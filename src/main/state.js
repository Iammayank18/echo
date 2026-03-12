// Shared mutable state for the main process.
// All modules require this and read/write directly.

module.exports = {
  // Electron object references
  tray: null,
  mainWindow: null,
  overlayWindow: null,
  quickActionsWindow: null,

  // PTT runtime (recording lifecycle lives in recording-machine.js)
  fnKeyHeld: false,
  fnHelperProcess: null,
  pttMethod: null, // 'fn-helper' | 'uiohook' | null
  lastTapTime: 0,
  quickActionMode: null,
};
