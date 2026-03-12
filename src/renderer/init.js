// ─── App Initialization ─────────────────────────────────────────────────────
function showView(view) {
  document.getElementById('setup-view').style.display = view === 'setup' ? 'block' : 'none';
  document.getElementById('settings-view').style.display = view === 'settings' ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    setupRecordingListeners();

    const hasCompleted = await voiceAI.getSetting('hasCompletedSetup', false);

    if (hasCompleted) {
      showView('settings');
      await loadSettings();
    } else {
      showView('setup');
      showStep(1);
    }

    setupWizardListeners();
    setupSettingsListeners();
    checkPermissions();
  } catch (err) {
    console.error('[APP INIT ERROR]', err);
    document.body.innerHTML = `<pre style="color:red;padding:20px;">${err.stack || err}</pre>`;
  }
});
