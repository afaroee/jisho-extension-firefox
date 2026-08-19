/**
 * Jisho Kanji Lens - Content Script
 * Injected into web pages to display interactive dictionary modals with stroke order animations.
 */

(function () {
  // Prevent duplicate initialization
  if (window.__JISHO_KANJI_LENS_INJECTED__) return;
  window.__JISHO_KANJI_LENS_INJECTED__ = true;

  const extBrowser = typeof browser !== 'undefined' ? browser : chrome;

  let shadowHost = null;
  let shadowRoot = null;
  let currentLookupData = null;
  let currentActiveTab = 'vocab';
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  /**
   * Initialize or get the Shadow DOM Host
   */
  function getOrCreateShadowRoot() {
    if (shadowRoot) return shadowRoot;

    shadowHost = document.createElement('div');
    shadowHost.id = 'jisho-kanji-lens-host';
    shadowHost.style.position = 'absolute';
    shadowHost.style.top = '0';
    shadowHost.style.left = '0';
    shadowHost.style.zIndex = '2147483647';
    document.documentElement.appendChild(shadowHost);

    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // Link stylesheet inside shadow DOM
    const cssUrl = extBrowser.runtime.getURL('content/content.css');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    shadowRoot.appendChild(link);

    // Also inject base styles directly as fallback
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
    `;
    shadowRoot.appendChild(style);

    return shadowRoot;
  }

  /**
   * Calculate smart position near selection or cursor
   */
  function getModalPosition(targetX, targetY) {
    const modalWidth = 440;
    const modalHeight = 480;
    const padding = 16;

    let x = (targetX !== undefined ? targetX : window.innerWidth / 2 - modalWidth / 2);
    let y = (targetY !== undefined ? targetY + 20 : window.innerHeight / 2 - modalHeight / 2);

    // Keep within viewport horizontally
    if (x + modalWidth > window.innerWidth - padding) {
      x = window.innerWidth - modalWidth - padding;
    }
    if (x < padding) x = padding;

    // Keep within viewport vertically
    if (y + modalHeight > window.innerHeight - padding) {
      y = (targetY !== undefined) ? targetY - modalHeight - 10 : window.innerHeight - modalHeight - padding;
    }
    if (y < padding) y = padding;

    return { x, y };
  }

  /**
   * Pronounce Japanese text using Speech Synthesis
   */
  function speakJapanese(text) {
    if (!text || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Stop prior speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.9; // Natural pace
      
      // Select Japanese voice if available
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find(v => v.lang.startsWith('ja') || v.name.includes('Japanese'));
      if (jaVoice) utterance.voice = jaVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS playback error:', e);
    }
  }

  /**
   * Display or Update the Floating Modal Overlay
   */
  async function showModal(query, initialTab = 'vocab', posX, posY) {
    const root = getOrCreateShadowRoot();

    // Remove existing modal if any
    const existingModal = root.querySelector('.jkl-modal-container');
    if (existingModal) existingModal.remove();

    const { x, y } = getModalPosition(posX, posY);

    const modal = document.createElement('div');
    modal.className = 'jkl-modal-container';
    modal.style.left = `${x}px`;
    modal.style.top = `${y}px`;

    // Render initial Loading State
    modal.innerHTML = `
      <div class="jkl-header">
        <div class="jkl-header-left">
          <div class="jkl-brand-logo">辞</div>
          <span class="jkl-header-title">Jisho Kanji Lens</span>
        </div>
        <div class="jkl-header-actions">
          <button class="jkl-icon-btn jkl-close-btn" title="Close (Esc)">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      </div>

      <div class="jkl-search-bar">
        <input type="text" class="jkl-search-input" value="${query}" placeholder="Search Kanji or Word..." />
        <button class="jkl-search-submit">Search</button>
      </div>

      <div class="jkl-loader-box">
        <div class="jkl-spinner"></div>
        <span>Searching Jisho for "<strong>${query}</strong>"...</span>
      </div>
    `;

    root.appendChild(modal);

    // Setup Header Dragging
    setupDrag(modal);

    // Setup Search bar inside modal
    const searchInput = modal.querySelector('.jkl-search-input');
    const searchSubmit = modal.querySelector('.jkl-search-submit');
    const handleModalSearch = () => {
      const val = searchInput.value.trim();
      if (val) showModal(val, 'vocab', x, y);
    };
    searchSubmit.addEventListener('click', handleModalSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleModalSearch();
    });

    // Setup Close Button
    const closeBtn = modal.querySelector('.jkl-close-btn');
    closeBtn.addEventListener('click', () => modal.remove());

    // Fetch data from background service worker
    try {
      const response = await extBrowser.runtime.sendMessage({
        type: 'JISHO_FULL_LOOKUP',
        query: query
      });

      if (!response || !response.success || !response.data) {
        throw new Error(response ? response.error : 'Lookup failed');
      }

      currentLookupData = response.data;
      renderModalContent(modal, currentLookupData, initialTab);
    } catch (err) {
      const loader = modal.querySelector('.jkl-loader-box');
      if (loader) {
        loader.innerHTML = `
          <div style="color:#E83B3B;font-weight:600;">Unable to load Jisho data</div>
          <div style="font-size:12px;color:var(--jkl-text-muted);">${err.message}</div>
        `;
      }
    }
  }

  /**
   * Render complete content tabs once data is received
   */
  function renderModalContent(modal, data, activeTab) {
    currentActiveTab = activeTab;

    const topWord = data.words && data.words.length > 0 ? data.words[0] : null;
    const topKanji = data.kanjiList && data.kanjiList.length > 0 ? data.kanjiList[0] : null;

    const displayWord = topWord ? topWord.displayWord : (topKanji ? topKanji.kanji : data.query);
    const displayReading = topWord ? topWord.displayReading : (topKanji ? (topKanji.onyomi.concat(topKanji.kunyomi).join('、 ')) : '');
    const isKanjiOnly = data.hasKanji && (!topWord || data.query.length === 1);

    // Determine banner info
    const jlptBadge = topWord?.jlpt || topKanji?.jlpt || null;
    const isCommon = topWord?.isCommon || false;

    // Check favorite state
    let isFavorited = false;
    if (typeof isFavorite === 'function') {
      isFavorite(data.query).then(fav => {
        isFavorited = fav;
        const starBtn = modal.querySelector('.jkl-star-btn');
        if (starBtn && fav) starBtn.classList.add('jkl-starred');
      });
    }

    // Modal HTML Structure
    modal.innerHTML = `
      <div class="jkl-header">
        <div class="jkl-header-left">
          <div class="jkl-brand-logo">辞</div>
          <span class="jkl-header-title">Jisho Kanji Lens</span>
        </div>
        <div class="jkl-header-actions">
          <button class="jkl-icon-btn jkl-star-btn ${isFavorited ? 'jkl-starred' : ''}" title="Save to Favorites (Anki)">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
          </button>
          <button class="jkl-icon-btn jkl-close-btn" title="Close (Esc)">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      </div>

      <div class="jkl-search-bar">
        <input type="text" class="jkl-search-input" value="${data.query}" placeholder="Search Kanji or Word..." />
        <button class="jkl-search-submit">Search</button>
      </div>

      <!-- Main Banner -->
      <div class="jkl-banner">
        <div class="jkl-banner-main">
          <div class="jkl-furigana">${displayReading}</div>
          <div class="jkl-word-title">${displayWord}</div>
          <div class="jkl-badges">
            ${isCommon ? '<span class="jkl-badge jkl-badge-common">Common Word</span>' : ''}
            ${jlptBadge ? `<span class="jkl-badge jkl-badge-jlpt">${jlptBadge}</span>` : ''}
            ${data.hasKanji ? `<span class="jkl-badge jkl-badge-kanji">${data.kanjiList.length} Kanji</span>` : ''}
          </div>
        </div>
        <button class="jkl-audio-trigger" title="Listen to pronunciation">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        </button>
      </div>

      <!-- Tabs Navigation -->
      <div class="jkl-nav-tabs">
        <button class="jkl-tab-btn ${currentActiveTab === 'vocab' ? 'jkl-tab-active' : ''}" data-tab="vocab">
          Meanings & Words
        </button>
        ${data.hasKanji ? `
          <button class="jkl-tab-btn ${currentActiveTab === 'kanji' ? 'jkl-tab-active' : ''}" data-tab="kanji">
            Kanji (${data.kanjiList.length})
          </button>
          <button class="jkl-tab-btn ${currentActiveTab === 'strokes' ? 'jkl-tab-active' : ''}" data-tab="strokes">
            Stroke Order
          </button>
        ` : ''}
        <button class="jkl-tab-btn ${currentActiveTab === 'sentences' ? 'jkl-tab-active' : ''}" data-tab="sentences">
          Sentences (${data.sentences ? data.sentences.length : 0})
        </button>
      </div>

      <!-- Scrollable Tab Content Container -->
      <div class="jkl-content-body">
        <!-- Content dynamically injected here -->
      </div>

      <!-- Footer -->
      <div class="jkl-footer">
        <span>Powered by Jisho.org & KanjiVG</span>
        <a href="https://jisho.org/search/${encodeURIComponent(data.query)}" target="_blank" rel="noopener noreferrer" class="jkl-footer-link">
          Open on Jisho.org ↗
        </a>
      </div>
    `;

    // Render active tab content
    renderTabPane(modal, data, currentActiveTab);

    // Setup Tab Click Handlers
    const tabButtons = modal.querySelectorAll('.jkl-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('jkl-tab-active'));
        btn.classList.add('jkl-tab-active');
        const tabName = btn.dataset.tab;
        currentActiveTab = tabName;
        renderTabPane(modal, data, tabName);
      });
    });

    // Setup Audio Button
    const audioBtn = modal.querySelector('.jkl-audio-trigger');
    audioBtn.addEventListener('click', () => {
      speakJapanese(displayWord || displayReading || data.query);
    });

    // Setup Star / Favorite
    const starBtn = modal.querySelector('.jkl-star-btn');
    starBtn.addEventListener('click', async () => {
      if (typeof toggleFavorite === 'function') {
        const itemToSave = {
          query: data.query,
          reading: displayReading,
          meanings: topWord ? (topWord.senses[0] ? topWord.senses[0].definitions : []) : (topKanji ? topKanji.meanings : []),
          jlpt: jlptBadge,
          isKanji: Boolean(data.hasKanji)
        };
        const newState = await toggleFavorite(itemToSave);
        starBtn.classList.toggle('jkl-starred', newState);
      }
    });

    // Setup Header Dragging
    setupDrag(modal);

    // Search bar re-binding
    const searchInput = modal.querySelector('.jkl-search-input');
    const searchSubmit = modal.querySelector('.jkl-search-submit');
    const handleModalSearch = () => {
      const val = searchInput.value.trim();
      if (val) {
        const rect = modal.getBoundingClientRect();
        showModal(val, 'vocab', rect.left, rect.top);
      }
    };
    searchSubmit.addEventListener('click', handleModalSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleModalSearch();
    });

    // Close button
    const closeBtn = modal.querySelector('.jkl-close-btn');
    closeBtn.addEventListener('click', () => modal.remove());
  }

  /**
   * Render Specific Tab Content Inside Content Body
   */
  function renderTabPane(modal, data, tabName) {
    const container = modal.querySelector('.jkl-content-body');
    if (!container) return;
    container.innerHTML = '';

    if (tabName === 'vocab') {
      if (!data.words || data.words.length === 0) {
        container.innerHTML = `<div class="jkl-loader-box">No exact dictionary word entry found. Check the Kanji or Sentences tab.</div>`;
        return;
      }

      data.words.slice(0, 5).forEach((word, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'jkl-sense-item';

        const posText = word.senses.map(s => s.partsOfSpeech.join(', ')).filter(Boolean).join('; ');
        
        let sensesHtml = '';
        word.senses.forEach((s, sIdx) => {
          const defs = s.definitions.join(', ');
          const tagBadges = s.tags.length > 0 ? `<span style="font-size:10px;color:var(--jkl-text-muted);"> (${s.tags.join(', ')})</span>` : '';
          sensesHtml += `<li><strong>${defs}</strong>${tagBadges}</li>`;
        });

        itemEl.innerHTML = `
          <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px;">
            <div style="font-size:15px;font-weight:700;color:var(--jkl-text-main);">
              ${idx + 1}. ${word.displayWord} <span style="font-size:13px;font-weight:normal;color:var(--jkl-primary);">【${word.displayReading}】</span>
            </div>
            ${word.jlpt ? `<span class="jkl-badge jkl-badge-jlpt">${word.jlpt}</span>` : ''}
          </div>
          ${posText ? `<div class="jkl-pos-tag">${posText}</div>` : ''}
          <ol class="jkl-def-list">
            ${sensesHtml}
          </ol>
        `;
        container.appendChild(itemEl);
      });
    }

    else if (tabName === 'kanji') {
      if (!data.kanjiList || data.kanjiList.length === 0) {
        container.innerHTML = `<div class="jkl-loader-box">No Kanji characters found in selection.</div>`;
        return;
      }

      data.kanjiList.forEach(k => {
        const card = document.createElement('div');
        card.className = 'jkl-kanji-card';

        const onyomiStr = k.onyomi && k.onyomi.length > 0 ? k.onyomi.join('、 ') : '—';
        const kunyomiStr = k.kunyomi && k.kunyomi.length > 0 ? k.kunyomi.join('、 ') : '—';
        const meaningsStr = k.meanings && k.meanings.length > 0 ? k.meanings.join(', ') : '—';

        card.innerHTML = `
          <div class="jkl-kanji-top">
            <div class="jkl-kanji-glyph">${k.kanji}</div>
            <div class="jkl-kanji-meta-grid">
              <div class="jkl-meta-box">
                <div class="jkl-meta-label">Strokes</div>
                <div class="jkl-meta-val">${k.strokeCount || '—'}</div>
              </div>
              <div class="jkl-meta-box">
                <div class="jkl-meta-label">JLPT</div>
                <div class="jkl-meta-val">${k.jlpt || '—'}</div>
              </div>
              <div class="jkl-meta-box">
                <div class="jkl-meta-label">Grade</div>
                <div class="jkl-meta-val">${k.grade || '—'}</div>
              </div>
            </div>
          </div>
          <div class="jkl-readings-section">
            <div class="jkl-reading-row">
              <span class="jkl-reading-type">Meaning:</span>
              <span class="jkl-reading-vals" style="font-weight:600;">${meaningsStr}</span>
            </div>
            <div class="jkl-reading-row">
              <span class="jkl-reading-type">On'yomi:</span>
              <span class="jkl-reading-vals" style="color:var(--jkl-primary);">${onyomiStr}</span>
            </div>
            <div class="jkl-reading-row">
              <span class="jkl-reading-type">Kun'yomi:</span>
              <span class="jkl-reading-vals">${kunyomiStr}</span>
            </div>
            ${k.radical ? `
              <div class="jkl-reading-row">
                <span class="jkl-reading-type">Radical:</span>
                <span class="jkl-reading-vals">${k.radical}</span>
              </div>
            ` : ''}
          </div>
        `;
        container.appendChild(card);
      });
    }

    else if (tabName === 'strokes') {
      if (!data.kanjiList || data.kanjiList.length === 0) {
        container.innerHTML = `<div class="jkl-loader-box">No Kanji available for stroke animations.</div>`;
        return;
      }

      // If multiple kanji, allow selecting which kanji to animate
      if (data.kanjiList.length > 1) {
        const selectorBar = document.createElement('div');
        selectorBar.style.cssText = 'display:flex;gap:6px;margin-bottom:12px;align-items:center;';
        selectorBar.innerHTML = `<span style="font-size:12px;color:var(--jkl-text-muted);font-weight:600;">Select Kanji:</span>`;

        data.kanjiList.forEach((k, idx) => {
          const btn = document.createElement('button');
          btn.className = `jkl-ctrl-btn ${idx === 0 ? 'jkl-active' : ''}`;
          btn.textContent = k.kanji;
          btn.style.fontSize = '16px';
          btn.style.fontWeight = 'bold';
          btn.addEventListener('click', () => {
            selectorBar.querySelectorAll('.jkl-ctrl-btn').forEach(b => b.classList.remove('jkl-active'));
            btn.classList.add('jkl-active');
            renderKanjiStrokeView(strokeWrapper, k);
          });
          selectorBar.appendChild(btn);
        });

        container.appendChild(selectorBar);
      }

      const strokeWrapper = document.createElement('div');
      container.appendChild(strokeWrapper);

      // Render first kanji stroke view
      renderKanjiStrokeView(strokeWrapper, data.kanjiList[0]);
    }

    else if (tabName === 'sentences') {
      if (!data.sentences || data.sentences.length === 0) {
        container.innerHTML = `<div class="jkl-loader-box">No sentence examples available for this entry.</div>`;
        return;
      }

      data.sentences.forEach(s => {
        const sCard = document.createElement('div');
        sCard.className = 'jkl-sentence-card';
        sCard.innerHTML = `
          <div class="jkl-sentence-jp">${s.japanese}</div>
          <div class="jkl-sentence-en">${s.english}</div>
        `;
        container.appendChild(sCard);
      });
    }
  }

  /**
   * Helper to render KanjiVG stroke animator in container
   */
  function renderKanjiStrokeView(wrapper, kanjiObj) {
    wrapper.innerHTML = '';
    if (!kanjiObj || !kanjiObj.svg) {
      wrapper.innerHTML = `<div class="jkl-loader-box">Stroke vector data not available for ${kanjiObj?.kanji || 'this character'}.</div>`;
      return;
    }

    if (typeof kanjivg !== 'undefined') {
      const parsed = kanjivg.parseSvgData(kanjiObj.svg, kanjiObj.kanji);
      const animator = kanjivg.createStrokeAnimator(parsed);
      wrapper.appendChild(animator);
    } else {
      // Fallback SVG display
      wrapper.innerHTML = `<div style="display:flex;justify-content:center;padding:12px;">${kanjiObj.svg}</div>`;
    }
  }

  /**
   * Header Drag and Drop support
   */
  function setupDrag(modal) {
    const header = modal.querySelector('.jkl-header');
    if (!header) return;

    header.addEventListener('mousedown', (e) => {
      // Ignore clicks on header buttons
      if (e.target.closest('.jkl-icon-btn')) return;

      isDragging = true;
      const rect = modal.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const newX = moveEvent.clientX - dragOffset.x;
        const newY = moveEvent.clientY - dragOffset.y;
        modal.style.left = `${Math.max(8, Math.min(window.innerWidth - modal.offsetWidth - 8, newX))}px`;
        modal.style.top = `${Math.max(8, Math.min(window.innerHeight - modal.offsetHeight - 8, newY))}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  // 1. Listen for background script messages
  extBrowser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'JISHO_SHOW_OVERLAY') {
      const selection = window.getSelection();
      let x, y;
      if (selection && selection.rangeCount > 0) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        x = rect.left;
        y = rect.bottom;
      }
      showModal(request.query, request.initialTab || 'vocab', x, y);
      sendResponse({ success: true });
    }

    if (request.type === 'JISHO_TRIGGER_SELECTION_LOOKUP') {
      const selText = (window.getSelection() ? window.getSelection().toString() : '').trim();
      if (selText) {
        const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
        showModal(selText, 'vocab', rect.left, rect.bottom);
      }
    }
  });

  // 2. Global Keyboard listener (Escape to dismiss modal)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shadowRoot) {
      const modal = shadowRoot.querySelector('.jkl-modal-container');
      if (modal) modal.remove();
    }
  });

  console.log('Jisho Kanji Lens content script loaded.');
})();
