/**
 * Synchronized Storage Manager for Jisho Kanji Lens
 * Handles history, favorites (wordbook), and user settings.
 */

const STORAGE_KEYS = {
  SETTINGS: 'jkl_settings',
  HISTORY: 'jkl_history',
  FAVORITES: 'jkl_favorites'
};

const DEFAULT_SETTINGS = {
  theme: 'auto', // 'auto' | 'dark' | 'light'
  popupPosition: 'cursor', // 'cursor' | 'center' | 'top-right'
  autoPlayAudio: false,
  strokeAnimationSpeed: 1.0, // 0.5x, 1x, 1.5x, 2x
  showStrokeNumbers: true,
  triggerMode: 'contextMenu', // 'contextMenu' | 'doubleClick' | 'hotkey'
  fontSize: 'medium', // 'small' | 'medium' | 'large'
  maxHistoryItems: 100
};

// Check if browser.storage is available (Firefox / Chrome WebExtension)
const storageAPI = (typeof browser !== 'undefined' && browser.storage)
  ? browser.storage.local
  : (typeof chrome !== 'undefined' && chrome.storage)
    ? chrome.storage.local
    : null;

/**
 * Get Settings
 */
async function getSettings() {
  if (!storageAPI) return { ...DEFAULT_SETTINGS };
  try {
    const res = await storageAPI.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(res[STORAGE_KEYS.SETTINGS] || {}) };
  } catch (err) {
    console.error('Failed to get settings:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save Settings
 */
async function saveSettings(settings) {
  if (!storageAPI) return;
  try {
    await storageAPI.set({ [STORAGE_KEYS.SETTINGS]: settings });
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

/**
 * Get Search History
 */
async function getHistory() {
  if (!storageAPI) return [];
  try {
    const res = await storageAPI.get(STORAGE_KEYS.HISTORY);
    return res[STORAGE_KEYS.HISTORY] || [];
  } catch (err) {
    console.error('Failed to get history:', err);
    return [];
  }
}

/**
 * Add item to Search History
 */
async function addHistoryItem(item) {
  if (!storageAPI || !item || !item.query) return;
  try {
    const settings = await getSettings();
    const history = await getHistory();
    
    // Remove duplicates
    const filtered = history.filter(h => h.query.toLowerCase() !== item.query.toLowerCase());
    
    // Prepend new item
    const newItem = {
      query: item.query,
      reading: item.reading || '',
      meanings: item.meanings || [],
      isKanji: Boolean(item.isKanji),
      timestamp: Date.now()
    };
    
    filtered.unshift(newItem);
    
    // Trim to max items
    const trimmed = filtered.slice(0, settings.maxHistoryItems || 100);
    await storageAPI.set({ [STORAGE_KEYS.HISTORY]: trimmed });
  } catch (err) {
    console.error('Failed to add history item:', err);
  }
}

/**
 * Clear History
 */
async function clearHistory() {
  if (!storageAPI) return;
  try {
    await storageAPI.set({ [STORAGE_KEYS.HISTORY]: [] });
  } catch (err) {
    console.error('Failed to clear history:', err);
  }
}

/**
 * Get Favorites / Wordbook
 */
async function getFavorites() {
  if (!storageAPI) return [];
  try {
    const res = await storageAPI.get(STORAGE_KEYS.FAVORITES);
    return res[STORAGE_KEYS.FAVORITES] || [];
  } catch (err) {
    console.error('Failed to get favorites:', err);
    return [];
  }
}

/**
 * Toggle or Add Favorite
 */
async function toggleFavorite(item) {
  if (!storageAPI || !item || !item.query) return false;
  try {
    const favorites = await getFavorites();
    const index = favorites.findIndex(f => f.query.toLowerCase() === item.query.toLowerCase());
    
    if (index >= 0) {
      // Remove from favorites
      favorites.splice(index, 1);
      await storageAPI.set({ [STORAGE_KEYS.FAVORITES]: favorites });
      return false; // Not favorited anymore
    } else {
      // Add to favorites
      favorites.unshift({
        query: item.query,
        reading: item.reading || '',
        meanings: item.meanings || [],
        jlpt: item.jlpt || null,
        isKanji: Boolean(item.isKanji),
        timestamp: Date.now()
      });
      await storageAPI.set({ [STORAGE_KEYS.FAVORITES]: favorites });
      return true; // Favorited
    }
  } catch (err) {
    console.error('Failed to toggle favorite:', err);
    return false;
  }
}

/**
 * Check if query is in favorites
 */
async function isFavorite(query) {
  if (!storageAPI || !query) return false;
  try {
    const favorites = await getFavorites();
    return favorites.some(f => f.query.toLowerCase() === query.toLowerCase());
  } catch (err) {
    return false;
  }
}

/**
 * Export Favorites to Anki CSV / TSV Format
 */
function exportFavoritesToAnki(favorites) {
  if (!favorites || favorites.length === 0) return '';
  
  // Format: Front (Kanji/Word) \t Reading \t Meanings \t JLPT \t Tags
  const rows = favorites.map(f => {
    const front = (f.query || '').replace(/\t|\n/g, ' ').trim();
    const reading = (f.reading || '').replace(/\t|\n/g, ' ').trim();
    const meanings = (Array.isArray(f.meanings) ? f.meanings.join('; ') : (f.meanings || '')).replace(/\t|\n/g, ' ').trim();
    const jlpt = (f.jlpt || '').replace(/\t|\n/g, ' ').trim();
    const tags = f.isKanji ? 'Kanji JishoLens' : 'Vocab JishoLens';
    return `${front}\t${reading}\t${meanings}\t${jlpt}\t${tags}`;
  });
  
  // Header line
  return `#separator:tab\n#html:false\n#tags column:5\n#Front\tReading\tMeaning\tJLPT\tTags\n` + rows.join('\n');
}

// Export for module/script usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings,
    getHistory,
    addHistoryItem,
    clearHistory,
    getFavorites,
    toggleFavorite,
    isFavorite,
    exportFavoritesToAnki
  };
}
