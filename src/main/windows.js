const { BrowserWindow, screen, shell } = require('electron');
const path = require('path');
const state = require('./state');
const { getSetting } = require('./settings');

const SRC_DIR = path.join(__dirname, '..');

// Overlay crash-loop rate limiting
const OVERLAY_MAX_RECREATIONS = 3;
const OVERLAY_RATE_WINDOW_MS = 30000;
let overlayRecreationTimestamps = [];

// Pending overlay show state (dedup multiple showOverlay calls while loading)
let pendingOverlayState = null;
let overlayLoadTimeout = null;

function createMainWindow() {
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    const [w, h] = state.mainWindow.getSize();
    if (w > 100 && h > 100) {
      state.mainWindow.show();
      state.mainWindow.focus();
      return;
    }
    state.mainWindow.destroy();
    state.mainWindow = null;
  }

  state.mainWindow = new BrowserWindow({
    width: 600,
    height: 680,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'sidebar',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(SRC_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  state.mainWindow.loadFile(path.join(SRC_DIR, 'index.html'));

  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  state.mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  state.mainWindow.once('ready-to-show', () => {
    state.mainWindow.show();
  });

  state.mainWindow.on('closed', () => {
    state.mainWindow = null;
  });
}

function isOverlayHealthy() {
  return state.overlayWindow
    && !state.overlayWindow.isDestroyed()
    && !state.overlayWindow.webContents.isCrashed();
}

function destroyOverlay() {
  if (overlayLoadTimeout) {
    clearTimeout(overlayLoadTimeout);
    overlayLoadTimeout = null;
  }
  pendingOverlayState = null;
  if (state.overlayWindow && !state.overlayWindow.isDestroyed()) {
    state.overlayWindow.destroy();
  }
  state.overlayWindow = null;
}

function canRecreateOverlay() {
  const now = Date.now();
  overlayRecreationTimestamps = overlayRecreationTimestamps.filter(
    t => now - t < OVERLAY_RATE_WINDOW_MS
  );
  return overlayRecreationTimestamps.length < OVERLAY_MAX_RECREATIONS;
}

function getActiveDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function createOverlayWindow() {
  if (isOverlayHealthy()) return;

  // Clean up dead window if it exists
  if (state.overlayWindow) {
    destroyOverlay();
  }

  if (!canRecreateOverlay()) {
    console.warn('Overlay recreation rate limit reached, skipping');
    return;
  }
  overlayRecreationTimestamps.push(Date.now());

  const display = getActiveDisplay();
  const { width: screenWidth } = display.workAreaSize;
  const { x: screenX } = display.workArea;
  const width = 320;
  const height = 120;

  state.overlayWindow = new BrowserWindow({
    width,
    height,
    x: screenX + Math.floor(screenWidth / 2 - width / 2),
    y: -52,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(SRC_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  state.overlayWindow.setIgnoreMouseEvents(true);
  state.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  state.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  state.overlayWindow.loadFile(path.join(SRC_DIR, 'overlay.html'));

  // Crash/failure recovery handlers
  state.overlayWindow.webContents.on('render-process-gone', (_event, details) => {
    console.warn('Overlay renderer crashed:', details.reason);
    destroyOverlay();
  });

  state.overlayWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.warn('Overlay failed to load:', errorCode, errorDescription);
    destroyOverlay();
  });

  state.overlayWindow.on('closed', () => {
    state.overlayWindow = null;
    pendingOverlayState = null;
    if (overlayLoadTimeout) {
      clearTimeout(overlayLoadTimeout);
      overlayLoadTimeout = null;
    }
  });
}

function showOverlay(overlayState, data = {}) {
  // If window exists but renderer is dead, destroy and recreate
  if (state.overlayWindow && !isOverlayHealthy()) {
    destroyOverlay();
  }

  if (!state.overlayWindow) {
    createOverlayWindow();
  }

  // If creation was rate-limited, bail out
  if (!state.overlayWindow) return;

  const send = () => {
    if (!isOverlayHealthy()) return;

    // Reposition to active screen each time
    const display = getActiveDisplay();
    const { width: screenWidth } = display.workAreaSize;
    const { x: screenX } = display.workArea;
    const overlayWidth = 320;
    state.overlayWindow.setPosition(
      screenX + Math.floor(screenWidth / 2 - overlayWidth / 2),
      -52
    );

    const style = getSetting('overlayStyle', 'pill');
    state.overlayWindow.webContents.send('overlay-state', { state: overlayState, style, ...data });
    if (!state.overlayWindow.isVisible()) {
      state.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      state.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      state.overlayWindow.moveTop();
      state.overlayWindow.showInactive();
    } else {
      state.overlayWindow.moveTop();
    }
  };

  if (state.overlayWindow.webContents.isLoading()) {
    // Replace any previous pending state (dedup)
    pendingOverlayState = { overlayState, data };

    // Only attach the listener + timeout once while loading
    if (!overlayLoadTimeout) {
      state.overlayWindow.webContents.once('did-finish-load', () => {
        if (overlayLoadTimeout) {
          clearTimeout(overlayLoadTimeout);
          overlayLoadTimeout = null;
        }
        if (pendingOverlayState && isOverlayHealthy()) {
          const pending = pendingOverlayState;
          pendingOverlayState = null;
          showOverlay(pending.overlayState, pending.data);
        }
      });

      // 5s timeout: if overlay doesn't finish loading, destroy and recreate
      overlayLoadTimeout = setTimeout(() => {
        overlayLoadTimeout = null;
        if (state.overlayWindow && state.overlayWindow.webContents.isLoading()) {
          console.warn('Overlay load timed out, destroying and recreating');
          const pending = pendingOverlayState;
          destroyOverlay();
          if (pending) {
            showOverlay(pending.overlayState, pending.data);
          }
        }
      }, 5000);
    }
  } else {
    pendingOverlayState = null;
    send();
  }
}

function hideOverlay() {
  if (!state.overlayWindow || state.overlayWindow.isDestroyed()) return;
  if (!state.overlayWindow.isVisible()) return;

  // Trigger slideOut animation in renderer
  if (isOverlayHealthy()) {
    state.overlayWindow.webContents.send('overlay-state', { state: 'hidden' });
  }

  // Hide BrowserWindow after animation completes
  setTimeout(() => {
    if (state.overlayWindow && !state.overlayWindow.isDestroyed()) {
      state.overlayWindow.hide();
    }
  }, 300);
}

function createQuickActionsWindow() {
  if (state.quickActionsWindow && !state.quickActionsWindow.isDestroyed()) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const width = 220;
  const height = 260;

  state.quickActionsWindow = new BrowserWindow({
    width,
    height,
    x: Math.floor(screenWidth / 2 - width / 2),
    y: 8,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    focusable: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(SRC_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  state.quickActionsWindow.setAlwaysOnTop(true, 'screen-saver');
  state.quickActionsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  state.quickActionsWindow.loadFile(path.join(SRC_DIR, 'quick-actions.html'));

  state.quickActionsWindow.on('blur', () => {
    hideQuickActionsMenu();
  });

  state.quickActionsWindow.on('closed', () => {
    state.quickActionsWindow = null;
  });
}

function showQuickActionsMenu() {
  if (!state.quickActionsWindow || state.quickActionsWindow.isDestroyed()) {
    createQuickActionsWindow();
  }

  const show = () => {
    if (state.quickActionsWindow && !state.quickActionsWindow.isDestroyed()) {
      state.quickActionsWindow.webContents.send('show-quick-actions');
      state.quickActionsWindow.show();
      state.quickActionsWindow.focus();
    }
  };

  if (state.quickActionsWindow.webContents.isLoading()) {
    state.quickActionsWindow.webContents.once('did-finish-load', show);
  } else {
    show();
  }
}

function hideQuickActionsMenu() {
  if (state.quickActionsWindow && !state.quickActionsWindow.isDestroyed()) {
    state.quickActionsWindow.hide();
  }
}

module.exports = { createMainWindow, createOverlayWindow, showOverlay, hideOverlay, showQuickActionsMenu, hideQuickActionsMenu };
