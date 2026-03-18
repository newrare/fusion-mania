import { en } from '../locales/en.js';
import { fr } from '../locales/fr.js';
import { STORAGE_KEYS } from '../configs/constants.js';

const LOCALES = { en, fr };

class I18nManager {
  #locale = 'en';
  #listeners = new Set();

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEYS.LOCALE);
    if (saved && LOCALES[saved]) {
      this.#locale = saved;
    }
  }

  /** @returns {string} Current locale code */
  get locale() {
    return this.#locale;
  }

  /** @returns {string[]} */
  get availableLocales() {
    return Object.keys(LOCALES);
  }

  /**
   * Translate a key with optional interpolation.
   * @param {string} key
   * @param {Record<string, string>} [params]
   * @returns {string}
   */
  t(key, params) {
    const dict = LOCALES[this.#locale] ?? LOCALES.en;
    let text = dict[key];
    if (text === undefined) {
      console.warn(`[i18n] Missing key: "${key}" for locale "${this.#locale}"`);
      return key;
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, v);
      }
    }
    return text;
  }

  /**
   * Switch locale and persist.
   * @param {string} code
   */
  setLocale(code) {
    if (!LOCALES[code]) return;
    this.#locale = code;
    localStorage.setItem(STORAGE_KEYS.LOCALE, code);
    for (const cb of this.#listeners) cb(code);
  }

  /**
   * Subscribe to locale changes.
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  onChange(callback) {
    this.#listeners.add(callback);
    return () => this.#listeners.delete(callback);
  }
}

export const i18n = new I18nManager();
