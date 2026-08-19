/**
 * Japanese Audio Pronunciation Engine
 * High-fidelity native Japanese audio with real-time speed adjustment & speech synthesis fallback.
 */

class JapaneseAudioPlayer {
  constructor() {
    this.currentAudio = null;
    this.currentSpeed = 1.0;
    this.isPlaying = false;
    this.onStateChange = null; // callback (isPlaying, speed)

    // Preload speech synthesis voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  /**
   * Set playback speed (e.g. 0.5, 0.75, 1.0, 1.25, 1.5)
   */
  setSpeed(speed) {
    this.currentSpeed = Math.max(0.5, Math.min(2.0, parseFloat(speed) || 1.0));
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.playbackRate = this.currentSpeed;
    }
    if (this.onStateChange) {
      this.onStateChange(this.isPlaying, this.currentSpeed);
    }
  }

  /**
   * Cycle next playback speed: 1.0x -> 0.75x -> 0.5x -> 1.25x -> 1.0x
   */
  cycleSpeed() {
    const speeds = [1.0, 0.75, 0.5, 1.25, 1.5];
    const currentIndex = speeds.findIndex(s => Math.abs(s - this.currentSpeed) < 0.05);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    this.setSpeed(newSpeed);
    return newSpeed;
  }

  /**
   * Stop any active audio playback
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying = false;
    if (this.onStateChange) {
      this.onStateChange(false, this.currentSpeed);
    }
  }

  /**
   * Play pronunciation for Japanese text
   * @param {string} text - Kanji / Japanese word to pronounce
   * @param {string} [customAudioUrl] - Optional direct audio URL from Jisho
   */
  async play(text, customAudioUrl = null) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    this.stop();
    this.isPlaying = true;
    if (this.onStateChange) {
      this.onStateChange(true, this.currentSpeed);
    }

    // 1. Try Direct Audio URL if provided or Native Audio Stream
    const audioUrl = customAudioUrl || `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(cleanText)}`;

    try {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = audioUrl;
      audio.playbackRate = this.currentSpeed;
      this.currentAudio = audio;

      audio.onended = () => {
        this.isPlaying = false;
        this.currentAudio = null;
        if (this.onStateChange) {
          this.onStateChange(false, this.currentSpeed);
        }
      };

      audio.onerror = (err) => {
        console.warn('Native audio stream failed, falling back to SpeechSynthesis:', err);
        this.playSpeechSynthesis(cleanText);
      };

      await audio.play();
    } catch (err) {
      console.warn('Audio play error, using SpeechSynthesis fallback:', err);
      this.playSpeechSynthesis(cleanText);
    }
  }

  /**
   * SpeechSynthesis Fallback
   */
  playSpeechSynthesis(text) {
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

// Export singleton instance
const jpAudio = new JapaneseAudioPlayer();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { JapaneseAudioPlayer, jpAudio };
}
