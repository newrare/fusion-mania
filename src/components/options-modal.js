import { layout } from '../managers/layout-manager.js';
import { i18n } from '../managers/i18n-manager.js';
import { themeManager } from '../managers/theme-manager.js';
import { audioManager } from '../managers/audio-manager.js';
import { optionsManager } from '../managers/options-manager.js';
import { saveManager } from '../managers/save-manager.js';
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

  /** @type {boolean} */
  #showResume = false;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ onClose?: Function, showResume?: boolean, onResume?: Function }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;
    this.#showResume = !!options.showResume;

    const themeLabel = i18n.t(`options.theme_${themeManager.current}`);
    const langLabel = i18n.t(`options.lang_${i18n.locale}`);
    const musicLabel = audioManager.musicEnabled ? 'ON' : 'OFF';
    const soundLabel = audioManager.soundEnabled ? 'ON' : 'OFF';
    const animSkipLabel = optionsManager.animSkipEnabled ? 'ON' : 'OFF';

    const html = `
      <div class="fm-modal-overlay" id="fm-options-overlay">
        <div class="fm-modal">
          <div class="fm-modal-title">${i18n.t('options.title')}</div>
          <div class="fm-modal-buttons">
            <div class="fm-option-row">
              <span class="fm-option-label">${i18n.t('options.music')}</span>
              <button class="fm-theme-btn" data-action="music" id="fm-music-label">${musicLabel}</button>
            </div>
            <div class="fm-option-row">
              <span class="fm-option-label">${i18n.t('options.sound')}</span>
              <button class="fm-theme-btn" data-action="sound" id="fm-sound-label">${soundLabel}</button>
            </div>
            <div class="fm-option-row">
              <span class="fm-option-label">${i18n.t('options.theme')}</span>
              <button class="fm-theme-btn" data-action="theme" id="fm-theme-label">${themeLabel}</button>
            </div>
            <div class="fm-option-row">
              <span class="fm-option-label">${i18n.t('options.language')}</span>
              <button class="fm-theme-btn" data-action="language" id="fm-lang-label">${langLabel}</button>
            </div>
            <div class="fm-option-row">
              <span class="fm-option-label">${i18n.t('options.anim_skip')}</span>
              <button class="fm-theme-btn" data-action="anim-skip" id="fm-anim-skip-label">${animSkipLabel}</button>
            </div>
            <button class="fm-btn fm-btn--danger" data-action="reset-ranking" id="fm-reset-ranking-btn">${i18n.t('options.reset_data')}</button>
            <div class="fm-reset-success" id="fm-reset-success" style="display:none"></div>
            <div class="fm-confirm-row" id="fm-reset-confirm" style="display:none">
              <span class="fm-confirm-label" id="fm-reset-confirm-label">${i18n.t('options.reset_data_confirm')}</span>
              <div class="fm-confirm-btns">
                <button class="fm-btn fm-btn--primary" data-action="reset-yes">${i18n.t('confirm.yes')}</button>
                <button class="fm-btn" data-action="reset-no">${i18n.t('confirm.no')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(110);

    const overlay = this.#domElement.node.querySelector('#fm-options-overlay');
    // Click outside modal = close
    overlay?.addEventListener('pointerdown', (e) => {
      const modal = /** @type {HTMLElement} */ (e.target).closest('.fm-modal');
      if (!modal) { options.onClose?.(); return; }
    });
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const action = btn.dataset.action;
      switch (action) {
        case 'music': {
          const next = !audioManager.musicEnabled;
          audioManager.setMusic(next);
          const label = this.#domElement?.node.querySelector('#fm-music-label');
          if (label) label.textContent = next ? 'ON' : 'OFF';
          break;
        }
        case 'sound': {
          const next = !audioManager.soundEnabled;
          audioManager.setSound(next);
          const label = this.#domElement?.node.querySelector('#fm-sound-label');
          if (label) label.textContent = next ? 'ON' : 'OFF';
          break;
        }
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
        case 'anim-skip': {
          const next = !optionsManager.animSkipEnabled;
          optionsManager.set('animSkip', next);
          const label = this.#domElement?.node.querySelector('#fm-anim-skip-label');
          if (label) label.textContent = next ? 'ON' : 'OFF';
          break;
        }
        case 'reset-ranking': {
          const confirmRow = this.#domElement?.node.querySelector('#fm-reset-confirm');
          const resetBtn = this.#domElement?.node.querySelector('#fm-reset-ranking-btn');
          if (confirmRow) confirmRow.style.display = 'flex';
          if (resetBtn) resetBtn.style.display = 'none';
          break;
        }
        case 'reset-yes': {
          saveManager.resetAllData();
          const confirmRow = this.#domElement?.node.querySelector('#fm-reset-confirm');
          const resetBtn = this.#domElement?.node.querySelector('#fm-reset-ranking-btn');
          if (confirmRow) confirmRow.style.display = 'none';
          if (resetBtn) resetBtn.style.display = '';
          const successEl = this.#domElement?.node.querySelector('#fm-reset-success');
          if (successEl) {
            successEl.textContent = i18n.t('options.reset_data_success');
            successEl.style.display = 'block';
            setTimeout(() => {
              if (successEl) successEl.style.display = 'none';
            }, 2500);
          }
          break;
        }
        case 'reset-no': {
          const confirmRow = this.#domElement?.node.querySelector('#fm-reset-confirm');
          const resetBtn = this.#domElement?.node.querySelector('#fm-reset-ranking-btn');
          if (confirmRow) confirmRow.style.display = 'none';
          if (resetBtn) resetBtn.style.display = '';
          break;
        }
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
    const labelKeys = [
      'options.music',
      'options.sound',
      'options.theme',
      'options.language',
      'options.anim_skip',
    ];
    labels.forEach((el, i) => {
      if (labelKeys[i]) el.textContent = i18n.t(labelKeys[i]);
    });
    const resumeBtn = overlay.querySelector('[data-action="resume"]');
    if (resumeBtn) resumeBtn.textContent = i18n.t('menu.resume');
    const closeBtn = overlay.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.textContent = i18n.t('options.close');
    const themeEl = overlay.querySelector('#fm-theme-label');
    if (themeEl) themeEl.textContent = i18n.t(`options.theme_${themeManager.current}`);
    const langEl = overlay.querySelector('#fm-lang-label');
    if (langEl) langEl.textContent = i18n.t(`options.lang_${i18n.locale}`);
    const resetBtn = overlay.querySelector('#fm-reset-ranking-btn');
    if (resetBtn) resetBtn.textContent = i18n.t('options.reset_data');
    const confirmLabel = overlay.querySelector('#fm-reset-confirm-label');
    if (confirmLabel) confirmLabel.textContent = i18n.t('options.reset_data_confirm');
    const yesBtn = overlay.querySelector('[data-action="reset-yes"]');
    if (yesBtn) yesBtn.textContent = i18n.t('confirm.yes');
    const noBtn = overlay.querySelector('[data-action="reset-no"]');
    if (noBtn) noBtn.textContent = i18n.t('confirm.no');
    const successEl = overlay.querySelector('#fm-reset-success');
    if (successEl && successEl.style.display !== 'none') {
      successEl.textContent = i18n.t('options.reset_success');
    }
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
