const overlay = document.getElementById('overlay');
const bars = document.querySelectorAll('.waveform-bar');

let currentState = null;
let currentStyle = 'pill';
let recordingStartTime = null;
let timerInterval = null;

// ─── Style initialization ───
function setStyle(style) {
  currentStyle = style || 'pill';
  document.body.className = `style-${currentStyle}`;
}

// ─── Timer ───
function startTimer() {
  recordingStartTime = Date.now();
  const timerEl = document.getElementById('pill-timer');
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!recordingStartTime || !timerEl) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }, 200);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  recordingStartTime = null;
}

// ─── State management ───
function showState(state, data) {
  currentState = state;
  overlay.classList.remove('hiding');

  if (state === 'hidden') {
    overlay.classList.add('hiding');
    stopTimer();
    setTimeout(() => overlay.classList.remove('visible', 'hiding'), 250);
    return;
  }

  const alreadyVisible = overlay.classList.contains('visible');

  // Always update content first (before making visible if new)
  if (currentStyle === 'pill') updatePill(state, data);
  else if (currentStyle === 'dot') updateDot(state, data);
  else if (currentStyle === 'bar') updateBar(state, data);
  else if (currentStyle === 'orb') updateOrb(state, data);

  if (!alreadyVisible) {
    // First show — animate in with fresh content
    overlay.classList.add('visible');
  }
  // If already visible — content already updated in-place, no re-animation
}

// ─── Pill updates ───
function updatePill(state, data) {
  document.getElementById('pill-recording').style.display = 'none';
  document.getElementById('pill-transcribing').style.display = 'none';
  document.getElementById('pill-done').style.display = 'none';
  document.getElementById('pill-error').style.display = 'none';

  switch (state) {
    case 'recording':
      document.getElementById('pill-recording').style.display = 'block';
      startTimer();
      break;
    case 'transcribing':
      document.getElementById('pill-transcribing').style.display = 'block';
      stopTimer();
      break;
    case 'done': {
      let doneText;
      if (data && data.message) {
        doneText = '\u2713 ' + data.message;
      } else if (data && data.pasted === false) {
        doneText = '\u2713 Copied!';
      } else {
        doneText = '\u2713 Pasted!';
      }
      document.querySelector('#pill-done .done-label').textContent = doneText;
      document.getElementById('pill-done').style.display = 'block';
      stopTimer();
      break;
    }
    case 'error':
      document.getElementById('pill-error-text').textContent = (data && data.message) || 'Error';
      document.getElementById('pill-error').style.display = 'block';
      stopTimer();
      break;
  }
}

// ─── Dot updates ───
function updateDot(state) {
  const dot = document.getElementById('dot-indicator');
  dot.className = 'indicator-dot ' + state;
}

// ─── Orb updates ───
function updateOrb(state) {
  const orb = document.getElementById('orb-sphere');
  orb.className = 'orb-sphere ' + state;
  if (state !== 'recording') {
    orb.style.setProperty('--orb-scale', 1);
    orb.style.boxShadow = '';
  }
  if (state === 'recording') startTimer();
  else stopTimer();
}

// ─── Bar updates ───
function updateBar(state, data) {
  const label = document.getElementById('bar-label');
  const line = document.getElementById('bar-line');

  label.className = 'bar-label';
  line.className = 'gradient-line';

  switch (state) {
    case 'recording':
      label.textContent = 'Recording';
      line.classList.add('recording');
      startTimer();
      break;
    case 'transcribing':
      label.textContent = 'Transcribing...';
      line.classList.add('transcribing');
      stopTimer();
      break;
    case 'done':
      label.textContent = data && data.message ? data.message : (data && data.pasted === false) ? 'Copied!' : 'Pasted!';
      label.classList.add('done');
      line.classList.add('done');
      stopTimer();
      break;
    case 'error':
      label.textContent = (data && data.message) || 'Error';
      label.classList.add('error');
      line.classList.add('error');
      stopTimer();
      break;
  }
}

// ─── Waveform (pill style) ───
function updateWaveform(level) {
  if (currentState !== 'recording') return;

  if (currentStyle === 'pill') {
    const baseHeight = 4;
    const maxHeight = 20;
    const range = maxHeight - baseHeight;

    bars.forEach((bar, i) => {
      const offset = Math.sin(Date.now() / 150 + i * 0.8) * 0.3;
      const normalizedLevel = Math.min(level * 3, 1);
      const barLevel = Math.max(0, normalizedLevel + offset);
      const height = baseHeight + barLevel * range;
      bar.style.height = `${height}px`;
    });
  } else if (currentStyle === 'bar') {
    const line = document.getElementById('bar-line');
    const intensity = Math.min(level * 4, 1);
    line.style.height = `${3 + intensity * 3}px`;
  } else if (currentStyle === 'orb') {
    const orb = document.getElementById('orb-sphere');
    const normalizedLevel = Math.min(level * 3, 1);
    const scale = 1 + normalizedLevel * 0.35;
    const g = 0.3 + normalizedLevel * 0.7;
    orb.style.setProperty('--orb-scale', scale);
    orb.style.boxShadow = `inset 0 -4px 8px rgba(0,0,0,0.4), inset 0 4px 8px rgba(255,255,255,0.1), 0 0 ${20 + g * 20}px rgba(74,144,217,${g}), 0 0 ${40 + g * 30}px rgba(74,144,217,${g * 0.6}), 0 0 ${60 + g * 40}px rgba(74,144,217,${g * 0.3})`;
  }
}

// ─── IPC listeners ───
if (window.voiceAI) {
  voiceAI.getOverlayStyle().then((style) => {
    setStyle(style);
  });

  voiceAI.onOverlayState((data) => {
    if (data.style) setStyle(data.style);
    showState(data.state, data);
  });

  voiceAI.onAudioLevel((level) => {
    updateWaveform(level);
  });

  voiceAI.onPlaySound((soundPath) => {
    const audio = new Audio('file://' + soundPath);
    audio.play().catch(() => {});
  });
}

// Idle animation
function idleAnimate() {
  if (currentState === 'recording') {
    updateWaveform(0.1);
  }
  requestAnimationFrame(idleAnimate);
}
idleAnimate();
