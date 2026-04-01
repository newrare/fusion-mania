import { layout } from '../managers/layout-manager.js';
import { i18n } from '../managers/i18n-manager.js';
import { themeManager } from '../managers/theme-manager.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Options modal — theme toggle, music/sound toggles, reset ranking.
 */
export class OptionsModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ onClose?: Function }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;

    const themeLabel = i18n.t(`options.theme_${themeManager.current}`);
    const langLabel = i18n.t(`options.lang_${i18n.locale}`);

    const html = `
      <div class="fm-modal-overlay" id="fm-options-overlay">
        <div class="fm-modal">
          <div class="fm-modal-title">${i18n.t('options.title')}</div>
          <div class="fm-modal-buttons">
            <div class="fm-option-row">
              <span class="fm-option-label">${i18n.t('options.theme')}</span>
              <button class="fm-theme-btn" data-action="theme" id="fm-theme-label">${themeLabel}</button>
            </div>
            <div class="fm-option-row">
              <span class="fm-option-label">${i18n.t('options.language')}</span>
              <button class="fm-theme-btn" data-action="language" id="fm-lang-label">${langLabel}</button>
            </div>
            <button class="fm-btn" data-action="close">${i18n.t('options.close')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(110);

    const overlay = this.#domElement.node.querySelector('#fm-options-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const action = btn.dataset.action;
      switch (action) {
        case 'theme': {
          const newTheme = themeManager.toggle();
          const label = this.#domElement?.node.querySelector('#fm-theme-label');
          if (label) label.textContent = i18n.t(`options.theme_${newTheme}`);
          break;
        }
        case 'language': {
          const locales = i18n.availableLocales;
          const next = locales[(locales.indexOf(i18n.locale) + 1) % locales.length];
          i18n.setLocale(next);
          const langEl = this.#domElement?.node.querySelector('#fm-lang-label');
          if (langEl) langEl.textContent = i18n.t(`options.lang_${next}`);
          break;
        }
        case 'close':
          options.onClose?.();
          break;
      }
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard, {
      onEscape: () => options.onClose?.(),
    });

    this.#unsubI18n = i18n.onChange(() => this.#refresh());
  }

  #refresh() {
    const overlay = this.#domElement?.node;
    if (!overlay) return;
    const title = overlay.querySelector('.fm-modal-title');
    if (title) title.textContent = i18n.t('options.title');
    const labels = overlay.querySelectorAll('.fm-option-label');
    const labelKeys = ['options.theme', 'options.language'];
    labels.forEach((el, i) => { if (labelKeys[i]) el.textContent = i18n.t(labelKeys[i]); });
    const closeBtn = overlay.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.textContent = i18n.t('options.close');
    const themeEl = overlay.querySelector('#fm-theme-label');
    if (themeEl) themeEl.textContent = i18n.t(`options.theme_${themeManager.current}`);
    const langEl = overlay.querySelector('#fm-lang-label');
    if (langEl) langEl.textContent = i18n.t(`options.lang_${i18n.locale}`);
  }

  destroy() {
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
