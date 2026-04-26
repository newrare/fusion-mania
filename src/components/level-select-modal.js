import { BATTLE } from '../configs/constants.js';
import { i18n } from '../managers/i18n-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { SaveLoadModal } from './save-load-modal.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * General game launcher modal — start Classic, Free, or Battle level games,
 * and access saved games.
 *
 * Layout:
 *  - Quick-play section: Classic + Free buttons (no success counters)
 *  - Battle tiers: Easy / Normal / Hard with level cards and win counters
 *  - Load Game button
 *  - Close button
 */
export class LevelSelectModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /** @type {SaveLoadModal | null} */
  #saveLoadModal = null;

  /** @type {object} */
  #options = {};

  /** @type {number} Interval ID for confetti */
  #confettiInterval = 0;

  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   onSelect?: (levelIndex: number) => void,
   *   onClassic?: () => void,
   *   onFree?: () => void,
   *   onLoadGame?: (slotData: object) => void,
   *   onCancel?: () => void,
   * }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;
    this.#options = options;

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

    // Quick-play section (Classic + Free)
    let quickPlayHtml = `
      <div class="fm-launcher-quick">
        <button class="fm-btn fm-launcher-mode-btn" data-action="classic"><span class="fm-btn-mode-icon">🎲</span>${i18n.t('launcher.classic')}</button>
        <button class="fm-btn fm-launcher-mode-btn" data-action="free"><span class="fm-btn-mode-icon">✨</span>${i18n.t('launcher.free')}</button>
      </div>`;

    // Battle tier sections
    let sectionsHtml = '';
    for (const tier of tiers) {
      let cardsHtml = '';
      let tierWon = 0;
      for (let i = tier.start; i < tier.end; i++) {
        const st = levelState(i);
        if (st === 'won') tierWon++;
        cardsHtml += `<button class="fm-btn fm-level-btn fm-level-btn--${tier.colorKey} fm-level-btn--${st} fm-level-btn--compact" data-level="${i}" tabindex="0">${i + 1}</button>`;
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

    const allClear = totalWon === 30;

    const html = `
      <div class="fm-modal-overlay" id="fm-level-select-overlay">
        ${allClear ? '<div class="fm-victory-confetti" id="fm-level-confetti"></div>' : ''}
        <div class="fm-modal fm-level-select-modal fm-level-select-modal--compact">
          <div class="fm-modal-title">${i18n.t('launcher.title')}</div>
          <div class="fm-level-total-count">⚔️ ${totalWon} / 30</div>
          <div class="fm-level-tiers">${sectionsHtml}</div>
          ${quickPlayHtml}
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
        if (!Number.isNaN(idx) && !card.classList.contains('fm-level-btn--loading')) {
          card.classList.add('fm-level-btn--loading');
          setTimeout(() => options.onSelect?.(idx), 500);
        }
        return;
      }
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (btn) {
        e.stopPropagation();
        switch (btn.dataset.action) {
          case 'classic':
            options.onClassic?.();
            return;
          case 'free':
            options.onFree?.();
            return;
        }
      }
      // Close on outside click
      const modal = /** @type {HTMLElement} */ (e.target).closest('.fm-modal');
      if (!modal) options.onCancel?.();
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard, {
      onEscape: () => options.onCancel?.(),
      gridColumns: 5,
    });

    if (allClear) this.#startConfetti();
  }

  #startConfetti() {
    const container = this.#domElement?.node.querySelector('#fm-level-confetti');
    if (!container) return;

    const colors = [
      '#ff6b6b',
      '#ffd93d',
      '#6bcb77',
      '#4d96ff',
      '#ff9ff3',
      '#feca57',
      '#48dbfb',
      '#ff6348',
      '#1dd1a1',
      '#ee5a24',
      '#c8d6e5',
      '#f368e0',
    ];

    const spawn = () => {
      const p = document.createElement('div');
      p.className = 'fm-confetti-piece';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const size = 5 + Math.random() * 8;
      const dur = 2.5 + Math.random() * 3;
      const delay = Math.random() * 0.3;
      const rotation = Math.random() * 360;
      const isRect = Math.random() > 0.5;
      const radius = isRect ? '2px' : '50%';
      const w = isRect ? size : size * 0.7;
      const h = isRect ? size * 0.4 : size * 0.7;
      p.style.cssText = `left:${left}%;width:${w}px;height:${h}px;background:${color};border-radius:${radius};animation-duration:${dur}s;animation-delay:${delay}s;transform:rotate(${rotation}deg);`;
      container.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    };

    for (let i = 0; i < 40; i++) spawn();
    this.#confettiInterval = setInterval(spawn, 100);
  }

  #openSaveLoad() {
    if (this.#saveLoadModal) return;
    this.#saveLoadModal = new SaveLoadModal(this.#scene, {
      onLoad: (slotData) => {
        this.#saveLoadModal?.destroy();
        this.#saveLoadModal = null;
        this.#options.onLoadGame?.(slotData);
      },
      onClose: () => {
        this.#saveLoadModal?.destroy();
        this.#saveLoadModal = null;
      },
    });
  }

  destroy() {
    if (this.#confettiInterval) clearInterval(this.#confettiInterval);
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#saveLoadModal?.destroy();
    this.#saveLoadModal = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
