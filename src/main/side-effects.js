// ─── Centralized Side Effects ────────────────────────────────────────────────
// Single handler for all recording state transitions.
// Maps state changes to tray icon, tray menu, and overlay updates.
// No other file should call updateTray/updateTrayMenu/showOverlay/hideOverlay
// for recording-lifecycle reasons.

const { updateTray, updateTrayMenu } = require('./tray');
const { showOverlay, hideOverlay } = require('./windows');

let errorDismissTimer = null;
let doneDismissTimer = null;

function handleTransition(newState, oldState, data) {
  // Always update tray on any transition
  updateTray();
  updateTrayMenu();

  // Clear any pending dismiss timers
  if (errorDismissTimer) {
    clearTimeout(errorDismissTimer);
    errorDismissTimer = null;
  }
  if (doneDismissTimer) {
    clearTimeout(doneDismissTimer);
    doneDismissTimer = null;
  }

  switch (newState) {
    case 'starting':
      // No overlay yet — wait for hold threshold
      break;

    case 'recording':
      showOverlay('recording');
      break;

    case 'transcribing':
      showOverlay('transcribing');
      break;

    case 'idle':
      if (data.result === 'done') {
        showOverlay('done', { pasted: data.pasted });
        doneDismissTimer = setTimeout(() => {
          doneDismissTimer = null;
          hideOverlay();
        }, 1000);
      } else {
        hideOverlay();
      }
      break;

    case 'error':
      showOverlay('error', { message: data.message || 'Something went wrong' });
      errorDismissTimer = setTimeout(() => {
        errorDismissTimer = null;
        // Lazy require to avoid circular dependency
        const machine = require('./recording-machine');
        machine.transition('idle');
      }, 2500);
      break;
  }
}

module.exports = { handleTransition };
