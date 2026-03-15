// ─── Settings UI ────────────────────────────────────────────────────────────
async function loadSettings() {
  const settings = await voiceAI.getSettings();

  document.getElementById('settings-groq-key').value = settings.groqApiKey || '';
  document.getElementById('settings-openrouter-key').value = settings.openRouterApiKey || '';
  document.getElementById('settings-vocabulary').value = settings.customVocabulary || '';

  if (settings.openRouterModel) {
    document.getElementById('settings-model').value = settings.openRouterModel;
  }

  // Load language settings
  const transLangSelect = document.getElementById('settings-transcription-language');
  if (transLangSelect) {
    transLangSelect.value = settings.transcriptionLanguage || 'auto';
  }
  const translateLangSelect = document.getElementById('settings-translate-language');
  if (translateLangSelect) {
    translateLangSelect.value = settings.translateTargetLanguage || 'en';
  }

  // Update PTT key selection
  const pttKey = settings.pttKey;
  let pttValue = 'fn';
  let pttCustomLabel = null;
  if (pttKey === 'right-option') {
    pttValue = 'right-option';
  } else if (typeof pttKey === 'object' && pttKey.label) {
    pttValue = 'custom';
    pttCustomLabel = pttKey.label;
  }
  const settingsKeyOpts = document.querySelectorAll('.setting-card .key-option');
  settingsKeyOpts.forEach(opt => {
    const radio = opt.querySelector('input[type="radio"]');
    const isMatch = radio.value === pttValue;
    opt.classList.toggle('selected', isMatch);
    radio.checked = isMatch;
  });
  const sCustomInput = document.getElementById('settings-ptt-custom-key-input');
  if (sCustomInput) {
    sCustomInput.style.display = pttValue === 'custom' ? 'block' : 'none';
    if (pttCustomLabel) sCustomInput.value = pttCustomLabel;
  }
  const sFnTip = document.getElementById('settings-fn-tip');
  if (sFnTip) sFnTip.style.display = pttValue === 'fn' ? 'block' : 'none';

  // Update overlay style selection
  const currentStyle = settings.overlayStyle || 'pill';
  document.querySelectorAll('.settings-style-options .style-option').forEach((opt) => {
    const radio = opt.querySelector('input[type="radio"]');
    if (radio.value === currentStyle) {
      opt.classList.add('selected');
      radio.checked = true;
    } else {
      opt.classList.remove('selected');
      radio.checked = false;
    }
  });

  // Load auto-paste setting
  const autoPasteCheckbox = document.getElementById('settings-auto-paste');
  if (autoPasteCheckbox) {
    autoPasteCheckbox.checked = settings.autoPasteEnabled !== undefined ? settings.autoPasteEnabled : true;
  }

  // Load developer mode setting
  const devModeCheckbox = document.getElementById('settings-developer-mode');
  if (devModeCheckbox) {
    devModeCheckbox.checked = settings.developerMode === true;
  }

  // Load sound settings
  await loadSoundOptions();
  const soundCheckbox = document.getElementById('settings-sound-enabled');
  if (soundCheckbox && !soundCheckbox.checked) {
    const soundContainer = document.getElementById('sound-options');
    const addBtnEl = document.getElementById('add-custom-sound');
    if (soundContainer) { soundContainer.style.opacity = '0.4'; soundContainer.style.pointerEvents = 'none'; }
    if (addBtnEl) { addBtnEl.style.opacity = '0.4'; addBtnEl.style.pointerEvents = 'none'; }
  }

  loadHistory();
}

function setupSettingsListeners() {
  // ─── Tab Navigation ───
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

      if (btn.dataset.tab === 'history') loadHistory();
      if (btn.dataset.tab === 'prompts') loadProfiles();
    });
  });

  // ─── Indicator Style Selection ───
  document.querySelectorAll('.settings-style-options .style-option').forEach((option) => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.settings-style-options .style-option').forEach((o) => o.classList.remove('selected'));
      option.classList.add('selected');
      option.querySelector('input[type="radio"]').checked = true;
    });
  });

  // ─── Toggle visibility ───
  document.querySelectorAll('.toggle-visibility').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Hide';
      } else {
        input.type = 'password';
        btn.textContent = 'Show';
      }
    });
  });

  // ─── Save Settings ───
  document.getElementById('save-settings').addEventListener('click', async () => {
    const status = document.getElementById('save-status');
    status.textContent = 'Saving...';
    status.className = 'status-msg loading';

    await voiceAI.setSetting('groqApiKey', document.getElementById('settings-groq-key').value.trim());
    await voiceAI.setSetting('openRouterApiKey', document.getElementById('settings-openrouter-key').value.trim());
    await voiceAI.setSetting('openRouterModel', document.getElementById('settings-model').value);
    await voiceAI.setSetting('transcriptionLanguage', document.getElementById('settings-transcription-language').value);
    await voiceAI.setSetting('translateTargetLanguage', document.getElementById('settings-translate-language').value);
    await voiceAI.setSetting('customVocabulary', document.getElementById('settings-vocabulary').value);

    const selectedStyle = document.querySelector('input[name="settings-overlay-style"]:checked');
    if (selectedStyle) {
      await voiceAI.setSetting('overlayStyle', selectedStyle.value);
    }

    const autoPasteCheckbox = document.getElementById('settings-auto-paste');
    if (autoPasteCheckbox) {
      await voiceAI.setSetting('autoPasteEnabled', autoPasteCheckbox.checked);
    }

    const devModeCheckbox = document.getElementById('settings-developer-mode');
    if (devModeCheckbox) {
      await voiceAI.setSetting('developerMode', devModeCheckbox.checked);
    }

    const soundEnabled = document.getElementById('settings-sound-enabled');
    if (soundEnabled) {
      await voiceAI.setSetting('completionSoundEnabled', soundEnabled.checked);
    }
    const selectedSound = document.querySelector('input[name="completion-sound"]:checked');
    if (selectedSound) {
      await voiceAI.setSetting('completionSound', selectedSound.value);
    }

    status.textContent = 'Settings saved!';
    status.className = 'status-msg success';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });

  // ─── PTT Key Selection ───
  const settingsKeyOptions = document.querySelectorAll('.setting-card .key-option');
  const settingsCustomInput = document.getElementById('settings-ptt-custom-key-input');
  const settingsFnTip = document.getElementById('settings-fn-tip');

  function selectSettingsKeyOption(value, customLabel) {
    settingsKeyOptions.forEach(opt => {
      const radio = opt.querySelector('input[type="radio"]');
      const isMatch = radio.value === value;
      opt.classList.toggle('selected', isMatch);
      radio.checked = isMatch;
    });
    if (settingsCustomInput) settingsCustomInput.style.display = value === 'custom' ? 'block' : 'none';
    if (customLabel && settingsCustomInput) settingsCustomInput.value = customLabel;
    if (settingsFnTip) settingsFnTip.style.display = value === 'fn' ? 'block' : 'none';
  }

  document.querySelectorAll('.setting-card .key-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      const value = radio.value;
      selectSettingsKeyOption(value);
      if (value === 'fn' || value === 'right-option') {
        await voiceAI.changePttKey(value);
      }
    });
  });

  if (settingsCustomInput) {
    let settingsCapturing = false;
    settingsCustomInput.addEventListener('click', async () => {
      if (settingsCapturing) return;
      settingsCapturing = true;
      try {
        settingsCustomInput.classList.add('capturing');
        settingsCustomInput.value = '';
        settingsCustomInput.placeholder = 'Press any key...';

        const result = await captureKeyFromDOM();

        settingsCustomInput.classList.remove('capturing');
        settingsCustomInput.value = result.label;
        settingsCustomInput.placeholder = 'Click to set key...';
        await voiceAI.changePttKey({ type: 'custom', keycode: result.keycode, label: result.label });
      } finally {
        settingsCapturing = false;
      }
    });
  }

  // ─── Profiles ───
  setupProfileListeners();

  // ─── Clear History ───
  document.getElementById('clear-history').addEventListener('click', async () => {
    await voiceAI.setSetting('transcriptionHistory', []);
    history = [];
    renderHistory();
  });

  // ─── Rerun setup ───
  document.getElementById('rerun-setup').addEventListener('click', async () => {
    await voiceAI.setSetting('hasCompletedSetup', false);
    showView('setup');
    showStep(1);
  });

  // ─── History ───
  setupHistoryListeners();

  // ─── Sound Settings ───
  setupSoundListeners();
}
