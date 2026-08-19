/**
 * KanjiVG Stroke Order Visualizer & SVG Processor
 * Fetches and animates Japanese Kanji stroke order from KanjiVG data.
 */

class KanjiVGManager {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Convert Kanji character to 5-digit hex code
   * e.g., '漢' -> '06f22', '日' -> '065e5'
   */
  getKanjiCode(char) {
    if (!char) return null;
    const codePoint = char.codePointAt(0);
    return codePoint.toString(16).padStart(5, '0').toLowerCase();
  }

  /**
   * Check if character is a Kanji (CJK Unified Ideographs, Extensions, etc.)
   */
  isKanji(char) {
    if (!char) return false;
    const code = char.codePointAt(0);
    return (
      (code >= 0x4E00 && code <= 0x9FAF) || // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4DBF) || // CJK Unified Ideographs Extension A
      (code >= 0x20000 && code <= 0x2A6DF) || // Extension B
      (code >= 0xF900 && code <= 0xFAFF) // CJK Compatibility Ideographs
    );
  }

  /**
   * Extract all individual kanji from a string
   */
  extractKanji(str) {
    if (!str) return [];
    const kanjiList = [];
    for (const char of str) {
      if (this.isKanji(char) && !kanjiList.includes(char)) {
        kanjiList.push(char);
      }
    }
    return kanjiList;
  }

  /**
   * Build KanjiVG raw URL
   */
  getSvgUrl(char) {
    const code = this.getKanjiCode(char);
    if (!code) return null;
    return `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${code}.svg`;
  }

  /**
   * Fetch KanjiVG SVG XML for a character
   */
  async fetchSvg(char) {
    const code = this.getKanjiCode(char);
    if (!code) return null;

    if (this.cache.has(code)) {
      return this.cache.get(code);
    }

    const url = this.getSvgUrl(char);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`KanjiVG HTTP error ${response.status}`);
      }
      const svgText = await response.text();
      this.cache.set(code, svgText);
      return svgText;
    } catch (err) {
      console.warn(`Could not load KanjiVG SVG for '${char}':`, err);
      return null;
    }
  }

  /**
   * Parse KanjiVG SVG and return structured stroke data & animated SVG element
   */
  parseSvgData(svgText, kanjiChar) {
    if (!svgText) return null;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) return null;

      // Extract stroke paths
      const paths = Array.from(svg.querySelectorAll('path')).filter(p => {
        const id = p.getAttribute('id') || '';
        return id.includes('-s') || p.getAttribute('kvg:type');
      });

      // Extract stroke numbers
      const numberTexts = Array.from(svg.querySelectorAll('text')).map(t => ({
        text: t.textContent.trim(),
        transform: t.getAttribute('transform') || '',
        x: t.getAttribute('x') || '',
        y: t.getAttribute('y') || ''
      }));

      const strokeCount = paths.length;

      return {
        kanji: kanjiChar,
        code: this.getKanjiCode(kanjiChar),
        strokeCount,
        strokePaths: paths.map((p, idx) => ({
          index: idx + 1,
          id: p.getAttribute('id') || `stroke-${idx + 1}`,
          d: p.getAttribute('d'),
          type: p.getAttribute('kvg:type') || ''
        })),
        strokeNumbers: numberTexts,
        rawSvg: svgText
      };
    } catch (err) {
      console.error('Error parsing KanjiVG SVG:', err);
      return null;
    }
  }

  /**
   * Create an interactive Animated Stroke Order Component in DOM
   */
  createStrokeAnimator(strokeData, options = {}) {
    if (!strokeData || !strokeData.strokePaths) {
      const fallback = document.createElement('div');
      fallback.className = 'jkl-stroke-fallback';
      fallback.textContent = 'Stroke order data not available.';
      return fallback;
    }

    const container = document.createElement('div');
    container.className = 'jkl-stroke-animator-container';

    const baseSpeed = options.speed || 1.0;
    const showNumbers = options.showNumbers !== false;

    container.innerHTML = `
      <div class="jkl-stroke-viewer">
        <div class="jkl-stroke-canvas-wrapper">
          <svg class="jkl-stroke-svg" viewBox="0 0 109 109" width="160" height="160">
            <!-- Background Grid Lines -->
            <line x1="0" y1="54.5" x2="109" y2="54.5" class="jkl-grid-line" stroke-dasharray="2 2"/>
            <line x1="54.5" y1="0" x2="54.5" y2="109" class="jkl-grid-line" stroke-dasharray="2 2"/>
            <line x1="0" y1="0" x2="109" y2="109" class="jkl-grid-line jkl-grid-diag" stroke-dasharray="2 2"/>
            <line x1="109" y1="0" x2="0" y2="109" class="jkl-grid-line jkl-grid-diag" stroke-dasharray="2 2"/>
            
            <!-- Ghost / Background complete strokes -->
            <g class="jkl-ghost-strokes">
              ${strokeData.strokePaths.map(p => `<path d="${p.d}" class="jkl-ghost-path" />`).join('')}
            </g>

            <!-- Active Animated Strokes -->
            <g class="jkl-active-strokes">
              ${strokeData.strokePaths.map((p, i) => `
                <path id="jkl-stroke-${i}" d="${p.d}" class="jkl-anim-path" data-stroke="${i+1}" />
              `).join('')}
            </g>

            <!-- Stroke Numbers -->
            <g class="jkl-stroke-numbers ${showNumbers ? '' : 'jkl-hidden'}">
              ${strokeData.strokeNumbers.map(n => `
                <text ${n.transform ? `transform="${n.transform}"` : `x="${n.x}" y="${n.y}"`} class="jkl-number-text">${n.text}</text>
              `).join('')}
            </g>
          </svg>
        </div>

        <div class="jkl-stroke-info">
          <div class="jkl-stroke-badge">
            <span>Strokes: <strong class="jkl-current-step">0</strong> / <strong>${strokeData.strokeCount}</strong></span>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="jkl-stroke-controls">
        <button class="jkl-ctrl-btn jkl-btn-prev" title="Previous Stroke">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </button>
        <button class="jkl-ctrl-btn jkl-btn-play jkl-primary-btn" title="Play / Pause">
          <svg class="jkl-icon-play" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          <svg class="jkl-icon-pause jkl-hidden" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <button class="jkl-ctrl-btn jkl-btn-next" title="Next Stroke">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
        <button class="jkl-ctrl-btn jkl-btn-restart" title="Restart">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
        </button>
        
        <div class="jkl-speed-selector">
          <span class="jkl-speed-label">Speed:</span>
          <select class="jkl-speed-dropdown">
            <option value="0.5">0.5x</option>
            <option value="1.0" selected>1.0x</option>
            <option value="1.5">1.5x</option>
            <option value="2.0">2.0x</option>
          </select>
        </div>

        <button class="jkl-ctrl-btn jkl-btn-toggle-numbers ${showNumbers ? 'jkl-active' : ''}" title="Toggle Stroke Numbers">
          #
        </button>
      </div>

      <!-- Stroke by Stroke Step Grid -->
      <div class="jkl-stroke-steps-preview">
        <div class="jkl-step-grid-header">Stroke Sequence:</div>
        <div class="jkl-step-grid-scroller">
          ${strokeData.strokePaths.map((p, i) => `
            <div class="jkl-step-card" data-step="${i+1}" title="Stroke ${i+1}">
              <svg viewBox="0 0 109 109" width="36" height="36">
                <!-- Previous strokes grayed -->
                ${strokeData.strokePaths.slice(0, i).map(sp => `<path d="${sp.d}" stroke="#aaa" stroke-width="3" fill="none" />`).join('')}
                <!-- Current stroke highlighted in red -->
                <path d="${p.d}" stroke="#E83B3B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
              </svg>
              <span class="jkl-step-num">${i+1}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Initialize animation controller
    this.attachAnimatorLogic(container, strokeData, baseSpeed);

    return container;
  }

  /**
   * Attach interactive logic to stroke animator DOM
   */
  attachAnimatorLogic(container, strokeData, initialSpeed) {
    const paths = Array.from(container.querySelectorAll('.jkl-anim-path'));
    const stepLabel = container.querySelector('.jkl-current-step');
    const playBtn = container.querySelector('.jkl-btn-play');
    const iconPlay = container.querySelector('.jkl-icon-play');
    const iconPause = container.querySelector('.jkl-icon-pause');
    const prevBtn = container.querySelector('.jkl-btn-prev');
    const nextBtn = container.querySelector('.jkl-btn-next');
    const restartBtn = container.querySelector('.jkl-btn-restart');
    const speedDropdown = container.querySelector('.jkl-speed-dropdown');
    const toggleNumbersBtn = container.querySelector('.jkl-btn-toggle-numbers');
    const numbersGroup = container.querySelector('.jkl-stroke-numbers');
    const stepCards = Array.from(container.querySelectorAll('.jkl-step-card'));

    let currentStrokeIndex = -1; // -1 means none shown, 0..N-1
    let isPlaying = false;
    let animTimer = null;
    let speed = initialSpeed || 1.0;

    // Prepare SVG path lengths
    paths.forEach(p => {
      const len = p.getTotalLength ? p.getTotalLength() : 200;
      p.style.strokeDasharray = `${len} ${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.opacity = '0';
      p.dataset.length = len;
    });

    const updateStepUI = (index) => {
      const displayIndex = index + 1;
      if (stepLabel) stepLabel.textContent = displayIndex;
      
      stepCards.forEach((card, i) => {
        if (i === index) {
          card.classList.add('jkl-step-active');
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
          card.classList.remove('jkl-step-active');
        }
      });
    };

    const showStrokeInstantly = (index) => {
      paths.forEach((p, i) => {
        const len = parseFloat(p.dataset.length) || 200;
        if (i <= index) {
          p.style.transition = 'none';
          p.style.strokeDashoffset = '0';
          p.style.opacity = '1';
        } else {
          p.style.transition = 'none';
          p.style.strokeDashoffset = `${len}`;
          p.style.opacity = '0';
        }
      });
      currentStrokeIndex = index;
      updateStepUI(index);
    };

    const animateStroke = (index, onComplete) => {
      if (index >= paths.length) {
        stopPlay();
        return;
      }

      currentStrokeIndex = index;
      updateStepUI(index);

      const path = paths[index];
      const len = parseFloat(path.dataset.length) || 200;
      const duration = Math.max(300, (len / 120) * 1000 / speed);

      path.style.transition = 'none';
      path.style.strokeDashoffset = `${len}`;
      path.style.opacity = '1';

      // Force layout reflow
      void path.getBoundingClientRect();

      path.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`;
      path.style.strokeDashoffset = '0';

      animTimer = setTimeout(() => {
        if (onComplete && isPlaying) {
          onComplete();
        }
      }, duration + 150 / speed);
    };

    const startPlay = () => {
      isPlaying = true;
      if (iconPlay) iconPlay.classList.add('jkl-hidden');
      if (iconPause) iconPause.classList.remove('jkl-hidden');

      if (currentStrokeIndex >= paths.length - 1) {
        // Reset if reached end
        showStrokeInstantly(-1);
      }

      const next = () => {
        if (!isPlaying) return;
        if (currentStrokeIndex < paths.length - 1) {
          animateStroke(currentStrokeIndex + 1, next);
        } else {
          stopPlay();
        }
      };

      animateStroke(currentStrokeIndex + 1, next);
    };

    const stopPlay = () => {
      isPlaying = false;
      if (animTimer) clearTimeout(animTimer);
      if (iconPlay) iconPlay.classList.remove('jkl-hidden');
      if (iconPause) iconPause.classList.add('jkl-hidden');
    };

    // Play/Pause button
    playBtn.addEventListener('click', () => {
      if (isPlaying) {
        stopPlay();
      } else {
        startPlay();
      }
    });

    // Prev Button
    prevBtn.addEventListener('click', () => {
      stopPlay();
      if (currentStrokeIndex > 0) {
        showStrokeInstantly(currentStrokeIndex - 1);
      } else {
        showStrokeInstantly(-1);
      }
    });

    // Next Button
    nextBtn.addEventListener('click', () => {
      stopPlay();
      if (currentStrokeIndex < paths.length - 1) {
        showStrokeInstantly(currentStrokeIndex + 1);
      }
    });

    // Restart Button
    restartBtn.addEventListener('click', () => {
      stopPlay();
      showStrokeInstantly(-1);
      startPlay();
    });

    // Speed change
    speedDropdown.addEventListener('change', (e) => {
      speed = parseFloat(e.target.value) || 1.0;
    });

    // Toggle numbers
    toggleNumbersBtn.addEventListener('click', () => {
      const isHidden = numbersGroup.classList.toggle('jkl-hidden');
      toggleNumbersBtn.classList.toggle('jkl-active', !isHidden);
    });

    // Step cards click
    stepCards.forEach((card, idx) => {
      card.addEventListener('click', () => {
        stopPlay();
        showStrokeInstantly(idx);
      });
    });

    // Auto-start initial animation smoothly
    setTimeout(() => {
      startPlay();
    }, 200);
  }
}

// Export instance or class
const kanjivg = new KanjiVGManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KanjiVGManager, kanjivg };
}
