import { STORAGE_KEYS, DEFAULT_OPTIONS } from '../configs/constants.js';

/**
 * OptionsManager — single source of truth for user preferences persisted in
 * `STORAGE_KEYS.OPTIONS` (music, sound, animSkip, …). Side-effect-free: managers
 * with side effects (AudioManager for music/SFX) read/write through this
 * singleton but keep their own reactions (pause/resume music, etc.).
 *
 * Import as `{ optionsManager }`.
 */
class OptionsManager {
  #options = { ...DEFAULT_OPTIONS };

  constructor() {
    this.#load();
  }

  // ─── Generic accessors ─────────────────────────────

  /**
   * @template {keyof typeof DEFAULT_OPTIONS} K
   * @param {K} key
   * @returns {(typeof DEFAULT_OPTIONS)[K]}
   */
  get(key) {
    return this.#options[key];
  }

  /**
   * @template {keyof typeof DEFAULT_OPTIONS} K
   * @param {K} key
   * @param {(typeof DEFAULT_OPTIONS)[K]} value
   */
  set(key, value) {
    this.#options[key] = value;
    this.#save();
  }

  // ─── Named accessors (convenience) ─────────────────

  get musicEnabled() {
    return this.#options.music;
  }

  get soundEnabled() {
    return this.#options.sound;
  }

  /** True when swipes are allowed to interrupt / skip ongoing tile animations. */
  get animSkipEnabled() {
    return this.#options.animSkip;
  }

  // ─── Persistence ───────────────────────────────────

  #load() {
    const raw = localStorage.getItem(STORAGE_KEYS.OPTIONS);
    if (!raw) return;
    try {
      Object.assign(this.#options, JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }

  #save() {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify(this.#options));
  }
}

export const optionsManager = new OptionsManager();
