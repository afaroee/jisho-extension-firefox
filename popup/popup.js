/**
 * Jisho Kanji Lens - Popup Controller
 */

const extBrowser = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
  const searchInput = document.getElementById('popup-search-input');
  const btnSearch = document.getElementById('btn-popup-search');
  const btnClear = document.getElementById('btn-clear-search');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  const resultsContainer = document.getElementById('results-container');
  const strokesContainer = document.getElementById('strokes-container');
  const favoritesList = document.getElementById('favorites-list');
  const historyList = document.getElementById('history-list');
  const favCountBadge = document.getElementById('fav-count');
  
  const btnExportAnki = document.getElementById('btn-export-anki');
  const btnClearFavorites = document.getElementById('btn-clear-favorites');
  const btnClearHistory = document.getElementById('btn-clear-history');

  let currentData = null;
  let popupAudioSpeed = 1.0;

  // 1. Initialize favorites count & recent history
  updateFavoritesCount();
  renderHistoryView();
  renderFavoritesView();

  // 2. Open Settings
  btnOpenOptions.addEventListener('click', () => {
    if (extBrowser.runtime.openOptionsPage) {
      extBrowser.runtime.openOptionsPage();
    } else {
      window.open(extBrowser.runtime.getURL('options/options.html'));
    }
  });

  // 3. Tab Navigation
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const targetId = `pane-${tab.dataset.tab}`;
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');

      if (tab.dataset.tab === 'favorites') renderFavoritesView();
      if (tab.dataset.tab === 'history') renderHistoryView();
    });
  });

  // 4. Search Execution
  const performSearch = async (query) => {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    searchInput.value = cleanQuery;
    btnClear.classList.remove('hidden');

    // Switch to Results Tab
    switchTab('results');

    resultsContainer.innerHTML = `
      <div class="empty-state">
        <div style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <p style="margin-top:10px;">Searching Jisho for "<strong>${cleanQuery}</strong>"...</p>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;

    try {
      const res = await extBrowser.runtime.sendMessage({
        type: 'JISHO_FULL_LOOKUP',
        query: cleanQuery
      });

      if (!res || !res.success || !res.data) {
        throw new Error(res ? res.error : 'Lookup failed');
      }

      currentData = res.data;
      renderResults(currentData);
      renderStrokes(currentData);
      updateFavoritesCount();
    } catch (err) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div style="color:var(--primary);font-weight:bold;">Lookup Error</div>
          <p>${err.message}</p>
        </div>
      `;
    }
  };

  btnSearch.addEventListener('click', () => performSearch(searchInput.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch(searchInput.value);
  });

  searchInput.addEventListener('input', () => {
    btnClear.classList.toggle('hidden', !searchInput.value);
  });

  btnClear.addEventListener('click', () => {
    searchInput.value = '';
    btnClear.classList.add('hidden');
    searchInput.focus();
  });

  // 5. Render Search Results View
  function renderResults(data) {
    const topWord = data.words && data.words.length > 0 ? data.words[0] : null;
    const topKanji = data.kanjiList && data.kanjiList.length > 0 ? data.kanjiList[0] : null;

    // Build compound furigana if word reading is missing
    const compoundFurigana = data.kanjiList
      .map(k => (k.onyomi[0] ? katakanaToHiragana(k.onyomi[0]) : (k.kunyomi[0] ? k.kunyomi[0].replace(/\..*/, '') : '')))
      .filter(Boolean)
      .join('・');

    const displayWord = topWord ? topWord.displayWord : (topKanji ? topKanji.kanji : data.query);
    const displayReading = (topWord && topWord.displayReading) ? topWord.displayReading : (compoundFurigana || (topKanji ? (topKanji.onyomi.concat(topKanji.kunyomi).join('、 ')) : ''));
    const jlptBadge = topWord?.jlpt || topKanji?.jlpt || null;
    const isCommon = topWord?.isCommon || false;
    const targetText = displayWord || displayReading || data.query;
    const directAudio = topWord?.audioUrl || null;

    let html = `
      <div class="result-banner">
        <div>
          <div class="result-furigana">${displayReading}</div>
          <div class="result-word">${displayWord}</div>
          <div class="result-badges">
            ${isCommon ? '<span class="badge badge-common">Common</span>' : ''}
            ${jlptBadge ? `<span class="badge badge-jlpt">${jlptBadge}</span>` : ''}
            ${data.hasKanji ? `<span class="badge" style="background:var(--primary-light);color:var(--primary);">${data.kanjiList.length} Kanji</span>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button id="popup-audio-btn" class="audio-btn" title="Listen Japanese pronunciation">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          </button>
          <button id="popup-speed-btn" class="btn-secondary" style="font-weight:bold;padding:4px 8px;" title="Adjust audio speed">${popupAudioSpeed}x</button>
        </div>
      </div>
    `;

    // Word senses
    if (data.words && data.words.length > 0) {
      data.words.slice(0, 4).forEach((w, idx) => {
        const pos = w.senses.map(s => s.partsOfSpeech.join(', ')).filter(Boolean).join('; ');
        const defsHtml = w.senses.map(s => `<li>${s.definitions.join(', ')}</li>`).join('');
        html += `
          <div class="word-sense-card">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">
              ${idx + 1}. ${w.displayWord} <span style="font-weight:normal;color:var(--primary);font-size:12px;">【${w.displayReading}】</span>
            </div>
            ${pos ? `<div class="sense-pos">${pos}</div>` : ''}
            <ol class="sense-defs">${defsHtml}</ol>
          </div>
        `;
      });
    } else {
      html += `<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">No standalone dictionary word found.</p>`;
    }

    // Kanji breakdown section
    if (data.hasKanji && data.kanjiList.length > 0) {
      html += `<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin:14px 0 8px;">Kanji Characters in Selection:</div>`;
      data.kanjiList.forEach(k => {
        const primaryOn = k.onyomi && k.onyomi[0] ? k.onyomi[0] : '';
        const primaryKun = k.kunyomi && k.kunyomi[0] ? k.kunyomi[0].replace(/\..*/, '') : '';
        const rubyFurigana = primaryOn
          ? `${primaryOn} (${katakanaToHiragana(primaryOn)})`
          : (primaryKun || '');

        const onStr = k.onyomi && k.onyomi.length > 0
          ? k.onyomi.map(on => `${on} (${katakanaToHiragana(on)})`).join(', ')
          : '—';
        const kunStr = k.kunyomi && k.kunyomi.length > 0 ? k.kunyomi.join(', ') : '—';
        const mean = k.meanings.join(', ') || '—';

        html += `
          <div class="word-sense-card" style="display:flex;gap:12px;align-items:center;">
            <div style="text-align:center;">
              <ruby style="ruby-position:over;">
                <span style="font-size:32px;font-weight:900;color:var(--primary);line-height:1;">${k.kanji}</span>
                <rt style="font-size:10px;font-weight:bold;color:var(--primary);">${rubyFurigana}</rt>
              </ruby>
            </div>
            <div style="font-size:12px;flex:1;">
              <div><strong>Meaning:</strong> ${mean}</div>
              <div><strong style="color:var(--text-muted);">On (音):</strong> <span style="color:var(--primary);">${onStr}</span></div>
              <div><strong style="color:var(--text-muted);">Kun (訓):</strong> ${kunStr}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Strokes: ${k.strokeCount || '—'} | JLPT: ${k.jlpt || '—'}</div>
            </div>
          </div>
        `;
      });
    }

    resultsContainer.innerHTML = html;

    // Attach Audio Controls
    const audioBtn = document.getElementById('popup-audio-btn');
    const speedBtn = document.getElementById('popup-speed-btn');

    if (audioBtn && typeof jpAudio !== 'undefined') {
      audioBtn.addEventListener('click', () => {
        jpAudio.setSpeed(popupAudioSpeed);
        jpAudio.onStateChange = (isPlaying, speed) => {
          audioBtn.classList.toggle('playing', isPlaying);
          if (speedBtn) speedBtn.textContent = `${speed}x`;
        };
        jpAudio.play(targetText, directAudio);
      });

      if (speedBtn) {
        speedBtn.addEventListener('click', () => {
          popupAudioSpeed = jpAudio.cycleSpeed();
          speedBtn.textContent = `${popupAudioSpeed}x`;
        });
      }
    }
  }

  // 6. Render Stroke Order View in Popup
  function renderStrokes(data) {
    if (!data || !data.hasKanji || data.kanjiList.length === 0) {
      strokesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✍️</div>
          <p>No Kanji found in the current search query.</p>
        </div>
      `;
      return;
    }

    strokesContainer.innerHTML = '';

    if (data.kanjiList.length > 1) {
      const picker = document.createElement('div');
      picker.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap;';
      picker.innerHTML = `<span style="font-size:11px;font-weight:600;color:var(--text-muted);">Select:</span>`;
      
      data.kanjiList.forEach((k, idx) => {
        const b = document.createElement('button');
        b.className = `btn-secondary ${idx === 0 ? 'active' : ''}`;
        b.textContent = k.kanji;
        b.style.fontSize = '14px';
        b.style.fontWeight = 'bold';
        b.addEventListener('click', () => {
          picker.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
          b.classList.add('active');
          displayKanjiAnimator(animBox, k);
        });
        picker.appendChild(b);
      });
      strokesContainer.appendChild(picker);
    }

    const animBox = document.createElement('div');
    strokesContainer.appendChild(animBox);
    displayKanjiAnimator(animBox, data.kanjiList[0]);
  }

  function displayKanjiAnimator(container, kanjiObj) {
    container.innerHTML = '';
    if (!kanjiObj || !kanjiObj.svg) {
      container.innerHTML = `<p style="font-size:12px;color:var(--text-muted);text-align:center;">Stroke SVG unavailable.</p>`;
      return;
    }

    if (typeof kanjivg !== 'undefined') {
      const parsed = kanjivg.parseSvgData(kanjiObj.svg, kanjiObj.kanji);
      const animator = kanjivg.createStrokeAnimator(parsed);
      container.appendChild(animator);
    }
  }

  // 7. Render History View
  async function renderHistoryView() {
    if (typeof getHistory !== 'function') return;
    const history = await getHistory();
    if (history.length === 0) {
      historyList.innerHTML = `<div class="empty-state"><p>No search history yet.</p></div>`;
      return;
    }

    historyList.innerHTML = '';
    history.forEach(item => {
      const el = document.createElement('div');
      el.className = 'list-item';
      el.innerHTML = `
        <div class="list-item-left">
          <div class="list-item-query">${item.query}</div>
          <div class="list-item-sub">${item.reading || (item.meanings ? item.meanings.slice(0, 2).join(', ') : '')}</div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);">
          ${new Date(item.timestamp).toLocaleDateString()}
        </div>
      `;
      el.addEventListener('click', () => performSearch(item.query));
      historyList.appendChild(el);
    });
  }

  // 8. Render Favorites / Wordbook View
  async function renderFavoritesView() {
    if (typeof getFavorites !== 'function') return;
    const favorites = await getFavorites();
    favCountBadge.textContent = favorites.length;

    if (favorites.length === 0) {
      favoritesList.innerHTML = `<div class="empty-state"><p>No saved words in Wordbook. Click the ⭐ star button in any lookup to save.</p></div>`;
      return;
    }

    favoritesList.innerHTML = '';
    favorites.forEach(item => {
      const el = document.createElement('div');
      el.className = 'list-item';
      el.innerHTML = `
        <div class="list-item-left">
          <div class="list-item-query">${item.query} <span style="font-size:12px;font-weight:normal;color:var(--primary);">【${item.reading || ''}】</span></div>
          <div class="list-item-sub">${Array.isArray(item.meanings) ? item.meanings.slice(0, 3).join(', ') : item.meanings}</div>
        </div>
        <button class="btn-icon danger-icon" title="Remove" style="color:var(--text-muted);">✕</button>
      `;

      el.querySelector('.list-item-left').addEventListener('click', () => performSearch(item.query));
      el.querySelector('.danger-icon').addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleFavorite(item);
        renderFavoritesView();
        updateFavoritesCount();
      });

      favoritesList.appendChild(el);
    });
  }

  // Clear History
  btnClearHistory.addEventListener('click', async () => {
    if (typeof clearHistory === 'function') {
      await clearHistory();
      renderHistoryView();
    }
  });

  // Clear Favorites
  btnClearFavorites.addEventListener('click', async () => {
    if (typeof storageAPI !== 'undefined' && storageAPI) {
      await storageAPI.set({ jkl_favorites: [] });
      renderFavoritesView();
      updateFavoritesCount();
    }
  });

  // Export Anki TSV
  btnExportAnki.addEventListener('click', async () => {
    if (typeof getFavorites !== 'function' || typeof exportFavoritesToAnki !== 'function') return;
    const favs = await getFavorites();
    if (favs.length === 0) {
      alert('Wordbook is empty. Star some words or kanji first!');
      return;
    }

    const tsvContent = exportFavoritesToAnki(favs);
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jisho-kanji-anki-${new Date().toISOString().slice(0, 10)}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  async function updateFavoritesCount() {
    if (typeof getFavorites === 'function') {
      const favs = await getFavorites();
      favCountBadge.textContent = favs.length;
    }
  }

  function switchTab(tabName) {
    navTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    tabPanes.forEach(p => p.classList.toggle('active', p.id === `pane-${tabName}`));
  }
});
