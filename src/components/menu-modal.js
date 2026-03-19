import { layout } from '../managers/layout-manager.js';
import { i18n } from '../managers/i18n-manager.js';
import { OptionsModal } from './options-modal.js';

/**
 * Menu modal component — overlay with game mode buttons.
 */
export class MenuModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {OptionsModal | null} */
  #optionsModal = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ showResume?: boolean, onResume?: Function, onClassic?: Function, onClose?: Function, onQuit?: Function }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;

    let buttonsHtml = '';

    if (options.showResume) {
      buttonsHtml += `<button class="fm-btn fm-btn--primary" data-action="resume">${i18n.t('menu.resume')}</button>`;
    }

    buttonsHtml += `<button class="fm-btn" data-action="classic">${i18n.t('menu.classic')}</button>`;
    buttonsHtml += `<button class="fm-btn" data-action="options">${i18n.t('menu.options')}</button>`;
    buttonsHtml += `<button class="fm-btn" data-action="close">${i18n.t('menu.close')}</button>`;

    if (options.onQuit) {
      buttonsHtml += `<button class="fm-btn" data-action="quit">${i18n.t('menu.quit')}</button>`;
    }

    const html = `
      <div class="fm-modal-overlay" id="fm-menu-overlay">
        <div class="fm-modal">
          <div class="fm-modal-title">${i18n.t('menu.title')}</div>
          <div class="fm-modal-buttons">${buttonsHtml}</div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(100);

    const overlay = this.#domElement.node.querySelector('#fm-menu-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const action = btn.dataset.action;
      switch (action) {
        case 'resume':
          options.onResume?.();
          break;
        case 'classic':
          options.onClassic?.();
          break;
        case 'options':
          this.#openOptions();
          break;
        case 'close':
          options.onClose?.();
          break;
        case 'quit':
          options.onQuit?.();
          break;
      }
    });
  }

  #openOptions() {
    if (this.#optionsModal) return;
    this.#optionsModal = new OptionsModal(this.#scene, {
      onClose: () => {
        this.#optionsModal?.destroy();
        this.#optionsModal = null;
      },
    });
  }

  destroy() {
    this.#optionsModal?.destroy();
    this.#optionsModal = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
