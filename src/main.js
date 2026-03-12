const { app } = require('electron');
const { getSetting } = require('./main/settings');
const { setupIPC } = require('./main/ipc');
const { createTray } = require('./main/tray');
const { createMainWindow, createOverlayWindow } = require('./main/windows');
const { setupPushToTalk, cleanupPushToTalk } = require('./main/ptt');
const machine = require('./main/recording-machine');
const { handleTransition } = require('./main/side-effects');

app.dock?.hide();

app.whenReady().then(() => {
  machine.setTransitionHandler(handleTransition);
  setupIPC();
  createTray();
  createOverlayWindow();

  const hasCompleted = getSetting('hasCompletedSetup', false);
  if (hasCompleted) {
    setupPushToTalk();
  } else {
    createMainWindow();
  }
});

app.on('will-quit', () => cleanupPushToTalk());

app.on('window-all-closed', (e) => {
  e?.preventDefault?.();
});

app.on('activate', () => createMainWindow());
