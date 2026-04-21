import { i18n } from '../managers/i18n-manager.js';
import { layout } from '../managers/layout-manager.js';
import { Power } from '../entities/power.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Inline popover for choosing between two different powers when both merging tiles have powers.
 * Anchored to the merged tile so the player sees grid context.
 */
export class PowerChoiceModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {Function | null} */
  #onChoice = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   powerTypeA: string,
   *   powerTypeB: string,
   *   tileRow: number,
   *   tileCol: number,
   *   gridEl: HTMLElement,
   *   cellPositionFn: (row: number, col: number) => { x: number, y: number },
   *   onChoice: (chosenType: string) => void
   * }} options
   */
  constructor(scene, options) {
    this.#scene = scene;
    this.#onChoice = options.onChoice;

    const svgIdA = Power.svgId(options.powerTypeA);
    const svgIdB = Power.svgId(options.powerTypeB);
    const nameA = i18n.t(Power.nameKey(options.powerTypeA));
    const nameB = i18n.t(Power.nameKey(options.powerTypeB));
    const catA = Power.category(options.powerTypeA);
    const catB = Power.category(options.powerTypeB);

    // Compute popover position relative to the tile
    const { placement, popoverX, popoverY } = this.#computePosition(options);

    const html = `
      <div class="fm-modal-overlay fm-power-choice-overlay" id="fm-power-choice-overlay">
        <div class="fm-power-choice-popover fm-power-choice-popover--${placement}"
             style="left:${popoverX}px; top:${popoverY}px;">
          <div class="fm-power-choice-title">${i18n.t('free.choose_power')}</div>
          <div class="fm-power-choice-grid">
            <div class="fm-power-item fm-power-choice-item fm-clickable" data-type="${options.powerTypeA}" tabindex="0">
              <div class="fm-power-dot ${catA}">
                <svg class="fm-power-icon" aria-hidden="true"><use href="#${svgIdA}"/></svg>
              </div>
              <span class="fm-power-name">${nameA}</span>
            </div>
            <div class="fm-power-item fm-power-choice-item fm-clickable" data-type="${options.powerTypeB}" tabindex="0">
              <div class="fm-power-dot ${catB}">
                <svg class="fm-power-icon" aria-hidden="true"><use href="#${svgIdB}"/></svg>
              </div>
              <span class="fm-power-name">${nameB}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);

    // Highlight the merged tile
    this.#highlightTile(options);

    const overlay = this.#domElement.node.querySelector('#fm-power-choice-overlay');

    for (const item of overlay.querySelectorAll('.fm-power-choice-item')) {
      item.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const type = item.dataset.type;
        if (type && this.#onChoice) {
          this.#onChoice(type);
        }
      });
    }

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard);
  }

  /**
   * Compute popover placement and pixel coordinates.
   * The popover is positioned in viewport space relative to the grid.
   * If the tile is in the bottom half → show above, otherwise show below.
   * Clamps horizontally to stay within the safe zone.
   * @param {{ tileRow: number, tileCol: number, gridEl: HTMLElement, cellPositionFn: (r: number, c: number) => { x: number, y: number } }} options
   * @returns {{ placement: 'above' | 'below', popoverX: number, popoverY: number }}
   */
  #computePosition(options) {
    const gridRect = options.gridEl.getBoundingClientRect();
    const { x: cellX, y: cellY } = options.cellPositionFn(options.tileRow, options.tileCol);
    const tileSize = options.gridEl.querySelector('.fm-tile')?.offsetWidth ?? 74;

    // Tile center in viewport coordinates
    const tileCenterX = gridRect.left + cellX + tileSize / 2;
    const tileCenterY = gridRect.top + cellY + tileSize / 2;

    // Clamp X within the safe zone
    const minPad = 12;
    const minX = (layout.safe?.left ?? 0) + minPad;
    const maxX = (layout.safe?.right ?? window.innerWidth) - minPad;
    const popoverX = Math.max(minX, Math.min(maxX, tileCenterX));

    // Decide placement: if tile is in bottom half of viewport → above, else below
    const placement = tileCenterY > window.innerHeight / 2 ? 'above' : 'below';

    const gap = 12;
    const popoverY =
      placement === 'above' ? gridRect.top + cellY - gap : gridRect.top + cellY + tileSize + gap;

    return { placement, popoverX, popoverY };
  }

  /**
   * Add a pulsing highlight to the merged tile element.
   * @param {{ tileRow: number, tileCol: number, gridEl: HTMLElement, cellPositionFn: (r: number, c: number) => { x: number, y: number } }} options
   */
  #highlightTile(options) {
    const { x, y } = options.cellPositionFn(options.tileRow, options.tileCol);
    // Find the tile element at this position by matching left/top
    for (const el of options.gridEl.querySelectorAll('.fm-tile')) {
      const elLeft = parseInt(el.style.left, 10);
      const elTop = parseInt(el.style.top, 10);
      if (elLeft === x && elTop === y) {
        el.classList.add('fm-tile--choice-highlight');
        this._highlightedTile = el;
        break;
      }
    }
  }

  destroy() {
    this.#keyNav?.destroy();
    this.#keyNav = null;
    if (this._highlightedTile) {
      this._highlightedTile.classList.remove('fm-tile--choice-highlight');
      this._highlightedTile = null;
    }
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
