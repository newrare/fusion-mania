import { STORAGE_KEYS, DEFAULT_OPTIONS } from '../configs/constants.js';

class AudioManager {
  /** @type {Phaser.Scene | null} */
  #scene = null;
  #options = { ...DEFAULT_OPTIONS };

  constructor() {
    this.#loadOptions();
  }

  /**
   * Bind to a Phaser scene for sound playback.
   * @param {Phaser.Scene} scene
   */
  setScene(scene) {
    this.#scene = scene;
  }

  /** @returns {boolean} */
  get musicEnabled() {
    return this.#options.music;
  }

  /** @returns {boolean} */
  get soundEnabled() {
    return this.#options.sound;
  }

  /** @param {boolean} value */
  setMusic(value) {
    this.#options.music = value;
    this.#saveOptions();
  }

  /** @param {boolean} value */
  setSound(value) {
    this.#options.sound = value;
    this.#saveOptions();
  }

  #loadOptions() {
    const raw = localStorage.getItem(STORAGE_KEYS.OPTIONS);
    if (raw) {
      try {
        Object.assign(this.#options, JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }

  #saveOptions() {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify(this.#options));
  }
}

export const audioManager = new AudioManager();
