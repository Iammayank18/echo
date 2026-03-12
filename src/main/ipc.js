const { app, ipcMain, dialog, systemPreferences, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const state = require('./state');
const machine = require('./recording-machine');
const { STATES } = machine;
const { loadSettings, getSetting, setSetting, getActiveProfile, migrateToProfiles } = require('./settings');
const { createMainWindow, showOverlay, hideOverlay, hideQuickActionsMenu } = require('./windows');
const { setupPushToTalk, resetFnHelperBroken } = require('./ptt');
const { transcribeAudio } = require('./api-groq');
const { postProcessTranscript } = require('./api-openrouter');
const { getActiveWindowContext, pasteText, playCompletionSound } = require('./utils');
const { clearStartingTimeout } = require('./recording');

function setupIPC() {
  // ─── Settings ───
  ipcMain.handle('get-settings', () => loadSettings());

  ipcMain.handle('set-setting', (_, key, value) => {
    setSetting(key, value);
    return true;
  });

  ipcMain.handle('get-setting', (_, key, defaultValue) => getSetting(key, defaultValue));

  // ─── API Key Validation ───
  ipcMain.handle('validate-groq-key', async (_, apiKey) => {
    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'api.groq.com',
          path: '/openai/v1/models',
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(res.statusCode === 200));
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  });

  ipcMain.handle('validate-openrouter-key', async (_, apiKey) => {
    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'openrouter.ai',
          path: '/api/v1/models',
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(res.statusCode === 200));
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  });

  // ─── Audio Processing Pipeline ───
  const PIPELINE_TIMEOUT_MS = 60000;

  ipcMain.handle('process-audio', async (_, audioArrayBuffer) => {
    const audioBuffer = Buffer.from(audioArrayBuffer);

    if (audioBuffer.length < 1000) {
      machine.transition(STATES.IDLE);
      return { error: 'Recording too short' };
    }

    machine.transition(STATES.TRANSCRIBING);

    let pipelineTimer;
    const pipelineTimeout = new Promise((_, reject) => {
      pipelineTimer = setTimeout(() => reject(new Error('Pipeline timed out')), PIPELINE_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([
        (async () => {
          const context = await getActiveWindowContext();
          const lang = getSetting('transcriptionLanguage', 'auto');
          const rawTranscript = await transcribeAudio(audioBuffer, 'audio/webm', lang);

          if (!rawTranscript || !rawTranscript.trim()) {
            machine.transition(STATES.IDLE);
            return { error: 'Empty transcription' };
          }

          const profile = getActiveProfile(context);
          const action = state.quickActionMode || null;
          state.quickActionMode = null;

          const cleanText = await postProcessTranscript(rawTranscript, context, profile, action);

          if (cleanText && cleanText.trim()) {
            const didPaste = pasteText(cleanText.trim());
            playCompletionSound();
            machine.transition(STATES.IDLE, { result: 'done', pasted: didPaste });
            return { rawTranscript, cleanText: cleanText.trim(), context, profileName: profile.name };
          } else {
            machine.transition(STATES.IDLE);
            return { error: 'Empty result after processing' };
          }
        })(),
        pipelineTimeout,
      ]);
      clearTimeout(pipelineTimer);
      return result;
    } catch (err) {
      clearTimeout(pipelineTimer);
      console.error('Pipeline error:', err);
      machine.transition(STATES.ERROR, { message: err.message });
      return { error: err.message };
    }
  });

  // ─── Recording Events ───
  ipcMain.on('audio-level', (_, level) => {
    if (state.overlayWindow && !state.overlayWindow.isDestroyed()) {
      state.overlayWindow.webContents.send('audio-level', level);
    }
  });

  ipcMain.on('recording-stopped', () => {});

  ipcMain.on('recording-started', () => {
    clearStartingTimeout();
    machine.transition(STATES.RECORDING);
  });

  ipcMain.on('recording-failed', (_, error) => {
    clearStartingTimeout();
    machine.transition(STATES.ERROR, { message: error || 'Microphone access failed' });
  });

  // ─── Permissions ───
  ipcMain.handle('check-accessibility', () => {
    return systemPreferences.isTrustedAccessibilityClient(false);
  });

  ipcMain.handle('request-accessibility', () => {
    return systemPreferences.isTrustedAccessibilityClient(true);
  });

  ipcMain.handle('open-accessibility-settings', () => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  });

  // ─── Window & App ───
  ipcMain.handle('get-overlay-style', () => getSetting('overlayStyle', 'pill'));

  ipcMain.handle('show-main-window', () => createMainWindow());

  ipcMain.handle('complete-setup', () => {
    setSetting('hasCompletedSetup', true);
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.hide();
    }
    setupPushToTalk();
  });

  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('change-ptt-key', (_, newKey) => {
    if (newKey === 'fn') resetFnHelperBroken();
    setSetting('pttKey', newKey);
    setupPushToTalk();
    return true;
  });

  // ─── Quick Actions ───
  ipcMain.on('quick-action-selected', (_, actionId) => {
    hideQuickActionsMenu();
    if (!actionId) return; // Escape pressed, cancel

    state.quickActionMode = actionId;
    // Brief overlay confirmation of selected action
    const actionLabels = {
      summarize: 'Summarize',
      bullets: 'Bullet Points',
      translate: 'Translate',
      reply: 'Reply',
      'just-transcribe': 'Just Transcribe',
    };
    const label = actionLabels[actionId] || actionId;
    showOverlay('done', { message: label, pasted: true });
    setTimeout(() => hideOverlay(), 800);
  });

  // ─── Profiles ───
  ipcMain.handle('migrate-profiles', () => {
    return migrateToProfiles();
  });

  // ─── Clipboard ───
  ipcMain.handle('copy-to-clipboard', (_, text) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('repaste-text', (_, text) => {
    pasteText(text);
    return true;
  });

  // ─── Sound Management ───
  ipcMain.handle('get-sound-files', () => {
    const builtInDir = app.isPackaged
      ? path.join(process.resourcesPath, 'audio')
      : path.join(__dirname, '..', '..', 'assets', 'audio');
    const customDir = path.join(app.getPath('userData'), 'sounds');

    const sounds = [];

    if (fs.existsSync(builtInDir)) {
      for (const file of fs.readdirSync(builtInDir)) {
        if (/\.(mp3|wav|ogg|m4a)$/i.test(file)) {
          sounds.push({
            name: path.parse(file).name,
            filename: file,
            path: path.join(builtInDir, file),
            builtin: true,
          });
        }
      }
    }

    if (fs.existsSync(customDir)) {
      for (const file of fs.readdirSync(customDir)) {
        if (/\.(mp3|wav|ogg|m4a)$/i.test(file)) {
          sounds.push({
            name: path.parse(file).name,
            filename: file,
            path: path.join(customDir, file),
            builtin: false,
          });
        }
      }
    }

    return sounds;
  });

  ipcMain.handle('add-custom-sound', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Sound File',
      filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const srcPath = result.filePaths[0];
    const customDir = path.join(app.getPath('userData'), 'sounds');
    if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });

    const filename = path.basename(srcPath);
    const destPath = path.join(customDir, filename);
    fs.copyFileSync(srcPath, destPath);

    return {
      name: path.parse(filename).name,
      filename,
      path: destPath,
      builtin: false,
    };
  });

  ipcMain.handle('remove-custom-sound', (_, filename) => {
    const customDir = path.join(app.getPath('userData'), 'sounds');
    const filePath = path.join(customDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  });
}

module.exports = { setupIPC };
