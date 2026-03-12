// ─── Permission helpers ─────────────────────────────────────────────────────
function showMicGranted(granted) {
  const btn = document.getElementById('grant-mic');
  const status = document.getElementById('mic-granted');
  const nextBtn = document.getElementById('step4-next');
  if (granted) {
    btn.style.display = 'none';
    status.style.display = 'flex';
    nextBtn.disabled = false;
  }
}

function showAccGranted(granted) {
  const btn = document.getElementById('grant-acc');
  const status = document.getElementById('acc-granted');
  const nextBtn = document.getElementById('step5-next');
  if (granted) {
    btn.style.display = 'none';
    status.style.display = 'flex';
    nextBtn.disabled = false;
  }
}

function showAccHint(show) {
  const hint = document.getElementById('acc-retry-hint');
  if (hint) hint.style.display = show ? 'block' : 'none';
}

async function checkSetupPermissions() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasAudio = devices.some((d) => d.kind === 'audioinput' && d.deviceId);
    if (hasAudio) showMicGranted(true);
  } catch {}

  try {
    const acc = await voiceAI.checkAccessibility();
    if (acc) showAccGranted(true);
  } catch {}
}

async function checkPermissions() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasAudio = devices.some((d) => d.kind === 'audioinput' && d.deviceId);
    const micEl = document.getElementById('perm-mic');
    if (micEl) {
      if (hasAudio) {
        micEl.textContent = 'Granted';
        micEl.className = 'perm-status granted';
      } else {
        micEl.textContent = 'Not determined';
        micEl.className = 'perm-status unknown';
      }
    }
  } catch {
    const micEl = document.getElementById('perm-mic');
    if (micEl) {
      micEl.textContent = 'Denied';
      micEl.className = 'perm-status denied';
    }
  }

  try {
    const acc = await voiceAI.checkAccessibility();
    const accEl = document.getElementById('perm-accessibility');
    if (accEl) {
      if (acc) {
        accEl.textContent = 'Granted';
        accEl.className = 'perm-status granted';
      } else {
        accEl.textContent = 'Not Granted';
        accEl.className = 'perm-status denied';
      }
    }
  } catch {}
}
