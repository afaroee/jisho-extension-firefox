/**
 * Jisho Kanji Lens - Options Page Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const themeSelect = document.getElementById('setting-theme');
  const popupPosSelect = document.getElementById('setting-popup-pos');
  const strokeSpeedSelect = document.getElementById('setting-stroke-speed');
  const strokeNumbersToggle = document.getElementById('setting-stroke-numbers');
  const autoAudioToggle = document.getElementById('setting-auto-audio');
  const rememberSizeSelect = document.getElementById('setting-remember-size');
  const resetDimensionsBtn = document.getElementById('btn-reset-dimensions');
  const saveIndicator = document.getElementById('save-indicator');

  let currentSettings = {};

  // Load existing settings
  if (typeof getSettings === 'function') {
    currentSettings = await getSettings();
    
    themeSelect.value = currentSettings.theme || 'auto';
    popupPosSelect.value = currentSettings.popupPosition || 'cursor';
    strokeSpeedSelect.value = String(currentSettings.strokeAnimationSpeed || '1.0');
    strokeNumbersToggle.checked = currentSettings.showStrokeNumbers !== false;
    autoAudioToggle.checked = Boolean(currentSettings.autoPlayAudio);
    if (rememberSizeSelect) {
      rememberSizeSelect.value = String(currentSettings.rememberModalSize !== false);
    }
  }

  function showSaveFeedback() {
    saveIndicator.classList.add('visible');
    setTimeout(() => {
      saveIndicator.classList.remove('visible');
    }, 1500);
  }

  async function updateSetting(key, value) {
    currentSettings[key] = value;
    if (typeof saveSettings === 'function') {
      await saveSettings(currentSettings);
      showSaveFeedback();
    }
  }

  themeSelect.addEventListener('change', (e) => {
    updateSetting('theme', e.target.value);
  });

  popupPosSelect.addEventListener('change', (e) => {
    updateSetting('popupPosition', e.target.value);
  });

  strokeSpeedSelect.addEventListener('change', (e) => {
    updateSetting('strokeAnimationSpeed', parseFloat(e.target.value));
  });

  strokeNumbersToggle.addEventListener('change', (e) => {
    updateSetting('showStrokeNumbers', e.target.checked);
  });

  autoAudioToggle.addEventListener('change', (e) => {
    updateSetting('autoPlayAudio', e.target.checked);
  });

  if (rememberSizeSelect) {
    rememberSizeSelect.addEventListener('change', (e) => {
      updateSetting('rememberModalSize', e.target.value === 'true');
    });
  }

  if (resetDimensionsBtn) {
    resetDimensionsBtn.addEventListener('click', async () => {
      if (typeof resetModalDimensions === 'function') {
        await resetModalDimensions();
        showSaveFeedback();
      }
    });
  }
});
