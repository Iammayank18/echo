const { app, clipboard } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const state = require('./state');
const { getSetting } = require('./settings');

function getActiveWindowContext() {
  return new Promise((resolve) => {
    exec(
      `osascript -e 'tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        try
          set frontWindow to name of front window of (first application process whose frontmost is true)
        on error
          set frontWindow to "Unknown"
        end try
        return frontApp & " | " & frontWindow
      end tell'`,
      (err, stdout) => {
        if (err) {
          resolve('Unknown context');
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

function pasteText(text) {
  clipboard.writeText(text);
  const autoPaste = getSetting('autoPasteEnabled', true);
  if (autoPaste) {
    exec(
      `osascript -e 'delay 0.1' -e 'tell application "System Events" to keystroke "v" using command down'`
    );
  }
  return autoPaste;
}

function playCompletionSound() {
  const enabled = getSetting('completionSoundEnabled', true);
  if (!enabled) return;

  const soundFile = getSetting('completionSound', 'faaa.mp3');
  if (!soundFile || soundFile === 'none') return;

  const customPath = path.join(app.getPath('userData'), 'sounds', soundFile);
  const builtInPath = app.isPackaged
    ? path.join(process.resourcesPath, 'audio', soundFile)
    : path.join(__dirname, '..', '..', 'assets', 'audio', soundFile);

  const soundPath = fs.existsSync(customPath) ? customPath : builtInPath;
  if (!fs.existsSync(soundPath)) return;

  if (state.overlayWindow && !state.overlayWindow.isDestroyed()) {
    state.overlayWindow.webContents.send('play-sound', soundPath);
  }
}

module.exports = { getActiveWindowContext, pasteText, playCompletionSound };
