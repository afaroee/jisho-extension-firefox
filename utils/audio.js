/**
 * Japanese Audio Pronunciation Engine
 * Communicates with background script to bypass webpage CSP and play native Japanese audio with speed controls.
 */

class JapaneseAudioPlayer {
  constructor() {
    this.currentAudio = null;
    this.currentSpeed = 1.0;
    this.isPlaying = false;
    this.onStateChange = null;
    this.extBrowser = typeof browser !== 'undefined' ? browser : chrome;
  }

  setSpeed(speed) {
    this.currentSpeed = Math.max(0.5, Math.min(2.0, parseFloat(speed) || 1.0));
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.playbackRate = this.currentSpeed;
    }
    // Also notify background if active
    try {
      this.extBrowser.runtime.sendMessage({
        type: 'SET_AUDIO_SPEED',
        speed: this.currentSpeed
      }).catch(() => {});
    } catch (e) {}

    if (this.onStateChange) {
      this.onStateChange(this.isPlaying, this.currentSpeed);
    }
  }

  cycleSpeed() {
    const speeds = [1.0, 0.75, 0.5, 1.25, 1.5];
    const currentIndex = speeds.findIndex(s => Math.abs(s - this.currentSpeed) < 0.05);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    this.setSpeed(newSpeed);
    return newSpeed;
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    try {
      this.extBrowser.runtime.sendMessage({ type: 'STOP_AUDIO' }).catch(() => {});
    } catch (e) {}

    this.isPlaying = false;
    if (this.onStateChange) {
      this.onStateChange(false, this.currentSpeed);
    }
  }

  /**
   * Play pronunciation for Japanese text
   * Requests audio data from background worker to bypass page CSP restrictions
   */
  async play(text, customAudioUrl = null) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    this.stop();
    this.isPlaying = true;
    if (this.onStateChange) {
      this.onStateChange(true, this.currentSpeed);
    }

    try {
      // 1. Request background service to fetch or stream the audio data
      const response = await this.extBrowser.runtime.sendMessage({
        type: 'PLAY_AUDIO',
        text: cleanText,
        speed: this.currentSpeed,
        audioUrl: customAudioUrl
      });

      if (response && response.success && response.audioDataUrl) {
        // Play data URL locally in page
        const audio = new Audio();
        audio.src = response.audioDataUrl;
        audio.playbackRate = this.currentSpeed;
        this.currentAudio = audio;

        audio.onended = () => {
          this.isPlaying = false;
          this.currentAudio = null;
          if (this.onStateChange) this.onStateChange(false, this.currentSpeed);
        };

        audio.onerror = () => {
          this.fallbackSpeechSynthesis(cleanText);
        };

        await audio.play();
      } else if (response && response.playedInBackground) {
        // Audio played directly in background script
        // Wait estimated duration or until background completes
        const estimatedDuration = Math.max(1200, (cleanText.length * 400) / this.currentSpeed);
        setTimeout(() => {
          this.isPlaying = false;
          if (this.onStateChange) this.onStateChange(false, this.currentSpeed);
        }, estimatedDuration);
      } else {
        this.fallbackSpeechSynthesis(cleanText);
      }
    } catch (err) {
      console.warn('Audio message error, falling back to Web Speech:', err);
      this.fallbackSpeechSynthesis(cleanText);
    }
  }

  /**
   * Browser SpeechSynthesis Fallback
   */
  fallbackSpeechSynthesis(text) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.isPlaying = false;
      if (this.onStateChange) this.onStateChange(false, this.currentSpeed);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = this.currentSpeed;

      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find(v => v.lang.startsWith('ja') || (v.name && v.name.toLowerCase().includes('japanese')));
      if (jaVoice) utterance.voice = jaVoice;

      utterance.onend = () => {
        this.isPlaying = false;
        if (this.onStateChange) this.onStateChange(false, this.currentSpeed);
      };

      utterance.onerror = () => {
        this.isPlaying = false;
        if (this.onStateChange) this.onStateChange(false, this.currentSpeed);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      this.isPlaying = false;
      if (this.onStateChange) this.onStateChange(false, this.currentSpeed);
    }
  }
}

// Singleton
const jpAudio = new JapaneseAudioPlayer();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { JapaneseAudioPlayer, jpAudio };
}
