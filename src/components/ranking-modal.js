import { i18n } from '../managers/i18n-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { RankingDetailModal } from './ranking-detail-modal.js';

/**
 * Ranking modal — full-safe-zone leaderboard with Classic / Battle / Free tabs.
 * Rows are clickable: tapping opens a RankingDetailModal with extra stats.
 */
export class RankingModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {string} Active tab: 'battle' | 'free' | 'classic' */
  #activeTab = 'battle';

  /** @type {Function | null} */
  #onClose = null;

  /** @type {Function | null} */
  #keyHandler = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /** @type {RankingDetailModal | null} */
  #detailModal = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ onClose?: Function, showResume?: boolean, onResume?: Function }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;
    this.#onClose = options.onClose ?? null;

    const html = `
      <div class="fm-modal-overlay" id="fm-ranking-overlay">
        <div class="fm-modal fm-ranking-modal">
          <div class="fm-modal-title">${i18n.t('ranking.title')}</div>
          <div class="fm-ranking-tabs">
            <button class="fm-ranking-tab fm-ranking-tab--active fm-clickable" data-tab="battle">${i18n.t('ranking.battle')}</button>
            <button class="fm-ranking-tab fm-clickable" data-tab="free">${i18n.t('ranking.free')}</button>
            <button class="fm-ranking-tab fm-clickable" data-tab="classic">${i18n.t('ranking.classic')}</button>
          </div>
          <div class="fm-ranking-table-wrap" id="fm-ranking-table-wrap"></div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(120);

    this.#renderTable();

    const overlay = this.#domElement.node.querySelector('#fm-ranking-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      // Click outside modal = close
      const modal = /** @type {HTMLElement} */ (e.target).closest('.fm-modal');
      if (!modal) { this.#onClose?.(); return; }

      const tab = /** @type {HTMLElement} */ (e.target).closest('[data-tab]');
      if (tab) {
        e.stopPropagation();
        this.#switchTab(tab.dataset.tab);
        return;
      }
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (btn) {
        e.stopPropagation();
        return;
      }
      const row = /** @type {HTMLElement} */ (e.target).closest('[data-rank-index]');
      if (row) {
        e.stopPropagation();
        const idx = parseInt(row.dataset.rankIndex, 10);
        this.#openDetail(idx);
      }
    });

    /** @type {string[]} Tab order for keyboard navigation */
    const tabOrder = ['battle', 'free', 'classic'];

    this.#keyHandler = (event) => {
      switch (event.code) {
        case 'Escape':
          if (this.#detailModal) {
            this.#closeDetail();
          } else {
            this.#onClose?.();
          }
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
        case 'ArrowDown':
        case 'ArrowUp': {
          event.preventDefault?.();
          const overlay = this.#domElement?.node.querySelector('#fm-ranking-overlay');
          if (!overlay) break;
          const focusable = /** @type {HTMLElement[]} */ (
            [...overlay.querySelectorAll('button:not([disabled]), [data-action]')].filter(
              (el) =>
                !(
                  /** @type {HTMLElement} */ (el).closest(
                    '[style*="display:none"], [style*="display: none"]',
                  )
                ),
            )
          );
          if (focusable.length === 0) break;
          const active = /** @type {HTMLElement} */ (document.activeElement);
          const fidx = focusable.indexOf(active);
          const next =
            event.code === 'ArrowDown'
              ? (fidx + 1) % focusable.length
              : (fidx - 1 + focusable.length) % focusable.length;
          focusable[next]?.focus();
          break;
        }
        case 'Enter':
        case 'Space': {
          const active = /** @type {HTMLElement} */ (document.activeElement);
          if (active && active !== document.body) {
            event.preventDefault?.();
            active.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          }
          break;
        }
      }
    };
    scene.input.keyboard.on('keydown', this.#keyHandler);

    // Auto-focus the active tab so ArrowDown immediately navigates from there
    this.#domElement.node.querySelector('.fm-ranking-tab--active')?.focus();

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
    const locale = i18n.locale === 'fr' ? 'fr-FR' : 'en-GB';

    let html = `
      <div class="fm-ranking-header" aria-hidden="true">
        <span class="fm-ranking-cell fm-ranking-rank">${i18n.t('ranking.rank')}</span>
        <span class="fm-ranking-cell fm-ranking-main-col">${i18n.t('ranking.score')}</span>
        <span class="fm-ranking-cell fm-ranking-date-col">${i18n.t('ranking.date')}</span>
      </div>
      <div class="fm-ranking-rows">`;

    const ROWS = 10;
    for (let i = 0; i < ROWS; i++) {
      const r = rankings[i] ?? null;
      const isTop3 = i < 3;
      const isEven = i % 2 === 1;
      const medalClass = isTop3 ? ` fm-ranking-medal-${i + 1}` : '';
      const evenClass = isEven ? ' fm-ranking-row--alt' : '';
      const clickAttr = r ? ` data-rank-index="${i}"` : '';

      let rankHtml = `<span class="fm-ranking-cell fm-ranking-rank">${r ? i + 1 : '-'}</span>`;

      let mainHtml;
      if (!r) {
        mainHtml = `<span class="fm-ranking-cell fm-ranking-main-col">-</span>`;
      } else {
        mainHtml = `<span class="fm-ranking-cell fm-ranking-main-col">${r.score}</span>`;
      }

      let dateHtml;
      if (!r) {
        dateHtml = `<span class="fm-ranking-cell fm-ranking-date-col">-</span>`;
      } else {
        const dateStr = this.#formatDate(r.date, locale);
        dateHtml = `<span class="fm-ranking-cell fm-ranking-date-col">${dateStr}</span>`;
      }

      const rowClass = `fm-ranking-row${medalClass}${evenClass}${r ? ' fm-clickable' : ''}`;
      html += `<div class="${rowClass}"${clickAttr}>${rankHtml}${mainHtml}${dateHtml}</div>`;
    }

    html += `</div>`;
    wrap.innerHTML = html;
  }

  /**
   * Format a timestamp as a compact locale-aware date string ("3 avr 26" / "3 Apr 26").
   * @param {number} ts - Unix timestamp (ms)
   * @param {string} locale - BCP 47 locale string
   * @returns {string}
   */
  #formatDate(ts, locale) {
    const d = new Date(ts);
    const parts = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    }).formatToParts(d);
    // Strip trailing dots from month abbreviation and forward slashes / commas
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = (parts.find((p) => p.type === 'month')?.value ?? '').replace(/\.$/u, '');
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    return `${day} ${month} ${year}`;
  }

  /** @param {number} idx - 0-based index in rankings array */
  #openDetail(idx) {
    if (this.#detailModal) return;
    const rankings = saveManager.getRankings(this.#activeTab);
    const entry = rankings[idx];
    if (!entry) return;
    this.#detailModal = new RankingDetailModal(this.#scene, {
      entry,
      mode: this.#activeTab,
      rank: idx + 1,
      onClose: () => this.#closeDetail(),
    });
  }

  #closeDetail() {
    this.#detailModal?.destroy();
    this.#detailModal = null;
  }

  destroy() {
    this.#closeDetail();
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
