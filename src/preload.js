const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voiceAI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getSetting: (key, defaultValue) => ipcRenderer.invoke('get-setting', key, defaultValue),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Validation
  validateGroqKey: (key) => ipcRenderer.invoke('validate-groq-key', key),
  validateOpenRouterKey: (key) => ipcRenderer.invoke('validate-openrouter-key', key),

  // Recording
  processAudio: (audioBuffer) => ipcRenderer.invoke('process-audio', audioBuffer),
  sendAudioLevel: (level) => ipcRenderer.send('audio-level', level),
  signalRecordingStarted: () => ipcRenderer.send('recording-started'),
  signalRecordingFailed: (error) => ipcRenderer.send('recording-failed', error),

  // Events from main process
  onStartRecording: (callback) => {
    ipcRenderer.on('start-recording', () => callback());
    return () => ipcRenderer.removeAllListeners('start-recording');
  },
  onStopRecording: (callback) => {
    ipcRenderer.on('stop-recording', () => callback());
    return () => ipcRenderer.removeAllListeners('stop-recording');
  },

  // Overlay events
  onOverlayState: (callback) => {
    ipcRenderer.on('overlay-state', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('overlay-state');
  },
  onAudioLevel: (callback) => {
    ipcRenderer.on('audio-level', (_, level) => callback(level));
    return () => ipcRenderer.removeAllListeners('audio-level');
  },

  // Permissions
  checkAccessibility: () => ipcRenderer.invoke('check-accessibility'),
  requestAccessibility: () => ipcRenderer.invoke('request-accessibility'),
  openAccessibilitySettings: () => ipcRenderer.invoke('open-accessibility-settings'),

  // Overlay
  getOverlayStyle: () => ipcRenderer.invoke('get-overlay-style'),

  // Push-to-Talk
  changePttKey: (key) => ipcRenderer.invoke('change-ptt-key', key),
  onPttFallback: (callback) => {
    ipcRenderer.on('ptt-fallback', (_, keyLabel) => callback(keyLabel));
    return () => ipcRenderer.removeAllListeners('ptt-fallback');
  },

  // Sound
  getSoundFiles: () => ipcRenderer.invoke('get-sound-files'),
  addCustomSound: () => ipcRenderer.invoke('add-custom-sound'),
  removeCustomSound: (filename) => ipcRenderer.invoke('remove-custom-sound', filename),
  onPlaySound: (callback) => {
    ipcRenderer.on('play-sound', (_, soundPath) => callback(soundPath));
    return () => ipcRenderer.removeAllListeners('play-sound');
  },

  // Quick Actions
  onQuickActionsShow: (callback) => {
    ipcRenderer.on('show-quick-actions', () => callback());
    return () => ipcRenderer.removeAllListeners('show-quick-actions');
  },
  selectQuickAction: (actionId) => ipcRenderer.send('quick-action-selected', actionId),

  // Profiles
  migrateProfiles: () => ipcRenderer.invoke('migrate-profiles'),

  // Clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  repasteText: (text) => ipcRenderer.invoke('repaste-text', text),

  // App lifecycle
  restartApp: () => ipcRenderer.invoke('restart-app'),

  // Window management
  showMainWindow: () => ipcRenderer.invoke('show-main-window'),
  completeSetup: () => ipcRenderer.invoke('complete-setup'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});
