import { layout } from '../managers/layout-manager.js';
import { i18n } from '../managers/i18n-manager.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Game over modal — shows final score with action buttons.
 */
export class GameOverModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /** @type {number} */
  #score = 0;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ score: number, onNewGame?: Function, onMenu?: Function }} options
   */
  constructor(scene, options) {
    this.#score = options.score;
    const html = `
      <div class="fm-modal-overlay" id="fm-gameover-overlay">
        <div class="fm-modal fm-gameover">
          <div class="fm-modal-title">${i18n.t('gameover.title')}</div>
          <div class="fm-score-label">${i18n.t('gameover.score')}</div>
          <div class="fm-gameover-score">${options.score}</div>
          <div class="fm-modal-buttons">
            <button class="fm-btn fm-btn--primary" data-action="new-game">${i18n.t('gameover.new_game')}</button>
            <button class="fm-btn" data-action="menu">${i18n.t('gameover.menu')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(100);

    const overlay = this.#domElement.node.querySelector('#fm-gameover-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const action = btn.dataset.action;
      if (action === 'new-game') options.onNewGame?.();
      else if (action === 'menu') options.onMenu?.();
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard);
    this.#unsubI18n = i18n.onChange(() => this.#refresh());
  }

  #refresh() {
    const overlay = this.#domElement?.node;
    if (!overlay) return;
    const title = overlay.querySelector('.fm-modal-title');
    if (title) title.textContent = i18n.t('gameover.title');
    const label = overlay.querySelector('.fm-score-label');
    if (label) label.textContent = i18n.t('gameover.score');
    const newGameBtn = overlay.querySelector('[data-action="new-game"]');
    if (newGameBtn) newGameBtn.textContent = i18n.t('gameover.new_game');
    const menuBtn = overlay.querySelector('[data-action="menu"]');
    if (menuBtn) menuBtn.textContent = i18n.t('gameover.menu');
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
