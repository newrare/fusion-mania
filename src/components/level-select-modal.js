import { BATTLE } from '../configs/constants.js';
import { i18n } from '../managers/i18n-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Modal for selecting a battle level before starting a Battle Mode game.
 * 3 tier sections (Easy / Normal / Hard), each listing 10 levels as cards.
 * All levels are freely accessible.
 * Level states: fresh (never launched) | attempted (launched, game-over) | won (victory)
 */
export class LevelSelectModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ onSelect?: (levelIndex: number) => void, onCancel?: () => void }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;

    const tiers = [
      { key: 'easy', colorKey: 'info', label: i18n.t('battle.tier_easy'), ...BATTLE.TIER_EASY },
      {
        key: 'normal',
        colorKey: 'warning',
        label: i18n.t('battle.tier_normal'),
        ...BATTLE.TIER_NORMAL,
      },
      { key: 'hard', colorKey: 'danger', label: i18n.t('battle.tier_hard'), ...BATTLE.TIER_HARD },
    ];

    /**
     * Returns 'won' | 'attempted' | 'fresh' for a level index.
     * @param {number} idx
     * @returns {'won'|'attempted'|'fresh'}
     */
    const levelState = (idx) => {
      const rankings = saveManager.getRankings(`battle_L${idx}`);
      if (rankings.length === 0) return 'fresh';
      if (rankings.some((r) => r.won)) return 'won';
      return 'attempted';
    };

    const totalWon = Array.from({ length: 30 }, (_, i) => levelState(i) === 'won').filter(
      Boolean,
    ).length;

    let sectionsHtml = '';
    for (const tier of tiers) {
      let cardsHtml = '';
      let tierWon = 0;
      for (let i = tier.start; i < tier.end; i++) {
        const st = levelState(i);
        if (st === 'won') tierWon++;
        cardsHtml += `<button class="fm-btn fm-level-btn fm-level-btn--${tier.colorKey} fm-level-btn--${st}" data-level="${i}" tabindex="0">${i + 1}</button>`;
      }
      const tierTotal = tier.end - tier.start;
      sectionsHtml += `
        <div class="fm-level-tier fm-level-tier--${tier.colorKey}">
          <div class="fm-level-tier-header">
            <span class="fm-level-tier-label">${tier.label}</span>
            <span class="fm-level-tier-count fm-level-tier-count--${tier.colorKey}">${tierWon} / ${tierTotal}</span>
          </div>
          <div class="fm-level-grid">${cardsHtml}</div>
        </div>`;
    }

    const html = `
      <div class="fm-modal-overlay" id="fm-level-select-overlay">
        <div class="fm-modal fm-level-select-modal">
          <div class="fm-modal-title">${i18n.t('battle.level_select')}</div>
          <div class="fm-level-total-count">${totalWon} / 30</div>
          <div class="fm-level-tiers">${sectionsHtml}</div>
          <div class="fm-modal-buttons">
            <button class="fm-btn" data-action="cancel">${i18n.t('menu.close')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(100);

    const overlay = this.#domElement.node.querySelector('#fm-level-select-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const card = /** @type {HTMLElement} */ (e.target).closest('.fm-level-btn');
      if (card) {
        e.stopPropagation();
        const idx = parseInt(card.dataset.level, 10);
        if (!Number.isNaN(idx)) options.onSelect?.(idx);
        return;
      }
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (btn?.dataset.action === 'cancel') {
        e.stopPropagation();
        options.onCancel?.();
        return;
      }
      // Close on outside click
      const modal = /** @type {HTMLElement} */ (e.target).closest('.fm-modal');
      if (!modal) options.onCancel?.();
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard, {
      onEscape: () => options.onCancel?.(),
      gridColumns: 5,
    });
  }

  destroy() {
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
