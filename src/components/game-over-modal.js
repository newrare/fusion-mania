import { layout } from '../managers/layout-manager.js';
import { i18n } from '../managers/i18n-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { Power } from '../entities/power.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Game over modal — shows final score, game stats, ranking, and dramatic particle effect.
 */
export class GameOverModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /** @type {number} */
  #score = 0;

  /** @type {object} */
  #stats;

  /** @type {string} */
  #mode;

  /** @type {number | null} */
  #currentRank = null;

  /** @type {number} Interval ID for particle spawning */
  #particleInterval = 0;

  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   score: number,
   *   mode: string,
   *   stats: {
   *     maxTile?: number,
   *     moves?: number,
   *     fusions?: number,
   *     comboScore?: number,
   *     powers?: string[],
   *     enemiesDefeated?: number,
   *     enemyMaxLevel?: number,
   *     defeatedEnemies?: { name: string, level: number }[],
   *   },
   *   onNewGame?: Function,
   *   onMenu?: Function,
   * }} options
   */
  constructor(scene, options) {
    this.#score = options.score;
    this.#stats = options.stats ?? {};
    this.#mode = options.mode ?? 'classic';

    const rankings = saveManager.getRankings(this.#mode === 'battle' ? 'battle' : this.#mode);
    this.#currentRank = this.#computeRank(rankings);

    const html = `
      <div class="fm-modal-overlay" id="fm-gameover-overlay">
        <div class="fm-gameover-particles" id="fm-gameover-particles"></div>
        <div class="fm-modal fm-gameover">
          <div class="fm-modal-title">${i18n.t('gameover.title')}</div>
          <div class="fm-score-label">${i18n.t('gameover.score')}</div>
          <div class="fm-gameover-score">${options.score}</div>
          <div class="fm-gameover-stats" id="fm-gameover-stats">
            ${this.#renderStats()}
          </div>
          <div class="fm-gameover-ranking" id="fm-gameover-ranking"${this.#currentRank === null || this.#currentRank > 10 ? ' style="display:none"' : ''}>
            <div class="fm-gameover-ranking-title">${i18n.t('ranking.title')}</div>
            ${this.#renderRankObtained()}
          </div>
          <div class="fm-modal-buttons">
            <button class="fm-btn fm-btn--primary" data-action="new-game">${i18n.t('gameover.new_game')}</button>
            <button class="fm-btn" data-action="quit">${i18n.t('gameover.quit')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(100);

    const overlay = this.#domElement.node.querySelector('#fm-gameover-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const action = btn.dataset.action;
      if (action === 'new-game') options.onNewGame?.();
      else if (action === 'quit') options.onMenu?.();
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard);
    this.#unsubI18n = i18n.onChange(() => this.#refresh());

    // Dark red overlay
    const overlayEl = this.#domElement?.node.querySelector('#fm-gameover-overlay');
    if (overlayEl) overlayEl.style.background = 'rgba(60,0,0,0.82)';

    // Start dramatic particle effect
    this.#startParticles();
  }

  #renderStats() {
    const s = this.#stats;
    const isBattle = this.#mode === 'battle';
    const isFree = this.#mode === 'free';

    /** @param {string} label @param {string|number} value */
    const row = (label, value) =>
      `<div class="fm-gameover-stat-row"><span class="fm-gameover-stat-label">${label}</span><span class="fm-gameover-stat-value">${value}</span></div>`;

    let html = '';
    if (isBattle && s.battleLevel != null) {
      const num = s.battleLevel + 1;
      html +=
        `<div class="fm-gameover-stat-row fm-battle-level-row">` +
        `<span class="fm-gameover-stat-label">${i18n.t('battle.level')}</span>` +
        `<span class="fm-gameover-stat-value">` +
        `<span class="fm-battle-level-num">${num}</span>` +
        `<span class="fm-battle-level-status fm-battle-level-status--fail">✗</span>` +
        `</span></div>`;
      if (s.levelBonus > 0) {
        html +=
          `<div class="fm-gameover-stat-row">` +
          `<span class="fm-gameover-stat-label">${i18n.t('battle.level_bonus')}</span>` +
          `<span class="fm-gameover-stat-value fm-battle-level-bonus">+${s.levelBonus.toLocaleString()}</span>` +
          `</div>`;
      }
    }
    html += row(i18n.t('ranking.moves'), s.moves ?? '-');
    html += row(i18n.t('ranking.fusions'), s.fusions ?? '-');

    // Max tile
    const maxTile = s.maxTile;
    const maxTileHtml = maxTile
      ? `<span class="fm-tile fm-ranking-enemy-lvl fm-t${maxTile}">${maxTile}</span>`
      : '-';
    html += `<div class="fm-gameover-stat-row"><span class="fm-gameover-stat-label">${i18n.t('ranking.max_tile')}</span><span class="fm-gameover-stat-value">${maxTileHtml}</span></div>`;

    if (s.comboScore > 0) {
      html += row(i18n.t('ranking.combo_score'), s.comboScore);
    }

    if (isBattle) {
      const lvl = s.enemyMaxLevel;
      const lvlHtml = lvl
        ? `<span class="fm-tile fm-ranking-enemy-lvl fm-t${lvl}">${lvl}</span>`
        : '-';
      html += `<div class="fm-gameover-stat-row"><span class="fm-gameover-stat-label">${i18n.t('ranking.enemy_max_level')}</span><span class="fm-gameover-stat-value">${lvlHtml}</span></div>`;
      html += row(i18n.t('ranking.enemies_defeated'), s.enemiesDefeated ?? 0);
    }

    // Powers triggered
    if ((isBattle || isFree) && s.powers?.length > 0) {
      const distinct = [...new Set(s.powers)];
      const iconsHtml = distinct
        .map((p) => {
          const svgId = Power.svgId(p);
          return svgId
            ? `<svg class="fm-gameover-power-icon" aria-hidden="true"><use href="#${svgId}"/></svg>`
            : '';
        })
        .join('');
      html += `<div class="fm-gameover-stat-row"><span class="fm-gameover-stat-label">${i18n.t('ranking.powers_used')}</span><span class="fm-gameover-stat-value fm-gameover-powers">${iconsHtml}</span></div>`;
    }

    return html;
  }

  /**
   * Find the rank of the current game in the saved rankings.
   * Ties are broken by date ASC (oldest wins), so the current entry (newest) ranks last among equals.
   * @param {object[]} rankings
   * @returns {number | null}
   */
  #computeRank(rankings) {
    if (rankings.length === 0) return null;
    // Count how many entries scored strictly higher than this score.
    // The current entry was already saved before this modal is shown,
    // so among equals we are the newest — we lose ties (rank last of equals).
    let rank = 1;
    for (const r of rankings) {
      if ((r.score ?? 0) > this.#score) rank++;
    }
    return rank;
  }

  /** @returns {string} */
  #renderRankObtained() {
    const rank = this.#currentRank;
    if (rank === null || rank > 10) {
      return '';
    }
    if (rank === 1) {
      return `<div class="fm-gameover-rank-obtained fm-gameover-rank-obtained--1">${i18n.t('gameover.rank_1')}</div>`;
    }
    if (rank === 2) {
      return `<div class="fm-gameover-rank-obtained fm-gameover-rank-obtained--2">${i18n.t('gameover.rank_2')}</div>`;
    }
    if (rank === 3) {
      return `<div class="fm-gameover-rank-obtained fm-gameover-rank-obtained--3">${i18n.t('gameover.rank_3')}</div>`;
    }
    return `<div class="fm-gameover-rank-obtained fm-gameover-rank-obtained--neutral">${i18n.t('gameover.rank_n')}${rank}</div>`;
  }

  #startParticles() {
    const container = this.#domElement?.node.querySelector('#fm-gameover-particles');
    if (!container) return;

    const colors = [
      '#ff2200',
      '#ff4400',
      '#cc0000',
      '#ff6600',
      '#aa0000',
      '#ff3300',
      '#880000',
      '#ff1100',
      '#dd0000',
    ];

    const spawn = () => {
      const p = document.createElement('div');
      p.className = 'fm-gameover-particle';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 5 + Math.random() * 10;
      const left = Math.random() * 100;
      const dur = 1.8 + Math.random() * 2.5;
      const delay = Math.random() * 0.3;
      p.style.cssText = `left:${left}%;width:${size}px;height:${size}px;background:${color};animation-duration:${dur}s;animation-delay:${delay}s;`;
      container.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    };

    // Big initial burst
    for (let i = 0; i < 60; i++) spawn();
    this.#particleInterval = setInterval(spawn, 80);
  }

  #refresh() {
    const overlay = this.#domElement?.node;
    if (!overlay) return;
    const title = overlay.querySelector('.fm-modal-title');
    if (title) title.textContent = i18n.t('gameover.title');
    const label = overlay.querySelector('.fm-score-label');
    if (label) label.textContent = i18n.t('gameover.score');
    const newGameBtn = overlay.querySelector('[data-action="new-game"]');
    if (newGameBtn) newGameBtn.textContent = i18n.t('gameover.new_game');
    const menuBtn = overlay.querySelector('[data-action="quit"]');
    if (menuBtn) menuBtn.textContent = i18n.t('gameover.quit');
    const statsEl = overlay.querySelector('#fm-gameover-stats');
    if (statsEl) statsEl.innerHTML = this.#renderStats();
    const rankingEl = overlay.querySelector('#fm-gameover-ranking');
    if (rankingEl) {
      if (this.#currentRank === null || this.#currentRank > 10) {
        rankingEl.style.display = 'none';
      } else {
        rankingEl.style.display = '';
        rankingEl.innerHTML = `<div class="fm-gameover-ranking-title">${i18n.t('ranking.title')}</div>${this.#renderRankObtained()}`;
      }
    }
  }

  destroy() {
    if (this.#particleInterval) clearInterval(this.#particleInterval);
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
