// ─── Key Code Mapping (DOM event.code → uiohook keycode) ───────────────────
const KEY_CODE_MAP = {
  'AltRight': { keycode: 3640, label: 'Right Option' },
  'MetaRight': { keycode: 3612, label: 'Right Cmd' },
  'AltLeft': { keycode: 56, label: 'Left Alt' },
  'ControlLeft': { keycode: 29, label: 'Left Ctrl' },
  'ControlRight': { keycode: 3613, label: 'Right Ctrl' },
  'ShiftLeft': { keycode: 42, label: 'Left Shift' },
  'ShiftRight': { keycode: 54, label: 'Right Shift' },
  'CapsLock': { keycode: 58, label: 'Caps Lock' },
  'F1': { keycode: 59, label: 'F1' },
  'F2': { keycode: 60, label: 'F2' },
  'F3': { keycode: 61, label: 'F3' },
  'F4': { keycode: 62, label: 'F4' },
  'F5': { keycode: 63, label: 'F5' },
  'F6': { keycode: 64, label: 'F6' },
  'F7': { keycode: 65, label: 'F7' },
  'F8': { keycode: 66, label: 'F8' },
  'F9': { keycode: 67, label: 'F9' },
  'F10': { keycode: 68, label: 'F10' },
  'F11': { keycode: 87, label: 'F11' },
  'F12': { keycode: 88, label: 'F12' },
};

function captureKeyFromDOM() {
  return new Promise((resolve) => {
    function onKeyDown(e) {
      e.preventDefault();
      document.removeEventListener('keydown', onKeyDown, true);
      const mapped = KEY_CODE_MAP[e.code];
      if (mapped) {
        resolve(mapped);
      } else {
        resolve({ keycode: null, label: e.code });
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
  });
}
