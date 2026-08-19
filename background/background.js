/**
 * Jisho Kanji Lens - Background Service
 * Manages Context Menus, Keyboard Commands, API Requests, and Audio Playback (bypassing CSP)
 */

// Import scripts in MV3 background context if using importScripts
try {
  importScripts('../utils/storage.js', '../utils/kanjivg.js', '../utils/jisho_api.js');
} catch (e) {
  // In modern Firefox background.scripts, files can also be declared in manifest or global scope
}

// Browser API compatibility wrapper
const extBrowser = typeof browser !== 'undefined' ? browser : chrome;

// Background Audio Manager
let bgAudio = null;

// 1. Setup Context Menus
function setupContextMenus() {
  extBrowser.contextMenus.removeAll(() => {
    // Primary context menu
    extBrowser.contextMenus.create({
      id: 'jkl-lookup-selection',
      title: 'Search Jisho for "%s"',
      contexts: ['selection']
    });

    // Stroke order quick menu
    extBrowser.contextMenus.create({
      id: 'jkl-stroke-lookup',
      title: 'View Kanji Stroke Order for "%s"',
      contexts: ['selection']
    });
  });
}

extBrowser.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  console.log('Jisho Kanji Lens installed successfully.');
});

extBrowser.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

// 2. Handle Context Menu Clicks
extBrowser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id || !info.selectionText) return;

  const selectedText = info.selectionText.trim();
  if (!selectedText) return;

  const initialTab = info.menuItemId === 'jkl-stroke-lookup' ? 'strokes' : 'word';

  try {
    // Send message to content script in the active tab
    await extBrowser.tabs.sendMessage(tab.id, {
      type: 'JISHO_SHOW_OVERLAY',
      query: selectedText,
      initialTab: initialTab
    });
  } catch (err) {
    // If content script was not already loaded, inject it dynamically
    console.warn('Content script not reachable, attempting injection...', err);
    try {
      if (extBrowser.scripting && extBrowser.scripting.executeScript) {
        await extBrowser.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content/content.css']
        });
        await extBrowser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['utils/storage.js', 'utils/kanjivg.js', 'utils/jisho_api.js', 'utils/audio.js', 'content/content.js']
        });

        // Retry sending message
        await extBrowser.tabs.sendMessage(tab.id, {
          type: 'JISHO_SHOW_OVERLAY',
          query: selectedText,
          initialTab: initialTab
        });
      }
    } catch (injectErr) {
      console.error('Failed to inject content script:', injectErr);
    }
  }
});

// 3. Handle Keyboard Shortcuts
if (extBrowser.commands && extBrowser.commands.onCommand) {
  extBrowser.commands.onCommand.addListener(async (command) => {
    if (command === 'search-selection') {
      const [tab] = await extBrowser.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;

      try {
        await extBrowser.tabs.sendMessage(tab.id, {
          type: 'JISHO_TRIGGER_SELECTION_LOOKUP'
        });
      } catch (err) {
        console.warn('Keyboard trigger error:', err);
      }
    }
  });
}

// 4. Message Hub (Proxying cross-origin requests & storage sync)
extBrowser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.type) return false;

  // Handle Full Jisho Lookup
  if (request.type === 'JISHO_FULL_LOOKUP') {
    handleFullLookup(request.query)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  // Handle KanjiVG SVG Fetch
  if (request.type === 'FETCH_KANJIVG_SVG') {
    fetchKanjiVgSvg(request.kanji)
      .then(svg => sendResponse({ success: true, svg: svg }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Handle Audio Playback Request (bypassing CSP)
  if (request.type === 'PLAY_AUDIO') {
    handlePlayAudio(request.text, request.speed || 1.0, request.audioUrl)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Handle Audio Speed Change
  if (request.type === 'SET_AUDIO_SPEED') {
    if (bgAudio && !bgAudio.paused) {
      bgAudio.playbackRate = parseFloat(request.speed) || 1.0;
    }
    sendResponse({ success: true });
    return false;
  }

  // Handle Stop Audio
  if (request.type === 'STOP_AUDIO') {
    if (bgAudio) {
      bgAudio.pause();
      bgAudio.currentTime = 0;
      bgAudio = null;
    }
    sendResponse({ success: true });
    return false;
  }

  // Open Jisho web page in a new tab
  if (request.type === 'OPEN_JISHO_TAB') {
    const url = request.url || `https://jisho.org/search/${encodeURIComponent(request.query || '')}`;
    extBrowser.tabs.create({ url: url });
    sendResponse({ success: true });
    return false;
  }

  return false;
});

/**
 * Fetch and play Japanese audio in background context
 */
async function handlePlayAudio(text, speed = 1.0, customAudioUrl = null) {
  if (!text || !text.trim()) {
    throw new Error('Empty text');
  }

  const cleanText = text.trim();
  const audioUrl = customAudioUrl || `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(cleanText)}`;

  try {
    // Fetch audio stream with background host_permissions
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Audio fetch HTTP error: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const dataUrl = `data:audio/mp3;base64,${base64}`;

    // Play in background context directly
    if (typeof Audio !== 'undefined') {
      if (bgAudio) {
        bgAudio.pause();
        bgAudio.currentTime = 0;
      }
      bgAudio = new Audio(dataUrl);
      bgAudio.playbackRate = parseFloat(speed) || 1.0;
      bgAudio.play().catch(e => console.warn('Background audio.play error:', e));
    }

    return {
      success: true,
      audioDataUrl: dataUrl,
      playedInBackground: true
    };
  } catch (err) {
    console.warn('handlePlayAudio error:', err);
    throw err;
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Perform full lookup via background fetch (No CORS issues)
 */
async function handleFullLookup(query) {
  if (!query || !query.trim()) {
    throw new Error('Empty query');
  }

  const cleanQuery = query.trim();

  // 1. Fetch Words from Jisho API
  const wordApiUrl = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(cleanQuery)}`;
  let words = [];
  try {
    const res = await fetch(wordApiUrl);
    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        words = json.data.map(item => formatWordEntry(item));
      }
    }
  } catch (err) {
    console.warn('Background word fetch error:', err);
  }

  // 2. Identify Kanji in query
  const kanjiChars = [];
  for (const char of cleanQuery) {
    const code = char.codePointAt(0);
    if (
      (code >= 0x4E00 && code <= 0x9FAF) ||
      (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0xF900 && code <= 0xFAFF)
    ) {
      if (!kanjiChars.includes(char)) kanjiChars.push(char);
    }
  }

  // Fetch Kanji details & SVG for each kanji (up to 8 kanji)
  const kanjiDetailsPromises = kanjiChars.slice(0, 8).map(async (char) => {
    const details = await fetchKanjiDetailsFromHtml(char);
    const svg = await fetchKanjiVgSvg(char);
    return {
      ...details,
      svg: svg
    };
  });

  // 3. Fetch sentence examples
  const sentencesPromise = fetchSentenceExamples(cleanQuery);

  const [kanjiList, sentences] = await Promise.all([
    Promise.all(kanjiDetailsPromises),
    sentencesPromise
  ]);

  // Record into history
  try {
    const topWord = words[0];
    const topKanji = kanjiList[0];
    const historyItem = {
      query: cleanQuery,
      reading: topWord ? topWord.displayReading : (topKanji ? (topKanji.onyomi[0] || topKanji.kunyomi[0]) : ''),
      meanings: topWord ? (topWord.senses[0] ? topWord.senses[0].definitions : []) : (topKanji ? topKanji.meanings : []),
      isKanji: kanjiChars.length > 0 && cleanQuery.length <= 2,
      timestamp: Date.now()
    };
    if (typeof addHistoryItem === 'function') {
      await addHistoryItem(historyItem);
    }
  } catch (err) {
    // Non-fatal
  }

  return {
    query: cleanQuery,
    hasKanji: kanjiChars.length > 0,
    kanjiList: kanjiList,
    words: words,
    sentences: sentences,
    timestamp: Date.now()
  };
}

function formatWordEntry(raw) {
  const slug = raw.slug || '';
  const isCommon = Boolean(raw.is_common);
  const jlptList = (raw.jlpt || []).map(j => j.toUpperCase().replace('JLPT-', 'JLPT '));
  const tags = raw.tags || [];

  const japaneseForms = (raw.japanese || []).map(j => ({
    word: j.word || '',
    reading: j.reading || ''
  }));

  const primaryForm = japaneseForms[0] || { word: slug, reading: '' };
  const displayWord = primaryForm.word || primaryForm.reading || slug;
  const displayReading = primaryForm.reading || '';

  const senses = (raw.senses || []).map(sense => ({
    partsOfSpeech: sense.parts_of_speech || [],
    definitions: sense.english_definitions || [],
    tags: sense.tags || [],
    info: sense.info || [],
    seeAlso: sense.see_also || []
  }));

  return {
    slug,
    displayWord,
    displayReading,
    isCommon,
    jlpt: jlptList.length > 0 ? jlptList[0] : null,
    allJlpt: jlptList,
    tags,
    japaneseForms,
    senses,
    jishoUrl: `https://jisho.org/word/${encodeURIComponent(slug)}`
  };
}

async function fetchKanjiVgSvg(kanjiChar) {
  if (!kanjiChar) return null;
  const code = kanjiChar.codePointAt(0).toString(16).padStart(5, '0').toLowerCase();
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${code}.svg`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    return null;
  }
}

async function fetchKanjiDetailsFromHtml(kanjiChar) {
  const url = `https://jisho.org/search/${encodeURIComponent(kanjiChar)}%20%23kanji`;
  const fallback = {
    kanji: kanjiChar,
    meanings: [],
    onyomi: [],
    kunyomi: [],
    nanori: [],
    strokeCount: null,
    jlpt: null,
    grade: null,
    radical: null,
    parts: [],
    jishoUrl: url
  };

  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const html = await res.text();

    // Fast regex extraction for ServiceWorker / Background environment
    const meaningsMatch = html.match(/class="kanji-details__main-meanings"[^>]*>([\s\S]*?)<\/div>/i);
    let meanings = [];
    if (meaningsMatch) {
      meanings = meaningsMatch[1].replace(/<[^>]+>/g, '').trim().split(',').map(s => s.trim()).filter(Boolean);
    }

    // Extract On, Kun, Nanori readings by dt section
    const extractReadingsByTag = (tagName) => {
      const re = new RegExp(`<dt>\\s*${tagName}:?\\s*<\\/dt>[\\s\\S]*?<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 'i');
      const match = html.match(re);
      if (!match) return [];
      const links = [];
      const linkRe = /<a[^>]*>([\\s\\S]*?)<\/a>/gi;
      let m;
      while ((m = linkRe.exec(match[1])) !== null) {
        const clean = m[1].replace(/<[^>]+>/g, '').trim();
        if (clean && !links.includes(clean)) links.push(clean);
      }
      return links;
    };

    const onyomi = extractReadingsByTag('On');
    const kunyomi = extractReadingsByTag('Kun');
    const nanori = extractReadingsByTag('Nanori');

    const strokeMatch = html.match(/class="kanji-details__stroke_count"[^>]*>[\s\S]*?<strong>(\d+)<\/strong>/i);
    const strokeCount = strokeMatch ? parseInt(strokeMatch[1], 10) : null;

    const jlptMatch = html.match(/class="jlpt"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
    const jlpt = jlptMatch ? jlptMatch[1].trim() : null;

    const gradeMatch = html.match(/class="grade"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
    const grade = gradeMatch ? gradeMatch[1].trim() : null;

    const radicalMatch = html.match(/class="radicals"[^>]*>[\s\S]*?class="character"[^>]*>([\s\S]*?)<\/span>/i);
    const radical = radicalMatch ? radicalMatch[1].trim() : null;

    return {
      kanji: kanjiChar,
      meanings,
      onyomi,
      kunyomi,
      nanori,
      strokeCount,
      jlpt,
      grade,
      radical,
      parts: [],
      jishoUrl: url
    };
  } catch (e) {
    return fallback;
  }
}

async function fetchSentenceExamples(query) {
  const url = `https://jisho.org/search/${encodeURIComponent(query)}%20%23sentences`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const html = await res.text();

    const results = [];
    const blockRegex = /class="sentence_content"[^>]*>([\s\S]*?)<\/li>/gi;
    let block;
    while ((block = blockRegex.exec(html)) !== null && results.length < 5) {
      const blockHtml = block[1];
      const jpMatch = blockHtml.match(/class="japanese_sentence"[^>]*>([\s\S]*?)<\/ul>/i);
      const enMatch = blockHtml.match(/class="english"[^>]*>([\s\S]*?)<\/span>/i);

      if (jpMatch && enMatch) {
        const jp = jpMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const en = enMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (jp && en) {
          results.push({ japanese: jp, english: en });
        }
      }
    }
    return results;
  } catch (err) {
    return [];
  }
}
