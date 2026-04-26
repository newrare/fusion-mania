import { i18n } from '../managers/i18n-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { MAX_SAVE_SLOTS } from '../configs/constants.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Save/Load modal — displays up to MAX_SAVE_SLOTS saved games.
 * Columns: #, Mode, Score (classic/free) or max-enemy-level (battle), Date.
 * Clicking a filled row toggles an action bar (Load + Delete) below it.
 */
export class SaveLoadModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {Function | null} */
  #onClose = null;

  /** @type {Function | null} Called with slot data when user picks a saved game */
  #onLoad = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /** @type {number | 'auto' | null} Currently expanded slot row index */
  #expandedIdx = null;

  /** @type {boolean} True while a confirm-delete prompt is active */
  #confirmingDelete = false;

  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   onClose?: Function,
   *   onLoad?: (slotData: object) => void,
   * }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;
    this.#onClose = options.onClose ?? null;
    this.#onLoad = options.onLoad ?? null;

    const html = `
      <div class="fm-modal-overlay" id="fm-saveload-overlay">
        <div class="fm-modal fm-saveload-modal">
          <div class="fm-modal-title">${i18n.t('save.title')}</div>
          <div class="fm-saveload-table-wrap" id="fm-saveload-table-wrap"></div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(120);

    this.#renderTable();

    const overlay = this.#domElement.node.querySelector('#fm-saveload-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();

      // Click outside modal = close
      const modal = /** @type {HTMLElement} */ (e.target).closest('.fm-modal');
      if (!modal) {
        this.#onClose?.();
        return;
      }

      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (btn) {
        const action = btn.dataset.action;
        if (action === 'load-auto') {
          this.#handleLoadAutoSave();
        } else if (action === 'load') {
          const idx = parseInt(btn.dataset.slot, 10);
          this.#handleLoad(idx);
        } else if (action === 'delete') {
          const idx = parseInt(btn.dataset.slot, 10);
          this.#handleDelete(idx);
        }
        return;
      }

      // Click on a filled row → toggle action bar
      const row = /** @type {HTMLElement} */ (e.target).closest('[data-slot-row]');
      if (row) {
        const rawIdx = row.dataset.slotRow;
        if (rawIdx === 'auto') {
          this.#toggleExpand('auto');
        } else {
          this.#toggleExpand(parseInt(rawIdx, 10));
        }
      }
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard, {
      onEscape: () => {
        if (this.#expandedIdx !== null) {
          this.#collapseAll();
        } else {
          this.#onClose?.();
        }
      },
    });

    this.#unsubI18n = i18n.onChange(() => this.#refresh());
  }

  /** @param {number | 'auto'} idx */
  #toggleExpand(idx) {
    if (this.#confirmingDelete) return;
    const overlay = this.#domElement?.node.querySelector('#fm-saveload-overlay');
    if (!overlay) return;

    // Collapse any previously open row
    if (this.#expandedIdx !== null && this.#expandedIdx !== idx) {
      this.#collapseRow(overlay, this.#expandedIdx);
    }

    if (this.#expandedIdx === idx) {
      this.#collapseRow(overlay, idx);
      this.#expandedIdx = null;
    } else {
      this.#expandRow(overlay, idx);
      this.#expandedIdx = idx;
    }
  }

  /**
   * @param {Element} overlay
   * @param {number | 'auto'} idx
   */
  #expandRow(overlay, idx) {
    const actionBar = overlay.querySelector(`[data-action-bar="${idx}"]`);
    if (actionBar) {
      actionBar.classList.add('fm-saveload-action-bar--open');
    }
    const row = overlay.querySelector(`[data-slot-row="${idx}"]`);
    if (row) row.classList.add('fm-saveload-row--expanded');
  }

  /**
   * @param {Element} overlay
   * @param {number | 'auto'} idx
   */
  #collapseRow(overlay, idx) {
    const actionBar = overlay.querySelector(`[data-action-bar="${idx}"]`);
    if (actionBar) actionBar.classList.remove('fm-saveload-action-bar--open');
    const row = overlay.querySelector(`[data-slot-row="${idx}"]`);
    if (row) row.classList.remove('fm-saveload-row--expanded');
  }

  #collapseAll() {
    const overlay = this.#domElement?.node.querySelector('#fm-saveload-overlay');
    if (!overlay) return;
    if (this.#expandedIdx !== null) {
      this.#collapseRow(overlay, this.#expandedIdx);
      this.#expandedIdx = null;
    }
  }

  /** @param {number} idx */
  #handleLoad(idx) {
    const data = saveManager.loadSlot(idx);
    if (data) this.#onLoad?.(data);
  }

  #handleLoadAutoSave() {
    const data = saveManager.loadAutoSave();
    if (data) this.#onLoad?.(data);
  }

  /** @param {number} idx */
  #handleDelete(idx) {
    if (this.#confirmingDelete) return;
    this.#confirmingDelete = true;

    const overlay = this.#domElement?.node.querySelector('#fm-saveload-overlay');
    if (!overlay) return;

    const actionBar = overlay.querySelector(`[data-action-bar="${idx}"]`);
    if (!actionBar) {
      this.#confirmingDelete = false;
      return;
    }

    const original = actionBar.innerHTML;
    actionBar.innerHTML = `
      <div class="fm-saveload-confirm-wrap">
        <span class="fm-saveload-confirm-text">${i18n.t('save.delete_confirm')}</span>
        <div class="fm-saveload-confirm-btns">
          <button class="fm-btn fm-btn--small fm-btn--danger" data-confirm="yes">${i18n.t('confirm.yes')}</button>
          <button class="fm-btn fm-btn--small" data-confirm="no">${i18n.t('confirm.no')}</button>
        </div>
      </div>
    `;

    const handler = (e) => {
      const confirmBtn = /** @type {HTMLElement} */ (e.target).closest('[data-confirm]');
      if (!confirmBtn) return;
      e.stopPropagation();
      actionBar.removeEventListener('pointerdown', handler);

      if (confirmBtn.dataset.confirm === 'yes') {
        saveManager.deleteSlot(idx);
        this.#expandedIdx = null;
        this.#confirmingDelete = false;
        this.#renderTable();
      } else {
        actionBar.innerHTML = original;
        this.#confirmingDelete = false;
      }
    };
    actionBar.addEventListener('pointerdown', handler);
  }

  #renderTable() {
    const wrap = this.#domElement?.node.querySelector('#fm-saveload-table-wrap');
    if (!wrap) return;

    const slots = saveManager.getSlots();
    const autoSave = saveManager.loadAutoSave();
    const locale = i18n.locale === 'fr' ? 'fr-FR' : 'en-GB';

    let html = `
      <div class="fm-ranking-header" aria-hidden="true">
        <span class="fm-ranking-cell fm-ranking-rank">#</span>
        <span class="fm-ranking-cell fm-saveload-mode-col">${i18n.t('save.mode_col')}</span>
        <span class="fm-ranking-cell fm-ranking-main-col">${i18n.t('save.score')}</span>
        <span class="fm-ranking-cell fm-ranking-date-col">${i18n.t('ranking.date')}</span>
      </div>
      <div class="fm-ranking-rows">`;

    // ── Auto-save slot (always first row, displayed as slot 0) ──
    if (autoSave) {
      const modeLabel = this.#modeLabel(autoSave);
      const dateStr = this.#formatDate(autoSave.date, locale);
      const mainHtml = this.#buildMainCell(autoSave);
      html += `
        <div class="fm-ranking-row fm-saveload-row fm-saveload-row--autosave fm-clickable" data-slot-row="auto" tabindex="0">
          <span class="fm-ranking-cell fm-ranking-rank">0</span>
          <span class="fm-ranking-cell fm-saveload-mode-col">${modeLabel}</span>
          <span class="fm-ranking-cell fm-ranking-main-col">${mainHtml}</span>
          <span class="fm-ranking-cell fm-ranking-date-col">${dateStr}</span>
        </div>
        <div class="fm-saveload-action-bar" data-action-bar="auto">
          <button class="fm-btn fm-btn--small fm-btn--primary" data-action="load-auto">${i18n.t('save.load_autosave')}</button>
        </div>`;
    } else {
      html += `
        <div class="fm-ranking-row fm-saveload-empty fm-saveload-row--autosave">
          <span class="fm-ranking-cell fm-ranking-rank">0</span>
          <span class="fm-ranking-cell fm-saveload-mode-col">${i18n.t('save.autosave')}</span>
          <span class="fm-ranking-cell fm-ranking-main-col">-</span>
          <span class="fm-ranking-cell fm-ranking-date-col">-</span>
        </div>`;
    }

    // ── Manual save slots ──
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      const s = i < slots.length ? slots[i] : null;
      const isEven = (i + 1) % 2 === 1;
      const evenClass = isEven ? ' fm-ranking-row--alt' : '';

      if (!s) {
        html += `
          <div class="fm-ranking-row${evenClass} fm-saveload-empty">
            <span class="fm-ranking-cell fm-ranking-rank">${i + 1}</span>
            <span class="fm-ranking-cell fm-saveload-mode-col">-</span>
            <span class="fm-ranking-cell fm-ranking-main-col">-</span>
            <span class="fm-ranking-cell fm-ranking-date-col">-</span>
          </div>`;
        continue;
      }

      const modeLabel = this.#modeLabel(s);
      const dateStr = this.#formatDate(s.date, locale);
      const mainHtml = this.#buildMainCell(s);

      html += `
        <div class="fm-ranking-row${evenClass} fm-saveload-row fm-clickable" data-slot-row="${i}" tabindex="0">
          <span class="fm-ranking-cell fm-ranking-rank">${i + 1}</span>
          <span class="fm-ranking-cell fm-saveload-mode-col">${modeLabel}</span>
          <span class="fm-ranking-cell fm-ranking-main-col">${mainHtml}</span>
          <span class="fm-ranking-cell fm-ranking-date-col">${dateStr}</span>
        </div>
        <div class="fm-saveload-action-bar" data-action-bar="${i}">
          <button class="fm-btn fm-btn--small fm-btn--primary" data-action="load" data-slot="${i}">${i18n.t('save.load')}</button>
          <button class="fm-btn fm-btn--small" data-action="delete" data-slot="${i}">${i18n.t('save.delete')}</button>
        </div>`;
    }

    html += `</div>`;
    wrap.innerHTML = html;

    // Re-open the previously expanded row if it still has data
    if (this.#expandedIdx !== null) {
      const overlay = this.#domElement?.node.querySelector('#fm-saveload-overlay');
      if (overlay) {
        let slotStillExists;
        if (this.#expandedIdx === 'auto') {
          slotStillExists = autoSave != null;
        } else {
          slotStillExists = this.#expandedIdx < slots.length && slots[this.#expandedIdx] != null;
        }
        if (slotStillExists) {
          this.#expandRow(overlay, this.#expandedIdx);
        } else {
          this.#expandedIdx = null;
        }
      }
    }
  }

  /**
   * Build HTML for the main (centre) column based on mode:
   *   - battle  → max enemy level badge (like RankingModal)
   *   - classic / free → score number
   * @param {object} s — slot summary
   * @returns {string}
   */
  #buildMainCell(s) {
    return `<span>${s.score ?? 0}</span>`;
  }

  /**
   * @param {object} save
   * @returns {string}
   */
  #modeLabel(save) {
    switch (save.mode) {
      case 'classic':
        return i18n.t('ranking.classic');
      case 'battle': {
        const bl = save.battleLevel ?? save.battleManager?.battleLevel;
        const suffix = bl != null && bl >= 0 ? ` L${bl + 1}` : '';
        return i18n.t('ranking.battle') + suffix;
      }
      case 'free':
        return i18n.t('ranking.free');
      default:
        return save.mode;
    }
  }

  /**
   * @param {number} ts
   * @param {string} locale
   * @returns {string}
   */
  #formatDate(ts, locale) {
    if (!ts) return '-';
    const d = new Date(ts);
    const parts = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    }).formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = (parts.find((p) => p.type === 'month')?.value ?? '').replace(/\.$/u, '');
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    return `${day} ${month} ${year}`;
  }

  #refresh() {
    const overlay = this.#domElement?.node;
    if (!overlay) return;
    const title = overlay.querySelector('.fm-modal-title');
    if (title) title.textContent = i18n.t('save.title');
    const closeBtn = overlay.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.textContent = i18n.t('save.close');
    this.#renderTable();
  }

  destroy() {
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
