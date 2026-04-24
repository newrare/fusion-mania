import { AUDIO } from '../configs/constants.js';
import { optionsManager } from './options-manager.js';

/**
 * AudioManager — manages background music and sound effects using HTML5 Audio.
 * User preferences (music/sound toggles) are owned by `optionsManager`; this
 * class only reacts to changes (pause/resume music, gate SFX playback).
 * Singleton: import { audioManager } from './audio-manager.js'.
 */
class AudioManager {
  /** @type {HTMLAudioElement | null} */
  #music = null;

  /** @type {boolean} Music element is ready to play */
  #musicReady = false;

  /** @type {Map<string, HTMLAudioElement>} Preloaded SFX pool */
  #sfxPool = new Map();

  /** @type {boolean} True once the user has interacted (autoplay policy gate) */
  #unlocked = false;

  // ─── Options (delegated to optionsManager) ─────────

  /** @returns {boolean} */
  get musicEnabled() {
    return optionsManager.musicEnabled;
  }

  /** @returns {boolean} */
  get soundEnabled() {
    return optionsManager.soundEnabled;
  }

  /** @param {boolean} value */
  setMusic(value) {
    optionsManager.set('music', value);
    if (value) {
      this.#resumeMusic();
    } else {
      this.#pauseMusic();
    }
  }

  /** @param {boolean} value */
  setSound(value) {
    optionsManager.set('sound', value);
  }

  // ─── Preloading ────────────────────────────────────

  /**
   * Preload all audio assets. Call once during scene preload.
   * Uses HTML5 Audio — independent of Phaser's sound system.
   */
  preload() {
    // Music
    this.#music = new Audio(AUDIO.MUSIC);
    this.#music.loop = true;
    this.#music.volume = AUDIO.MUSIC_VOLUME;
    this.#music.preload = 'auto';
    this.#music.addEventListener(
      'canplaythrough',
      () => {
        this.#musicReady = true;
      },
      { once: true },
    );

    // Pause/resume music when the app goes to background or screen turns off
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.#pauseMusic();
      } else if (optionsManager.musicEnabled) {
        this.#resumeMusic();
      }
    });

    // SFX
    for (const [key, path] of Object.entries(AUDIO.SFX)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = Math.min(1, AUDIO.SFX_VOLUME * (AUDIO.SFX_VOLUMES[key] ?? 1.0));
      this.#sfxPool.set(key, audio);
    }
    for (const [key, path] of Object.entries(AUDIO.POWER_SFX)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = Math.min(1, AUDIO.SFX_VOLUME * (AUDIO.POWER_SFX_VOLUMES[key] ?? 1.0));
      this.#sfxPool.set(`power:${key}`, audio);
    }
  }

  // ─── Autoplay unlock ──────────────────────────────

  /**
   * Call on the first user interaction (tap/key) to unlock autoplay.
   * Browsers block audio playback until a user gesture has occurred.
   */
  unlock() {
    if (this.#unlocked) return;
    this.#unlocked = true;
    if (optionsManager.musicEnabled) {
      this.#resumeMusic();
    }

    // Global click SFX on all buttons and interactive elements via event delegation.
    // Capture phase (true) ensures stopPropagation() in modals doesn't block this listener.
    // fm-clickable is a sentinel class for non-button interactive elements (tabs, rows, items).
    const INTERACTIVE = '.fm-btn, .fm-theme-btn, .fm-clickable';
    document.addEventListener(
      'pointerdown',
      (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest(INTERACTIVE);
        if (btn) this.playSfx('click');
      },
      true,
    );
  }

  // ─── Music ─────────────────────────────────────────

  #resumeMusic() {
    if (!this.#music || !this.#unlocked) return;
    this.#music.play().catch(() => {
      /* blocked by browser policy — ignore */
    });
  }

  #pauseMusic() {
    if (!this.#music) return;
    this.#music.pause();
  }

  /** Stop music and reset to beginning. */
  stopMusic() {
    if (!this.#music) return;
    this.#music.pause();
    this.#music.currentTime = 0;
  }

  // ─── SFX ───────────────────────────────────────────

  /**
   * Play a sound effect by key (AUDIO.SFX keys, e.g. 'fusion', 'click').
   * @param {string} key
   */
  playSfx(key) {
    if (!optionsManager.soundEnabled || !this.#unlocked) return;
    const audio = this.#sfxPool.get(key);
    if (!audio) return;
    // Clone to allow overlapping playback
    const clone = /** @type {HTMLAudioElement} */ (audio.cloneNode());
    clone.volume = AUDIO.SFX_VOLUME;
    clone.play().catch(() => {
      /* ignore */
    });
  }

  /**
   * Play the SFX for a power activation (tile merges with a powered tile).
   * Expel powers play the "-in" variant; all wind variants share one SFX.
   * Lightning is NOT played here — it must be triggered per-strike via playSfx.
   * @param {string} powerType — POWER_TYPES value
   */
  playPowerSfx(powerType) {
    let key;
    if (powerType.startsWith('wind-')) {
      key = 'power:wind';
    } else {
      key = `power:${powerType}`;
    }
    this.playSfx(key);
  }
}

export const audioManager = new AudioManager();
