import { i18n } from './i18n-manager.js';
import { saveManager } from './save-manager.js';
import { audioManager } from './audio-manager.js';
import { layout } from './layout-manager.js';
import { COMBO_COLORS } from '../configs/constants.js';

/**
 * Manages the in-game HUD: score/stats display, combo system, card rotations,
 * help button, and best-score notifications.
 */
export class HudManager {
  /** @type {Phaser.Scene} */
  #scene;

  /** @type {string} */
  #mode;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #hudDom = null;

  /** @type {HTMLElement | null} */
  #hudEl = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #helpBtnDom = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #historyBtnDom = null;

  /** @type {HTMLElement | null} "!" button shown when prediction panel is truncated */
  #predBtnEl = null;

  /** @type {HTMLElement | null} */
  #comboEl = null;

  /** @type {HTMLElement | null} */
  #scoreBonusEl = null;

  /** @type {Array<{slots: HTMLElement[], current: number, swapTimer: Phaser.Time.TimerEvent | null}>} */
  #cardStates = [];

  /** @type {Phaser.Time.TimerEvent | null} */
  #comboTimer = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /** @type {{ classic: string, battle: string, free: string }} */
  static #MODE_ICONS = { classic: '🎲', battle: '⚔️', free: '✨' };

  /**
   * @param {Phaser.Scene} scene
   * @param {string} mode — 'classic' | 'battle' | 'free'
   */
  constructor(scene, mode) {
    this.#scene = scene;
    this.#mode = mode;
  }

  /** @returns {HTMLElement | null} */
  get hudEl() {
    return this.#hudEl;
  }

  /** @returns {HTMLElement | null} */
  get comboEl() {
    return this.#comboEl;
  }

  // ─── HUD CREATION ──────────────────────────────

  /**
   * Build and mount the HUD overlay.
   * @param {{ onLauncherOpen: () => void }} callbacks
   */
  createHUD({ onLauncherOpen }) {
    const html = `
      <div class="fm-hud">
        <div class="fm-hud-row">
          <div class="fm-score-box fm-hud-card" id="fm-card-stat1">
            <div class="fm-hud-slot" id="fm-card-stat1-a">
              <span class="fm-score-label" id="fm-label-moves">${i18n.t('game.moves')}</span>
              <span class="fm-score-value" id="fm-moves">0</span>
            </div>
            <div class="fm-hud-slot fm-hud-slot--hidden" id="fm-card-stat1-b" aria-hidden="true">
              <span class="fm-score-label" id="fm-label-fusions">${i18n.t('game.fusions')}</span>
              <span class="fm-score-value" id="fm-fusions">0</span>
            </div>
            <div class="fm-hud-slot fm-hud-slot--hidden" id="fm-card-stat1-c" aria-hidden="true">
              <span class="fm-score-label" id="fm-label-max-tile">${i18n.t('game.max_tile')}</span>
              <span class="fm-score-value" id="fm-max-tile">0</span>
            </div>
          </div>
          <div class="fm-score-wrap">
            <div class="fm-score-box" id="fm-card-stat2">
              <span class="fm-score-label" id="fm-label-score">${i18n.t('game.score')}</span>
              <span class="fm-score-value" id="fm-score">0</span>
            </div>
            <div class="fm-combo-display" id="fm-combo-display" style="display:none"></div>
            <div class="fm-score-bonus" id="fm-score-bonus"></div>
          </div>
          <div class="fm-score-box fm-hud-card" id="fm-card-stat3">
            <div class="fm-hud-slot" id="fm-card-stat3-a">
              <span class="fm-score-label" id="fm-label-best">${i18n.t('game.best')}</span>
              <span class="fm-score-value" id="fm-best">${saveManager.getBestScore(this.#mode)}</span>
            </div>
            <div class="fm-hud-slot fm-hud-slot--hidden" id="fm-card-stat3-b" aria-hidden="true">
              <span class="fm-score-label" id="fm-label-best-tile">${i18n.t('game.best_tile')}</span>
              <span class="fm-score-value" id="fm-best-max-tile">${saveManager.getBestMaxTile(this.#mode)}</span>
            </div>
          </div>
          <div class="fm-menu-btn" id="fm-launcher-top-btn"><img src="/images/menu-list.svg" alt="Launcher" class="fm-hud-icon" /></div>
        </div>
      </div>
    `;

    this.#hudDom = this.#scene.add.dom(layout.safe.cx, layout.safe.top).createFromHTML(html);
    this.#hudDom.setOrigin(0.5, 0);
    this.#hudEl = this.#hudDom.node;

    const launcherTopBtn = this.#hudEl.querySelector('#fm-launcher-top-btn');
    launcherTopBtn?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onLauncherOpen?.();
    });

    this.#comboEl = this.#hudEl.querySelector('#fm-combo-display');
    this.#scoreBonusEl = this.#hudEl.querySelector('#fm-score-bonus');

    this.#unsubI18n = i18n.onChange(() => this.#refreshLabels());
    this.#initCardRotations();
  }

  /**
   * Create the floating bottom bars:
   * - Bottom-LEFT: (ranking) + (modeIcon → history) + (! → pred)
   * - Bottom-RIGHT: (? → help) + (folder → sub-menu) + column[(replay) / (setting → settings)]
   * The "!" button is hidden by default; call setPredBtnVisible() to toggle it.
   * @param {{ onHistoryOpen: () => void, onHelpOpen: () => void, onMenuOpen: () => void, onSettingsOpen: () => void, onRankingOpen: () => void, onReplayOpen: () => void, onPredOpen?: () => void, battleLevel?: number }} callbacks
   */
  createBottomBar({
    onHistoryOpen,
    onHelpOpen,
    onMenuOpen,
    onSettingsOpen,
    onRankingOpen,
    onReplayOpen,
    onPredOpen,
    battleLevel = -1,
  }) {
    const modeIcon = HudManager.#MODE_ICONS[this.#mode] ?? '🎮';
    const levelLabel =
      battleLevel >= 0 ? `<span class="fm-mode-badge-level">L${battleLevel + 1}</span>` : '';
    const historyBtnClass = `fm-mode-badge fm-clickable${battleLevel >= 0 ? ' fm-mode-badge--with-label' : ''}`;

    // ── Bottom-LEFT: ranking + history + pred ──
    const leftHtml = `
      <div class="fm-help-bar">
        <button class="fm-mode-badge fm-clickable" id="fm-ranking-btn" aria-label="Ranking"><img src="/images/menu-ranking.svg" alt="Ranking" class="fm-hud-icon" /></button>
        <button class="${historyBtnClass}" id="fm-history-mode-btn" aria-label="History">${modeIcon}${levelLabel}</button>
        <button class="fm-mode-badge fm-clickable fm-pred-btn" id="fm-pred-btn" aria-label="Predictions" style="display:none">!</button>
      </div>
    `;
    this.#historyBtnDom = this.#scene.add
      .dom(layout.safe.left, layout.safe.bottom - 15)
      .createFromHTML(leftHtml);
    this.#historyBtnDom.setOrigin(0, 1);

    this.#historyBtnDom.node
      .querySelector('#fm-ranking-btn')
      ?.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        onRankingOpen?.();
      });

    this.#historyBtnDom.node
      .querySelector('#fm-history-mode-btn')
      ?.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        onHistoryOpen?.();
      });

    this.#predBtnEl = this.#historyBtnDom.node.querySelector('#fm-pred-btn');
    this.#predBtnEl?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onPredOpen?.();
    });

    // ── Bottom-RIGHT: help + menu + (replay stacked above settings) ──
    const rightHtml = `
      <div class="fm-help-bar">
        <button class="fm-mode-badge fm-clickable" id="fm-help-btn" aria-label="Help">?</button>
        <button class="fm-mode-badge fm-clickable" id="fm-menu-btn" aria-label="Menu"><img src="/images/menu-folder.svg" alt="Menu" class="fm-hud-icon" /></button>
        <div class="fm-help-col">
          <button class="fm-mode-badge fm-clickable" id="fm-replay-btn" aria-label="Replay"><img src="/images/menu-replay.svg" alt="Replay" class="fm-hud-icon" /></button>
          <button class="fm-mode-badge fm-clickable" id="fm-settings-btn" aria-label="Settings"><img src="/images/menu-setting.svg" alt="Settings" class="fm-hud-icon" /></button>
        </div>
      </div>
    `;
    const x = layout.safe.right;
    const y = layout.safe.bottom - 15;
    this.#helpBtnDom = this.#scene.add.dom(x, y).createFromHTML(rightHtml);
    this.#helpBtnDom.setOrigin(1, 1);

    this.#helpBtnDom.node.querySelector('#fm-help-btn')?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onHelpOpen?.();
    });

    this.#helpBtnDom.node.querySelector('#fm-menu-btn')?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onMenuOpen?.();
    });

    this.#helpBtnDom.node.querySelector('#fm-replay-btn')?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onReplayOpen?.();
    });

    this.#helpBtnDom.node
      .querySelector('#fm-settings-btn')
      ?.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        onSettingsOpen?.();
      });
  }

  /**
   * Show or hide the "!" prediction button.
   * @param {boolean} visible
   */
  setPredBtnVisible(visible) {
    if (this.#predBtnEl) {
      this.#predBtnEl.style.display = visible ? '' : 'none';
    }
  }

  /**
   * @deprecated Use createBottomBar instead.
   * @param {{ onHistoryOpen: () => void }} callbacks
   */
  createHistoryBtn({ onHistoryOpen }) {
    // No-op — kept for backward compatibility.
    void onHistoryOpen;
  }

  // ─── HUD UPDATES ──────────────────────────────

  /**
   * Refresh all stat values in the HUD.
   * @param {{ score: number, moves: number, fusions: number, maxTile: number, prevBestScore: number }} stats
   * @returns {{ newBest: boolean }} Whether the player just beat their previous best
   */
  updateStats({ score, moves, fusions, maxTile, prevBestScore }) {
    const el = this.#hudEl;
    if (!el) return { newBest: false };

    const scoreEl = el.querySelector('#fm-score');
    const movesEl = el.querySelector('#fm-moves');
    const bestEl = el.querySelector('#fm-best');
    const fusionsEl = el.querySelector('#fm-fusions');
    const maxTileEl = el.querySelector('#fm-max-tile');
    const bestMaxTileEl = el.querySelector('#fm-best-max-tile');

    if (scoreEl) scoreEl.textContent = String(score);
    if (movesEl) movesEl.textContent = String(moves);
    if (bestEl) {
      const best = Math.max(saveManager.getBestScore(this.#mode), score);
      bestEl.textContent = String(best);
    }
    if (fusionsEl) fusionsEl.textContent = String(fusions);
    if (maxTileEl) maxTileEl.textContent = String(maxTile);
    if (bestMaxTileEl) {
      const bestMax = Math.max(saveManager.getBestMaxTile(this.#mode), maxTile);
      bestMaxTileEl.textContent = String(bestMax);
    }

    const newBest = prevBestScore > 0 && score > prevBestScore;
    return { newBest };
  }

  /** Show a transient banner when the player beats their previous best score. */
  showNewBestNotification() {
    audioManager.playSfx('notification');
    const el = document.createElement('div');
    el.className = 'fm-new-best-notif';
    el.textContent = i18n.t('game.new_best');
    document.body.appendChild(el);

    this.#scene.time.delayedCall(2500, () => {
      el.classList.add('fm-new-best-notif--out');
      this.#scene.time.delayedCall(400, () => el.remove());
    });
  }

  // ─── CARD ROTATIONS ──────────────────────────────

  #initCardRotations() {
    const el = this.#hudEl;
    if (!el) return;

    const defs = [
      { slotIds: ['fm-card-stat1-a', 'fm-card-stat1-b', 'fm-card-stat1-c'] },
      { slotIds: ['fm-card-stat3-a', 'fm-card-stat3-b'] },
    ];

    for (const { slotIds } of defs) {
      this.#cardStates.push({
        slots: slotIds.map((id) => el.querySelector(`#${id}`)),
        current: 0,
        swapTimer: null,
      });
    }
  }

  /**
   * Advance all HUD cards in the direction matching the player's move.
   * @param {'left' | 'right' | 'up' | 'down'} direction
   */
  advanceCards(direction) {
    if (direction !== 'left' && direction !== 'right') return;
    const forward = direction === 'left';
    for (const card of this.#cardStates) {
      const n = card.slots.length;
      const next = forward ? (card.current + 1) % n : (card.current - 1 + n) % n;
      const exitSlot = card.slots[card.current];
      const enterSlot = card.slots[next];
      card.current = next;
      this.#animateSlotSwap(card, exitSlot, enterSlot, forward);
    }
  }

  /**
   * @param {object} activeCard
   * @param {HTMLElement} exitSlot
   * @param {HTMLElement} enterSlot
   * @param {boolean} forward
   */
  #animateSlotSwap(activeCard, exitSlot, enterSlot, forward = true) {
    if (!exitSlot || !enterSlot) return;

    if (activeCard.swapTimer) {
      activeCard.swapTimer.remove(false);
      activeCard.swapTimer = null;
    }

    const allAnimClasses = [
      'fm-hud-slot--exit',
      'fm-hud-slot--enter',
      'fm-hud-slot--exit-rev',
      'fm-hud-slot--enter-rev',
    ];
    const exitClass = forward ? 'fm-hud-slot--exit-rev' : 'fm-hud-slot--exit';
    const enterClass = forward ? 'fm-hud-slot--enter-rev' : 'fm-hud-slot--enter';
    for (const cls of allAnimClasses) exitSlot.classList.remove(cls);
    exitSlot.classList.remove('fm-hud-slot--hidden');
    exitSlot.classList.add(exitClass);
    for (const cls of allAnimClasses) enterSlot.classList.remove(cls);
    enterSlot.classList.remove('fm-hud-slot--hidden');
    enterSlot.classList.add(enterClass);
    activeCard.swapTimer = this.#scene.time.delayedCall(140, () => {
      activeCard.swapTimer = null;
      exitSlot.classList.remove(exitClass);
      exitSlot.classList.add('fm-hud-slot--hidden');
      enterSlot.classList.remove(enterClass);
    });
  }

  // ─── COMBO SYSTEM ─────────────────────────────

  /**
   * Render the combo counter.
   * @param {number} combo — Current combo count
   * @param {boolean} animate
   */
  updateComboDisplay(combo, animate) {
    if (!this.#comboEl) return;
    this.cancelComboTimer();
    this.#comboEl.classList.remove('fm-combo-hurt');
    this.#comboEl.style.removeProperty('animation');
    void this.#comboEl.offsetWidth;
    const color = COMBO_COLORS[(combo - 1) % COMBO_COLORS.length];
    this.#comboEl.style.display = 'block';
    this.#comboEl.style.color = color;
    this.#comboEl.style.textShadow = `-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 8px ${color}`;
    this.#comboEl.style.borderColor = color;
    this.#comboEl.innerHTML = `<span class="fm-hit-number">${combo}</span><span class="fm-hit-label">HIT</span>`;
    const fade = 'fm-combo-fade 3s linear forwards';
    if (animate && combo >= 3) {
      this.#comboEl.style.animation = `fm-combo-shake 0.5s ease-in-out both, ${fade}`;
    } else if (animate) {
      this.#comboEl.style.animation = `fm-combo-pop 0.45s ease-out both, ${fade}`;
    } else {
      this.#comboEl.style.animation = fade;
    }
    this.#comboTimer = this.#scene.time.delayedCall(3000, () => this.onComboTimeout?.());
  }

  /** @type {(() => void) | null} Callback for when combo timer expires. Set by GameScene. */
  onComboTimeout = null;

  /** Shake the combo display to indicate a missed merge. */
  hurtCombo() {
    this.cancelComboTimer();
    if (this.#comboEl) {
      this.#comboEl.classList.remove('fm-combo-hurt');
      this.#comboEl.style.removeProperty('animation');
      void this.#comboEl.offsetWidth;
      this.#comboEl.classList.add('fm-combo-hurt');
    }
    this.#comboTimer = this.#scene.time.delayedCall(600, () => this.onComboTimeout?.());
  }

  cancelComboTimer() {
    if (this.#comboTimer) {
      this.#comboTimer.remove(false);
      this.#comboTimer = null;
    }
  }

  /** Hide the combo display completely. */
  resetComboDisplay() {
    if (this.#comboEl) {
      this.#comboEl.style.removeProperty('animation');
      this.#comboEl.style.display = 'none';
      this.#comboEl.classList.remove('fm-combo-hurt');
    }
  }

  /**
   * Show floating score bonus popup.
   * @param {number} amount
   */
  showScoreBonus(amount) {
    if (!this.#scoreBonusEl || amount <= 0) return;
    const color = '#ffdd00';
    this.#scoreBonusEl.textContent = `+${amount}`;
    this.#scoreBonusEl.style.color = color;
    this.#scoreBonusEl.style.textShadow = `0 0 10px ${color}, 0 2px 6px rgba(0,0,0,0.6)`;
    this.#scoreBonusEl.classList.remove('fm-bonus-active');
    void this.#scoreBonusEl.offsetWidth;
    this.#scoreBonusEl.classList.add('fm-bonus-active');
  }

  // ─── PRIVATE ───────────────────────────────────

  #refreshLabels() {
    const el = this.#hudEl;
    if (!el) return;
    const map = {
      'fm-label-moves': 'game.moves',
      'fm-label-fusions': 'game.fusions',
      'fm-label-max-tile': 'game.max_tile',
      'fm-label-score': 'game.score',
      'fm-label-best': 'game.best',
      'fm-label-best-tile': 'game.best_tile',
    };
    for (const [id, key] of Object.entries(map)) {
      const node = el.querySelector(`#${id}`);
      if (node) node.textContent = i18n.t(key);
    }
  }

  // ─── SHUTDOWN ──────────────────────────────────

  shutdown() {
    this.cancelComboTimer();
    for (const card of this.#cardStates) {
      if (card.swapTimer) {
        card.swapTimer.remove(false);
        card.swapTimer = null;
      }
    }
    this.#cardStates = [];
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#hudDom?.destroy();
    this.#hudDom = null;
    this.#helpBtnDom?.destroy();
    this.#helpBtnDom = null;
    this.#historyBtnDom?.destroy();
    this.#historyBtnDom = null;
    this.#hudEl = null;
    this.#comboEl = null;
    this.#scoreBonusEl = null;
    this.#predBtnEl = null;
  }
}
