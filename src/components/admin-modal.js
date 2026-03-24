import { TILE_VALUES } from '../configs/constants.js';
import { TILE_STATE_IDS } from '../entities/tile.js';

/** @param {string} id */
const stateLabel = (id) =>
  id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/**
 * Dev-only admin panel: clear the grid, inject tiles by value or state.
 * Only constructed when `import.meta.env.DEV` is true.
 */
export class AdminModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   onClearTiles?: () => void,
   *   onAddValue?:   (value: number) => void,
   *   onAddState?:   (state: string) => void,
   *   onClose?:      () => void,
   * }} options
   */
  constructor(scene, options = {}) {
    const valButtons = TILE_VALUES.map(
      (v) => `<button class="fm-btn fm-admin-tile-btn" data-action="add-value" data-value="${v}">${v}</button>`,
    ).join('');

    const stateButtons = TILE_STATE_IDS.map(
      (id) => `<button class="fm-btn fm-admin-tile-btn" data-action="add-state" data-state="${id}">${stateLabel(id)}</button>`,
    ).join('');

    const html = `
      <div class="fm-modal-overlay" id="fm-admin-overlay">
        <div class="fm-modal fm-admin-modal">
          <div class="fm-modal-title">⚙ Admin</div>

          <div class="fm-admin-section">
            <button class="fm-btn fm-btn--danger" data-action="clear">🗑 Clear grid</button>
          </div>

          <div class="fm-admin-section">
            <div class="fm-admin-label">Add tile — value</div>
            <div class="fm-admin-grid">${valButtons}</div>
          </div>

          <div class="fm-admin-section">
            <div class="fm-admin-label">Add tile — state</div>
            <div class="fm-admin-grid">${stateButtons}</div>
          </div>

          <button class="fm-btn" data-action="close">Close</button>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(200);

    const overlay = this.#domElement.node.querySelector('#fm-admin-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      switch (btn.dataset.action) {
        case 'clear':
          options.onClearTiles?.();
          break;
        case 'add-value':
          options.onAddValue?.(Number(btn.dataset.value));
          break;
        case 'add-state':
          options.onAddState?.(btn.dataset.state ?? 'normal');
          break;
        case 'close':
          options.onClose?.();
          break;
      }
    });
  }

  destroy() {
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
