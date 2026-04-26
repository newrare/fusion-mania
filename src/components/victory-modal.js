import { i18n } from '../managers/i18n-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { Power } from '../entities/power.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Victory modal — shown when the player reaches the 2048 tile.
 *
 * Classic / Free: allows continuing the game or going to menu.
 * Battle: the game ends (score saved), only new game or menu.
 */
export class VictoryModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /** @type {number} Interval ID for confetti */
  #confettiInterval = 0;

  /** @type {object} */
  #stats;

  /** @type {string} */
  #mode;

  /** @type {number | null} */
  #currentRank = null;

  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   score: number,
   *   mode: string,
   *   stats: object,
   *   onContinue?: Function,
   *   onNextLevel?: Function,
   *   onNewGame?: Function,
   *   onMenu?: Function,
   * }} options
   */
  constructor(scene, options) {
    this.#stats = options.stats ?? {};
    this.#mode = options.mode ?? 'classic';

    const isBattle = this.#mode === 'battle';
    const rankings = saveManager.getRankings(isBattle ? 'battle' : this.#mode);
    this.#currentRank = this.#computeProvisionalRank(rankings, options.score);

    const continueBtn =
      !isBattle && options.onContinue
        ? `<button class="fm-btn fm-btn--primary" data-action="continue">${i18n.t('victory.continue')}</button>`
        : '';

    const nextLevelBtn =
      isBattle && options.onNextLevel
        ? `<button class="fm-btn fm-btn--primary" data-action="next-level">${i18n.t('victory.next_level')}</button>`
        : '';

    const html = `
      <div class="fm-modal-overlay" id="fm-victory-overlay">
        <div class="fm-victory-confetti" id="fm-victory-confetti"></div>
        <div class="fm-modal fm-victory">
          <div class="fm-victory-sunburst"></div>
          <div class="fm-modal-title fm-victory-title">${i18n.t('victory.title')}</div>
          <div class="fm-victory-subtitle">${isBattle ? i18n.t('victory.subtitle_battle', { level: (options.stats?.battleLevel ?? 0) + 1 }) : i18n.t('victory.subtitle')}</div>
          <div class="fm-score-label">${i18n.t('gameover.score')}</div>
          <div class="fm-gameover-score">${options.score}</div>
          <div class="fm-gameover-stats" id="fm-victory-stats">
            ${this.#renderStats()}
          </div>
          <div class="fm-gameover-ranking" id="fm-victory-ranking"${this.#currentRank === null || this.#currentRank > 10 ? ' style="display:none"' : ''}>
            <div class="fm-gameover-ranking-title">${i18n.t('ranking.title')}</div>
            ${this.#renderRankObtained()}
          </div>
          <div class="fm-modal-buttons">
            ${continueBtn}
            ${nextLevelBtn}
            <button class="fm-btn" data-action="quit">${i18n.t('gameover.menu')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(100);

    const overlay = this.#domElement.node.querySelector('#fm-victory-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const action = btn.dataset.action;
      if (action === 'continue') options.onContinue?.();
      else if (action === 'next-level') options.onNextLevel?.();
      else if (action === 'quit') options.onMenu?.();
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard);
    this.#unsubI18n = i18n.onChange(() => this.#refresh());

    this.#startConfetti();
    // Align sunburst to score element after DOM is painted
    requestAnimationFrame(() => this.#alignSunburst());
  }

  /** Position the sunburst center over the score element dynamically. */
  #alignSunburst() {
    const modal = this.#domElement?.node.querySelector('.fm-victory');
    const scoreEl = this.#domElement?.node.querySelector('.fm-gameover-score');
    const sunburst = this.#domElement?.node.querySelector('.fm-victory-sunburst');
    if (!modal || !scoreEl || !sunburst) return;
    const modalRect = modal.getBoundingClientRect();
    const scoreRect = scoreEl.getBoundingClientRect();
    // Center of score element relative to the modal, as a percentage
    const scoreCenterY = scoreRect.top + scoreRect.height / 2 - modalRect.top;
    const pct = Math.round((scoreCenterY / modalRect.height) * 100);
    sunburst.style.setProperty('--fm-sunburst-top', `${pct}%`);
  }

  #renderStats() {
    const s = this.#stats;
    const isBattle = this.#mode === 'battle';
    const isFree = this.#mode === 'free';

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
        `<span class="fm-battle-level-status fm-battle-level-status--win">✓</span>` +
        `</span></div>`;
      if (s.levelBonus > 0) {
        html +=
          `<div class="fm-gameover-stat-row">` +
          `<span class="fm-gameover-stat-label">${i18n.t('battle.level_bonus')}</span>` +
          `<span class="fm-gameover-stat-value fm-battle-level-bonus">+${s.levelBonus.toLocaleString()}</span>` +
          `</div>`;
      }
      if (s.victoryBonus > 0) {
        html +=
          `<div class="fm-gameover-stat-row">` +
          `<span class="fm-gameover-stat-label">${i18n.t('battle.victory_bonus')}</span>` +
          `<span class="fm-gameover-stat-value fm-battle-level-bonus">+${s.victoryBonus.toLocaleString()}</span>` +
          `</div>`;
      }
    }
    html += row(i18n.t('ranking.moves'), s.moves ?? '-');
    html += row(i18n.t('ranking.fusions'), s.fusions ?? '-');

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
   * Compute the rank the current game *would* obtain once saved.
   * Inserts a provisional entry (date = now, so newest = loses ties) and returns its 1-based position.
   * @param {object[]} rankings
   * @param {number} score
   * @returns {number | null}
   */
  #computeProvisionalRank(rankings, score) {
    if (this.#mode === 'battle') {
      // Score is already saved before this modal is shown — count entries that rank strictly better.
      if (rankings.length === 0) return null;
      let rank = 1;
      const myLevel = this.#stats.enemyMaxLevel ?? 0;
      for (const r of rankings) {
        const lvlDiff = (r.enemyMaxLevel ?? 0) - myLevel;
        if (lvlDiff > 0) rank++;
        else if (lvlDiff === 0 && (r.score ?? 0) > score) rank++;
      }
      return rank;
    }
    // Non-battle: score not yet saved — insert a provisional entry to find rank.
    const provisional = { score, date: Date.now(), ...this.#stats };
    const list = [...rankings, provisional];
    list.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return (a.date ?? 0) - (b.date ?? 0);
    });
    const rank = list.indexOf(provisional) + 1;
    return rank > 0 ? rank : null;
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

  #startConfetti() {
    const container = this.#domElement?.node.querySelector('#fm-victory-confetti');
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

    // Big initial burst
    for (let i = 0; i < 40; i++) spawn();
    this.#confettiInterval = setInterval(spawn, 100);
  }

  #refresh() {
    const overlay = this.#domElement?.node;
    if (!overlay) return;
    const title = overlay.querySelector('.fm-victory-title');
    if (title) title.textContent = i18n.t('victory.title');
    const subtitle = overlay.querySelector('.fm-victory-subtitle');
    if (subtitle)
      subtitle.textContent =
        this.#mode === 'battle'
          ? i18n.t('victory.subtitle_battle', { level: (this.#stats.battleLevel ?? 0) + 1 })
          : i18n.t('victory.subtitle');
    const statsEl = overlay.querySelector('#fm-victory-stats');
    if (statsEl) statsEl.innerHTML = this.#renderStats();
    const rankingEl = overlay.querySelector('#fm-victory-ranking');
    if (rankingEl) {
      if (this.#currentRank === null || this.#currentRank > 10) {
        rankingEl.style.display = 'none';
      } else {
        rankingEl.style.display = '';
        rankingEl.innerHTML = `<div class="fm-gameover-ranking-title">${i18n.t('ranking.title')}</div>${this.#renderRankObtained()}`;
      }
    }
    const continueBtn = overlay.querySelector('[data-action="continue"]');
    if (continueBtn) continueBtn.textContent = i18n.t('victory.continue');
    const menuBtn = overlay.querySelector('[data-action="quit"]');
    if (menuBtn) menuBtn.textContent = i18n.t('gameover.menu');
    requestAnimationFrame(() => this.#alignSunburst());
  }

  destroy() {
    if (this.#confettiInterval) clearInterval(this.#confettiInterval);
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
