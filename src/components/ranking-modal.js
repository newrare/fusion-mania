import { i18n } from '../managers/i18n-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { POWER_META } from '../configs/constants.js';

/**
 * Ranking modal — full-safe-zone leaderboard with Classic / Free tabs.
 */
export class RankingModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {string} Active tab: 'classic' | 'free' */
  #activeTab = 'classic';

  /** @type {Function | null} */
  #onClose = null;

  /** @type {Function | null} */
  #keyHandler = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ onClose?: Function }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;
    this.#onClose = options.onClose ?? null;

    const html = `
      <div class="fm-modal-overlay" id="fm-ranking-overlay">
        <div class="fm-modal fm-ranking-modal">
          <div class="fm-modal-title">${i18n.t('ranking.title')}</div>
          <div class="fm-ranking-tabs">
            <button class="fm-ranking-tab fm-ranking-tab--active" data-tab="classic">${i18n.t('ranking.classic')}</button>
            <button class="fm-ranking-tab" data-tab="battle">${i18n.t('ranking.battle')}</button>
            <button class="fm-ranking-tab" data-tab="free">${i18n.t('ranking.free')}</button>
          </div>
          <div class="fm-ranking-table-wrap" id="fm-ranking-table-wrap"></div>
          <div class="fm-modal-buttons">
            <button class="fm-btn" data-action="close">${i18n.t('ranking.close')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(120);

    this.#renderTable();

    const overlay = this.#domElement.node.querySelector('#fm-ranking-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const tab = /** @type {HTMLElement} */ (e.target).closest('[data-tab]');
      if (tab) {
        e.stopPropagation();
        this.#switchTab(tab.dataset.tab);
        return;
      }
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();
      if (btn.dataset.action === 'close') this.#onClose?.();
    });

    // Keyboard navigation
    /** @type {string[]} Tab order for keyboard navigation */
    const tabOrder = ['classic', 'battle', 'free'];

    this.#keyHandler = (event) => {
      switch (event.code) {
        case 'Escape':
          this.#onClose?.();
          break;
        case 'ArrowLeft': {
          const idx = tabOrder.indexOf(this.#activeTab);
          this.#switchTab(tabOrder[(idx - 1 + tabOrder.length) % tabOrder.length]);
          break;
        }
        case 'ArrowRight': {
          const idx = tabOrder.indexOf(this.#activeTab);
          this.#switchTab(tabOrder[(idx + 1) % tabOrder.length]);
          break;
        }
      }
    };
    scene.input.keyboard.on('keydown', this.#keyHandler);
    this.#unsubI18n = i18n.onChange(() => this.#refreshText());
  }

  #refreshText() {
    const overlay = this.#domElement?.node;
    if (!overlay) return;
    const title = overlay.querySelector('.fm-modal-title');
    if (title) title.textContent = i18n.t('ranking.title');
    for (const tab of overlay.querySelectorAll('.fm-ranking-tab')) {
      tab.textContent = i18n.t(`ranking.${tab.dataset.tab}`);
    }
    const closeBtn = overlay.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.textContent = i18n.t('ranking.close');
    this.#renderTable();
  }

  /** @param {string} tab */
  #switchTab(tab) {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    const overlay = this.#domElement?.node;
    if (!overlay) return;
    for (const t of overlay.querySelectorAll('.fm-ranking-tab')) {
      t.classList.toggle('fm-ranking-tab--active', t.dataset.tab === tab);
    }
    this.#renderTable();
  }

  #renderTable() {
    const wrap = this.#domElement?.node.querySelector('#fm-ranking-table-wrap');
    if (!wrap) return;

    const rankings = saveManager.getRankings(this.#activeTab);
    if (rankings.length === 0) {
      wrap.innerHTML = `<div class="fm-ranking-empty">${i18n.t('ranking.empty')}</div>`;
      return;
    }

    const isFree = this.#activeTab === 'free';
    const isBattle = this.#activeTab === 'battle';
    let headerHtml = `
      <div class="fm-ranking-header">
        <span class="fm-ranking-cell fm-ranking-rank">${i18n.t('ranking.rank')}</span>
        <span class="fm-ranking-cell fm-ranking-score-col">${i18n.t('ranking.score')}</span>
        <span class="fm-ranking-cell fm-ranking-max">${i18n.t('ranking.max_tile')}</span>
        ${isBattle ? `<span class="fm-ranking-cell fm-ranking-enemy-max-col">${i18n.t('ranking.enemy_max_level')}</span>` : ''}
        <span class="fm-ranking-cell fm-ranking-date-col">${i18n.t('ranking.date')}</span>
        ${isFree ? `<span class="fm-ranking-cell fm-ranking-powers-col">${i18n.t('ranking.powers')}</span>` : ''}
      </div>`;

    let rowsHtml = '';
    for (let i = 0; i < rankings.length; i++) {
      const r = rankings[i];
      const date = new Date(r.date);
      const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
      const maxTile = r.maxTile ?? '-';

      let enemyMaxHtml = '';
      if (isBattle) {
        const lvl = r.enemyMaxLevel;
        enemyMaxHtml = lvl
          ? `<span class="fm-ranking-cell fm-ranking-enemy-max-col"><span class="fm-tile fm-ranking-enemy-lvl fm-t${lvl}">${lvl}</span></span>`
          : `<span class="fm-ranking-cell fm-ranking-enemy-max-col">-</span>`;
      }

      let powersHtml = '';
      if (isFree && r.powers?.length > 0) {
        powersHtml = '<span class="fm-ranking-cell fm-ranking-powers-col"><span class="fm-ranking-powers">';
        for (const p of r.powers) {
          const meta = POWER_META[p];
          if (meta) {
            powersHtml += `<svg class="fm-ranking-power-icon" aria-hidden="true"><use href="#${meta.svgId}"/></svg>`;
          }
        }
        powersHtml += '</span></span>';
      } else if (isFree) {
        powersHtml = '<span class="fm-ranking-cell fm-ranking-powers-col">-</span>';
      }

      const medalClass = i < 3 ? ` fm-ranking-medal-${i + 1}` : '';
      rowsHtml += `
        <div class="fm-ranking-row${medalClass}">
          <span class="fm-ranking-cell fm-ranking-rank">${i + 1}</span>
          <span class="fm-ranking-cell fm-ranking-score-col">${r.score}</span>
          <span class="fm-ranking-cell fm-ranking-max">${maxTile}</span>
          ${enemyMaxHtml}
          <span class="fm-ranking-cell fm-ranking-date-col">${dateStr}</span>
          ${powersHtml}
        </div>`;
    }

    wrap.innerHTML = headerHtml + `<div class="fm-ranking-rows">${rowsHtml}</div>`;
  }

  destroy() {
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    if (this.#keyHandler) {
      this.#scene.input.keyboard.off('keydown', this.#keyHandler);
      this.#keyHandler = null;
    }
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
