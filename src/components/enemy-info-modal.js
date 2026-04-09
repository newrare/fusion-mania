import { i18n } from '../managers/i18n-manager.js';
import { Power } from '../entities/power.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Modal displaying enemy stats: name, level, HP, and available powers.
 * Opened when the player taps the enemy tile during battle phase.
 */
export class EnemyInfoModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {Function | null} */
  #onClose = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ enemy: import('../entities/enemy.js').Enemy, onClose: () => void }} options
   */
  constructor(scene, options) {
    this.#scene = scene;
    this.#onClose = options.onClose;

    const { enemy } = options;
    const tileClass = `fm-t${enemy.level}`;
    const currentHp = Math.ceil(enemy.life.currentHp);
    const maxHp = enemy.life.maxHp;
    const hpPercent = enemy.life.percent * 100;
    const cat = enemy.life.getColorCategory();

    const powersHtml = enemy.availablePowers
      .map((p) => {
        const svgId = Power.svgId(p);
        if (!svgId) return '';
        const pcat = Power.category(p);
        const name = i18n.t(Power.nameKey(p));
        return `
        <div class="fm-ei-power-item">
          <div class="fm-power-dot ${pcat} tiny">
            <svg class="fm-power-icon" aria-hidden="true"><use href="#${svgId}"/></svg>
          </div>
          <span class="fm-ei-power-name">${name}</span>
        </div>
      `;
      })
      .join('');

    const html = `
      <div class="fm-modal-overlay" id="fm-enemy-info-overlay">
        <div class="fm-modal fm-enemy-info-modal">
          <div class="fm-modal-title">${enemy.name}</div>
          <div class="fm-ei-header">
            <div class="fm-ei-level-badge ${tileClass}">${enemy.level}</div>
            <div class="fm-ei-hp-row">
              <span class="fm-ei-hp-label">${i18n.t('game.hp')}</span>
              <div class="fm-ei-hp-bar-wrap">
                <div class="fm-ei-hp-bar fm-ei-hp-${cat}" style="width:${hpPercent.toFixed(1)}%"></div>
              </div>
              <span class="fm-ei-hp-val">${currentHp}/${maxHp}</span>
            </div>
          </div>
          <div class="fm-ei-section-title">${i18n.t('battle.powers_label')}</div>
          <div class="fm-ei-powers">
            ${powersHtml || '<span class="fm-ei-no-powers">—</span>'}
          </div>
          <button class="fm-btn fm-ei-close" tabindex="0">${i18n.t('menu.close')}</button>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);

    const overlay = this.#domElement.node.querySelector('#fm-enemy-info-overlay');

    overlay.querySelector('.fm-ei-close').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.#onClose?.();
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard);
  }

  destroy() {
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
