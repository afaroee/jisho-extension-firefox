/**
 * Jisho.org API & Japanese Linguistic Data Parser
 * Retrieves dictionary entries, kanji metadata, readings, and example sentences.
 */

class JishoAPI {
  constructor() {
    this.apiBase = 'https://jisho.org/api/v1/search/words';
    this.searchBase = 'https://jisho.org/search';
  }

  /**
   * Search for words on Jisho.org API
   * @param {string} query 
   */
  async searchWords(query) {
    if (!query || !query.trim()) return [];
    
    const cleanQuery = query.trim();
    const url = `${this.apiBase}?keyword=${encodeURIComponent(cleanQuery)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Jisho API returned status ${response.status}`);
      }

      const json = await response.json();
      if (!json.data || !Array.isArray(json.data)) {
        return [];
      }

      return json.data.map(item => this.formatWordEntry(item));
    } catch (err) {
      console.error('Jisho searchWords error:', err);
      throw err;
    }
  }

  /**
   * Formats a raw Jisho API entry into a standardized, easy-to-render object
   */
  formatWordEntry(raw) {
    const slug = raw.slug || '';
    const isCommon = Boolean(raw.is_common);
    const jlptList = (raw.jlpt || []).map(j => j.toUpperCase().replace('JLPT-', 'JLPT '));
    const tags = raw.tags || [];

    // Main Japanese forms (word + reading)
    const japaneseForms = (raw.japanese || []).map(j => ({
      word: j.word || '',
      reading: j.reading || ''
    }));

    // Primary display word & reading
    const primaryForm = japaneseForms[0] || { word: slug, reading: '' };
    const displayWord = primaryForm.word || primaryForm.reading || slug;
    const displayReading = primaryForm.reading || '';

    // English senses / definitions
    const senses = (raw.senses || []).map(sense => ({
      partsOfSpeech: sense.parts_of_speech || [],
      definitions: sense.english_definitions || [],
      tags: sense.tags || [],
      info: sense.info || [],
      seeAlso: sense.see_also || [],
      antonyms: sense.antonyms || [],
      restrictions: sense.restrictions || []
    }));

    // Check for any attached audio
    let audioUrl = null;
    if (raw.audio && raw.audio.length > 0) {
      audioUrl = raw.audio[0].src || null;
    }

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
      audioUrl,
      jishoUrl: `https://jisho.org/word/${encodeURIComponent(slug)}`
    };
  }

  /**
   * Scrape / parse detailed Kanji information from Jisho Kanji page
   * @param {string} kanjiChar 
   */
  async fetchKanjiDetails(kanjiChar) {
    if (!kanjiChar) return null;
    const url = `${this.searchBase}/${encodeURIComponent(kanjiChar)}%20%23kanji`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch Kanji page: ${response.status}`);
      }

      const html = await response.text();
      return this.parseKanjiHtml(html, kanjiChar);
    } catch (err) {
      console.warn(`Could not scrape Jisho Kanji details for '${kanjiChar}':`, err);
      // Return basic structure
      return {
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
        jishoUrl: `https://jisho.org/search/${encodeURIComponent(kanjiChar)}%20%23kanji`
      };
    }
  }

  /**
   * Parse Jisho Kanji HTML string
   */
  parseKanjiHtml(html, kanjiChar) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Meanings
      const meaningNodes = doc.querySelectorAll('.kanji-details__main-meanings');
      let meanings = [];
      if (meaningNodes.length > 0) {
        meanings = meaningNodes[0].textContent.trim().split(',').map(s => s.trim()).filter(Boolean);
      }

      // On-yomi (Katakana readings)
      const onyomiNodes = doc.querySelectorAll('.dictionary_codes .onyomi a, .kanji-details__main-readings .onyomi a');
      const onyomi = Array.from(onyomiNodes).map(n => n.textContent.trim()).filter(Boolean);

      // Kun-yomi (Hiragana readings)
      const kunyomiNodes = doc.querySelectorAll('.dictionary_codes .kunyomi a, .kanji-details__main-readings .kunyomi a');
      const kunyomi = Array.from(kunyomiNodes).map(n => n.textContent.trim()).filter(Boolean);

      // Nanori readings (Name readings)
      const nanoriNodes = doc.querySelectorAll('.dictionary_codes .nanori a, .kanji-details__main-readings .nanori a');
      const nanori = Array.from(nanoriNodes).map(n => n.textContent.trim()).filter(Boolean);

      // Stroke Count
      let strokeCount = null;
      const strokeNode = doc.querySelector('.kanji-details__stroke_count');
      if (strokeNode) {
        const match = strokeNode.textContent.match(/(\d+)/);
        if (match) strokeCount = parseInt(match[1], 10);
      }

      // JLPT Level
      let jlpt = null;
      const jlptNode = doc.querySelector('.jlpt strong');
      if (jlptNode) {
        jlpt = jlptNode.textContent.trim();
      }

      // Grade Level (taught in school)
      let grade = null;
      const gradeNode = doc.querySelector('.grade strong');
      if (gradeNode) {
        grade = gradeNode.textContent.trim();
      }

      // Radical & Parts
      let radical = null;
      const radicalNode = doc.querySelector('.radicals .character');
      if (radicalNode) {
        radical = radicalNode.textContent.trim();
      }

      const partNodes = doc.querySelectorAll('.parts a');
      const parts = Array.from(partNodes).map(n => n.textContent.trim()).filter(Boolean);

      return {
        kanji: kanjiChar,
        meanings,
        onyomi: [...new Set(onyomi)],
        kunyomi: [...new Set(kunyomi)],
        nanori: [...new Set(nanori)],
        strokeCount,
        jlpt,
        grade,
        radical,
        parts: [...new Set(parts)],
        jishoUrl: `https://jisho.org/search/${encodeURIComponent(kanjiChar)}%20%23kanji`
      };
    } catch (err) {
      console.error('Error parsing Kanji HTML:', err);
      return {
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
        jishoUrl: `https://jisho.org/search/${encodeURIComponent(kanjiChar)}%20%23kanji`
      };
    }
  }

  /**
   * Fetch sentence examples for a word/kanji
   * @param {string} query 
   */
  async fetchSentenceExamples(query) {
    if (!query) return [];
    const url = `${this.searchBase}/${encodeURIComponent(query)}%20%23sentences`;

    try {
      const response = await fetch(url);
      if (!response.ok) return [];

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const sentenceEntries = doc.querySelectorAll('.sentence_content');
      const results = [];

      sentenceEntries.forEach(entry => {
        const japaneseNode = entry.querySelector('.japanese_sentence');
        const englishNode = entry.querySelector('.english');

        if (japaneseNode && englishNode) {
          const japaneseText = japaneseNode.textContent.replace(/\s+/g, ' ').trim();
          const englishText = englishNode.textContent.replace(/\s+/g, ' ').trim();
          
          if (japaneseText && englishText) {
            results.push({
              japanese: japaneseText,
              english: englishText
            });
          }
        }
      });

      return results.slice(0, 5); // Limit to top 5 examples
    } catch (err) {
      console.warn('Sentence fetch error:', err);
      return [];
    }
  }

  /**
   * Unified search method: Retrieves word definitions, Kanji breakdowns, and stroke order
   * @param {string} text 
   */
  async fullLookup(text) {
    if (!text) return null;
    const query = text.trim();

    // 1. Fetch word definitions from Jisho API
    const wordsPromise = this.searchWords(query);

    // 2. Check for individual Kanji
    const kanjiChars = [];
    for (const char of query) {
      const code = char.codePointAt(0);
      if (
        (code >= 0x4E00 && code <= 0x9FAF) ||
        (code >= 0x3400 && code <= 0x4DBF) ||
        (code >= 0xF900 && code <= 0xFAFF)
      ) {
        if (!kanjiChars.includes(char)) kanjiChars.push(char);
      }
    }

    const kanjiPromises = kanjiChars.slice(0, 6).map(char => this.fetchKanjiDetails(char));
    const sentencesPromise = this.fetchSentenceExamples(query);

    const [words, kanjiList, sentences] = await Promise.all([
      wordsPromise.catch(() => []),
      Promise.all(kanjiPromises).catch(() => []),
      sentencesPromise.catch(() => [])
    ]);

    return {
      query,
      hasKanji: kanjiChars.length > 0,
      kanjiList: kanjiList.filter(Boolean),
      words,
      sentences,
      searchedAt: Date.now()
    };
  }
}

// Export singleton instance
const jishoAPI = new JishoAPI();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { JishoAPI, jishoAPI };
}
