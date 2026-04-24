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

    // Render one line per power type still in stock, with N icons stacked
    // so the player sees how many charges remain.
    const stockEntries = Object.entries(enemy.powerStock ?? {}).filter(([, n]) => n > 0);
    const powersHtml = stockEntries
      .map(([type, count]) => {
        const svgId = Power.svgId(type);
        if (!svgId) return '';
        const pcat = Power.category(type);
        const name = i18n.t(Power.nameKey(type));
        // Icons overlap with 6 px horizontal offset; last icon sits on top (highest z-index).
        const stackWidth = 28 + (count - 1) * 6;
        const iconsHtml = Array.from({ length: count })
          .map(
            (_, i) =>
              `<div class="fm-power-dot ${pcat} tiny" style="position:absolute;left:${i * 6}px;z-index:${i};top:0"><svg class="fm-power-icon" aria-hidden="true"><use href="#${svgId}"/></svg></div>`,
          )
          .join('');
        return `
        <div class="fm-ei-power-item">
          <div class="fm-ei-power-stack" style="width:${stackWidth}px">${iconsHtml}</div>
          <span class="fm-ei-power-name">${name} × ${count}</span>
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
          <div class="fm-ei-section-title">${i18n.t('battle.available_powers_label')}</div>
          <div class="fm-ei-powers">
            ${powersHtml || '<span class="fm-ei-no-powers">—</span>'}
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);

    const overlay = this.#domElement.node.querySelector('#fm-enemy-info-overlay');

    overlay?.addEventListener('pointerdown', (e) => {
      const modal = /** @type {HTMLElement} */ (e.target).closest('.fm-modal');
      if (!modal) {
        e.stopPropagation();
        this.#onClose?.();
      }
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
