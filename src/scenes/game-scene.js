import Phaser from 'phaser';
import {
  SCENE_KEYS,
  SWIPE_THRESHOLD,
  COMBO_COLORS,
  POWER_META,
  POWER_TYPES,
  ANIM,
  getPowerCategory,
} from '../configs/constants.js';
import { i18n } from '../managers/i18n-manager.js';
import { layout } from '../managers/layout-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { GridManager } from '../managers/grid-manager.js';
import { PowerManager } from '../managers/power-manager.js';
import { MenuModal } from '../components/menu-modal.js';
import { GameOverModal } from '../components/game-over-modal.js';
import { PowerSelectModal } from '../components/power-select-modal.js';
import { PowerChoiceModal } from '../components/power-choice-modal.js';
import { AdminModal } from '../components/admin-modal.js';
import { VictoryModal } from '../components/victory-modal.js';
import { EnemyInfoModal } from '../components/enemy-info-modal.js';
import { GridLife } from '../entities/grid-life.js';
import { BattleManager } from '../managers/battle-manager.js';
import { BATTLE, getRandomFaceUrl } from '../configs/constants.js';
import { addBackground } from '../utils/background.js';
import { LiquidWave } from '../utils/liquid-wave.js';

/**
 * Main gameplay scene — 2048 grid rendered with CSS DOM elements.
 * Grid rendering, animation, and tile DOM are delegated to GridManager.
 */
export class GameScene extends Phaser.Scene {
  /** @type {GridManager} */
  #gm;

  /** @type {string} Game mode */
  #mode = 'classic';

  /** @type {HTMLElement | null} HUD container */
  #hudEl = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #hudDom = null;

  /**
   * State for each rotating HUD card.
   * @type {Array<{slots: HTMLElement[], current: number}>}
   */
  #hudCardStates = [];

  /** @type {boolean} Game over state */
  #gameOver = false;

  /** @type {MenuModal | null} */
  #menuModal = null;

  /** @type {GameOverModal | null} */
  #gameOverModal = null;

  /** Swipe tracking */
  #pointerStartX = 0;
  #pointerStartY = 0;

  /** @type {number} Total tile fusions this game */
  #fusions = 0;

  /**
   * Fingerprint of the last persisted save state (mode:score:moves:fusions).
   * Reset after every valid move. Used to skip duplicate saves.
   * @type {string | null}
   */
  #lastSavedFingerprint = null;

  /** @type {number} Highest tile value reached this game */
  #maxTile = 0;

  /** @type {string[] | null} Selected power types for this free-mode game */
  #selectedPowers = null;

  /** @type {number} Cumulative combo bonus score earned this game */
  #comboScoreTotal = 0;

  /** @type {string[]} Power types triggered/fused during this game (battle + free) */
  #powersTriggered = [];

  /** @type {number} Current combo streak level */
  #combo = 0;

  /** @type {number} Max combo level reached in current streak */
  #comboMax = 0;

  /** @type {number} Score before the current combo started */
  #comboScoreStart = 0;

  /** @type {HTMLElement | null} Combo display element */
  #comboEl = null;

  /** @type {HTMLElement | null} Score bonus float popup */
  #scoreBonusEl = null;

  /** @type {Phaser.Time.TimerEvent | null} Timer that ends the combo on inactivity */
  #comboTimer = null;

  /** @type {boolean} True while the hurt/break animation is playing */
  #comboBreaking = false;

  /** @type {PowerManager | null} Power system (Free mode only) */
  #powerManager = null;

  /** @type {PowerSelectModal | null} */
  #powerSelectModal = null;

  /** @type {PowerChoiceModal | null} */
  #powerChoiceModal = null;

  /** @type {AdminModal | null} */
  #adminModal = null;

  /** @type {VictoryModal | null} */
  #victoryModal = null;

  /** @type {boolean} True once the victory modal has been shown this game */
  #victoryShown = false;

  /** Skip first pointerup after power-select Start tap */
  #skipNextPointerUp = false;

  /** @type {HTMLElement | null} Power info panel below grid */
  #powerInfoEl = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #powerInfoDom = null;

  /** @type {Phaser.GameObjects.DOMElement | null} Full-list overlay DOM element */
  #powerInfoAllDom = null;

  /** @type {string[] | null} Pending selected power types (from modal) */
  #pendingPowerTypes = null;

  /**
   * Tiles currently being animated for destruction by a power effect.
   * Map of tileId → tile value (for display in the info panel).
   * Populated when an effect starts, cleared when removeTiles is called or at the
   * start of the next move (safety flush).
   * @type {Map<string, number>}
   */
  #pendingDestructionTiles = new Map();

  /** @type {GridLife | null} HP system (Free mode only) */
  #gridLife = null;

  /** @type {HTMLElement | null} Liquid fill inside the grid */
  #liquidEl = null;

  /** @type {LiquidWave | null} Canvas wave renderer for grid HP */
  #gridWave = null;

  /** @type {HTMLElement | null} Critical red vignette overlay */
  #criticalOverlay = null;

  /** @type {Phaser.Time.TimerEvent | null} Safety timer: spawn a tile if grid stays empty 5 s (free mode) */
  #emptyGridTimer = null;

  /** @type {HTMLElement | null} Ads modal overlay currently displayed */
  #adsOverlay = null;

  /** @type {boolean} True once the player has seen an ad this game (only one per game) */
  #adsShown = false;

  /** @type {boolean} True while the ads overlay is visible — blocks all player input */
  #showingAds = false;

  /** @type {number} Best score for current mode at game start (persisted best from previous games) */
  #prevBestScore = 0;

  /** @type {boolean} True once the new-best notification has been shown this game */
  #bestScoreNotified = false;

  /** @type {Function | null} Unsubscribe from i18n locale changes */
  #unsubI18n = null;

  // ─── BATTLE MODE FIELDS ──────────────────────────

  /** @type {BattleManager | null} Battle system (Battle mode only) */
  #battleManager = null;

  /** @type {HTMLElement | null} Enemy area container (appended to document.body) */
  #enemyAreaEl = null;

  /** @type {LiquidWave | null} Canvas wave renderer for enemy HP */
  #enemyWave = null;

  /** @type {PowerManager | null} Power system shared for battle contamination effects */
  #battlePowerManager = null;

  /** @type {Array<{el: HTMLElement, body: MatterJS.BodyType}>} DOM+physics pairs for dead enemy tiles */
  #deadEnemyBodies = [];

  /** @type {EnemyInfoModal | null} */
  #enemyInfoModal = null;

  /** @type {MatterJS.BodyType | null} Static floor body at viewport bottom */
  #physicsFloor = null;

  /** Tile size in CSS pixels, cached from --fm-tile-size after create(). */
  #tileSizePx = 64;

  /** @type {object | null} Full save slot data to restore from */
  #pendingSlotData = null;

  constructor() {
    super({ key: SCENE_KEYS.GRID });
    this.#gm = new GridManager();
  }

  /** @param {{ mode?: string, restore?: boolean, selectedPowers?: string[], slotData?: object }} data */
  init(data) {
    this.#mode = data?.mode ?? 'classic';
    this.#gameOver = false;
    this.#fusions = 0;
    this.#maxTile = 0;
    this.#selectedPowers = null;
    this.#comboScoreTotal = 0;
    this.#powersTriggered = [];
    this.#combo = 0;
    this.#comboMax = 0;
    this.#comboScoreStart = 0;
    this.#comboEl = null;
    this.#scoreBonusEl = null;
    this.#comboTimer = null;
    this.#comboBreaking = false;
    this.#powerManager = null;
    this.#powerSelectModal = null;
    this.#powerChoiceModal = null;
    this.#adminModal = null;
    this.#victoryModal = null;
    this.#victoryShown = false;
    this.#powerInfoEl = null;
    this.#powerInfoDom = null;
    this.#powerInfoAllDom = null;
    this.#pendingPowerTypes = data?.selectedPowers ?? null;
    this.#skipNextPointerUp = false;
    this.#pendingDestructionTiles = new Map();
    this.#gridLife = null;
    this.#liquidEl = null;
    this.#gridWave = null;
    this.#criticalOverlay = null;
    this.#emptyGridTimer = null;
    this.#adsOverlay = null;
    this.#adsShown = false;
    this.#showingAds = false;
    this.#prevBestScore = 0;
    this.#bestScoreNotified = false;
    this.#pendingSlotData = data?.slotData ?? null;
    // Battle mode
    this.#battleManager = null;
    this.#enemyAreaEl = null;
    this.#enemyWave = null;
    this.#battlePowerManager = null;
    this.#deadEnemyBodies = [];
    this.#physicsFloor = null;
    // HUD card rotators — no timers, just reset state
    this.#hudCardStates = [];
  }

  create() {
    // Defensive cleanup: remove any DOM nodes from a previous game that may
    // have survived shutdown (e.g. if an animation was in flight).
    document.querySelectorAll(
      '.fm-dead-enemy, .fm-enemy-area, .fm-contaminate-particle, .fm-critical-overlay'
    ).forEach((el) => el.remove());

    // The Phaser DOM container is position:absolute with a CSS transform, which
    // creates an isolated stacking context. Without an explicit z-index it sits at
    // z-index:auto (0) and dead-enemy tiles appended to document.body at z-index:3
    // would paint on top of modals. Setting z-index:5 here makes the entire DOM
    // layer (grid, HUD, modals) paint above dead enemies (z-index:3) while keeping
    // the Phaser canvas (no z-index → 0) below them.
    if (this.game.domContainer) {
      this.game.domContainer.style.zIndex = '5';
    }

    this.#gm = new GridManager();
    addBackground(this);
    layout.drawDebugSafeZone(this);
    this.#createHUD();
    this.#gm.createContainer(this);

    if (this.#mode === 'free') {
      this.#createPowerInfoPanel();
    }

    if (this.#mode === 'battle') {
      this.#createEnemyArea();
      this.#createPowerInfoPanel();
    }

    this.#bindInput();

    // Cache CSS tile size for physics body sizing (read after container is in DOM)
    this.events.once('create', () => {
      this.#tileSizePx = parseInt(
        getComputedStyle(document.getElementById('game-container') ?? document.body)
          .getPropertyValue('--fm-tile-size'),
      ) || 64;
    });

    if (this.#pendingSlotData) {
      this.#restoreFromSlot(this.#pendingSlotData);
      this.#pendingSlotData = null;
    } else if (this.#mode === 'free' && !this.#pendingPowerTypes) {
      this.#showPowerSelectModal();
    } else {
      if (this.#mode === 'free' && this.#pendingPowerTypes) {
        this.#selectedPowers = this.#pendingPowerTypes;
        this.#powerManager = new PowerManager(this.#pendingPowerTypes);
        this.#pendingPowerTypes = null;
      }
      this.#startNewGame();
    }
  }

  // ─── HUD ─────────────────────────────────────────
  #createHUD() {
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
          <div class="fm-menu-btn" id="fm-menu-btn">☰</div>
        </div>
      </div>
    `;

    this.#hudDom = this.add.dom(layout.safe.cx, layout.safe.top).createFromHTML(html);
    this.#hudDom.setOrigin(0.5, 0);
    this.#hudEl = this.#hudDom.node;

    const menuBtn = this.#hudEl.querySelector('#fm-menu-btn');
    menuBtn?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.#openMenu();
    });

    this.#comboEl = this.#hudEl.querySelector('#fm-combo-display');
    this.#scoreBonusEl = this.#hudEl.querySelector('#fm-score-bonus');

    this.#unsubI18n = i18n.onChange(() => this.#refreshHUDLabels());
    this.#initHudCardRotations();
  }

  #refreshHUDLabels() {
    const el = this.#hudEl;
    if (!el) return;
    const map = {
      'fm-label-moves':     'game.moves',
      'fm-label-fusions':   'game.fusions',
      'fm-label-max-tile':  'game.max_tile',
      'fm-label-score':     'game.score',
      'fm-label-best':      'game.best',
      'fm-label-best-tile': 'game.best_tile',
    };
    for (const [id, key] of Object.entries(map)) {
      const node = el.querySelector(`#${id}`);
      if (node) node.textContent = i18n.t(key);
    }
  }

  // ─── HUD CARD ROTATORS ───────────────────────────

  /**
   * Set up the two rotating HUD cards (direction-driven, no timers):
   *   0 — Moves / Fusions / Max Tile (3-slot cycle)
   *   1 — Best Score ↔ Best Tile
   * Card 2 (Score) is fixed — no rotation.
   */
  #initHudCardRotations() {
    const el = this.#hudEl;
    if (!el) return;

    const defs = [
      { slotIds: ['fm-card-stat1-a', 'fm-card-stat1-b', 'fm-card-stat1-c'] },
      { slotIds: ['fm-card-stat3-a', 'fm-card-stat3-b'] },
    ];

    for (const { slotIds } of defs) {
      this.#hudCardStates.push({
        slots: slotIds.map((id) => el.querySelector(`#${id}`)),
        current: 0,
        swapTimer: null,
      });
    }
  }

  /**
   * Advance all HUD cards in the direction matching the player's move.
   * Right → content scrolls left (shows « next » stat).
   * Left  → content scrolls right (shows « previous » stat).
   * Up/Down are ignored.
   * @param {'left' | 'right' | 'up' | 'down'} direction
   */
  #advanceHudCards(direction) {
    if (direction !== 'left' && direction !== 'right') return;
    const forward = direction === 'left';
    for (const card of this.#hudCardStates) {
      const n = card.slots.length;
      const next = forward
        ? (card.current + 1) % n
        : (card.current - 1 + n) % n;
      const exitSlot  = card.slots[card.current];
      const enterSlot = card.slots[next];
      card.current = next;
      this.#animateHudSlotSwap(card, exitSlot, enterSlot, forward);
    }
  }

  /**
   * Slide exitSlot out and enterSlot in.
   * forward=true  → exit goes left,  enter comes from right (player moved right).
   * forward=false → exit goes right, enter comes from left  (player moved left).
   * @param {HTMLElement} exitSlot
   * @param {HTMLElement} enterSlot
   * @param {boolean} [forward=true]
   */
  #animateHudSlotSwap(activeCard, exitSlot, enterSlot, forward = true) {
    if (!exitSlot || !enterSlot) return;

    // Cancel any pending swap cleanup for this card to avoid conflicts on rapid direction changes
    if (activeCard.swapTimer) {
      activeCard.swapTimer.remove(false);
      activeCard.swapTimer = null;
    }

    const allAnimClasses = [
      'fm-hud-slot--exit', 'fm-hud-slot--enter',
      'fm-hud-slot--exit-rev', 'fm-hud-slot--enter-rev',
    ];
    const exitClass  = forward ? 'fm-hud-slot--exit-rev' : 'fm-hud-slot--exit';
    const enterClass = forward ? 'fm-hud-slot--enter-rev' : 'fm-hud-slot--enter';
    for (const cls of allAnimClasses) exitSlot.classList.remove(cls);
    exitSlot.classList.remove('fm-hud-slot--hidden');
    exitSlot.classList.add(exitClass);
    for (const cls of allAnimClasses) enterSlot.classList.remove(cls);
    enterSlot.classList.remove('fm-hud-slot--hidden');
    enterSlot.classList.add(enterClass);
    activeCard.swapTimer = this.time.delayedCall(140, () => {
      activeCard.swapTimer = null;
      exitSlot.classList.remove(exitClass);
      exitSlot.classList.add('fm-hud-slot--hidden');
      enterSlot.classList.remove(enterClass);
    });
  }
  #showPowerSelectModal() {
    this.#powerSelectModal = new PowerSelectModal(this, {
      onStart: (selectedTypes) => {
        this.#skipNextPointerUp = true;
        this.#powerSelectModal?.destroy();
        this.#powerSelectModal = null;
        this.#selectedPowers = selectedTypes;
        this.#powerManager = new PowerManager(selectedTypes);
        this.#startNewGame();
      },
      onCancel: () => {
        this.#powerSelectModal?.destroy();
        this.#powerSelectModal = null;
        this.scene.start(SCENE_KEYS.TITLE);
      },
    });
  }

  // ─── POWER INFO PANEL ────────────────────────────
  #createPowerInfoPanel() {
    const html = `<div class="fm-power-info" id="fm-power-info" style="display:none"></div>`;
    const gridBottom = layout.grid.y + layout.grid.totalWidth / 2;
    const gridLeft = layout.safe.cx - layout.grid.totalWidth / 2;
    const panelTop = gridBottom + 20;
    this.#powerInfoDom = this.add.dom(gridLeft, panelTop).createFromHTML(html);
    this.#powerInfoDom.setOrigin(0, 0);
    this.#powerInfoEl = this.#powerInfoDom.node.querySelector('#fm-power-info');

    // Full-list overlay (hidden by default, shown when "…" is tapped)
    const overlayHtml = `
      <div class="fm-modal-overlay" id="fm-power-info-all-overlay" style="display:none">
        <div class="fm-modal fm-power-info-all-modal">
          <div class="fm-modal-title" id="fm-power-info-all-title"></div>
          <div class="fm-power-info-all-lines" id="fm-power-info-all-lines"></div>
          <div style="display:flex;justify-content:center">
            <button class="fm-btn fm-btn--primary" id="fm-power-info-all-close">${i18n.t('menu.close')}</button>
          </div>
        </div>
      </div>`;
    this.#powerInfoAllDom = this.add.dom(0, 0).createFromHTML(overlayHtml);
    this.#powerInfoAllDom.setOrigin(0, 0);
    this.#powerInfoAllDom.setDepth(200);
    const overlayEl = this.#powerInfoAllDom.node.querySelector('#fm-power-info-all-overlay');
    overlayEl?.querySelector('#fm-power-info-all-close')?.addEventListener('pointerdown', () => {
      overlayEl.style.display = 'none';
    });
  }

  // ─── GAME FLOW ───────────────────────────────────
  #startNewGame() {
    this.#fusions = 0;
    this.#comboScoreTotal = 0;
    this.#powersTriggered = [];
    this.#combo = 0;
    this.#comboMax = 0;
    this.#comboScoreStart = 0;
    this.#prevBestScore = saveManager.getBestScore(this.#mode);
    this.#bestScoreNotified = false;
    this.#cancelComboTimer();
    if (this.#comboEl) {
      this.#comboEl.style.removeProperty('animation');
      this.#comboEl.style.display = 'none';
      this.#comboEl.classList.remove('fm-combo-hurt');
    }
    if (this.#scoreBonusEl) {
      this.#scoreBonusEl.classList.remove('fm-bonus-active');
    }
    this.#gm.startNewGame();

    // Grid Life system (Free mode only)
    if (this.#mode === 'free') {
      this.#gridLife = new GridLife();
      this.#createLiquidOverlay();
      this.#updateLifeVisual();
    }

    // Battle mode initialisation
    if (this.#mode === 'battle') {
      this.#battleManager = new BattleManager();
    }

    this.#updateHUD();
    this.#gm.updateFusionIndicators();
  }

  // ─── INPUT ───────────────────────────────────────
  #bindInput() {
    this.input.keyboard.on('keydown', this.#handleKey, this);
    this.input.on('pointerdown', this.#onPointerDown, this);
    this.input.on('pointerup', this.#onPointerUp, this);
  }

  /** @param {Phaser.Input.Keyboard.Key} event */
  #handleKey = (event) => {
    if (this.#gameOver || this.#menuModal || this.#powerChoiceModal || this.#powerSelectModal || this.#showingAds || this.#victoryModal) return;

    /** @type {'up' | 'down' | 'left' | 'right' | null} */
    let direction = null;
    switch (event.code) {
      case 'ArrowUp':    case 'KeyW': direction = 'up';    break;
      case 'ArrowDown':  case 'KeyS': direction = 'down';  break;
      case 'ArrowLeft':  case 'KeyA': direction = 'left';  break;
      case 'ArrowRight': case 'KeyD': direction = 'right'; break;
      case 'Escape': this.#openMenu(); return;
    }
    if (direction) {
      event.preventDefault?.();
      this.#executeMove(direction);
    }
  };

  /** @param {Phaser.Input.Pointer} pointer */
  #onPointerDown = (pointer) => {
    this.#pointerStartX = pointer.x;
    this.#pointerStartY = pointer.y;
  };

  /** @param {Phaser.Input.Pointer} pointer */
  #onPointerUp = (pointer) => {
    if (this.#skipNextPointerUp) {
      this.#skipNextPointerUp = false;
      this.#pointerStartX = pointer.x;
      this.#pointerStartY = pointer.y;
      return;
    }
    if (this.#gameOver || this.#menuModal || this.#powerChoiceModal || this.#powerSelectModal || this.#showingAds || this.#victoryModal) return;

    const dx = pointer.x - this.#pointerStartX;
    const dy = pointer.y - this.#pointerStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

    /** @type {'up' | 'down' | 'left' | 'right'} */
    const direction = absDx > absDy
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');

    this.#executeMove(direction);
  };

  // ─── MOVE EXECUTION ──────────────────────────────
  /**
   * @param {'up' | 'down' | 'left' | 'right'} direction
   */
  async #executeMove(direction) {
    this.#gm.clearFusionIndicators();
    // Safety flush: if a previous animation was cut, forcibly remove any DOM elements
    // that were scheduled for destruction but never cleaned up.
    if (this.#pendingDestructionTiles.size > 0) {
      for (const id of this.#pendingDestructionTiles.keys()) {
        this.#gm.removeTileById(id);
      }
      this.#pendingDestructionTiles.clear();
    }

    // Wind blocks this direction — input is accepted but no tiles move
    if (this.#powerManager?.windDirection === direction) {
      this.#gm.updateFusionIndicators();
      this.#updatePowerVisuals();
      return;
    }
    if (this.#battlePowerManager?.windDirection === direction) {
      this.#gm.updateFusionIndicators();
      this.#updatePowerVisuals();
      return;
    }

    const waitFn = (ms) => this.#wait(ms);
    const moveResult = await this.#gm.executeMove(
      direction,
      waitFn,
      () => this.#advanceHudCards(direction),
    );

    if (!moveResult.moved) {
      this.#gm.updateFusionIndicators();
      this.#updatePowerVisuals();
      if (!this.#gm.grid.canMove()) {
        this.#onGameOver();
      }
      return;
    }

    // Nudge dead enemies on every valid player move
    this.#nudgeDeadEnemies(direction);
    // Invalidate duplicate-save guard
    this.#lastSavedFingerprint = null;

    // Tick power state for EVERY real grid move
    if (this.#powerManager) {
      this.#powerManager.tickMove(this.#gm.grid);
    }
    if (this.#battlePowerManager) {
      this.#battlePowerManager.tickMove(this.#gm.grid);
    }

    if (moveResult.cancelled) {
      // Grid move happened but animations were cut short.
      // Power triggers MUST still execute so grid.cells stays correct.
      if (this.#powerManager && moveResult.merges.length > 0) {
        const triggers = this.#powerManager.checkMergeTriggers(moveResult.merges, this.#gm.grid);
        for (const trigger of triggers) {
          const chosenPower = trigger.needsChoice ? trigger.powerType : trigger.powerType;
          const effectResult = this.#powerManager.executeEffect(
            chosenPower, this.#gm.grid, trigger.tile,
          );
          // Remove destroyed tiles from DOM immediately (no animation)
          for (const tile of effectResult.destroyed) {
            this.#pendingDestructionTiles.delete(tile.id);
            this.#gm.removeTileById(tile.id);
          }
          // Grid Life: damage from cancelled power effects
          if (this.#gridLife && effectResult.destroyed.length > 0) {
            const values = effectResult.destroyed.map((t) => t.value);
            const damage = this.#gridLife.takeDamage(values);
            this.#onGridLifeDamage(damage);
          }
        }
        this.#powerManager.onMove(this.#gm.grid);
      }
      // Count fusions even when animations were cancelled
      if (moveResult.merges.length > 0) {
        this.#fusions += moveResult.merges.length;
        // Track max tile from cancelled moves
        for (const tile of this.#gm.grid.getAllTiles()) {
          if (tile.value > this.#maxTile) this.#maxTile = tile.value;
        }
        this.#updateHUD();
        this.#gm.updateFusionIndicators();
      }
      return;
    }

    const { merges, expelled, hasMergePossible, scoreBefore } = moveResult;

    // Grid Life: damage from expelled tiles
    if (this.#gridLife && expelled.length > 0) {
      const values = expelled.map((t) => t.value);
      const damage = this.#gridLife.takeDamage(values);
      this.#onGridLifeDamage(damage);
    }

    // ── Combo logic ──
    if (merges.length > 0) {
      this.#fusions += merges.length;
      if (this.#comboBreaking) this.#endCombo();
      if (this.#combo === 0) {
        this.#comboScoreStart = scoreBefore;
      }
      this.#combo++;
      if (this.#combo > this.#comboMax) this.#comboMax = this.#combo;
      this.#updateComboDisplay(true);
    } else if (hasMergePossible) {
      this.#breakComboWithHurt();
    }

    // ── Power system ──
    if (this.#powerManager) {
      const triggers = this.#powerManager.checkMergeTriggers(merges, this.#gm.grid);

      for (const trigger of triggers) {
        let chosenPower = trigger.powerType;

        if (trigger.needsChoice) {
          // Open choice modal and wait for player selection
          chosenPower = await this.#showPowerChoiceModal(trigger.powerType, trigger.powerTypeB);
        }

        this.#powersTriggered.push(chosenPower);
        await this.#executePowerEffect(chosenPower, trigger.tile);
      }

      this.#powerManager.onMove(this.#gm.grid);
      this.#gm.syncTileDom(this.#powerManager.windDirection);
      this.#updatePowerVisuals();
    }

    // ── Battle power system (contaminated tile effects) ──
    if (this.#battlePowerManager && merges.length > 0) {
      // Apply merge damage to enemy BEFORE processing power choice modals
      // so the player sees the damage from the fusion immediately.
      if (this.#battleManager?.isBattlePhase) {
        const { damage, killed } = this.#battleManager.applyMergeDamage(merges);
        if (damage > 0) {
          await this.#playAttackParticles(merges);
          this.#showEnemyDamage(damage);
          this.#updateEnemyVisual();
        }
        if (killed) {
          await this.#onEnemyDefeated();
          this.#updateHUD();
          this.#gm.updateFusionIndicators();
          this.#gm.animating = false;
          return;
        }
      }

      const triggers = this.#battlePowerManager.checkMergeTriggers(merges, this.#gm.grid);

      for (const trigger of triggers) {
        let chosenPower = trigger.powerType;

        if (trigger.needsChoice) {
          chosenPower = await this.#showPowerChoiceModal(trigger.powerType, trigger.powerTypeB);
        }

        this.#powersTriggered.push(chosenPower);
        await this.#executeBattlePowerEffect(chosenPower, trigger.tile);
      }

      this.#gm.syncTileDom(this.#battlePowerManager.windDirection);
      this.#updatePowerVisuals();
    }

    // Safety: if powers/effects destroyed every tile, start the empty-grid timer
    if (this.#gm.grid.getAllTiles().length === 0) {
      this.#startEmptyGridTimer();
    } else {
      this.#cancelEmptyGridTimer();
    }

    // ── Battle mode logic ──
    if (this.#mode === 'battle' && this.#battleManager) {
      await this.#tickBattle(merges);
    }

    this.#updateHUD();
    this.#gm.updateFusionIndicators();
    this.#gm.animating = false;

    // Check for victory (2048 tile reached) — classic and free modes only.
    // Battle mode victory is handled in #onEnemyDefeated when the level-2048 enemy is killed.
    if (!this.#victoryShown && this.#mode !== 'battle' && this.#maxTile >= 2048) {
      this.#onVictory();
      return;
    }

    if (this.#gridLife?.isDead || !this.#gm.grid.canMove()) {
      this.#onGameOver();
    }
  }

  /**
   * Execute a single power effect with appropriate animation.
   * @param {string} powerType
   * @param {import('../entities/tile.js').Tile} target
   */
  async #executePowerEffect(powerType, target) {
    const isFirePower = powerType === POWER_TYPES.FIRE_H
      || powerType === POWER_TYPES.FIRE_V
      || powerType === POWER_TYPES.FIRE_X;

    const effectResult = this.#powerManager.executeEffect(powerType, this.#gm.grid, target);

    // Track tiles being destroyed so the info panel can warn the player,
    // and so a safety flush at the next move can clean up unfinished animations.
    for (const tile of effectResult.destroyed) {
      this.#pendingDestructionTiles.set(tile.id, tile.value);
    }
    if (effectResult.destroyed.length > 0) {
      this.#updatePowerVisuals();
    }

    if (isFirePower && target && effectResult.destroyed.length > 0) {
      this.#gm.playFireAnimation(powerType, target, effectResult.destroyed);
      await this.#wait(ANIM.FIRE_BALL_DURATION + ANIM.FIRE_ZAP_DURATION);
      this.#gm.removeTiles(effectResult.destroyed);
    } else if (effectResult.teleported) {
      const { tileA, tileB, oldA, oldB } = effectResult.teleported;
      await this.#gm.playTeleportAnimation(tileA, tileB, oldA, oldB, ANIM.TELEPORT_DURATION);
    } else if (powerType === POWER_TYPES.LIGHTNING && effectResult.lightningStrikes) {
      const numStrikes = effectResult.lightningStrikes.length;
      this.#gm.playLightningAnimation(effectResult.lightningStrikes);
      const totalDuration = (numStrikes - 1) * ANIM.LIGHTNING_STRIKE_DELAY + ANIM.LIGHTNING_ANIM_DURATION;
      await this.#wait(totalDuration);
      this.#gm.removeTiles(effectResult.destroyed);
    } else if (powerType === POWER_TYPES.BOMB) {
      if (effectResult.destroyed.length > 0) {
        this.#gm.playBombAnimation(target, effectResult.destroyed);
        await this.#wait(ANIM.BOMB_DURATION);
        this.#gm.removeTiles(effectResult.destroyed);
      }
    } else if (powerType === POWER_TYPES.NUCLEAR) {
      if (effectResult.destroyed.length > 0) {
        this.#gm.playNuclearAnimation(effectResult.destroyed);
        // Wait for tiles to become visually invisible, then remove DOM nodes
        await this.#wait(ANIM.NUCLEAR_TILE_REMOVE_AT);
        this.#gm.removeTiles(effectResult.destroyed);
        // Wait for the blast overlay to finish fading out
        await this.#wait(ANIM.NUCLEAR_DURATION - ANIM.NUCLEAR_TILE_REMOVE_AT);
      }
    } else if (powerType === POWER_TYPES.ADS) {
      if (!this.#adsShown) {
        await this.#showAdsModal();
        this.#adsShown = true;
        // Disable ADS for the rest of this game
        this.#powerManager?.removePowerType(POWER_TYPES.ADS);
        // Clear any ADS powers already assigned to tiles
        for (const tile of this.#gm.grid.getAllTiles()) {
          if (tile.power === POWER_TYPES.ADS) tile.power = null;
        }
        this.#gm.syncTileDom(this.#powerManager?.windDirection ?? null);
      }
    } else {
      this.#gm.applyDangerOverlay(effectResult.destroyed);
      if (effectResult.destroyed.length > 0) {
        await this.#wait(400);
        this.#gm.removeTiles(effectResult.destroyed);
      }
    }

    // Animation done: clear tracked tiles from the pending map
    for (const tile of effectResult.destroyed) {
      this.#pendingDestructionTiles.delete(tile.id);
    }

    // Grid Life: apply damage from destroyed tiles
    if (this.#gridLife && effectResult.destroyed.length > 0) {
      const values = effectResult.destroyed.map((t) => t.value);
      const damage = this.#gridLife.takeDamage(values);
      this.#onGridLifeDamage(damage);
    }
  }

  /**
   * Show the power choice modal and wait for player to pick.
   * @param {string} powerTypeA
   * @param {string} powerTypeB
   * @returns {Promise<string>} The chosen power type
   */
  #showPowerChoiceModal(powerTypeA, powerTypeB) {
    return new Promise((resolve) => {
      this.#powerChoiceModal = new PowerChoiceModal(this, {
        powerTypeA,
        powerTypeB,
        onChoice: (chosenType) => {
          this.#powerChoiceModal?.destroy();
          this.#powerChoiceModal = null;
          this.#skipNextPointerUp = true;
          resolve(chosenType);
        },
      });
    });
  }

  /**
   * Display a non-dismissible ads modal for ADS_DURATION ms, then resolve.
   * Input is blocked for the entire duration via #showingAds.
   * @returns {Promise<void>}
   */
  #showAdsModal() {
    this.#showingAds = true;
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'fm-ads-overlay';
      overlay.style.setProperty('--fm-ads-open-dur', `${ANIM.ADS_OPEN_DURATION}ms`);
      overlay.innerHTML = `
        <div class="fm-ads-container">
          <div class="fm-ads-label">${i18n.t('ads.label')}</div>
          <div class="fm-ads-placeholder">📱</div>
          <div class="fm-ads-timer" id="fm-ads-timer">${Math.ceil(ANIM.ADS_DURATION / 1000)}</div>
        </div>`;
      document.body.appendChild(overlay);
      this.#adsOverlay = overlay;

      let remaining = Math.ceil(ANIM.ADS_DURATION / 1000);
      const timerEl = overlay.querySelector('#fm-ads-timer');

      // Delay the countdown start to let the entrance animation play first
      this.time.delayedCall(ANIM.ADS_OPEN_DURATION, () => {
        // Countdown ticker (every second)
        const tick = this.time.addEvent({
          delay: 1000,
          repeat: remaining - 1,
          callback: () => {
            remaining--;
            if (timerEl) timerEl.textContent = String(remaining);
          },
        });

        this.time.delayedCall(ANIM.ADS_DURATION, () => {
          tick.remove(false);
          overlay.classList.add('fm-ads-overlay--closing');
          this.time.delayedCall(ANIM.ADS_CLOSE_DURATION, () => {
            overlay.remove();
            this.#adsOverlay = null;
            this.#showingAds = false;
            resolve();
          });
        });
      });
    });
  }

  // ─── HUD UPDATE ──────────────────────────────────
  #updateHUD() {
    const grid = this.#gm.grid;
    const scoreEl = this.#hudEl?.querySelector('#fm-score');
    const movesEl = this.#hudEl?.querySelector('#fm-moves');
    const bestEl = this.#hudEl?.querySelector('#fm-best');
    const fusionsEl = this.#hudEl?.querySelector('#fm-fusions');
    if (scoreEl) scoreEl.textContent = String(grid.score);
    if (movesEl) movesEl.textContent = String(grid.moves);
    if (bestEl) {
      const best = Math.max(saveManager.getBestScore(this.#mode), grid.score);
      bestEl.textContent = String(best);
    }
    if (fusionsEl) fusionsEl.textContent = String(this.#fusions);

    // Track max tile
    for (const tile of grid.getAllTiles()) {
      if (tile.value > this.#maxTile) this.#maxTile = tile.value;
    }
    const maxTileEl = this.#hudEl?.querySelector('#fm-max-tile');
    if (maxTileEl) maxTileEl.textContent = String(this.#maxTile);
    const bestMaxTileEl = this.#hudEl?.querySelector('#fm-best-max-tile');
    if (bestMaxTileEl) {
      const bestMax = Math.max(saveManager.getBestMaxTile(this.#mode), this.#maxTile);
      bestMaxTileEl.textContent = String(bestMax);
    }

    // New best score notification — fire once per game when current score beats the record
    if (!this.#bestScoreNotified && this.#prevBestScore > 0 && grid.score > this.#prevBestScore) {
      this.#bestScoreNotified = true;
      this.#showNewBestNotification();
    }
  }

  /** Show a transient banner when the player beats their previous best score. */
  #showNewBestNotification() {
    const el = document.createElement('div');
    el.className = 'fm-new-best-notif';
    el.textContent = i18n.t('game.new_best');
    document.body.appendChild(el);

    this.time.delayedCall(2500, () => {
      el.classList.add('fm-new-best-notif--out');
      this.time.delayedCall(400, () => el.remove());
    });
  }

  // ─── COMBO ───────────────────────────────────────
  #updateComboDisplay(animate) {
    if (!this.#comboEl) return;
    this.#cancelComboTimer();
    this.#comboEl.classList.remove('fm-combo-hurt');
    this.#comboEl.style.removeProperty('animation');
    void this.#comboEl.offsetWidth;
    const color = COMBO_COLORS[(this.#combo - 1) % COMBO_COLORS.length];
    this.#comboEl.style.display = 'block';
    this.#comboEl.style.color = color;
    this.#comboEl.style.textShadow =
      `-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 8px ${color}`;
    this.#comboEl.style.borderColor = color;
    this.#comboEl.innerHTML =
      `<span class="fm-hit-number">${this.#combo}</span><span class="fm-hit-label">HIT</span>`;
    const fade = 'fm-combo-fade 3s linear forwards';
    if (animate && this.#combo >= 3) {
      this.#comboEl.style.animation = `fm-combo-shake 0.5s ease-in-out both, ${fade}`;
    } else if (animate) {
      this.#comboEl.style.animation = `fm-combo-pop 0.45s ease-out both, ${fade}`;
    } else {
      this.#comboEl.style.animation = fade;
    }
    this.#comboTimer = this.time.delayedCall(3000, () => this.#endCombo());
  }

  #endCombo() {
    this.#cancelComboTimer();
    this.#comboBreaking = false;
    if (this.#combo <= 0) return;
    if (this.#comboMax >= 2) {
      const grid = this.#gm.grid;
      const scoreGained = grid.score - this.#comboScoreStart;
      if (scoreGained > 0) {
        const bonus = scoreGained * (this.#comboMax - 1);
        grid.score += bonus;
        this.#comboScoreTotal += bonus;
        this.#showScoreBonus(bonus);
        this.#updateHUD();
      }
    }
    this.#combo = 0;
    this.#comboMax = 0;
    this.#comboScoreStart = 0;
    if (this.#comboEl) {
      this.#comboEl.style.removeProperty('animation');
      this.#comboEl.style.display = 'none';
      this.#comboEl.classList.remove('fm-combo-hurt');
    }
  }

  #breakComboWithHurt() {
    if (this.#combo <= 0) return;
    this.#cancelComboTimer();
    this.#comboBreaking = true;
    if (this.#comboEl) {
      this.#comboEl.classList.remove('fm-combo-hurt');
      this.#comboEl.style.removeProperty('animation');
      void this.#comboEl.offsetWidth;
      this.#comboEl.classList.add('fm-combo-hurt');
    }
    this.#comboTimer = this.time.delayedCall(600, () => this.#endCombo());
  }

  #cancelComboTimer() {
    if (this.#comboTimer) {
      this.#comboTimer.remove(false);
      this.#comboTimer = null;
    }
  }

  /** @param {number} amount */
  #showScoreBonus(amount) {
    if (!this.#scoreBonusEl || amount <= 0) return;
    const color = '#ffdd00';
    this.#scoreBonusEl.textContent = `+${amount}`;
    this.#scoreBonusEl.style.color = color;
    this.#scoreBonusEl.style.textShadow = `0 0 10px ${color}, 0 2px 6px rgba(0,0,0,0.6)`;
    this.#scoreBonusEl.classList.remove('fm-bonus-active');
    void this.#scoreBonusEl.offsetWidth;
    this.#scoreBonusEl.classList.add('fm-bonus-active');
  }

  // ─── BATTLE MODE ────────────────────────────────

  /** Create the enemy display area — a fixed overlay on document.body. */
  #createEnemyArea() {
    this.#enemyAreaEl = document.createElement('div');
    this.#enemyAreaEl.className = 'fm-enemy-area';
    this.#enemyAreaEl.style.display = 'none';
    document.body.appendChild(this.#enemyAreaEl);
    // Position after HUD and grid are in the DOM
    requestAnimationFrame(() => this.#positionEnemyArea());
    // Create the static physics floor for dead-enemy collision
    this.#createPhysicsFloor();
  }

  /**
   * Position the enemy area between the HUD bottom and the grid top using
   * actual DOM measurements so it works regardless of device size.
   */
  #positionEnemyArea() {
    if (!this.#enemyAreaEl) return;
    const hudRect = this.#hudEl?.getBoundingClientRect();
    const gridRect = this.#gm.gridEl?.getBoundingClientRect();
    if (!hudRect || !gridRect) return;
    const spaceCenter = hudRect.bottom + (gridRect.top - hudRect.bottom) / 2;
    this.#enemyAreaEl.style.position = 'fixed';
    this.#enemyAreaEl.style.left = '50%';
    this.#enemyAreaEl.style.top = `${spaceCenter}px`;
    this.#enemyAreaEl.style.transform = 'translate(-50%, -50%)';
    // z-index 1: above background canvas but below grid tiles, panels, and modals.
    // The CSS :has(.fm-modal-overlay) rule hides this element entirely when any modal is open.
    this.#enemyAreaEl.style.zIndex = '1';
  }

  /**
   * Create a static Matter.js floor body at the bottom of the viewport.
   * Dead enemy tiles collide with this floor and with each other.
   */
  #createPhysicsFloor() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const thickness = 100;
    // Top edge of the body sits exactly at viewport bottom (H)
    this.#physicsFloor = this.matter.add.rectangle(
      W / 2, H + thickness / 2,
      W * 4, thickness,
      { isStatic: true, label: 'floor', friction: 1.0, frictionStatic: 10.0, restitution: 0.02 },
    );
  }

  /**
   * Main battle tick — called after every player move.
   * Handles classic-phase counting, enemy spawn, contamination, and damage.
   * @param {{ tile: import('../entities/tile.js').Tile }[]} merges
   */
  async #tickBattle(merges) {
    const bm = this.#battleManager;
    if (!bm) return;

    if (bm.isClassicPhase) {
      // Classic phase: count moves, check for enemy spawn
      const enemy = bm.tickClassicPhase(this.#gm.grid);
      if (enemy) {
        await this.#onEnemySpawn(enemy);
      }
    } else {
      // Merge damage is now applied earlier (before power choice modal)
      // in the battle power system block of #executeMove.
      // Only apply damage here if there was no battlePowerManager
      // (i.e. no contaminated tiles were on the grid).
      if (!this.#battlePowerManager && merges.length > 0) {
        const { damage, killed } = bm.applyMergeDamage(merges);
        if (damage > 0) {
          await this.#playAttackParticles(merges);
          this.#showEnemyDamage(damage);
          this.#updateEnemyVisual();
        }
        if (killed) {
          await this.#onEnemyDefeated();
          return;
        }
      }

      // Enemy contaminates one tile per move
      const contamination = bm.contaminate(this.#gm.grid);
      if (contamination) {
        // Sync DOM IMMEDIATELY — power is applied to tile data regardless of animation
        this.#gm.syncTileDom(this.#battlePowerManager?.windDirection ?? null);
        this.#updatePowerVisuals();
        await this.#playContaminationAnimation(contamination.tile);
      }
    }
  }

  /**
   * Called when a new enemy spawns.
   * @param {import('../entities/enemy.js').Enemy} enemy
   */
  async #onEnemySpawn(enemy) {
    // Create power manager for battle contamination effects using ALL powers from this enemy
    this.#battlePowerManager = new PowerManager(enemy.availablePowers);

    // Create grid life overlay starting at 0% (will fill via CSS transition below)
    this.#gridLife = new GridLife();
    this.#createLiquidOverlay();

    // Render enemy (HP bar starts at 0% for fill animation)
    this.#renderEnemy(enemy);

    // Re-position now that the element is in the DOM
    this.#positionEnemyArea();

    // Entrance animation on the tile wrapper (not the area itself, which has translate positioning)
    if (this.#enemyAreaEl) {
      this.#enemyAreaEl.style.visibility = ''; // reset visibility hidden set during death animation
      this.#enemyAreaEl.style.display = 'flex';
      /* Force reflow so the tile has real dimensions before creating the wave canvas */
      void this.#enemyAreaEl.offsetHeight;

      /* Create wave now that the element is laid out */
      const cat = enemy.life.getColorCategory();
      this.#attachEnemyWave(cat, enemy.life.percent);

      const tileWrapper = this.#enemyAreaEl.querySelector('.fm-enemy-tile');

      if (tileWrapper) {
        tileWrapper.classList.add('fm-enemy-spawn');

        /* Trigger fill: grid HP 0 → actual */
        this.#updateLifeVisual();

        await this.#wait(600);
        tileWrapper.classList.remove('fm-enemy-spawn');
      } else {
        this.#updateLifeVisual();
        await this.#wait(600);
      }
    }
  }

  /**
   * Render the enemy tile + HP bar + name label.
   * Enemy HP liquid starts at 0% so the fill transition animates on spawn.
   * @param {import('../entities/enemy.js').Enemy} enemy
   */
  #renderEnemy(enemy) {
    if (!this.#enemyAreaEl) return;

    // Destroy previous enemy wave before clearing innerHTML
    this.#enemyWave?.destroy();
    this.#enemyWave = null;

    const tileClass = `fm-t${enemy.level}`;
    const bossClass = enemy.isBoss ? ' fm-enemy-boss' : '';
    const cat = enemy.life.getColorCategory();

    this.#enemyAreaEl.innerHTML = `
      <div class="fm-enemy-tile${bossClass}">
        <div class="fm-tile fm-enemy-tile-inner ${tileClass}">
          <div class="fm-enemy-hp-liquid"></div>
          <div class="fm-enemy-face" data-face-category="${cat}">
            <img src="${getRandomFaceUrl(cat)}" alt="">
          </div>
        </div>
      </div>
    `;
    /* LiquidWave is created in #onEnemySpawn after display:flex + reflow
       so getBoundingClientRect() returns correct tile dimensions. */

    const tileWrapper = this.#enemyAreaEl.querySelector('.fm-enemy-tile');
    if (tileWrapper) {
      tileWrapper.style.cursor = 'pointer';
      tileWrapper.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.#openEnemyInfoModal();
      });
    }
  }

  /**
   * Attach the canvas wave to the enemy tile after the area is visible.
   * Must be called after enemyAreaEl.style.display = 'flex' + forced reflow.
   * @param {string} category
   * @param {number} level 0-1
   */
  #attachEnemyWave(category, level) {
    const tileEl = this.#enemyAreaEl?.querySelector('.fm-enemy-tile');
    const liquidEl = this.#enemyAreaEl?.querySelector('.fm-enemy-hp-liquid');
    if (!liquidEl) return;
    /* Read size from the tile wrapper (offsetWidth/offsetHeight are reliable on
       visible elements). Fall back to #tileSizePx if layout hasn't settled yet. */
    const size = tileEl?.offsetWidth || this.#tileSizePx;
    this.#enemyWave = new LiquidWave(liquidEl, { category, alpha: 0.65, width: size, height: size });
    this.#enemyWave.snapLevel(0);
    this.#enemyWave.level = level;
  }

  /** Update the enemy HP bar visual. */
  #updateEnemyVisual() {
    if (!this.#enemyAreaEl || !this.#battleManager?.enemy) return;
    const enemy = this.#battleManager.enemy;
    const cat = enemy.life.getColorCategory();
    if (this.#enemyWave) {
      this.#enemyWave.level = enemy.life.percent;
      this.#enemyWave.setCategory(cat);
    }
    // Update face image when HP category changes
    const faceEl = this.#enemyAreaEl.querySelector('.fm-enemy-face');
    if (faceEl && faceEl.dataset.faceCategory !== cat) {
      faceEl.dataset.faceCategory = cat;
      const img = faceEl.querySelector('img');
      if (img) img.src = getRandomFaceUrl(cat);
    }
    // Hurt flash on enemy tile
    const tile = this.#enemyAreaEl.querySelector('.fm-enemy-tile-inner');
    if (tile) {
      tile.classList.remove('fm-enemy--hurt');
      void tile.offsetWidth;
      tile.classList.add('fm-enemy--hurt');
    }
  }

  /**
   * Show floating damage number on the enemy.
   * @param {number} damage
   */
  #showEnemyDamage(damage) {
    if (!this.#enemyAreaEl) return;
    const popup = document.createElement('div');
    popup.className = 'fm-enemy-damage';
    popup.textContent = `-${damage}`;
    this.#enemyAreaEl.appendChild(popup);
    popup.addEventListener('animationend', () => popup.remove());
  }

  /**
   * Called when the current enemy is defeated.
   */
  async #onEnemyDefeated() {
    const bm = this.#battleManager;
    if (!bm) return;

    const dead = bm.defeatEnemy();
    if (!dead) return;

    // Clear all powers from grid tiles
    bm.clearGridPowers(this.#gm.grid);
    this.#gm.syncTileDom(null);

    // Fade out the grid life liquid (non-blocking — runs while death animation plays)
    this.#gridLife = null;
    this.#criticalOverlay?.remove();
    this.#criticalOverlay = null;
    const dyingWave = this.#gridWave;
    this.#gridWave = null;
    const dyingLiquid = this.#liquidEl;
    this.#liquidEl = null;
    if (dyingLiquid) {
      dyingLiquid.classList.add('fm-grid-life-liquid--out');
      const removeDying = () => {
        dyingWave?.destroy();
        if (dyingLiquid.isConnected) dyingLiquid.remove();
      };
      dyingLiquid.addEventListener('transitionend', removeDying, { once: true });
      setTimeout(removeDying, 700);
    }

    // Hide HP box in HUD — removed (HP no longer shown in battle HUD)

    // Death animation: gray out, move to graveyard
    await this.#playEnemyDeathAnimation(dead);

    // Close info modal if open
    this.#enemyInfoModal?.destroy();
    this.#enemyInfoModal = null;

    // Clear enemy display
    this.#enemyWave?.destroy();
    this.#enemyWave = null;
    if (this.#enemyAreaEl) {
      this.#enemyAreaEl.style.display = 'none';
      this.#enemyAreaEl.innerHTML = '';
    }

    // Clear battle power manager
    this.#battlePowerManager = null;

    // Explicitly remove all edge power indicators and hide info panel
    if (this.#gm.gridEl) {
      for (const el of this.#gm.gridEl.querySelectorAll('.fm-edge-power')) {
        el.remove();
      }
    }
    if (this.#powerInfoEl) {
      this.#powerInfoEl.style.display = 'none';
    }

    // Check if all enemies have been defeated — triggers battle victory
    if (this.#battleManager?.allDefeated() && !this.#victoryShown) {
      this.#updateHUD();
      this.#gm.updateFusionIndicators();
      this.#gm.animating = false;
      this.#onVictory();
    }
  }

  /** Open the enemy info modal (tap on enemy tile). */
  #openEnemyInfoModal() {
    if (this.#enemyInfoModal || !this.#battleManager?.enemy) return;
    this.#enemyInfoModal = new EnemyInfoModal(this, {
      enemy: this.#battleManager.enemy,
      onClose: () => {
        this.#enemyInfoModal?.destroy();
        this.#enemyInfoModal = null;
      },
    });
  }

  /**
   * Animate attack particles flying from each merged tile to the enemy.
   * @param {{ tile: import('../entities/tile.js').Tile }[]} merges
   */
  async #playAttackParticles(merges) {
    if (!this.#enemyAreaEl || !merges.length) return;
    const enemyTileEl = this.#enemyAreaEl.querySelector('.fm-enemy-tile');
    if (!enemyTileEl) return;

    const enemyRect = enemyTileEl.getBoundingClientRect();
    const ex = enemyRect.left + enemyRect.width / 2;
    const ey = enemyRect.top + enemyRect.height / 2;

    const SPREAD = 28;  // px radius around merge center
    const COUNT  = 10;  // particles per merged tile

    const particles = [];
    for (const merge of merges) {
      const tileEl = this.#gm.tileElements.get(merge.tile.id);
      if (!tileEl) continue;
      const tileRect = tileEl.getBoundingClientRect();
      const cx = tileRect.left + tileRect.width  / 2;
      const cy = tileRect.top  + tileRect.height / 2;

      // Read tile border color from computed style — reuses the .fm-t* CSS class
      const borderColor = getComputedStyle(tileEl).borderColor || 'rgba(255,200,0,1)';

      for (let i = 0; i < COUNT; i++) {
        const angle  = Math.random() * Math.PI * 2;
        const radius = Math.random() * SPREAD;
        const ox = Math.cos(angle) * radius;
        const oy = Math.sin(angle) * radius;

        const p = document.createElement('div');
        p.className = 'fm-attack-particle';
        p.style.left = `${cx + ox}px`;
        p.style.top  = `${cy + oy}px`;
        p.style.background = `radial-gradient(circle, #fff, ${borderColor})`;
        p.style.boxShadow  = `0 0 6px 2px ${borderColor}`;
        document.body.appendChild(p);
        particles.push({ el: p, dx: ex - (cx + ox), dy: ey - (cy + oy) });
      }
    }

    if (!particles.length) return;

    requestAnimationFrame(() => {
      for (const { el, dx, dy } of particles) {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.classList.add('fm-attack-fly');
      }
    });

    await this.#wait(320);
    for (const { el } of particles) el.remove();
  }

  /**
   * Play the contamination animation: particle from enemy to tile.
   * Color is read from the enemy tile DOM element (.fm-t* class) — no hardcoded values.
   * @param {import('../entities/tile.js').Tile} tile — The freshly contaminated tile
   */
  async #playContaminationAnimation(tile) {
    if (!this.#enemyAreaEl || !this.#gm.gridEl) return;

    const tileEl = this.#gm.tileElements.get(tile.id);
    if (!tileEl) return;

    const enemyRect = this.#enemyAreaEl.getBoundingClientRect();
    const tileRect  = tileEl.getBoundingClientRect();

    // Read border color from the enemy tile inner element (.fm-t* already applied)
    const enemyInnerEl  = this.#enemyAreaEl.querySelector('.fm-enemy-tile-inner');
    const borderColor   = enemyInnerEl
      ? getComputedStyle(enemyInnerEl).borderColor
      : 'rgba(170, 0, 255, 1)';

    const particle = document.createElement('div');
    particle.className = 'fm-contaminate-particle';
    particle.style.background = `radial-gradient(circle, #fff, ${borderColor})`;
    particle.style.boxShadow  = `0 0 10px 3px ${borderColor}`;
    particle.style.left = `${enemyRect.left + enemyRect.width  / 2}px`;
    particle.style.top  = `${enemyRect.top  + enemyRect.height / 2}px`;
    document.body.appendChild(particle);

    requestAnimationFrame(() => {
      particle.style.transform = `translate(${tileRect.left + tileRect.width / 2 - (enemyRect.left + enemyRect.width / 2)}px, ${tileRect.top + tileRect.height / 2 - (enemyRect.top + enemyRect.height / 2)}px)`;
      particle.classList.add('fm-contaminate-fly');
    });

    await this.#wait(BATTLE.CONTAMINATE_DURATION);
    particle.remove();
  }

  /**
   * Play enemy death animation using Phaser's Matter.js physics engine.
   * A DOM element provides the visual; a Matter rigid body drives position + rotation.
   * Bodies collide with the static floor and with each other — no hand-crafted physics.
   * @param {import('../entities/enemy.js').Enemy} enemy
   */
  async #playEnemyDeathAnimation(enemy) {
    if (!this.#enemyAreaEl) return;

    const tileSize = this.#tileSizePx;
    const tileClass = `fm-t${enemy.level}`;

    // Find the tile wrapper to get its exact center position
    const tileWrap = this.#enemyAreaEl.querySelector('.fm-enemy-tile');
    const srcRect  = (tileWrap ?? this.#enemyAreaEl).getBoundingClientRect();
    const cx = srcRect.left + srcRect.width  / 2;
    const cy = srcRect.top  + srcRect.height / 2;

    // ── DOM element (visual only) ──────────────────────────────────────────
    // Hide the live enemy tile immediately so there is no overlap between the
    // still-visible live tile and the newly created dead tile.
    if (this.#enemyAreaEl) this.#enemyAreaEl.style.visibility = 'hidden';

    const deadTile = document.createElement('div');
    deadTile.className = 'fm-dead-enemy';
    deadTile.style.cssText = `position:fixed;width:${tileSize}px;height:${tileSize}px;` +
                             `pointer-events:none;transform-origin:center center;`;
    deadTile.style.left = `${cx - tileSize / 2}px`;
    deadTile.style.top  = `${cy - tileSize / 2}px`;
    deadTile.innerHTML  = `
      <div class="fm-tile fm-dead-enemy-inner ${tileClass}">
        <span class="fm-dead-enemy-label">${enemy.name}</span>
        <div class="fm-dead-enemy-face">
          <img src="${getRandomFaceUrl('death')}" alt="">
        </div>
      </div>`;
    document.body.appendChild(deadTile);

    // ── Matter.js physics body ─────────────────────────────────────────────
    // this.matter.add.rectangle() creates a raw Matter Body and adds it to the world.
    const body = this.matter.add.rectangle(cx, cy, tileSize, tileSize, {
      chamfer       : { radius: 14 }, // match CSS border-radius: 14px
      restitution   : 0.30,   // light bounce — natural fall feel
      friction      : 0.90,   // friction against floor/other bodies
      frictionAir   : 0.008,  // low air resistance — falls at normal speed
      density       : 0.002,
      label         : 'dead-enemy',
    });

    // Initial impulse: random horizontal kick + spin
    const M      = Phaser.Physics.Matter.Matter;
    const vxDir  = Math.random() > 0.5 ? 1 : -1;
    M.Body.setVelocity(body, {
      x: vxDir * (Math.random()),
      y: 0,
    });
    M.Body.setAngularVelocity(body,
      (Math.random() > 0.5 ? 1 : -1) * (0.08 + Math.random() * 0.18),
    );

    this.#deadEnemyBodies.push({ el: deadTile, body });

    // Brief pause so the caller waits for the tile to visually separate from
    // the enemy area before clearing it — physics continues via update().
    await this.#wait(400);
  }

  /**
   * Apply a small directional impulse to all dead-enemy physics bodies.
   * Creates a very subtle push effect when the player swipes, making the
   * graveyard pile feel alive without being distracting.
   * @param {'up' | 'down' | 'left' | 'right'} direction
   */
  #nudgeDeadEnemies(direction) {
    if (this.#deadEnemyBodies.length === 0) return;
    const M = Phaser.Physics.Matter.Matter;
    const BASE   = 1.5; // base velocity delta (pixels/frame) — keep subtle
    const JITTER = 0.8; // per-body random variation for natural feel
    const dx = direction === 'right' ? BASE : direction === 'left' ? -BASE : 0;
    const dy = direction === 'down'  ? BASE : direction === 'up'   ? -BASE : 0;
    for (const { body } of this.#deadEnemyBodies) {
      // Wake sleeping bodies first — setVelocity has no effect on sleeping bodies
      // (enableSleeping is true in the Matter world config).
      if (body.isSleeping) M.Sleeping.set(body, false);
      const jx = (Math.random() - 0.5) * JITTER;
      const jy = (Math.random() - 0.5) * JITTER;
      M.Body.setVelocity(body, {
        x: body.velocity.x + dx + jx,
        y: body.velocity.y + dy + jy,
      });
    }
  }

  /**
   * Execute a power effect triggered by a contaminated tile in battle mode.
   * Same as #executePowerEffect but uses battlePowerManager.
   * @param {string} powerType
   * @param {import('../entities/tile.js').Tile} target
   */
  async #executeBattlePowerEffect(powerType, target) {
    if (!this.#battlePowerManager) return;

    const isFirePower = powerType === POWER_TYPES.FIRE_H
      || powerType === POWER_TYPES.FIRE_V
      || powerType === POWER_TYPES.FIRE_X;

    const effectResult = this.#battlePowerManager.executeEffect(powerType, this.#gm.grid, target);

    for (const tile of effectResult.destroyed) {
      this.#pendingDestructionTiles.set(tile.id, tile.value);
    }
    if (effectResult.destroyed.length > 0) {
      this.#updatePowerVisuals();
    }

    if (isFirePower && target && effectResult.destroyed.length > 0) {
      this.#gm.playFireAnimation(powerType, target, effectResult.destroyed);
      await this.#wait(ANIM.FIRE_BALL_DURATION + ANIM.FIRE_ZAP_DURATION);
      this.#gm.removeTiles(effectResult.destroyed);
    } else if (effectResult.teleported) {
      const { tileA, tileB, oldA, oldB } = effectResult.teleported;
      await this.#gm.playTeleportAnimation(tileA, tileB, oldA, oldB, ANIM.TELEPORT_DURATION);
    } else if (powerType === POWER_TYPES.LIGHTNING && effectResult.lightningStrikes) {
      const numStrikes = effectResult.lightningStrikes.length;
      this.#gm.playLightningAnimation(effectResult.lightningStrikes);
      const totalDuration = (numStrikes - 1) * ANIM.LIGHTNING_STRIKE_DELAY + ANIM.LIGHTNING_ANIM_DURATION;
      await this.#wait(totalDuration);
      this.#gm.removeTiles(effectResult.destroyed);
    } else if (powerType === POWER_TYPES.BOMB) {
      if (effectResult.destroyed.length > 0) {
        this.#gm.playBombAnimation(target, effectResult.destroyed);
        await this.#wait(ANIM.BOMB_DURATION);
        this.#gm.removeTiles(effectResult.destroyed);
      }
    } else if (powerType === POWER_TYPES.NUCLEAR) {
      if (effectResult.destroyed.length > 0) {
        this.#gm.playNuclearAnimation(effectResult.destroyed);
        await this.#wait(ANIM.NUCLEAR_TILE_REMOVE_AT);
        this.#gm.removeTiles(effectResult.destroyed);
        await this.#wait(ANIM.NUCLEAR_DURATION - ANIM.NUCLEAR_TILE_REMOVE_AT);
      }
    } else if (powerType === POWER_TYPES.ADS) {
      if (!this.#adsShown) {
        await this.#showAdsModal();
        this.#adsShown = true;
        // Disable ADS for the rest of this game
        this.#battlePowerManager?.removePowerType(POWER_TYPES.ADS);
        // Also remove ADS from enemy's available powers to stop contamination
        if (this.#battleManager?.enemy) {
          this.#battleManager.enemy.availablePowers =
            this.#battleManager.enemy.availablePowers.filter((p) => p !== POWER_TYPES.ADS);
        }
        // Clear any ADS powers already assigned to tiles
        for (const tile of this.#gm.grid.getAllTiles()) {
          if (tile.power === POWER_TYPES.ADS) tile.power = null;
        }
        this.#gm.syncTileDom(this.#battlePowerManager?.windDirection ?? null);
      }
    } else {
      this.#gm.applyDangerOverlay(effectResult.destroyed);
      if (effectResult.destroyed.length > 0) {
        await this.#wait(400);
        this.#gm.removeTiles(effectResult.destroyed);
      }
    }

    for (const tile of effectResult.destroyed) {
      this.#pendingDestructionTiles.delete(tile.id);
    }

    // Grid Life: damage from power effects during battle
    if (this.#gridLife && effectResult.destroyed.length > 0) {
      const values = effectResult.destroyed.map((t) => t.value);
      const damage = this.#gridLife.takeDamage(values);
      this.#onGridLifeDamage(damage);
    }
  }

  // ─── MODALS ──────────────────────────────────────
  #openMenu() {
    if (this.#menuModal || this.#gameOverModal) return;
    saveManager.saveGame({ ...this.#gm.grid.serialize(), mode: this.#mode });

    this.#menuModal = new MenuModal(this, {
      showResume: true,
      onResume: () => this.#destroyMenuModal(),
      onClassic: () => { this.#destroyMenuModal(); this.scene.restart({ mode: 'classic' }); },
      onBattle: () => { this.#destroyMenuModal(); this.scene.restart({ mode: 'battle' }); },
      onFree: () => { this.#destroyMenuModal(); this.scene.restart({ mode: 'free' }); },
      onClose: () => this.#destroyMenuModal(),
      onQuit: () => {
        this.#destroyMenuModal();
        saveManager.saveGame({ ...this.#gm.grid.serialize(), mode: this.#mode });
        this.scene.start(SCENE_KEYS.TITLE);
      },
      onSave: () => this.#handleSaveSlot(),
      onAdmin: () => this.#openAdminMenu(),
    });
  }

  // ─── SAVE SLOT ───────────────────────────────────

  /**
   * Build a complete save-state object for the current game.
   * @returns {object}
   */
  #buildFullSaveState() {
    const grid = this.#gm.grid;
    const state = {
      mode: this.#mode,
      grid: grid.serializeFull(),
      score: grid.score,
      moves: grid.moves,
      fusions: this.#fusions,
      maxTile: this.#maxTile,
      comboScoreTotal: this.#comboScoreTotal,
      combo: this.#combo,
      comboMax: this.#comboMax,
      comboScoreStart: this.#comboScoreStart,
      powersTriggered: [...this.#powersTriggered],
      victoryShown: this.#victoryShown,
    };

    if (this.#mode === 'free') {
      state.selectedPowers = this.#selectedPowers ? [...this.#selectedPowers] : null;
      if (this.#powerManager) state.powerManager = this.#powerManager.serialize();
      if (this.#gridLife) state.gridLife = this.#gridLife.serialize();
    }

    if (this.#mode === 'battle') {
      if (this.#battleManager) state.battleManager = this.#battleManager.serialize();
      if (this.#gridLife) state.gridLife = this.#gridLife.serialize();
      if (this.#battlePowerManager) state.battlePowerManager = this.#battlePowerManager.serialize();
    }

    return state;
  }

  /**
   * Save the current game to a slot. Shows a toast on success.
   * Skips if the current state is identical to the last save (no moves made).
   */
  #handleSaveSlot() {
    const grid = this.#gm.grid;
    const fingerprint = `${this.#mode}:${grid.score}:${grid.moves}:${this.#fusions}`;
    if (fingerprint === this.#lastSavedFingerprint) {
      this.#showToast(i18n.t('save.already_saved'));
      return;
    }
    const state = this.#buildFullSaveState();
    saveManager.saveSlot(state);
    this.#lastSavedFingerprint = fingerprint;
    this.#showToast(i18n.t('save.saved'));
  }

  /**
   * Show a brief toast message at the bottom of the screen.
   * @param {string} message
   */
  #showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fm-saveload-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  /**
   * Recreate dead-enemy DOM tiles settled at the bottom of the screen after loading a save.
   * Each enemy is placed randomly along the screen width at the viewport bottom,
   * on top of the physics floor, with a static body so it does not fall again.
   * @param {{ name: string, level: number }[]} enemies
   */
  #restoreDeadEnemyTiles(enemies) {
    // Read the live CSS variable so tile size matches the actual rendered tiles,
    // even when this runs before events.once('create') sets #tileSizePx.
    const cssSize = parseInt(
      getComputedStyle(document.getElementById('game-container') ?? document.body)
        .getPropertyValue('--fm-tile-size'),
      10,
    );
    const tileSize = cssSize || this.#tileSizePx || 64;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const gap = 6;

    for (let i = 0; i < enemies.length; i++) {
      const { name, level } = enemies[i];
      const tileClass = `fm-t${level}`;

      // Centre tiles at the very bottom of the screen, spread side-by-side.
      // The physics floor top edge sits at H, so body centre at H - tileSize/2
      // places the tile bottom flush with the floor — perfectly flat.
      const totalW = enemies.length * tileSize + (enemies.length - 1) * gap;
      const startX = (W - totalW) / 2 + tileSize / 2;
      const cx = startX + i * (tileSize + gap);
      const cy = H - tileSize / 2;

      const deadTile = document.createElement('div');
      deadTile.className = 'fm-dead-enemy';
      deadTile.style.cssText = `position:fixed;width:${tileSize}px;height:${tileSize}px;pointer-events:none;transform-origin:center center;`;
      deadTile.style.left = `${cx - tileSize / 2}px`;
      deadTile.style.top  = `${cy - tileSize / 2}px`;
      deadTile.innerHTML = `
        <div class="fm-tile fm-dead-enemy-inner ${tileClass}">
          <span class="fm-dead-enemy-label">${name}</span>
          <div class="fm-dead-enemy-face">
            <img src="${getRandomFaceUrl('death')}" alt="">
          </div>
        </div>`;
      document.body.appendChild(deadTile);

      // Dynamic body with the same physics properties as a live dead-enemy tile,
      // but zero initial velocity — already settled on the floor.
      // Using dynamic (not static) so new enemies falling on top interact naturally.
      const body = this.matter.add.rectangle(cx, cy, tileSize, tileSize, {
        chamfer      : { radius: 14 },
        restitution  : 0.30,
        friction     : 0.90,
        frictionAir  : 0.008,
        density      : 0.002,
        label        : 'dead-enemy',
      });
      // Already settled — no initial velocity or spin
      const M = Phaser.Physics.Matter.Matter;
      M.Body.setVelocity(body, { x: 0, y: 0 });
      M.Body.setAngularVelocity(body, 0);

      this.#deadEnemyBodies.push({ el: deadTile, body });
    }
  }

  /**
   * Restore full game state from a save slot.
   * @param {object} data — Full save-slot object
   */
  #restoreFromSlot(data) {
    this.#fusions = data.fusions ?? 0;
    this.#maxTile = data.maxTile ?? 0;
    this.#comboScoreTotal = data.comboScoreTotal ?? 0;
    this.#powersTriggered = data.powersTriggered ?? [];
    this.#combo = data.combo ?? 0;
    this.#comboMax = data.comboMax ?? 0;
    this.#comboScoreStart = data.comboScoreStart ?? 0;
    this.#victoryShown = data.victoryShown ?? false;
    this.#prevBestScore = saveManager.getBestScore(this.#mode);
    this.#bestScoreNotified = false;
    this.#cancelComboTimer();

    // Restore grid
    this.#gm.grid.restoreFull(data.grid);

    // Free mode: restore power manager and grid life
    if (this.#mode === 'free') {
      this.#selectedPowers = data.selectedPowers ?? null;
      if (this.#selectedPowers) {
        this.#powerManager = new PowerManager(this.#selectedPowers);
        if (data.powerManager) this.#powerManager.restore(data.powerManager);
      }
      if (data.gridLife) {
        this.#gridLife = new GridLife();
        this.#gridLife.restore(data.gridLife);
        this.#createLiquidOverlay();
        this.#updateLifeVisual();
      }
    }

    // Battle mode: restore battle manager, power manager, grid life
    if (this.#mode === 'battle') {
      this.#battleManager = new BattleManager();
      if (data.battleManager) this.#battleManager.restore(data.battleManager);
      if (data.battlePowerManager) {
        this.#battlePowerManager = new PowerManager([]);
        this.#battlePowerManager.restore(data.battlePowerManager);
      }
      if (data.gridLife) {
        this.#gridLife = new GridLife();
        this.#gridLife.restore(data.gridLife);
        this.#createLiquidOverlay();
        this.#updateLifeVisual();
      }
      // Restore enemy visual if one is active
      if (this.#battleManager?.enemy) {
        const enemy = this.#battleManager.enemy;
        this.#renderEnemy(enemy);
        if (this.#enemyAreaEl) {
          this.#enemyAreaEl.style.display = 'flex';
          void this.#enemyAreaEl.offsetWidth;
          this.#attachEnemyWave(enemy.life.getColorCategory(), enemy.life.percent);
        }
      }
      // Recreate dead enemy tiles at the bottom of the screen
      const defeated = this.#battleManager.defeatedEnemies;
      if (defeated.length > 0) {
        this.#restoreDeadEnemyTiles(defeated);
      }
    }

    // Render restored grid and update HUD
    this.#gm.renderAllTiles();
    this.#gm.updateFusionIndicators();
    if (this.#powerManager || this.#battlePowerManager) {
      this.#gm.syncTileDom(this.#powerManager?.windDirection ?? this.#battlePowerManager?.windDirection ?? null);
    }
    this.#updateHUD();
  }

  #destroyMenuModal() {
    if (this.#adminModal) { this.#adminModal.destroy(); this.#adminModal = null; }
    if (this.#menuModal) { this.#menuModal.destroy(); this.#menuModal = null; }
  }

  // ─── ADMIN (dev only) ────────────────────────────
  #openAdminMenu() {
    if (this.#adminModal) return;
    this.#adminModal = new AdminModal(this, {
      onClearTiles: () => {
        this.#gm.clearGrid();
        this.#updateHUD();
        this.#gm.updateFusionIndicators();
      },
      onAddValue: (v) => {
        this.#gm.addTileValue(v);
        this.#gm.updateFusionIndicators();
      },
      onAddState: (s) => {
        this.#gm.addTileState(s);
        this.#gm.syncTileDom(this.#powerManager?.windDirection ?? null);
        this.#gm.updateFusionIndicators();
      },
      onNewRecord: () => this.#showNewBestNotification(),
      onShowVictory: () => {
        this.#adminModal?.destroy();
        this.#adminModal = null;
        this.#onVictory();
      },
      onShowGameOver: () => {
        this.#adminModal?.destroy();
        this.#adminModal = null;
        this.#onGameOver();
      },
      onResume: () => this.#destroyMenuModal(),
      onClose: () => { this.#adminModal?.destroy(); this.#adminModal = null; },
    });
  }

  #onVictory() {
    this.#victoryShown = true;
    const isBattle = this.#mode === 'battle';

    // Build stats (same structure as game over)
    const extra = {
      maxTile: this.#maxTile,
      moves: this.#gm.grid.moves,
      fusions: this.#fusions,
      comboScore: this.#comboScoreTotal,
    };
    if (this.#powersTriggered.length > 0) extra.powers = [...this.#powersTriggered];
    if (this.#battleManager) {
      extra.enemiesDefeated = this.#battleManager.enemiesDefeated;
      extra.enemyMaxLevel = this.#battleManager.maxEnemyLevel;
      extra.defeatedEnemies = this.#battleManager.defeatedEnemies;
    }

    // In battle mode, victory ends the game — save score
    if (isBattle) {
      this.#gameOver = true;
      this.#endCombo();
      saveManager.addRanking(this.#mode, this.#gm.grid.score, extra);
      saveManager.clearGame();
    }

    const provisionalEntry = isBattle ? null : {
      score: this.#gm.grid.score,
      date: Date.now(),
      maxTile: extra.maxTile,
      moves: extra.moves,
      fusions: extra.fusions,
      comboScore: extra.comboScore,
    };

    this.#victoryModal = new VictoryModal(this, {
      score: this.#gm.grid.score,
      mode: this.#mode,
      stats: extra,
      provisionalEntry,
      onContinue: isBattle ? undefined : () => {
        this.#victoryModal?.destroy();
        this.#victoryModal = null;
        // Player continues — game is NOT over
      },
      onNewGame: () => {
        this.#victoryModal?.destroy();
        this.#victoryModal = null;
        this.scene.restart({ mode: this.#mode });
      },
      onMenu: () => {
        this.#victoryModal?.destroy();
        this.#victoryModal = null;
        this.scene.start(SCENE_KEYS.TITLE);
      },
    });
  }

  #onGameOver() {
    if (this.#gameOver) return;
    this.#gameOver = true;
    this.#cancelEmptyGridTimer();
    this.#endCombo();
    const extra = {
      maxTile: this.#maxTile,
      moves: this.#gm.grid.moves,
      fusions: this.#fusions,
      comboScore: this.#comboScoreTotal,
    };
    if (this.#powersTriggered.length > 0) extra.powers = [...this.#powersTriggered];
    if (this.#battleManager) {
      extra.enemiesDefeated = this.#battleManager.enemiesDefeated;
      extra.enemyMaxLevel = this.#battleManager.maxEnemyLevel;
      extra.defeatedEnemies = this.#battleManager.defeatedEnemies;
    }
    saveManager.addRanking(this.#mode, this.#gm.grid.score, extra);
    saveManager.clearGame();

    this.#criticalOverlay?.classList.add('fm-critical-overlay--stopped');

    this.#gameOverModal = new GameOverModal(this, {
      score: this.#gm.grid.score,
      mode: this.#mode,
      stats: extra,
      onNewGame: () => {
        this.#gameOverModal?.destroy();
        this.#gameOverModal = null;
        this.scene.restart({ mode: this.#mode });
      },
      onMenu: () => {
        this.#gameOverModal?.destroy();
        this.#gameOverModal = null;
        this.scene.start(SCENE_KEYS.TITLE);
      },
    });
  }

  // ─── EMPTY GRID SAFETY (Free mode) ────────────────

  /**
   * Start a 5-second countdown; if the grid is still empty when it fires,
   * spawn a rescue tile to unblock the player.
   */
  #startEmptyGridTimer() {
    if (this.#emptyGridTimer) return;
    this.#emptyGridTimer = this.time.delayedCall(5000, () => {
      this.#emptyGridTimer = null;
      this.#rescueIfGridEmpty();
    });
  }

  /** Cancel the empty-grid safety timer. */
  #cancelEmptyGridTimer() {
    if (this.#emptyGridTimer) {
      this.#emptyGridTimer.remove(false);
      this.#emptyGridTimer = null;
    }
  }

  /**
   * If the grid is empty and the game is not over, spawn a rescue tile.
   * Called by both the timer and the continuous update() safety check.
   */
  #rescueIfGridEmpty() {
    if (this.#gameOver) return;
    if (this.#gm.animating) return;
    if (this.#gm.grid.getAllTiles().length > 0) return;
    const tile = this.#gm.spawnAndRender();
    if (tile) {
      this.#updateHUD();
      this.#gm.updateFusionIndicators();
    }
  }

  /** @param {number} ms */
  #wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  // ─── POWER VISUALS ────────────────────────────────
  #updatePowerVisuals() {
    const pm = this.#powerManager || this.#battlePowerManager;
    if (!pm || !this.#gm.gridEl) return;

    // Remove old edge indicators
    for (const old of this.#gm.gridEl.querySelectorAll('.fm-edge-power')) {
      old.remove();
    }

    // Show color-only indicators on edges based on prediction
    const directions = /** @type {const} */ (['up', 'down', 'left', 'right']);
    const dirToSide = { up: 'top', down: 'bottom', left: 'left', right: 'right' };

    for (const dir of directions) {
      const color = pm.getBadgeColor(dir, this.#gm.grid);
      if (!color) continue;

      const side = dirToSide[dir];
      const badge = document.createElement('div');
      badge.className = `fm-edge-power ${side}`;
      badge.innerHTML = `<div class="fm-power-dot tiny ${color}"><span class="fm-edge-warn">!</span></div>`;
      this.#gm.gridEl.appendChild(badge);
    }

    this.#updatePowerInfoPanel();
  }

  #updatePowerInfoPanel() {
    const pm = this.#powerManager || this.#battlePowerManager;
    if (!this.#powerInfoEl || !pm) return;

    if (
      !pm.hasPoweredTiles(this.#gm.grid) &&
      !pm.hasActiveExpelTiles(this.#gm.grid) &&
      this.#pendingDestructionTiles.size === 0
    ) {
      this.#powerInfoEl.style.display = 'none';
      return;
    }

    const directions = /** @type {const} */ (['up', 'down', 'left', 'right']);
    // Thick SVG arrow per direction
    const dirArrows = {
      up:    `<svg class="fm-info-arrow" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 1 L11 7 H8 V13 H4 V7 H1 Z" fill="currentColor"/></svg>`,
      down:  `<svg class="fm-info-arrow" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 13 L11 7 H8 V1 H4 V7 H1 Z" fill="currentColor"/></svg>`,
      left:  `<svg class="fm-info-arrow" viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6 L7 1 V4 H13 V8 H7 V11 Z" fill="currentColor"/></svg>`,
      right: `<svg class="fm-info-arrow" viewBox="0 0 14 12" aria-hidden="true"><path d="M13 6 L7 1 V4 H1 V8 H7 V11 Z" fill="currentColor"/></svg>`,
    };

    /** @type {string[]} */
    const lines = [];

    for (const dir of directions) {
      const predictions = pm.predictForDirection(dir, this.#gm.grid);
      if (predictions.length === 0) continue;

      for (const pred of predictions) {
        const cat = pred.exits ? 'danger' : getPowerCategory(pred.powerType);
        // Danger powers: skip if no tiles would be destroyed (e.g. fire on an empty row)
        if (
          !pred.exits &&
          cat === 'danger' &&
          pred.powerType !== POWER_TYPES.LIGHTNING &&
          (!pred.destroyedValues || pred.destroyedValues.length === 0)
        ) continue;

        const meta = POWER_META[pred.powerType];
        const powerName = i18n.t(meta.nameKey);
        // Badge matches the edge indicator style exactly
        const badgeHtml = `<div class="fm-power-dot tiny ${cat}"><span class="fm-edge-warn">!</span></div>`;

        let tilesHtml = '';

        if (pred.exits) {
          // Expel exit: show the tile value that will leave the grid
          const pill = `<span class="fm-power-info-tile fm-t${pred.tileValue}">${pred.tileValue}</span>`;
          tilesHtml = `<div class="fm-power-info-tiles">${pill}<span class="fm-range-sep">✕</span></div>`;
        } else if (
          (pred.powerType === POWER_TYPES.EXPEL_V || pred.powerType === POWER_TYPES.EXPEL_H) &&
          pred.mergeSourceValue
        ) {
          // Expel merge trigger: show source → source = result
          const src = pred.mergeSourceValue;
          const res = pred.tileValue;
          tilesHtml = `<div class="fm-power-info-tiles">
            <span class="fm-power-info-tile fm-t${src}">${src}</span>
            <span class="fm-range-sep">→</span>
            <span class="fm-power-info-tile fm-t${src}">${src}</span>
            <span class="fm-range-sep">=</span>
            <span class="fm-power-info-tile fm-t${res}">${res}</span>
          </div>`;
        } else if (pred.powerType === POWER_TYPES.LIGHTNING && pred.lightningRange) {
          const { min, max } = pred.lightningRange;
          const minPills = min.length > 0
            ? min.map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`).join('')
            : `<span class="fm-range-empty">∅</span>`;
          const maxPills = max.map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`).join('');
          tilesHtml = `<div class="fm-power-info-range">
              <span class="fm-range-label">min</span>
              <div class="fm-power-info-tiles">${minPills}</div>
              <span class="fm-range-sep">–</span>
              <span class="fm-range-label">max</span>
              <div class="fm-power-info-tiles">${maxPills}</div>
             </div>`;
        } else if (pred.destroyedValues && pred.destroyedValues.length > 0) {
          const pills = pred.destroyedValues
            .map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`)
            .join('');
          tilesHtml = `<div class="fm-power-info-tiles">${pills}</div>`;
        }

        lines.push(`
          <div class="fm-power-info-line">
            <span class="fm-power-info-dir">${dirArrows[dir]}</span>
            ${badgeHtml}
            <span class="fm-power-info-name">${powerName}</span>
            ${tilesHtml}
          </div>`);
      }
    }

    // Pending destruction row: tiles whose animation was cut mid-flight
    if (this.#pendingDestructionTiles.size > 0) {
      const pills = [...this.#pendingDestructionTiles.values()]
        .map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`)
        .join('');
      lines.push(`
        <div class="fm-power-info-line fm-power-info-destroying">
          <span class="fm-info-destroy-icon">🗑</span>
          <div class="fm-power-info-tiles">${pills}</div>
        </div>`);
    }

    if (lines.length === 0) {
      this.#powerInfoEl.style.display = 'none';
      return;
    }

    const MAX_VISIBLE = 4;
    const visible = lines.slice(0, MAX_VISIBLE);
    const hidden = lines.slice(MAX_VISIBLE);

    let html = visible.join('');

    if (hidden.length > 0) {
      html += `<button class="fm-power-info-more-btn" id="fm-power-info-more">…</button>`;
    }

    this.#powerInfoEl.style.display = 'flex';
    this.#powerInfoEl.innerHTML = html;

    if (hidden.length > 0) {
      const moreBtn = this.#powerInfoEl.querySelector('#fm-power-info-more');
      const overlayEl = this.#powerInfoAllDom?.node.querySelector('#fm-power-info-all-overlay');
      const titleEl = this.#powerInfoAllDom?.node.querySelector('#fm-power-info-all-title');
      const linesEl = this.#powerInfoAllDom?.node.querySelector('#fm-power-info-all-lines');
      moreBtn?.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (titleEl) titleEl.textContent = i18n.t('power.predictions');
        if (linesEl) linesEl.innerHTML = lines.join('');
        if (overlayEl) overlayEl.style.display = 'flex';
      });
    }
  }

  // ─── GRID LIFE ────────────────────────────────────

  /** Create (or reset) the liquid fill element inside the grid container. */
  #createLiquidOverlay() {
    // Tear down previous
    this.#gridWave?.destroy();
    this.#gridWave = null;
    if (this.#liquidEl) this.#liquidEl.remove();

    const gridEl = this.#gm.gridEl;
    if (!gridEl) return;

    // Ensure grid is a positioning context for the liquid
    if (getComputedStyle(gridEl).position === 'static') {
      gridEl.style.position = 'relative';
    }

    this.#liquidEl = document.createElement('div');
    this.#liquidEl.className = 'fm-grid-life-liquid';
    gridEl.prepend(this.#liquidEl);

    this.#gridWave = new LiquidWave(this.#liquidEl, { category: 'info', alpha: 0.5 });
    /* Start at 0 so the fill animates from empty to full */
    this.#gridWave.snapLevel(0);
  }

  /**
   * Called after damage is dealt to GridLife.
   * Plays hurt flash, shows damage popup, updates liquid, checks critical overlay.
   * @param {number} damage
   */
  #onGridLifeDamage(damage) {
    if (!this.#gridLife || damage <= 0) return;

    // Hurt flash on the grid
    const gridEl = this.#gm.gridEl;
    if (gridEl) {
      gridEl.classList.remove('fm-grid--hurt');
      void gridEl.offsetWidth;
      gridEl.classList.add('fm-grid--hurt');
    }

    // Floating damage number
    this.#showDamagePopup(damage);

    // Update liquid visual
    this.#updateLifeVisual();

    // Update HUD HP display
    this.#updateHUD();
  }

  /** Update liquid height + colour based on current HP percentage. */
  #updateLifeVisual() {
    if (!this.#gridLife || !this.#gridWave) return;

    const pct = this.#gridLife.percent;
    this.#gridWave.level = pct;

    // Colour by category
    const cat = this.#gridLife.getColorCategory();
    this.#gridWave.setCategory(cat);

    // Critical overlay
    if (this.#gridLife.isCritical && !this.#criticalOverlay) {
      this.#criticalOverlay = document.createElement('div');
      this.#criticalOverlay.className = 'fm-critical-overlay';
      document.body.appendChild(this.#criticalOverlay);
    } else if (!this.#gridLife.isCritical && this.#criticalOverlay) {
      this.#criticalOverlay.remove();
      this.#criticalOverlay = null;
    }
  }

  /**
   * Show a floating "-N" damage number on the right side of the grid.
   * @param {number} damage
   */
  #showDamagePopup(damage) {
    const gridEl = this.#gm.gridEl;
    if (!gridEl || !this.#gridLife) return;

    const popup = document.createElement('div');
    popup.className = 'fm-grid-damage';
    popup.textContent = `-${damage}`;

    // Position at the current liquid level
    const pct = this.#gridLife.percent;
    popup.style.bottom = `${(pct * 100).toFixed(0)}%`;

    gridEl.appendChild(popup);

    // Self-remove after animation
    popup.addEventListener('animationend', () => popup.remove());
  }

  /** Phaser game loop — called every frame. Syncs dead-enemy DOM elements to their Matter.js body positions. */
  update() {
    // Continuous empty-grid safety: catch any case the timer missed
    if (!this.#gameOver && !this.#gm.animating && this.#gm.grid.getAllTiles().length === 0 && !this.#emptyGridTimer) {
      this.#startEmptyGridTimer();
    }

    if (this.#deadEnemyBodies.length === 0) return;
    const half = this.#tileSizePx / 2;
    for (const { el, body } of this.#deadEnemyBodies) {
      if (!el.isConnected) continue;
      el.style.left      = `${body.position.x - half}px`;
      el.style.top       = `${body.position.y - half}px`;
      el.style.transform = `rotate(${body.angle}rad)`;
    }
  }

  shutdown() {
    this.#cancelComboTimer();
    this.#cancelEmptyGridTimer();
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#gm.shutdown();
    this.#destroyMenuModal();
    this.#gameOverModal?.destroy();
    this.#victoryModal?.destroy();
    this.#powerSelectModal?.destroy();
    this.#powerChoiceModal?.destroy();
    this.#adminModal?.destroy();
    this.#powerInfoDom?.destroy();
    this.#powerInfoAllDom?.destroy();
    this.#criticalOverlay?.remove();
    this.#criticalOverlay = null;
    this.#gridWave?.destroy();
    this.#gridWave = null;
    this.#enemyWave?.destroy();
    this.#enemyWave = null;
    this.#adsOverlay?.remove();
    this.#adsOverlay = null;
    document.querySelectorAll('.fm-new-best-notif').forEach((el) => el.remove());
    this.#enemyAreaEl?.remove();
    this.#enemyAreaEl = null;
    // Remove all dead enemy DOM nodes (in-flight or settled)
    document.querySelectorAll('.fm-dead-enemy').forEach((el) => el.remove());
    this.#deadEnemyBodies = [];
    // Physics bodies are destroyed with the Matter world on scene shutdown;
    // we only need to null our reference.
    this.#physicsFloor = null;
    document.querySelectorAll('.fm-contaminate-particle').forEach((el) => el.remove());
    this.#hudCardStates = [];
    this.input.keyboard.off('keydown', this.#handleKey, this);
    this.input.off('pointerdown', this.#onPointerDown, this);
    this.input.off('pointerup', this.#onPointerUp, this);
  }
}
