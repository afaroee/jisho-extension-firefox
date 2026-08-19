/**
 * Automated Unit Tests for Jisho Kanji Lens
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { KanjiVGManager } = require('../utils/kanjivg');
const { JishoAPI } = require('../utils/jisho_api');
const { exportFavoritesToAnki, DEFAULT_SETTINGS } = require('../utils/storage');

console.log('🧪 Starting Jisho Kanji Lens Test Suite...\n');

// 1. Test Manifest JSON Validity
console.log('Test 1: Validating manifest.json...');
const manifestPath = path.join(__dirname, '..', 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.strictEqual(manifest.manifest_version, 3, 'Manifest version must be 3');
assert(manifest.browser_specific_settings && manifest.browser_specific_settings.gecko, 'Must specify gecko settings for Firefox');
assert(manifest.background && manifest.background.scripts, 'Background scripts must be declared');
console.log('  ✅ Manifest structure is valid.');

// 2. Test KanjiVG Manager
console.log('\nTest 2: Validating KanjiVG Codepoint & Kanji Detection...');
const kvg = new KanjiVGManager();

assert.strictEqual(kvg.getKanjiCode('漢'), '06f22', "Hex code for '漢' should be 06f22");
assert.strictEqual(kvg.getKanjiCode('日'), '065e5', "Hex code for '日' should be 065e5");
assert.strictEqual(kvg.getKanjiCode('語'), '08a9e', "Hex code for '語' should be 08a9e");

assert.strictEqual(kvg.isKanji('漢'), true, "'漢' is Kanji");
assert.strictEqual(kvg.isKanji('あ'), false, "'あ' (Hiragana) is not Kanji");
assert.strictEqual(kvg.isKanji('A'), false, "'A' (ASCII) is not Kanji");

const extracted = kvg.extractKanji('日本語を勉強します (Learning Japanese)');
assert.deepStrictEqual(extracted, ['日', '本', '語', '勉', '強'], 'Should correctly extract unique Kanji');
console.log('  ✅ KanjiVG helpers verified.');

// 3. Test Jisho API Formatter
console.log('\nTest 3: Validating Jisho API Response Formatter...');
const api = new JishoAPI();

const mockJishoRaw = {
  slug: '日本語',
  is_common: true,
  tags: ['wanikani2'],
  jlpt: ['jlpt-n5'],
  japanese: [
    { word: '日本語', reading: 'にほんご' }
  ],
  senses: [
    {
      english_definitions: ['Japanese (language)'],
      parts_of_speech: ['Noun'],
      tags: []
    }
  ]
};

const formatted = api.formatWordEntry(mockJishoRaw);
assert.strictEqual(formatted.displayWord, '日本語');
assert.strictEqual(formatted.displayReading, 'にほんご');
assert.strictEqual(formatted.isCommon, true);
assert.strictEqual(formatted.jlpt, 'JLPT N5');
assert.strictEqual(formatted.senses[0].definitions[0], 'Japanese (language)');
console.log('  ✅ Jisho API data formatting verified.');

// 4. Test Anki TSV Exporter
console.log('\nTest 4: Validating Anki TSV Export Generation...');
const mockFavorites = [
  {
    query: '日本語',
    reading: 'にほんご',
    meanings: ['Japanese (language)'],
    jlpt: 'JLPT N5',
    isKanji: false
  },
  {
    query: '漢',
    reading: 'カン',
    meanings: ['China', 'Sino-'],
    jlpt: 'JLPT N3',
    isKanji: true
  }
];

const ankiTsv = exportFavoritesToAnki(mockFavorites);
assert(ankiTsv.includes('#separator:tab'), 'TSV header must declare separator');
assert(ankiTsv.includes('日本語\tにほんご\tJapanese (language)\tJLPT N5\tVocab JishoLens'), 'Vocab row should be formatted with tab separators');
assert(ankiTsv.includes('漢\tカン\tChina; Sino-\tJLPT N3\tKanji JishoLens'), 'Kanji row should be formatted correctly');
console.log('  ✅ Anki TSV export format verified.');

// 5. Test Katakana to Hiragana Furigana Conversion
console.log('\nTest 5: Validating Katakana to Hiragana Conversion...');
const { katakanaToHiragana } = require('../utils/jisho_api');
assert.strictEqual(katakanaToHiragana('ソウ'), 'そう', "Should convert 'ソウ' to 'そう'");
assert.strictEqual(katakanaToHiragana('ショウ'), 'しょう', "Should convert 'ショウ' to 'しょう'");
assert.strictEqual(katakanaToHiragana('ビ'), 'び', "Should convert 'ビ' to 'び'");
assert.strictEqual(katakanaToHiragana('ソ'), 'そ', "Should convert 'ソ' to 'そ'");
console.log('  ✅ Katakana to Hiragana conversion verified.');

console.log('\n🎉 All tests passed successfully!\n');
