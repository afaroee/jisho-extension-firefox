# 辞 Jisho Kanji Lens for Firefox

> **Instant Kanji & Japanese Vocabulary Lookups with Interactive Stroke Order, Audio Pronunciation, and Anki Export** — Built for Mozilla Firefox.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Firefox WebExtension](https://img.shields.io/badge/Firefox-WebExtension%20MV3-FF7139?logo=firefox-browser&logoColor=white)
![No Dependencies](https://img.shields.io/badge/Dependencies-Zero-brightgreen.svg)

---

## ✨ Features

- **Instant In-Page Overlay**: Select any Japanese text or Kanji while browsing and right-click **"Search Jisho for '%s'"** (or press <kbd>Alt</kbd> + <kbd>J</kbd>). A sleek, draggable floating card appears without leaving your current tab.
- **✍️ Animated Kanji Stroke Order**: Powered by [KanjiVG](https://kanjivg.tagaini.net/) vector data.
  - Interactive playback: Play, Pause, Replay, Step-by-step forward/backward.
  - Speed selector: 0.5x (slow study mode), 1.0x, 1.5x, 2.0x.
  - Toggle numbered stroke paths and visual stroke breakdown timeline.
- **🔊 Native Japanese Speech Pronunciation**:
  - High-fidelity Japanese text-to-speech (TTS) with optional auto-pronounce setting.
- **📖 Rich Linguistic Definitions**:
  - Furigana / Kana readings, Romaji, English meanings, parts of speech, JLPT level tags (N5–N1), and common word indicators from [Jisho.org](https://jisho.org).
  - Kanji radical breakdowns, stroke counts, and school grade classifications.
- **💬 Sentence Examples**:
  - Authentic contextual Japanese sentences with English translations.
- **⭐ Wordbook & 🎴 Anki TSV Export**:
  - Bookmark words or Kanji directly with one click.
  - Export your entire wordbook to Anki-compatible `.tsv` with tags and readings formatted automatically.
- **🔍 Toolbar Search Popup**:
  - Global search bar (<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd>) with recent search history and standalone stroke visualizer.
- **🎨 Glassmorphic Dark & Light Modes**:
  - Automatically respects system preferences or custom theme choices.
  - Encapsulated inside Shadow DOM so web page CSS never breaks the overlay layout.

---

## 🚀 Installation Guide for Firefox

### Method 1: Load as Temporary Add-on (Development / Immediate Use)
1. Open Firefox and enter `about:debugging` in the address bar.
2. Click **"This Firefox"** in the left sidebar.
3. Under **Temporary Extensions**, click **"Load Temporary Add-on..."**.
4. Select `manifest.json` (or any file inside this folder).
5. The extension is now active! You will see the **辞** icon in your toolbar and the context menu available on highlighted text.

### Method 2: Install from Packaged `.zip` or `.xpi`
1. Run `npm run package` in your terminal.
2. Find the ready-to-use archive in `dist/jisho-kanji-lens-v1.0.0.zip` or `.xpi`.
3. In Firefox Developer Edition / Nightly or standard Firefox with add-on debugging, drag and drop the `.xpi` file into Firefox to install.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Alt</kbd> + <kbd>J</kbd> | Look up highlighted Japanese text / Kanji | Active Web Page |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd> | Open Extension Search Popup & History | Global Toolbar |
| <kbd>Esc</kbd> | Close active in-page lookup modal | Active Web Page |

---

## 🛠️ Developer Commands & Zero-Cost Workflow

This project is built from a **100% free developer perspective** — all build, test, packaging, and versioning tools run locally using pure Node.js with **zero external dependencies and zero paid GitHub bills**.

### 1. Run Automated Test Suite
```bash
npm test
```
Runs unit tests verifying manifest integrity, KanjiVG Unicode codepoint mapping, Jisho API parsing, and Anki TSV generation.

### 2. Package for Distribution
```bash
npm run package
```
Generates clean `.zip` and `.xpi` archives inside the `dist/` directory ready for Firefox Add-ons (AMO) submission.

### 3. Automated Semantic Version Bumping
Automatically updates `manifest.json` and `package.json`, re-packages the extension into `dist/`, and creates semantic Git release commits and tags:

```bash
# Bump patch version (e.g. 1.0.0 -> 1.0.1)
npm run bump:patch

# Bump minor version (e.g. 1.0.0 -> 1.1.0)
npm run bump:minor

# Bump major version (e.g. 1.0.0 -> 2.0.0)
npm run bump:major
```

---

## 📂 Project Architecture

```
jisho-extension-firefox/
├── manifest.json              # Firefox WebExtension Manifest V3
├── package.json               # Local automation scripts & metadata
├── LICENSE                    # MIT License
├── README.md                  # Documentation & Guides
├── icons/                     # Extension icons (SVG, 16px, 32px, 48px, 128px)
├── background/
│   └── background.js          # Service worker: context menus, hotkeys, CORS proxy
├── content/
│   ├── content.js             # Shadow DOM floating overlay, selection handler
│   └── content.css            # Glassmorphic modal styling & dark mode
├── popup/
│   ├── popup.html             # Toolbar search & wordbook interface
│   ├── popup.js               # Search controller, history, Anki export
│   └── popup.css              # Toolbar popup styles
├── options/
│   ├── options.html           # Settings & preferences page
│   ├── options.js             # Settings synchronizer
│   └── options.css            # Settings styling
├── utils/
│   ├── jisho_api.js           # Jisho.org API & HTML parser
│   ├── kanjivg.js             # KanjiVG stroke SVG loader & animator
│   └── storage.js             # Browser storage, favorites, Anki export
├── test/
│   └── api_test.js            # Automated test suite
└── scripts/
    ├── package.js             # Pure Node.js .zip / .xpi packager
    ├── bump-version.js        # Local semantic version automation
    └── generate_icons.js      # PNG icon generator
```

---

## 📄 Attributions & License

- Dictionary data powered by [Jisho.org](https://jisho.org) and [EDICT / JMdict](https://www.edrdg.org/jmdict/j_jmdict.html).
- Stroke order vector diagrams powered by [KanjiVG](https://kanjivg.tagaini.net/) (Creative Commons Attribution-Share Alike 3.0).
- Extension source code licensed under the [MIT License](LICENSE).
