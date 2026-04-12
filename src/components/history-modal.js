import { i18n } from '../managers/i18n-manager.js';
import { POWER_META, getPowerCategory } from '../configs/constants.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/** Thick SVG arrows matching the prediction info panel. */
const DIR_ARROWS = {
  up: `<svg class="fm-info-arrow" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 1 L11 7 H8 V13 H4 V7 H1 Z" fill="currentColor"/></svg>`,
  down: `<svg class="fm-info-arrow" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 13 L11 7 H8 V1 H4 V7 H1 Z" fill="currentColor"/></svg>`,
  left: `<svg class="fm-info-arrow" viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6 L7 1 V4 H13 V8 H7 V11 Z" fill="currentColor"/></svg>`,
  right: `<svg class="fm-info-arrow" viewBox="0 0 14 12" aria-hidden="true"><path d="M13 6 L7 1 V4 H1 V8 H7 V11 Z" fill="currentColor"/></svg>`,
};

/**
 * History modal — scrollable chronological log of game events.
 * Most recent turn at the top, oldest at the bottom.
 */
export class HistoryModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {Function | null} */
  #onClose = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /** @type {import('../managers/history-manager.js').HistoryManager} */
  #historyManager;

  /**
   * @param {Phaser.Scene} scene
   * @param {{ historyManager: import('../managers/history-manager.js').HistoryManager, onClose: () => void }} options
   */
  constructor(scene, options) {
    this.#scene = scene;
    this.#onClose = options.onClose;
    this.#historyManager = options.historyManager;

    const html = `
      <div class="fm-modal-overlay" id="fm-history-overlay">
        <div class="fm-modal fm-history-modal">
          <div class="fm-modal-title">${i18n.t('history.title')}</div>
          <div class="fm-history-content" id="fm-history-content"></div>
          <div class="fm-modal-buttons">
            <button class="fm-btn" data-action="close">${i18n.t('history.close')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(130);

    this.#renderContent();

    const overlay = this.#domElement.node.querySelector('#fm-history-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();
      if (btn.dataset.action === 'close') {
        this.#onClose?.();
      }
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard, {
      onEscape: () => this.#onClose?.(),
    });

    this.#unsubI18n = i18n.onChange(() => this.#refresh());
  }

  /** Render the history entries into the content area. */
  #renderContent() {
    const content = this.#domElement?.node.querySelector('#fm-history-content');
    if (!content) return;

    const turns = this.#historyManager.getTurns();
    if (turns.length === 0) {
      content.innerHTML = `<div class="fm-history-empty">${i18n.t('history.empty')}</div>`;
      return;
    }

    const lines = [];
    for (const turn of turns) {
      lines.push(this.#renderTurn(turn));
    }
    content.innerHTML = lines.join('');
  }

  /**
   * Render a single turn as HTML.
   * @param {object} turn
   * @returns {string}
   */
  #renderTurn(turn) {
    const dirSvg = DIR_ARROWS[turn.direction] ?? '';

    const header = `<span class="fm-power-info-dir">${dirSvg}</span><span>${i18n.t('history.move')}: ${turn.move}</span>`;

    let subLines = '';
    for (const entry of turn.entries) {
      subLines += this.#renderEntry(entry);
    }

    return `<div class="fm-history-turn">
      <div class="fm-history-header">${header}</div>
      ${subLines ? `<div class="fm-history-details">${subLines}</div>` : ''}
    </div>`;
  }

  /**
   * Render a tile value as a styled pill (same style as prediction info).
   * @param {number} value
   * @returns {string}
   */
  #pill(value) {
    return `<span class="fm-power-info-tile fm-t${value}">${value}</span>`;
  }

  /**
   * Render a sub-entry line.
   * @param {object} entry
   * @returns {string}
   */
  #renderEntry(entry) {
    switch (entry.type) {
      case 'fusion': {
        const pairs = entry.pairs.map(([a, b]) => `${this.#pill(a)}+${this.#pill(b)}`).join(' ');
        return `<div class="fm-history-sub">${i18n.t('history.fusion')}: ${pairs}</div>`;
      }
      case 'contamination':
        return `<div class="fm-history-sub fm-history-sub--danger">${i18n.t('history.contamination')}: ${this.#pill(entry.value)}</div>`;
      case 'power': {
        const icons = entry.powers
          .map((p) => {
            const svgId = POWER_META[p]?.svgId ?? '';
            const cat = getPowerCategory(p);
            return svgId
              ? `<svg class="fm-history-power-icon fm-pw-${cat}"><use href="#${svgId}"/></svg>`
              : p;
          })
          .join(' ');
        return `<div class="fm-history-sub">${i18n.t('history.power')}: ${icons}</div>`;
      }
      case 'enemy_spawn':
        return `<div class="fm-history-sub">${i18n.t('history.enemy_spawn').replace('{name}', entry.name).replace('{level}', entry.level)}</div>`;
      case 'enemy_damage':
        return `<div class="fm-history-sub">${i18n.t('history.enemy_damage').replace('{name}', entry.name).replace('{level}', entry.level).replace('{damage}', entry.damage)}</div>`;
      case 'enemy_defeated':
        return `<div class="fm-history-sub fm-history-sub--success">${i18n.t('history.enemy_defeated').replace('{name}', entry.name).replace('{level}', entry.level)}</div>`;
      case 'score':
        return `<div class="fm-history-sub">${i18n.t('history.score')}: +${entry.points}</div>`;
      case 'combo_bonus':
        return `<div class="fm-history-sub fm-history-sub--bonus">${i18n.t('history.combo_bonus')}: +${entry.points}</div>`;
      case 'tiles_lost': {
        const tiles = entry.values.map((v) => this.#pill(v)).join('');
        return `<div class="fm-history-sub fm-history-sub--danger">${i18n.t('history.tiles_lost')}: ${tiles}</div>`;
      }
      default:
        return '';
    }
  }

  /** Refresh on locale change */
  #refresh() {
    const titleEl = this.#domElement?.node.querySelector('.fm-modal-title');
    if (titleEl) titleEl.textContent = i18n.t('history.title');
    const closeBtn = this.#domElement?.node.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.textContent = i18n.t('history.close');
    this.#renderContent();
  }

  /** Remove modal from DOM */
  destroy() {
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
