// ─── Setup Wizard ───────────────────────────────────────────────────────────
function showStep(step) {
  currentStep = step;
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.style.display = i === step ? 'flex' : 'none';
  }
  updateDots();
}

function updateDots() {
  const dots = document.querySelectorAll('.dot-ind');
  dots.forEach((dot, i) => {
    dot.className = 'dot-ind';
    if (i + 1 === currentStep) dot.classList.add('active');
    else if (i + 1 < currentStep) dot.classList.add('done');
  });
}

function setupWizardListeners() {
  // ─── Step 1: Welcome ───
  document.getElementById('step1-next').addEventListener('click', () => showStep(2));

  // ─── Step 2: Groq Validation ───
  document.getElementById('validate-groq').addEventListener('click', async () => {
    const key = document.getElementById('setup-groq-key').value.trim();
    const status = document.getElementById('groq-status');
    const nextBtn = document.getElementById('step2-next');

    if (!key) {
      status.textContent = 'Please enter an API key';
      status.className = 'status-msg error';
      return;
    }

    status.textContent = 'Validating...';
    status.className = 'status-msg loading';

    const valid = await voiceAI.validateGroqKey(key);
    if (valid) {
      status.textContent = 'Valid! Key verified successfully.';
      status.className = 'status-msg success';
      nextBtn.disabled = false;
      await voiceAI.setSetting('groqApiKey', key);
    } else {
      status.textContent = 'Invalid key. Please check and try again.';
      status.className = 'status-msg error';
      nextBtn.disabled = true;
    }
  });

  document.getElementById('setup-groq-key').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('validate-groq').click();
  });

  document.getElementById('step2-back').addEventListener('click', () => showStep(1));
  document.getElementById('step2-next').addEventListener('click', () => showStep(3));

  // ─── Step 3: OpenRouter Validation ───
  document.getElementById('validate-openrouter').addEventListener('click', async () => {
    const key = document.getElementById('setup-openrouter-key').value.trim();
    const status = document.getElementById('openrouter-status');

    if (!key) {
      status.textContent = 'No key entered — post-processing will be skipped.';
      status.className = 'status-msg loading';
      return;
    }

    status.textContent = 'Validating...';
    status.className = 'status-msg loading';

    const valid = await voiceAI.validateOpenRouterKey(key);
    if (valid) {
      status.textContent = 'Valid! Key verified successfully.';
      status.className = 'status-msg success';
      await voiceAI.setSetting('openRouterApiKey', key);
    } else {
      status.textContent = 'Invalid key. Please check and try again.';
      status.className = 'status-msg error';
    }
  });

  document.getElementById('setup-openrouter-key').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('validate-openrouter').click();
  });

  document.getElementById('step3-back').addEventListener('click', () => showStep(2));
  document.getElementById('step3-next').addEventListener('click', async () => {
    const key = document.getElementById('setup-openrouter-key').value.trim();
    if (key) await voiceAI.setSetting('openRouterApiKey', key);
    showStep(4);
  });

  // ─── Step 4: Microphone ───
  document.getElementById('grant-mic').addEventListener('click', async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      showMicGranted(true);
    } catch {
      showMicGranted(false);
    }
  });

  document.getElementById('step4-back').addEventListener('click', () => showStep(3));
  document.getElementById('step4-next').addEventListener('click', () => showStep(5));

  // ─── Step 5: Accessibility ───
  document.getElementById('grant-acc').addEventListener('click', async () => {
    const btn = document.getElementById('grant-acc');
    const granted = await voiceAI.requestAccessibility();
    showAccGranted(granted);
    if (!granted) {
      // Open System Settings directly so user doesn't have to navigate
      await voiceAI.openAccessibilitySettings();
      btn.textContent = 'Checking...';
      btn.disabled = true;
      showAccHint(false);
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const check = await voiceAI.checkAccessibility();
        if (check) {
          showAccGranted(true);
          showAccHint(false);
          clearInterval(poll);
        }
        if (attempts > 30) {
          clearInterval(poll);
          btn.textContent = 'Check Again';
          btn.disabled = false;
          showAccHint(true);
        }
      }, 1000);
    }
  });

  document.getElementById('restart-app-btn')?.addEventListener('click', async () => {
    await voiceAI.restartApp();
  });

  document.getElementById('step5-back').addEventListener('click', () => showStep(4));
  document.getElementById('step5-next').addEventListener('click', () => showStep(6));

  // ─── Step 6: Push-to-Talk Key ───
  const wizardKeyOptions = document.querySelectorAll('#step-6 .key-option');
  const wizardCustomInput = document.getElementById('ptt-custom-key-input');
  const wizardFnTip = document.getElementById('fn-tip');

  function selectWizardKeyOption(value, customLabel) {
    wizardKeyOptions.forEach(opt => {
      const radio = opt.querySelector('input[type="radio"]');
      const isMatch = radio.value === value;
      opt.classList.toggle('selected', isMatch);
      radio.checked = isMatch;
    });
    wizardCustomInput.style.display = value === 'custom' ? 'block' : 'none';
    if (customLabel) wizardCustomInput.value = customLabel;
    wizardFnTip.style.display = value === 'fn' ? 'block' : 'none';
  }

  async function initPttKeyDisplay() {
    const key = await voiceAI.getSetting('pttKey', 'fn');
    if (key === 'fn') {
      selectWizardKeyOption('fn');
    } else if (key === 'right-option') {
      selectWizardKeyOption('right-option');
    } else if (typeof key === 'object' && key.label) {
      selectWizardKeyOption('custom', key.label);
    } else {
      selectWizardKeyOption('fn');
    }
  }
  initPttKeyDisplay();

  document.querySelectorAll('#step-6 .key-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      const value = radio.value;
      selectWizardKeyOption(value);
      if (value === 'fn' || value === 'right-option') {
        await voiceAI.setSetting('pttKey', value);
      }
    });
  });

  let wizardCapturing = false;
  wizardCustomInput.addEventListener('click', async () => {
    if (wizardCapturing) return;
    wizardCapturing = true;
    try {
      wizardCustomInput.classList.add('capturing');
      wizardCustomInput.value = '';
      wizardCustomInput.placeholder = 'Press any key...';

      const result = await captureKeyFromDOM();

      wizardCustomInput.classList.remove('capturing');
      wizardCustomInput.value = result.label;
      wizardCustomInput.placeholder = 'Click to set key...';
      await voiceAI.setSetting('pttKey', { type: 'custom', keycode: result.keycode, label: result.label });
    } finally {
      wizardCapturing = false;
    }
  });

  document.getElementById('step6-back').addEventListener('click', () => showStep(5));
  document.getElementById('step6-next').addEventListener('click', async () => {
    const key = await voiceAI.getSetting('pttKey', 'fn');
    let label = 'Fn';
    if (typeof key === 'object' && key.label) label = key.label;
    else { const labels = { fn: 'Fn', 'right-option': 'Right Option', f5: 'F5' }; label = labels[key] || key; }
    document.getElementById('test-key-label').textContent = label;

    showStep(7);
  });

  // ─── Step 7: Custom Vocabulary ───
  document.getElementById('step7-back').addEventListener('click', () => showStep(6));
  document.getElementById('step7-next').addEventListener('click', async () => {
    const vocab = document.getElementById('setup-vocabulary').value;
    if (vocab.trim()) await voiceAI.setSetting('customVocabulary', vocab);
    showStep(8);
  });

  // ─── Step 8: Indicator Style ───
  document.querySelectorAll('#step-8 .style-option').forEach((option) => {
    option.addEventListener('click', () => {
      document.querySelectorAll('#step-8 .style-option').forEach((o) => o.classList.remove('selected'));
      option.classList.add('selected');
      option.querySelector('input[type="radio"]').checked = true;
    });
  });

  document.getElementById('step8-back').addEventListener('click', () => showStep(7));
  document.getElementById('step8-next').addEventListener('click', async () => {
    const selected = document.querySelector('input[name="overlay-style"]:checked').value;
    await voiceAI.setSetting('overlayStyle', selected);
    showStep(9);
    // Initialize PTT right before the test step so the watchdog timer
    // starts when the user is actually ready to press the key
    const pttKey = await voiceAI.getSetting('pttKey', 'fn');
    await voiceAI.changePttKey(pttKey);
  });

  // ─── Step 9: Test Recording ───
  // Update test key label if PTT falls back (e.g. Fn → Right Option on macOS 15)
  voiceAI.onPttFallback((keyLabel) => {
    const el = document.getElementById('test-key-label');
    if (el) el.textContent = keyLabel;
  });

  document.getElementById('step9-back').addEventListener('click', () => showStep(8));
  document.getElementById('step9-skip').addEventListener('click', () => showStep(10));
  document.getElementById('step9-next').addEventListener('click', () => showStep(10));

  // ─── Step 10: Finish ───
  document.getElementById('finish-setup').addEventListener('click', async () => {
    await voiceAI.completeSetup();
    showView('settings');
    await loadSettings();
  });

  // Check initial permission states for step 4 & 5
  checkSetupPermissions();
}
