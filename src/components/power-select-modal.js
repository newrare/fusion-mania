import { i18n } from '../managers/i18n-manager.js';
import { POWER_TYPES } from '../configs/constants.js';
import { Power } from '../entities/power.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Modal for selecting powers before starting a Free Mode game.
 */
export class PowerSelectModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {Set<string>} Selected power type IDs */
  #selected = new Set();

  /** @type {Function | null} */
  #onStart = null;

  /** @type {Function | null} */
  #onCancel = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ onStart?: (selectedTypes: string[]) => void, onCancel?: () => void }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;
    this.#onStart = options.onStart ?? null;
    this.#onCancel = options.onCancel ?? null;

    const allTypes = Object.values(POWER_TYPES);
    let powersHtml = '';
    for (const type of allTypes) {
      const name = i18n.t(Power.nameKey(type));
      powersHtml += `
        <div class="fm-power-item fm-clickable" data-type="${type}" title="${name}" tabindex="0">
          <div class="fm-power-dot off" data-dot="${type}">
            <svg class="fm-power-icon" aria-hidden="true"><use href="#${Power.svgId(type)}"/></svg>
          </div>
          <span class="fm-power-name">${name}</span>
        </div>`;
    }

    const html = `
      <div class="fm-modal-overlay" id="fm-power-select-overlay">
        <div class="fm-modal fm-power-select-modal">
          <div class="fm-modal-title">${i18n.t('free.select_powers')}</div>
          <div class="fm-power-grid">${powersHtml}</div>
          <div class="fm-modal-buttons">
            <button class="fm-btn fm-btn--primary" id="fm-power-start-btn" disabled>${i18n.t('free.start')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(100);

    const overlay = this.#domElement.node.querySelector('#fm-power-select-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      // Click outside modal = cancel
      const modal = /** @type {HTMLElement} */ (e.target).closest('.fm-modal');
      if (!modal) {
        this.#onCancel?.();
        return;
      }

      const item = /** @type {HTMLElement} */ (e.target).closest('.fm-power-item');
      if (item) {
        e.stopPropagation();
        this.#togglePower(item.dataset.type);
        return;
      }

      const btn = /** @type {HTMLElement} */ (e.target).closest('#fm-power-start-btn');
      if (!btn) return;
      e.stopPropagation();

      if (btn.id === 'fm-power-start-btn' && !btn.disabled) {
        this.#onStart?.([...this.#selected]);
      }
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard, {
      onEscape: () => this.#onCancel?.(),
      gridColumns: 4,
    });
  }

  /**
   * @param {string} type
   */
  #togglePower(type) {
    if (this.#selected.has(type)) {
      this.#selected.delete(type);
    } else {
      this.#selected.add(type);
    }
    this.#updateUI();
  }

  #updateUI() {
    const overlay = this.#domElement?.node;
    if (!overlay) return;

    for (const dot of overlay.querySelectorAll('.fm-power-dot')) {
      const type = dot.dataset.dot;
      if (this.#selected.has(type)) {
        dot.classList.remove('off');
        dot.classList.add('info');
      } else {
        dot.classList.remove('info');
        dot.classList.add('off');
      }
    }

    const startBtn = overlay.querySelector('#fm-power-start-btn');
    if (startBtn) {
      startBtn.disabled = this.#selected.size === 0;
    }
  }

  destroy() {
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
