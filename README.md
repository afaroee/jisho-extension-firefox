# Jisho Kanji Lens for Firefox

Jisho Kanji Lens is a Mozilla Firefox extension that enables instant lookups of Japanese Kanji, vocabulary, and phrases directly from any webpage using data from Jisho.org.

---

## Disclaimer

This extension is an independent open-source project and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with [Jisho.org](https://jisho.org) or any of its subsidiaries or affiliates. All dictionary and linguistic data referenced by this tool are the property of their respective owners and projects (including EDICT/JMdict, KANJIDIC, and KanjiVG).

---

## Key Features

- **Contextual In-Page Lookup**: Highlight any Japanese word or Kanji, right-click, and select **"Search Jisho"** to view definitions in a floating window.
- **Animated Stroke Order**: Interactive stroke-by-stroke diagrams for Kanji characters with playback and speed controls.
- **Pronunciation Audio**: Text-to-speech audio pronunciation for Japanese terms.
- **Definitions and Examples**: Furigana readings, meanings, JLPT levels, radicals, and contextual sentence examples.
- **Wordbook and Anki Export**: Save words to your personal list and export them to Anki TSV format.
- **Toolbar Search**: Quick dictionary search accessible directly from the browser toolbar.

---

## Installation Guide

### Option 1: Load as a Temporary Add-on (Recommended for Testing)

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click the **Load Temporary Add-on...** button.
3. Browse to the extension directory and select `manifest.json`.
4. The extension is now active in your browser.

### Option 2: Install from Release Package

1. Download the latest `.xpi` or `.zip` file from the [Releases](https://github.com/afaroee/jisho-extension-firefox/releases) page.
2. In Firefox, open `about:addons` and drag the downloaded file into the browser window to install.

---

## How to Use

### 1. In-Page Lookup
1. Highlight any Japanese text or Kanji on any webpage.
2. Right-click and select **"Search Jisho for '...'"**, or press **Alt + J**.
3. A floating card will appear displaying readings, meanings, stroke orders, and example sentences.
4. Click the speaker button to hear pronunciation, or the star button to save the word.

### 2. Toolbar Quick Search
1. Click the extension icon in the Firefox toolbar (or press **Alt + Shift + J**).
2. Type any English word, Romaji, Hiragana, or Kanji in the search field.
3. View dictionary entries, animated strokes, and your search history.

### 3. Exporting to Anki
1. Open the toolbar popup and navigate to the **Wordbook** tab.
2. Click **Export Anki** to download a formatted `.tsv` file.
3. In Anki, select **File > Import** and choose the downloaded file.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **Alt + J** | Look up selected text on the active page |
| **Alt + Shift + J** | Open toolbar search popup |
| **Esc** | Close active floating lookup card |

---

## License

This project is licensed under the MIT License.
