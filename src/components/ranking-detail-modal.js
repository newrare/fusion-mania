import { i18n } from '../managers/i18n-manager.js';
import { POWER_META } from '../configs/constants.js';

/**
 * Detail modal for a single ranking entry — shows extended stats.
 *
 * Classic  : moves, fusions, max tile, combo bonus score
 * Battle   : as Classic + score + list of defeated enemies + triggered powers
 * Free     : as Classic + triggered powers
 */
const ENEMIES_PREVIEW_COUNT = 3;

export class RankingDetailModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #allEnemiesOverlay = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {Function | null} */
  #onClose = null;

  /** @type {Function | null} */
  #keyHandler = null;

  /** @type {Function | null} */
  #allEnemiesKeyHandler = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   entry: object,
   *   mode: string,
   *   rank: number,
   *   onClose?: Function,
   * }} options
   */
  constructor(scene, options) {
    this.#scene = scene;
    this.#onClose = options.onClose ?? null;

    const html = `
      <div class="fm-modal-overlay" id="fm-rank-detail-overlay">
        <div class="fm-modal fm-rank-detail-modal">
          <div class="fm-modal-title" id="fm-rdd-title"></div>
          <div class="fm-rank-detail-body" id="fm-rdd-body"></div>
          <div class="fm-modal-buttons">
            <button class="fm-btn" data-action="close">${i18n.t('ranking.close')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(130);

    this.#renderContent(options);

    const overlay = this.#domElement.node.querySelector('#fm-rank-detail-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();
      if (btn.dataset.action === 'close') this.#onClose?.();
      if (btn.dataset.action === 'see-all-enemies') {
        const enemies = JSON.parse(btn.dataset.enemies ?? '[]');
        this.#openAllEnemiesModal(enemies);
      }
    });

    this.#keyHandler = (event) => {
      if (event.code === 'Escape') this.#onClose?.();
    };
    scene.input.keyboard.on('keydown', this.#keyHandler);

    this.#unsubI18n = i18n.onChange(() => {
      this.#renderContent(options);
      const closeBtn = this.#domElement?.node.querySelector('[data-action="close"]');
      if (closeBtn) closeBtn.textContent = i18n.t('ranking.close');
    });
  }

  /**
   * @param {{ entry: object, mode: string, rank: number }} options
   */
  #renderContent({ entry, mode, rank }) {
    const overlay = this.#domElement?.node;
    if (!overlay) return;

    const titleEl = overlay.querySelector('#fm-rdd-title');
    const bodyEl = overlay.querySelector('#fm-rdd-body');
    if (!titleEl || !bodyEl) return;

    titleEl.textContent = `${i18n.t('ranking.title')} #${rank}`;

    const locale = i18n.locale === 'fr' ? 'fr-FR' : 'en-GB';
    const isBattle = mode === 'battle';
    const isFree = mode === 'free';

    /** @param {string} label @param {string|number} value */
    const row = (label, value) =>
      `<div class="fm-rdd-row"><span class="fm-rdd-label">${label}</span><span class="fm-rdd-value">${value}</span></div>`;

    let html = '';

    // Score (always shown)
    html += row(i18n.t('ranking.score'), entry.score ?? '-');

    if (isBattle) {
      // Max enemy level for battle
      const lvl = entry.enemyMaxLevel;
      const lvlHtml = lvl
        ? `<span class="fm-tile fm-ranking-enemy-lvl fm-t${lvl}">${lvl}</span>`
        : '-';
      html += `<div class="fm-rdd-row"><span class="fm-rdd-label">${i18n.t('ranking.enemy_max_level')}</span><span class="fm-rdd-value">${lvlHtml}</span></div>`;
    }

    // Common stats
    html += row(i18n.t('ranking.moves'), entry.moves ?? '-');
    html += row(i18n.t('ranking.fusions'), entry.fusions ?? '-');

    // Max tile
    const maxTile = entry.maxTile;
    const maxTileHtml = maxTile
      ? `<span class="fm-tile fm-ranking-enemy-lvl fm-t${maxTile}">${maxTile}</span>`
      : '-';
    html += `<div class="fm-rdd-row"><span class="fm-rdd-label">${i18n.t('ranking.max_tile')}</span><span class="fm-rdd-value">${maxTileHtml}</span></div>`;

    // Combo bonus score
    html += row(i18n.t('ranking.combo_score'), entry.comboScore ?? '-');

    // Date
    const date = entry.date ? this.#formatDate(entry.date, locale) : '-';
    html += row(i18n.t('ranking.date'), date);

    // Battle: defeated enemies list (sorted by level desc, preview only)
    if (isBattle && entry.defeatedEnemies?.length > 0) {
      const sorted = [...entry.defeatedEnemies].sort((a, b) => b.level - a.level);
      const preview = sorted.slice(0, ENEMIES_PREVIEW_COUNT);
      const hasMore = sorted.length > ENEMIES_PREVIEW_COUNT;

      html += `<div class="fm-rdd-section-title">${i18n.t('ranking.enemies_killed')}</div>`;
      html += `<div class="fm-rdd-enemies">`;
      for (const e of preview) {
        html += `<div class="fm-rdd-enemy-row">
          <span class="fm-tile fm-ranking-enemy-lvl fm-t${e.level}">${e.level}</span>
          <span class="fm-rdd-enemy-name">${e.name}</span>
        </div>`;
      }
      if (hasMore) {
        const label = i18n.t('ranking.enemies_see_all').replace('{count}', String(sorted.length));
        const encodedEnemies = JSON.stringify(sorted).replace(/"/gu, '&quot;');
        html += `<button class="fm-rdd-see-all fm-clickable" data-action="see-all-enemies" data-enemies="${encodedEnemies}">${label}</button>`;
      }
      html += `</div>`;
    }

    // Powers (battle + free) — distinct power types only, no duplicates
    if ((isBattle || isFree) && entry.powers?.length > 0) {
      const distinctPowers = [...new Set(entry.powers)];
      html += `<div class="fm-rdd-section-title">${i18n.t('ranking.powers_used')}</div>`;
      html += `<div class="fm-rdd-powers">`;
      for (const p of distinctPowers) {
        const meta = POWER_META[p];
        if (meta) {
          html += `<div class="fm-rdd-power-item" title="${i18n.t(meta.nameKey)}">
            <svg class="fm-rdd-power-icon" aria-hidden="true"><use href="#${meta.svgId}"/></svg>
          </div>`;
        }
      }
      html += `</div>`;
    }

    bodyEl.innerHTML = html;
  }

  /**
   * @param {Array<{level: number, name: string}>} enemies
   */
  #openAllEnemiesModal(enemies) {
    if (this.#allEnemiesOverlay) return;

    const rowsHtml = enemies
      .map(
        (e) => `<div class="fm-rdd-enemy-row">
          <span class="fm-tile fm-ranking-enemy-lvl fm-t${e.level}">${e.level}</span>
          <span class="fm-rdd-enemy-name">${e.name}</span>
        </div>`
      )
      .join('');

    const html = `
      <div class="fm-modal-overlay" id="fm-all-enemies-overlay">
        <div class="fm-modal fm-rank-detail-modal">
          <div class="fm-modal-title">${i18n.t('ranking.enemies_killed')}</div>
          <div class="fm-rank-detail-body">
            <div class="fm-rdd-enemies">${rowsHtml}</div>
          </div>
          <div class="fm-modal-buttons">
            <button class="fm-btn" data-action="close-all-enemies">${i18n.t('ranking.close')}</button>
          </div>
        </div>
      </div>
    `;

    this.#allEnemiesOverlay = this.#scene.add.dom(0, 0).createFromHTML(html);
    this.#allEnemiesOverlay.setOrigin(0, 0);
    this.#allEnemiesOverlay.setDepth(140);

    this.#allEnemiesOverlay.node
      .querySelector('#fm-all-enemies-overlay')
      ?.addEventListener('pointerdown', (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
        if (!btn) return;
        e.stopPropagation();
        if (btn.dataset.action === 'close-all-enemies') this.#closeAllEnemiesModal();
      });

    this.#allEnemiesKeyHandler = (event) => {
      if (event.code === 'Escape') this.#closeAllEnemiesModal();
    };
    this.#scene.input.keyboard.on('keydown', this.#allEnemiesKeyHandler);
  }

  #closeAllEnemiesModal() {
    if (this.#allEnemiesKeyHandler) {
      this.#scene.input.keyboard.off('keydown', this.#allEnemiesKeyHandler);
      this.#allEnemiesKeyHandler = null;
    }
    this.#allEnemiesOverlay?.destroy();
    this.#allEnemiesOverlay = null;
  }

  /**
   * @param {number} ts
   * @param {string} locale
   * @returns {string}
   */
  #formatDate(ts, locale) {
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

  destroy() {
    this.#closeAllEnemiesModal();
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
