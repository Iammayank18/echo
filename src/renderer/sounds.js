// ─── Sound Settings ─────────────────────────────────────────────────────────
async function loadSoundOptions() {
  const sounds = await voiceAI.getSoundFiles();
  const selectedSound = await voiceAI.getSetting('completionSound', 'faaa.mp3');
  const enabled = await voiceAI.getSetting('completionSoundEnabled', true);

  const checkbox = document.getElementById('settings-sound-enabled');
  if (checkbox) checkbox.checked = enabled;

  renderSoundOptions(sounds, selectedSound);
}

function renderSoundOptions(sounds, selectedSound) {
  const container = document.getElementById('sound-options');
  if (!container) return;

  container.innerHTML = sounds.map(s => `
    <div class="sound-option${s.filename === selectedSound ? ' selected' : ''}" data-filename="${s.filename}">
      <input type="radio" name="completion-sound" value="${s.filename}" ${s.filename === selectedSound ? 'checked' : ''}>
      <span class="sound-option-name">${s.name}</span>
      ${s.builtin ? '<span class="sound-option-badge">built-in</span>' : '<span class="sound-option-badge">custom</span>'}
      <div class="sound-option-actions">
        <button class="btn-icon btn-preview" data-path="${s.path}" title="Preview">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>
        </button>
        ${!s.builtin ? `<button class="btn-icon btn-danger btn-remove-sound" data-filename="${s.filename}" title="Remove">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H5.5l1-1h3l1 1H13.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
        </button>` : ''}
      </div>
    </div>
  `).join('');

  // Click on option row to select
  container.querySelectorAll('.sound-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      if (e.target.closest('.btn-icon')) return;
      container.querySelectorAll('.sound-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input[type="radio"]').checked = true;
    });
  });

  // Preview buttons
  container.querySelectorAll('.btn-preview').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentPreviewAudio) {
        currentPreviewAudio.pause();
        currentPreviewAudio = null;
      }
      const soundPath = btn.dataset.path;
      currentPreviewAudio = new Audio('file://' + soundPath);
      currentPreviewAudio.play().catch(() => {});
    });
  });

  // Remove buttons
  container.querySelectorAll('.btn-remove-sound').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const filename = btn.dataset.filename;
      await voiceAI.removeCustomSound(filename);
      const currentSelected = document.querySelector('input[name="completion-sound"]:checked');
      const wasSelected = currentSelected && currentSelected.value === filename;
      await loadSoundOptions();
      if (wasSelected) {
        const firstRadio = document.querySelector('input[name="completion-sound"]');
        if (firstRadio) firstRadio.checked = true;
        const firstOpt = document.querySelector('.sound-option');
        if (firstOpt) firstOpt.classList.add('selected');
      }
    });
  });
}

function setupSoundListeners() {
  const addBtn = document.getElementById('add-custom-sound');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const result = await voiceAI.addCustomSound();
      if (result) {
        await loadSoundOptions();
      }
    });
  }

  const checkbox = document.getElementById('settings-sound-enabled');
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      const container = document.getElementById('sound-options');
      const addBtnEl = document.getElementById('add-custom-sound');
      if (container) container.style.opacity = checkbox.checked ? '1' : '0.4';
      if (container) container.style.pointerEvents = checkbox.checked ? 'auto' : 'none';
      if (addBtnEl) addBtnEl.style.opacity = checkbox.checked ? '1' : '0.4';
      if (addBtnEl) addBtnEl.style.pointerEvents = checkbox.checked ? 'auto' : 'none';
    });
  }
}
