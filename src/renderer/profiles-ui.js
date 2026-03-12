// ─── Profiles UI ────────────────────────────────────────────────────────────
let profiles = {};
let activeProfileId = 'default';
let editingProfileId = null;

async function loadProfiles() {
  await voiceAI.migrateProfiles();
  profiles = (await voiceAI.getSetting('promptProfiles', {})) || {};
  activeProfileId = (await voiceAI.getSetting('activeProfileId', 'default')) || 'default';
  renderProfileList();
  renderAutoSwitchRules();
  populateAutoSwitchProfileSelect();
}

function renderProfileList() {
  const container = document.getElementById('profile-list');
  if (!container) return;

  const entries = Object.entries(profiles);
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-state">No profiles yet. Add one to get started.</p>';
    return;
  }

  container.innerHTML = entries
    .map(([id, profile]) => {
      const isActive = id === activeProfileId;
      const isDefault = profile.isDefault;
      const isEditing = id === editingProfileId;
      return `
        <div class="profile-item ${isEditing ? 'editing' : ''}" data-profile-id="${id}">
          <div class="profile-item-info">
            <span class="profile-item-name">${escapeHTMLProfiles(profile.name)}</span>
            ${isDefault ? '<span class="badge">Default</span>' : ''}
            ${isActive ? '<span class="badge badge-accent">Active</span>' : ''}
          </div>
          <div class="profile-item-actions">
            <button class="btn btn-secondary btn-sm profile-edit-btn" data-profile-id="${id}">Edit</button>
            <button class="btn btn-secondary btn-sm profile-activate-btn" data-profile-id="${id}" ${isActive ? 'disabled' : ''}>
              ${isActive ? 'Active' : 'Activate'}
            </button>
          </div>
        </div>`;
    })
    .join('');
}

function showProfileEditor(id) {
  editingProfileId = id;
  const profile = profiles[id];
  if (!profile) return;

  const card = document.getElementById('profile-editor-card');
  card.style.display = '';
  document.getElementById('profile-editor-title').textContent = 'Edit: ' + profile.name;
  document.getElementById('profile-name-input').value = profile.name;
  document.getElementById('profile-prompt-input').value = profile.systemPrompt || '';

  const badge = document.getElementById('profile-default-badge');
  badge.style.display = profile.isDefault ? '' : 'none';

  const deleteBtn = document.getElementById('delete-profile');
  deleteBtn.style.display = profile.isDefault ? 'none' : '';

  renderProfileList();
}

function hideProfileEditor() {
  editingProfileId = null;
  document.getElementById('profile-editor-card').style.display = 'none';
  renderProfileList();
}

function setupProfileListeners() {
  const listContainer = document.getElementById('profile-list');
  if (listContainer) {
    listContainer.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.profile-edit-btn');
      const activateBtn = e.target.closest('.profile-activate-btn');

      if (editBtn) {
        showProfileEditor(editBtn.dataset.profileId);
      }

      if (activateBtn && !activateBtn.disabled) {
        activeProfileId = activateBtn.dataset.profileId;
        await voiceAI.setSetting('activeProfileId', activeProfileId);
        renderProfileList();
      }
    });
  }

  document.getElementById('add-profile').addEventListener('click', async () => {
    const id = 'profile_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    profiles[id] = { name: 'New Profile', systemPrompt: '', isDefault: false };
    await voiceAI.setSetting('promptProfiles', profiles);
    renderProfileList();
    populateAutoSwitchProfileSelect();
    showProfileEditor(id);
  });

  document.getElementById('save-profile').addEventListener('click', async () => {
    if (!editingProfileId || !profiles[editingProfileId]) return;
    const name = document.getElementById('profile-name-input').value.trim();
    const prompt = document.getElementById('profile-prompt-input').value;

    if (!name) return;

    profiles[editingProfileId].name = name;
    profiles[editingProfileId].systemPrompt = prompt;
    await voiceAI.setSetting('promptProfiles', profiles);

    const status = document.getElementById('profile-save-status');
    status.textContent = 'Profile saved!';
    status.className = 'status-msg success';
    setTimeout(() => { status.textContent = ''; }, 2000);

    document.getElementById('profile-editor-title').textContent = 'Edit: ' + name;
    renderProfileList();
    populateAutoSwitchProfileSelect();
  });

  document.getElementById('set-default-profile').addEventListener('click', async () => {
    if (!editingProfileId) return;
    Object.values(profiles).forEach(p => { p.isDefault = false; });
    profiles[editingProfileId].isDefault = true;
    await voiceAI.setSetting('promptProfiles', profiles);

    document.getElementById('profile-default-badge').style.display = '';
    document.getElementById('delete-profile').style.display = 'none';
    renderProfileList();
  });

  document.getElementById('delete-profile').addEventListener('click', async () => {
    if (!editingProfileId || profiles[editingProfileId]?.isDefault) return;
    delete profiles[editingProfileId];
    await voiceAI.setSetting('promptProfiles', profiles);

    if (activeProfileId === editingProfileId) {
      const defaultEntry = Object.entries(profiles).find(([, p]) => p.isDefault);
      activeProfileId = defaultEntry ? defaultEntry[0] : Object.keys(profiles)[0] || 'default';
      await voiceAI.setSetting('activeProfileId', activeProfileId);
    }

    hideProfileEditor();
    populateAutoSwitchProfileSelect();
    renderAutoSwitchRules();
  });

  // Auto-switch rules
  document.getElementById('add-auto-switch-rule').addEventListener('click', async () => {
    const appInput = document.getElementById('auto-switch-app-input');
    const profileSelect = document.getElementById('auto-switch-profile-select');
    const appPattern = appInput.value.trim();
    const profileId = profileSelect.value;

    if (!appPattern || !profileId) return;

    const rules = (await voiceAI.getSetting('autoSwitchRules', [])) || [];
    rules.push({ appPattern, profileId });
    await voiceAI.setSetting('autoSwitchRules', rules);

    appInput.value = '';
    renderAutoSwitchRules();
  });

  const rulesContainer = document.getElementById('auto-switch-rules');
  if (rulesContainer) {
    rulesContainer.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.auto-switch-remove-btn');
      if (removeBtn) {
        const index = parseInt(removeBtn.dataset.index, 10);
        const rules = (await voiceAI.getSetting('autoSwitchRules', [])) || [];
        rules.splice(index, 1);
        await voiceAI.setSetting('autoSwitchRules', rules);
        renderAutoSwitchRules();
      }
    });
  }
}

async function renderAutoSwitchRules() {
  const container = document.getElementById('auto-switch-rules');
  if (!container) return;

  const rules = (await voiceAI.getSetting('autoSwitchRules', [])) || [];

  if (rules.length === 0) {
    container.innerHTML = '<p class="empty-state" style="font-size: 12px;">No rules yet. Transcriptions will use the active profile.</p>';
    return;
  }

  container.innerHTML = rules
    .map((rule, i) => {
      const profileName = profiles[rule.profileId]?.name || 'Unknown';
      return `
        <div class="auto-switch-rule">
          <span class="auto-switch-app">${escapeHTMLProfiles(rule.appPattern)}</span>
          <span class="auto-switch-arrow">&rarr;</span>
          <span class="auto-switch-profile">${escapeHTMLProfiles(profileName)}</span>
          <button class="btn btn-ghost btn-sm auto-switch-remove-btn" data-index="${i}" style="color: var(--error); padding: 2px 6px;">&times;</button>
        </div>`;
    })
    .join('');
}

function populateAutoSwitchProfileSelect() {
  const select = document.getElementById('auto-switch-profile-select');
  if (!select) return;

  select.innerHTML = Object.entries(profiles)
    .map(([id, profile]) => `<option value="${id}">${escapeHTMLProfiles(profile.name)}</option>`)
    .join('');
}

function escapeHTMLProfiles(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
