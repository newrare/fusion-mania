import { i18n } from '../managers/i18n-manager.js';
import { POWER_META, getPowerCategory } from '../configs/constants.js';

/**
 * Modal for choosing between two different powers when both merging tiles have powers.
 */
export class PowerChoiceModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {Function | null} */
  #onChoice = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ powerTypeA: string, powerTypeB: string, onChoice: (chosenType: string) => void }} options
   */
  constructor(scene, options) {
    this.#scene = scene;
    this.#onChoice = options.onChoice;

    const metaA = POWER_META[options.powerTypeA];
    const metaB = POWER_META[options.powerTypeB];
    const nameA = i18n.t(metaA.nameKey);
    const nameB = i18n.t(metaB.nameKey);
    const catA = getPowerCategory(options.powerTypeA);
    const catB = getPowerCategory(options.powerTypeB);

    const html = `
      <div class="fm-modal-overlay" id="fm-power-choice-overlay">
        <div class="fm-modal fm-power-choice-modal">
          <div class="fm-modal-title">${i18n.t('free.choose_power')}</div>
          <div class="fm-power-choice-grid">
            <div class="fm-power-choice-item" data-type="${options.powerTypeA}">
              <div class="fm-power-dot ${catA}">
                <svg class="fm-power-icon" aria-hidden="true"><use href="#${metaA.svgId}"/></svg>
              </div>
              <span class="fm-power-name">${nameA}</span>
            </div>
            <div class="fm-power-choice-item" data-type="${options.powerTypeB}">
              <div class="fm-power-dot ${catB}">
                <svg class="fm-power-icon" aria-hidden="true"><use href="#${metaB.svgId}"/></svg>
              </div>
              <span class="fm-power-name">${nameB}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);

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
  }

  destroy() {
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
