// ─── History ────────────────────────────────────────────────────────────────
let searchQuery = '';

async function loadHistory() {
  history = (await voiceAI.getSetting('transcriptionHistory', [])) || [];
  renderHistory();
}

function setupHistoryListeners() {
  const searchInput = document.getElementById('history-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.toLowerCase().trim();
      renderHistory();
    });
  }

  const container = document.getElementById('history-list');
  if (container) {
    container.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('.history-copy-btn');
      const repasteBtn = e.target.closest('.history-repaste-btn');

      if (copyBtn) {
        const text = copyBtn.dataset.text;
        await voiceAI.copyToClipboard(text);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      }

      if (repasteBtn) {
        const text = repasteBtn.dataset.text;
        await voiceAI.repasteText(text);
        repasteBtn.textContent = 'Pasted!';
        setTimeout(() => { repasteBtn.textContent = 'Re-paste'; }, 1500);
      }
    });
  }
}

function renderHistory() {
  const container = document.getElementById('history-list');

  if (!history || history.length === 0) {
    container.innerHTML = `<p class="empty-state">No transcriptions yet. Use your shortcut to start recording!</p>`;
    return;
  }

  let filtered = history.slice().reverse();

  if (searchQuery) {
    filtered = filtered.filter(item => {
      const raw = (item.rawTranscript || '').toLowerCase();
      const clean = (item.cleanText || '').toLowerCase();
      const ctx = (item.context || '').toLowerCase();
      return raw.includes(searchQuery) || clean.includes(searchQuery) || ctx.includes(searchQuery);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">No matches found.</p>`;
    return;
  }

  container.innerHTML = filtered
    .map(
      (item) => `
    <div class="history-item">
      <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
      <div class="history-raw"><strong>Raw:</strong> ${escapeHTML(item.rawTranscript || '')}</div>
      <div class="history-clean"><strong>Clean:</strong> ${escapeHTML(item.cleanText || '')}</div>
      ${item.context ? `<div class="history-context">Context: ${escapeHTML(item.context)}</div>` : ''}
      ${item.profileName ? `<div class="history-profile"><span class="badge">${escapeHTML(item.profileName)}</span></div>` : ''}
      <div class="history-actions">
        <button class="btn btn-secondary btn-sm history-copy-btn" data-text="${escapeAttr(item.cleanText || item.rawTranscript || '')}">Copy</button>
        <button class="btn btn-secondary btn-sm history-repaste-btn" data-text="${escapeAttr(item.cleanText || item.rawTranscript || '')}">Re-paste</button>
      </div>
    </div>
  `
    )
    .join('');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}
