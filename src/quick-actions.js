document.querySelectorAll('.qa-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (action && window.voiceAI) {
      voiceAI.selectQuickAction(action);
    }
  });
});

// Listen for keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Close without selecting
    if (window.voiceAI) {
      voiceAI.selectQuickAction(null);
    }
  }
});
