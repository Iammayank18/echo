// ─── Recording State Machine ────────────────────────────────────────────────
// Single source of truth for the recording lifecycle.
// Replaces scattered isRecording / isStartingRecording / isTranscribing booleans.

const STATES = {
  IDLE: 'idle',
  STARTING: 'starting',
  RECORDING: 'recording',
  TRANSCRIBING: 'transcribing',
  ERROR: 'error',
};

const VALID_TRANSITIONS = {
  idle: ['starting'],
  starting: ['recording', 'idle', 'error'],
  recording: ['transcribing', 'idle', 'error'],
  transcribing: ['idle', 'error'],
  error: ['idle'],
};

let currentState = STATES.IDLE;
let onTransition = null;

function getState() {
  return currentState;
}

function transition(newState, data = {}) {
  const allowed = VALID_TRANSITIONS[currentState];
  if (!allowed || !allowed.includes(newState)) {
    console.warn(`[StateMachine] Invalid transition: ${currentState} -> ${newState}`);
    return false;
  }
  const oldState = currentState;
  currentState = newState;
  console.log(`[StateMachine] ${oldState} -> ${newState}`, data);
  if (onTransition) onTransition(newState, oldState, data);
  return true;
}

function setTransitionHandler(handler) {
  onTransition = handler;
}

function isIdle() { return currentState === STATES.IDLE; }
function isRecording() { return currentState === STATES.RECORDING; }
function isTranscribing() { return currentState === STATES.TRANSCRIBING; }
function isBusy() { return currentState !== STATES.IDLE; }

module.exports = {
  STATES,
  transition,
  getState,
  setTransitionHandler,
  isIdle,
  isRecording,
  isTranscribing,
  isBusy,
};
