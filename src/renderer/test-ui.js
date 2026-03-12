// ─── Test Recording UI helpers ──────────────────────────────────────────────
function showTestState(state) {
  if (currentStep !== 9) return;

  const idle = document.getElementById('test-idle');
  const recording = document.getElementById('test-recording');
  const transcribing = document.getElementById('test-transcribing');
  const result = document.getElementById('test-result');

  if (idle) idle.style.display = state === 'idle' ? 'flex' : 'none';
  if (recording) recording.style.display = state === 'recording' ? 'flex' : 'none';
  if (transcribing) transcribing.style.display = state === 'transcribing' ? 'flex' : 'none';
  if (result) result.style.display = state === 'result' ? 'flex' : 'none';
}

function showTestResult(text) {
  if (currentStep !== 9) return;

  const resultText = document.getElementById('test-result-text');
  if (resultText) {
    resultText.textContent = text || '(empty transcription)';
  }
  const nextBtn = document.getElementById('step9-next');
  if (nextBtn) nextBtn.disabled = false;
  showTestState('result');
}
