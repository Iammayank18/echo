const { app, Tray, Menu } = require('electron');
const state = require('./state');
const machine = require('./recording-machine');
const { createTrayIcon } = require('./icons');
const { getPttKeyLabel, getSetting, setSetting, migrateToProfiles } = require('./settings');
const { createMainWindow } = require('./windows');

function updateTray() {
  if (!state.tray) return;
  state.tray.setImage(createTrayIcon(machine.isRecording(), machine.isTranscribing()));
}

function createTray() {
  state.tray = new Tray(createTrayIcon(false, false));
  state.tray.setToolTip('Echo - Voice Transcription');
  updateTrayMenu();
}

function updateTrayMenu() {
  const autoPaste = getSetting('autoPasteEnabled', true);

  const template = [
    {
      label: machine.isRecording()
        ? '⏹ Recording...'
        : machine.isTranscribing()
          ? '⏳ Transcribing...'
          : `🎙 Hold ${getPttKeyLabel()} to record`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Auto-paste',
      type: 'checkbox',
      checked: autoPaste,
      click: (menuItem) => {
        setSetting('autoPasteEnabled', menuItem.checked);
      },
    },
    ...buildProfileSubmenu(),
    { type: 'separator' },
    {
      label: 'Settings...',
      click: () => createMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit Echo',
      accelerator: 'CmdOrCtrl+Q',
      click: () => app.quit(),
    },
  ];

  state.tray.setContextMenu(Menu.buildFromTemplate(template));
}

function buildProfileSubmenu() {
  const profiles = getSetting('promptProfiles', null);
  if (!profiles || Object.keys(profiles).length === 0) return [];

  const activeId = getSetting('activeProfileId', 'default');
  const profileItems = Object.entries(profiles).map(([id, profile]) => ({
    label: profile.name,
    type: 'radio',
    checked: id === activeId,
    click: () => {
      setSetting('activeProfileId', id);
      updateTrayMenu();
    },
  }));

  return [
    { type: 'separator' },
    { label: 'Profile', enabled: false },
    ...profileItems,
  ];
}

module.exports = { createTray, updateTray, updateTrayMenu };
