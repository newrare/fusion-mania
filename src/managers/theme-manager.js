import { STORAGE_KEYS } from '../configs/constants.js';

/** Available theme identifiers */
export const THEMES = /** @type {const} */ (['candy', 'chroma']);

/**
 * Manages tile color theme.
 * Applies a `data-theme` attribute on `<html>` so CSS can scope overrides.
 */
class ThemeManager {
  /** @type {string} */
  #current;

  constructor() {
    this.#current = this.#load();
    this.#apply();
  }

  /** @returns {string} The active theme id */
  get current() {
    return this.#current;
  }

  /**
   * Switch to the next theme in the list.
   * @returns {string} The newly active theme id
   */
  toggle() {
    const idx = THEMES.indexOf(this.#current);
    this.#current = THEMES[(idx + 1) % THEMES.length];
    this.#save();
    this.#apply();
    return this.#current;
  }

  /**
   * Set a specific theme.
   * @param {string} id
   */
  set(id) {
    if (THEMES.includes(id)) {
      this.#current = id;
      this.#save();
      this.#apply();
    }
  }

  /** Apply the theme attribute to the document root */
  #apply() {
    document.documentElement.setAttribute('data-theme', this.#current);
  }

  /** @returns {string} */
  #load() {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);
    return THEMES.includes(stored) ? stored : THEMES[0];
  }

  #save() {
    localStorage.setItem(STORAGE_KEYS.THEME, this.#current);
  }
}

export const themeManager = new ThemeManager();
