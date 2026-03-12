const { BrowserWindow } = require('electron');
const path = require('path');
const state = require('./state');
const machine = require('./recording-machine');
const { STATES } = machine;
const { showQuickActionsMenu } = require('./windows');

const SRC_DIR = path.join(__dirname, '..');

// Module-local timers (no longer in global state)
let holdTimeout = null;
let startingTimeout = null;

function beginRecording() {
  if (!machine.isIdle()) return;

  console.log('[PTT] Begin recording');
  machine.transition(STATES.STARTING);

  // Require minimum hold duration (200ms) to avoid accidental taps
  holdTimeout = setTimeout(() => {
    holdTimeout = null;
    ensureHiddenRecorder();

    // Timeout fallback: if renderer never confirms within 5s, reset state
    startingTimeout = setTimeout(() => {
      if (machine.getState() === STATES.STARTING) {
        console.log('[PTT] Recording start timed out');
        machine.transition(STATES.ERROR, { message: 'Recording failed to start' });
      }
    }, 5000);
  }, 200);
}

function endRecording() {
  const currentState = machine.getState();
  if (currentState !== STATES.RECORDING && currentState !== STATES.STARTING) return;

  console.log('[PTT] End recording');

  // Key released before hold threshold — tap detected
  if (holdTimeout) {
    clearTimeout(holdTimeout);
    holdTimeout = null;
    machine.transition(STATES.IDLE);

    const now = Date.now();
    if (now - state.lastTapTime < 400) {
      // Double-tap: show quick actions
      state.lastTapTime = 0;
      showQuickActionsMenu();
    } else {
      state.lastTapTime = now;
    }
    return;
  }

  // Released during starting phase (after hold but before renderer confirmed)
  if (currentState === STATES.STARTING) {
    clearStartingTimeout();
    machine.transition(STATES.IDLE);
    return;
  }

  // Normal stop — send stop to renderer, state stays RECORDING
  // until process-audio fires and transitions to TRANSCRIBING
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send('stop-recording');
  }
}

function clearStartingTimeout() {
  if (startingTimeout) {
    clearTimeout(startingTimeout);
    startingTimeout = null;
  }
}

function ensureHiddenRecorder() {
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send('start-recording');
    return;
  }

  state.mainWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    webPreferences: {
      preload: path.join(SRC_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  state.mainWindow.loadFile(path.join(SRC_DIR, 'index.html'));
  state.mainWindow.webContents.once('did-finish-load', () => {
    state.mainWindow.webContents.send('start-recording');
  });

  state.mainWindow.on('closed', () => {
    state.mainWindow = null;
  });
}

module.exports = { beginRecording, endRecording, clearStartingTimeout };
