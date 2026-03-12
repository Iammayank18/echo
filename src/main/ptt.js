const { app, systemPreferences, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { uIOhook } = require('uiohook-napi');
const state = require('./state');
const { getSetting } = require('./settings');
const { beginRecording, endRecording } = require('./recording');
const { showOverlay, hideOverlay } = require('./windows');

const RIGHT_OPTION_KEYCODE = 3640;
let fnHelperWatchdog = null;
let fnHelperBroken = false; // module-local — not in settings.json
const SRC_DIR = path.join(__dirname, '..');

function checkAccessibilityPermission() {
  const trusted = systemPreferences.isTrustedAccessibilityClient(true);
  console.log(`[PTT] Accessibility permission: ${trusted ? 'granted' : 'NOT granted'}`);
  return trusted;
}

function cleanupPushToTalk() {
  if (fnHelperWatchdog) {
    clearTimeout(fnHelperWatchdog);
    fnHelperWatchdog = null;
  }
  if (accessibilityPollTimer) {
    clearInterval(accessibilityPollTimer);
    accessibilityPollTimer = null;
  }
  if (state.fnHelperProcess) {
    try { state.fnHelperProcess.kill(); } catch {}
    state.fnHelperProcess = null;
  }
  if (state.pttMethod === 'uiohook') {
    try { uIOhook.stop(); } catch {}
    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('keyup');
  }
  state.pttMethod = null;
  state.fnKeyHeld = false;
}

let accessibilityPollTimer = null;

function waitForAccessibility() {
  if (accessibilityPollTimer) return;
  console.log('[PTT] Waiting for accessibility permission...');

  accessibilityPollTimer = setInterval(() => {
    if (systemPreferences.isTrustedAccessibilityClient(false)) {
      console.log('[PTT] Accessibility permission granted — starting PTT');
      clearInterval(accessibilityPollTimer);
      accessibilityPollTimer = null;
      setupPushToTalk();
    }
  }, 2000);
}

function openAccessibilitySettings() {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
}

function setupPushToTalk() {
  cleanupPushToTalk();

  // Log diagnostics
  console.log(`[PTT] macOS version: ${process.getSystemVersion()}`);
  console.log(`[PTT] Electron version: ${process.versions.electron}`);
  console.log(`[PTT] Arch: ${process.arch}`);

  if (!checkAccessibilityPermission()) {
    console.log('[PTT] Accessibility permission required — polling for grant');
    showOverlay('error', { message: 'Grant Accessibility in System Settings' });
    openAccessibilitySettings();
    waitForAccessibility();
    return;
  }

  const pttKey = getSetting('pttKey', 'fn');
  console.log(`[PTT] Push-to-talk key: ${JSON.stringify(pttKey)}`);

  if (pttKey === 'fn') {
    if (fnHelperBroken) {
      console.log('[PTT] Fn helper previously failed — using Right Option');
      startUiohookFallback(RIGHT_OPTION_KEYCODE);
      return;
    }
    const fnHelperPath = app.isPackaged
      ? path.join(process.resourcesPath, 'fn-helper')
      : path.join(SRC_DIR, 'fn-helper');
    if (fs.existsSync(fnHelperPath)) {
      try {
        startFnHelper(fnHelperPath);
        return;
      } catch (err) {
        console.error('[PTT] Fn helper failed to start:', err.message);
      }
    } else {
      console.log('[PTT] Fn helper binary not found at', fnHelperPath);
    }
    startUiohookFallback(RIGHT_OPTION_KEYCODE);
  } else if (typeof pttKey === 'object' && pttKey.keycode) {
    startUiohookFallback(pttKey.keycode);
  } else if (pttKey === 'right-option') {
    startUiohookFallback(RIGHT_OPTION_KEYCODE);
  } else if (pttKey === 'f5') {
    startUiohookFallback(63);
  } else {
    startUiohookFallback(RIGHT_OPTION_KEYCODE);
  }
}

function startFnHelper(helperPath) {
  console.log('[PTT] Starting Fn key helper...');
  state.fnHelperProcess = spawn(helperPath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let started = false;

  state.fnHelperProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'ready') {
        started = true;
        state.pttMethod = 'fn-helper';
        console.log('[PTT] Fn helper started — hold Fn key to record');
        // Watchdog: if no key events within 5s, fn-helper can't receive events (macOS 15+)
        fnHelperWatchdog = setTimeout(() => {
          fnHelperWatchdog = null;
          console.log('[PTT] Fn helper not responding — switching to Right Option');
          fnHelperBroken = true;
          try { state.fnHelperProcess.kill(); } catch {}
          state.fnHelperProcess = null;
          showOverlay('done', { message: 'Switched to Right Option key' });
          setTimeout(() => hideOverlay(), 2000);
          if (state.mainWindow && !state.mainWindow.isDestroyed()) {
            state.mainWindow.webContents.send('ptt-fallback', 'Right Option');
          }
          startUiohookFallback(RIGHT_OPTION_KEYCODE);
        }, 5000);
        continue;
      }
      if (trimmed === 'down' && !state.fnKeyHeld) {
        if (fnHelperWatchdog) {
          clearTimeout(fnHelperWatchdog);
          fnHelperWatchdog = null;
        }
        state.fnKeyHeld = true;
        beginRecording();
      } else if (trimmed === 'up' && state.fnKeyHeld) {
        state.fnKeyHeld = false;
        endRecording();
      }
    }
  });

  state.fnHelperProcess.stderr.on('data', (data) => {
    console.error('[PTT] Fn helper stderr:', data.toString().trim());
  });

  state.fnHelperProcess.on('error', (err) => {
    console.error('[PTT] Fn helper process error:', err.message);
    state.fnHelperProcess = null;
    startUiohookFallback();
  });

  state.fnHelperProcess.on('exit', (code) => {
    console.log(`[PTT] Fn helper exited with code ${code}`);
    state.fnHelperProcess = null;
    if (!started) {
      startUiohookFallback();
    }
  });
}

function startUiohookFallback(keycode) {
  state.pttMethod = 'uiohook';
  console.log(`[PTT] Using uiohook-napi with keycode ${keycode}`);

  uIOhook.on('keydown', (e) => {
    if (e.keycode === keycode && !state.fnKeyHeld) {
      state.fnKeyHeld = true;
      beginRecording();
    }
  });

  uIOhook.on('keyup', (e) => {
    if (e.keycode === keycode && state.fnKeyHeld) {
      state.fnKeyHeld = false;
      endRecording();
    }
  });

  uIOhook.start();
  console.log('[PTT] uiohook started');
}

function resetFnHelperBroken() {
  fnHelperBroken = false;
}

module.exports = { setupPushToTalk, cleanupPushToTalk, resetFnHelperBroken };
