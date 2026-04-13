import Phaser from 'phaser';
import {
  SCENE_KEYS,
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
import { InputManager } from '../managers/input-manager.js';
import { HudManager } from '../managers/hud-manager.js';
import { MenuModal } from '../components/menu-modal.js';
import { GameOverModal } from '../components/game-over-modal.js';
import { PowerSelectModal } from '../components/power-select-modal.js';
import { PowerChoiceModal } from '../components/power-choice-modal.js';
import { AdminModal } from '../components/admin-modal.js';
import { VictoryModal } from '../components/victory-modal.js';
import { EnemyInfoModal } from '../components/enemy-info-modal.js';
import { HelpModal } from '../components/help-modal.js';
import { HistoryModal } from '../components/history-modal.js';
import { GridLife } from '../entities/grid-life.js';
import { BattleManager } from '../managers/battle-manager.js';
import { HistoryManager } from '../managers/history-manager.js';
import { getRandomFaceUrl } from '../configs/constants.js';
import { audioManager } from '../managers/audio-manager.js';
import { addBackground } from '../utils/background.js';
/* ── CSS liquid-fill helper (replaces former canvas LiquidWave) ── */

/** True when the primary pointer is coarse (touch device) */
const IS_MOBILE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const BUBBLE_COUNT = IS_MOBILE ? 6 : 10;

const LIQUID_PRESETS = {
  info: { c1: 'rgba(80,160,255,0.55)', c2: 'rgba(30,80,180,0.4)' },
  warning: { c1: 'rgba(255,180,60,0.55)', c2: 'rgba(200,120,0,0.4)' },
  danger: { c1: 'rgba(255,60,60,0.55)', c2: 'rgba(200,20,20,0.4)' },
};

/**
 * Create a `.fm-liquid-fill` div with bubble-ring spans inside a container.
 * Everything is animated by CSS — no RAF, no canvas.
 * @param {HTMLElement} container
 * @param {string} category
 * @returns {HTMLElement} the fill element
 */
function createLiquidFill(container, category = 'info') {
  const el = document.createElement('div');
  el.className = 'fm-liquid-fill';

  // Bubble wrapper — overflow:hidden clips bubbles at the waterline
  const bw = document.createElement('div');
  bw.className = 'fm-liquid-bubble-zone';
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const b = document.createElement('span');
    b.className = 'fm-liquid-bubble';
    const size = 3 + Math.random() * 6;
    const left = 8 + Math.random() * 84;
    const delay = Math.random() * 8;
    const dur = 3 + Math.random() * 5;
    b.style.cssText = `width:${size}px;height:${size}px;left:${left}%;animation-delay:${delay.toFixed(1)}s;animation-duration:${dur.toFixed(1)}s;`;
    bw.appendChild(b);
  }
  el.appendChild(bw);

  setLiquidCategory(el, category);
  container.appendChild(el);
  return el;
}

/** Update liquid colour preset via CSS custom properties. */
function setLiquidCategory(fillEl, cat) {
  const p = LIQUID_PRESETS[cat] ?? LIQUID_PRESETS.info;
  fillEl.style.setProperty('--fm-liq-c1', p.c1);
  fillEl.style.setProperty('--fm-liq-c2', p.c2);
}

/** Set liquid level (0–1) with CSS transition. */
function setLiquidLevel(fillEl, level) {
  fillEl.style.height = `${(Math.max(0, Math.min(1, level)) * 100).toFixed(1)}%`;
}

/** Snap liquid level instantly (no transition). */
function snapLiquidLevel(fillEl, level) {
  fillEl.style.transition = 'none';
  setLiquidLevel(fillEl, level);
  void fillEl.offsetHeight;
  fillEl.style.transition = '';
}

/**
 * Main gameplay scene — 2048 grid rendered with CSS DOM elements.
 * Grid rendering, animation, and tile DOM are delegated to GridManager.
 */
export class GameScene extends Phaser.Scene {
  /** @type {GridManager} */
  #gm;

  /** @type {string} Game mode */
  #mode = 'classic';

  /** @type {InputManager | null} */
  #inputManager = null;

  /** @type {HudManager | null} */
  #hudManager = null;

  /** @type {boolean} Game over state */
  #gameOver = false;

  /** @type {MenuModal | null} */
  #menuModal = null;

  /** @type {GameOverModal | null} */
  #gameOverModal = null;

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

  /** @type {boolean} True while the hurt/break animation is playing */
  #comboBreaking = false;

  /** @type {number} Move generation counter — prevents stale async continuations */
  #moveGen = 0;

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

  /** @type {HTMLElement | null} Power info panel below grid */
  #powerInfoEl = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #powerInfoDom = null;

  /** @type {Phaser.GameObjects.DOMElement | null} Full-list overlay DOM element */
  #powerInfoAllDom = null;

  /** @type {boolean} True when the prediction panel is truncated and the "!" button should be shown */
  #predPanelTruncated = false;

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

  /** @type {HTMLElement | null} CSS liquid fill element for grid HP */
  #gridFillEl = null;

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

  // ─── BATTLE MODE FIELDS ──────────────────────────

  /** @type {BattleManager | null} Battle system (Battle mode only) */
  #battleManager = null;

  /** @type {HTMLElement | null} Enemy area container (appended to document.body) */
  #enemyAreaEl = null;

  /** @type {HTMLElement | null} CSS liquid fill element for enemy HP */
  #enemyFillEl = null;

  /** @type {PowerManager | null} Power system shared for battle contamination effects */
  #battlePowerManager = null;

  /** @type {Array<{el: HTMLElement, body: MatterJS.BodyType}>} DOM+physics pairs for dead enemy tiles */
  #deadEnemyBodies = [];

  /** @type {EnemyInfoModal | null} */
  #enemyInfoModal = null;

  /** @type {HelpModal | null} */
  #helpModal = null;

  /** @type {HistoryModal | null} */
  #historyModal = null;

  /** @type {HistoryManager} */
  #historyManager = new HistoryManager();

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
    this.#comboBreaking = false;
    this.#inputManager = null;
    this.#hudManager = null;
    this.#powerManager = null;
    this.#powerSelectModal = null;
    this.#powerChoiceModal = null;
    this.#adminModal = null;
    this.#victoryModal = null;
    this.#victoryShown = false;
    this.#powerInfoEl = null;
    this.#powerInfoDom = null;
    this.#powerInfoAllDom = null;
    this.#predPanelTruncated = false;
    this.#pendingPowerTypes = data?.selectedPowers ?? null;
    this.#pendingDestructionTiles = new Map();
    this.#gridLife = null;
    this.#liquidEl = null;
    this.#gridFillEl = null;
    this.#criticalOverlay = null;
    this.#emptyGridTimer = null;
    this.#adsOverlay = null;
    this.#adsShown = false;
    this.#showingAds = false;
    this.#prevBestScore = 0;
    this.#bestScoreNotified = false;
    this.#pendingSlotData = data?.slotData ?? null;
    this.#helpModal = null;
    this.#historyModal = null;
    this.#historyManager = new HistoryManager();
    // Battle mode
    this.#battleManager = null;
    this.#enemyAreaEl = null;
    this.#enemyFillEl = null;
    this.#battlePowerManager = null;
    this.#deadEnemyBodies = [];
    this.#physicsFloor = null;
  }

  create() {
    // Defensive cleanup: remove any DOM nodes from a previous game that may
    // have survived shutdown (e.g. if an animation was in flight).
    document
      .querySelectorAll(
        '.fm-dead-enemy, .fm-enemy-area, .fm-contaminate-particle, .fm-critical-overlay',
      )
      .forEach((el) => el.remove());

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
    this.#hudManager = new HudManager(this, this.#mode);
    this.#hudManager.createHUD({ onMenuOpen: () => this.#openMenu() });
    this.#hudManager.onComboTimeout = () => this.#endCombo();
    this.#gm.createContainer(this);

    if (this.#mode === 'free') {
      this.#createPowerInfoPanel();
    }

    if (this.#mode === 'battle') {
      this.#createEnemyArea();
      this.#createPowerInfoPanel();
    } else {
      // Matter.js is only used for battle-mode death animations.
      // Keep the world paused in other modes to avoid an idle physics tick every frame.
      this.matter.world.pause();
    }

    this.#hudManager.createHelpBtn({
      onHelpOpen: () => this.#openHelp(),
      onHistoryOpen: () => this.#openHistory(),
      onPredOpen: () => this.#openPredModal(),
    });
    this.#inputManager = new InputManager(this, {
      onDirection: (dir) => this.#executeMove(dir),
      onMenu: () => this.#openMenu(),
      isBlocked: () =>
        !!(
          this.#gameOver ||
          this.#menuModal ||
          this.#helpModal ||
          this.#historyModal ||
          this.#gameOverModal ||
          this.#enemyInfoModal ||
          this.#adminModal ||
          this.#powerChoiceModal ||
          this.#powerSelectModal ||
          this.#showingAds ||
          this.#victoryModal
        ),
    });
    this.#inputManager.bind();

    // Cache CSS tile size for physics body sizing (read after container is in DOM)
    this.events.once('create', () => {
      this.#tileSizePx =
        parseInt(
          getComputedStyle(
            document.getElementById('game-container') ?? document.body,
          ).getPropertyValue('--fm-tile-size'),
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

  #showPowerSelectModal() {
    this.#powerSelectModal = new PowerSelectModal(this, {
      onStart: (selectedTypes) => {
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
    this.#hudManager?.cancelComboTimer();
    this.#hudManager?.resetComboDisplay();
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

  // ─── MOVE EXECUTION ──────────────────────────────
  /**
   * @param {'up' | 'down' | 'left' | 'right'} direction
   */
  async #executeMove(direction) {
    const moveGen = ++this.#moveGen;
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
      this.#gm.bumpTiles(direction);
      this.#gm.updateFusionIndicators();
      this.#updatePowerVisuals();
      return;
    }
    if (this.#battlePowerManager?.windDirection === direction) {
      this.#gm.bumpTiles(direction);
      this.#gm.updateFusionIndicators();
      this.#updatePowerVisuals();
      return;
    }

    const waitFn = (ms) => this.#wait(ms);
    const moveResult = await this.#gm.executeMove(
      direction,
      waitFn,
      () => this.#hudManager.advanceCards(direction),
      (merges) => {
        // Play fusion SFX at the moment the merge bounce animation starts,
        // but only if no power SFX will override it on this move.
        // Lightning is excluded — it allows fusion SFX (lightning plays per-strike separately).
        // NOTE: checkMergeTriggers mutates tile state, so we inspect merges directly here.
        if (merges.length === 0) return;
        const hasSuppressingPower = merges.some((m) => {
          const pa = m.tile.power;
          const pb = m.consumedPower ?? null;
          return (pa && pa !== POWER_TYPES.LIGHTNING) || (pb && pb !== POWER_TYPES.LIGHTNING);
        });
        if (!hasSuppressingPower) audioManager.playSfx('fusion');
      },
    );

    if (!moveResult.moved) {
      this.#gm.bumpTiles(direction);
      this.#gm.updateFusionIndicators();
      this.#updatePowerVisuals();
      if (!this.#gm.grid.canMove()) {
        this.#onGameOver();
      }
      return;
    }

    const { merges, expelled, hasMergePossible, scoreBefore } = moveResult;

    // ╔══════════════════════════════════════════════════════════╗
    // ║  GAME LOGIC — runs synchronously, regardless of cancel  ║
    // ╚══════════════════════════════════════════════════════════╝

    this.#nudgeDeadEnemies(direction);
    this.#lastSavedFingerprint = null;
    this.#historyManager.beginTurn(moveResult.moveNumber, direction, moveResult.scoreBefore);

    // Tick power state for EVERY real grid move
    if (this.#powerManager) this.#powerManager.tickMove(this.#gm.grid);
    if (this.#battlePowerManager) this.#battlePowerManager.tickMove(this.#gm.grid);

    // ── Expelled tiles ──
    if (expelled.length > 0) {
      this.#historyManager.addTilesLost(expelled.map((t) => t.value));
      if (this.#gridLife) {
        const damage = this.#gridLife.takeDamage(expelled.map((t) => t.value));
        this.#onGridLifeDamage(damage);
      }
    }

    // ── Fusions + combo ──
    // Combo only advances on non-cancelled moves (animation completed).
    // Cancelled moves still count fusions and score, but a skipped animation
    // must not inflate #comboMax — the timer-based multiplier was designed for
    // visually-observed streaks, not invisible rapid-fire moves.
    if (merges.length > 0) {
      this.#fusions += merges.length;
      const pairs = merges.map((m) => [m.tile.value / 2, m.tile.value / 2]);
      this.#historyManager.addFusions(pairs);
      if (!moveResult.cancelled) {
        if (this.#comboBreaking) this.#endCombo();
        if (this.#combo === 0) this.#comboScoreStart = scoreBefore;
        this.#combo++;
        if (this.#combo > this.#comboMax) this.#comboMax = this.#combo;
        this.#hudManager.updateComboDisplay(this.#combo, true);
      }
    } else if (hasMergePossible && !moveResult.cancelled) {
      if (this.#combo > 0) {
        this.#hudManager.hurtCombo();
        this.#comboBreaking = true;
      }
    }

    // ── Free-mode power triggers (logic only) ──
    const powerWork = [];
    if (this.#powerManager) {
      const triggers = this.#powerManager.checkMergeTriggers(merges, this.#gm.grid);
      for (const trigger of triggers) {
        let chosenPower = trigger.powerType;
        // Power choice modal blocks input — safe to await even mid-logic
        if (trigger.needsChoice && !moveResult.cancelled && moveGen === this.#moveGen) {
          chosenPower = await this.#showPowerChoiceModal(
            trigger.powerType,
            trigger.powerTypeB,
            trigger.tile,
          );
        }
        this.#powersTriggered.push(chosenPower);
        this.#historyManager.addPower(chosenPower);
        const effectResult = this.#powerManager.executeEffect(
          chosenPower,
          this.#gm.grid,
          trigger.tile,
        );
        for (const tile of effectResult.destroyed) {
          this.#pendingDestructionTiles.set(tile.id, tile.value);
        }
        if (effectResult.destroyed.length > 0) {
          this.#historyManager.addTilesLost(effectResult.destroyed.map((t) => t.value));
          if (this.#gridLife) {
            const damage = this.#gridLife.takeDamage(effectResult.destroyed.map((t) => t.value));
            this.#onGridLifeDamage(damage);
          }
        }
        powerWork.push({ chosenPower, target: trigger.tile, effectResult, pm: this.#powerManager });
      }
      this.#powerManager.onMove(this.#gm.grid);
    }

    // ── Battle merge damage (logic) ──
    let enemyKilled = false;
    let battleDamage = 0;
    if (this.#battleManager?.isBattlePhase && merges.length > 0) {
      const dmgResult = this.#battleManager.applyMergeDamage(merges);
      battleDamage = dmgResult.damage;
      enemyKilled = dmgResult.killed;
      if (battleDamage > 0) {
        const enemy = this.#battleManager.enemy;
        this.#historyManager.addEnemyDamage(enemy?.name ?? '?', enemy?.level ?? 0, battleDamage);
      }
      if (enemyKilled) {
        const dead = this.#battleManager.enemy;
        this.#historyManager.addEnemyDefeated(dead?.name ?? '?', dead?.level ?? 0);
      }
    }

    // ── Battle power triggers (logic only) ──
    const battlePowerWork = [];
    if (this.#battlePowerManager && merges.length > 0 && !enemyKilled) {
      const triggers = this.#battlePowerManager.checkMergeTriggers(merges, this.#gm.grid);
      for (const trigger of triggers) {
        let chosenPower = trigger.powerType;
        if (trigger.needsChoice && !moveResult.cancelled && moveGen === this.#moveGen) {
          chosenPower = await this.#showPowerChoiceModal(
            trigger.powerType,
            trigger.powerTypeB,
            trigger.tile,
          );
        }
        this.#powersTriggered.push(chosenPower);
        this.#historyManager.addPower(chosenPower);
        const effectResult = this.#battlePowerManager.executeEffect(
          chosenPower,
          this.#gm.grid,
          trigger.tile,
        );
        for (const tile of effectResult.destroyed) {
          this.#pendingDestructionTiles.set(tile.id, tile.value);
        }
        if (effectResult.destroyed.length > 0) {
          this.#historyManager.addTilesLost(effectResult.destroyed.map((t) => t.value));
          if (this.#gridLife) {
            const damage = this.#gridLife.takeDamage(effectResult.destroyed.map((t) => t.value));
            this.#onGridLifeDamage(damage);
          }
        }
        battlePowerWork.push({
          chosenPower,
          target: trigger.tile,
          effectResult,
          pm: this.#battlePowerManager,
        });
      }
    }

    // ── Battle tick (logic only) ──
    let spawnedEnemy = null;
    let contamination = null;
    if (this.#mode === 'battle' && this.#battleManager && !enemyKilled) {
      if (this.#battleManager.isClassicPhase) {
        spawnedEnemy = this.#battleManager.tickClassicPhase(this.#gm.grid);
        if (spawnedEnemy) {
          this.#historyManager.addEnemySpawn(spawnedEnemy.name, spawnedEnemy.level);
        }
      } else {
        // Apply damage via tickBattle path when no battlePowerManager handled it
        if (!this.#battlePowerManager && merges.length > 0 && battleDamage === 0) {
          const dmgResult = this.#battleManager.applyMergeDamage(merges);
          battleDamage = dmgResult.damage;
          enemyKilled = dmgResult.killed;
          if (battleDamage > 0) {
            const enemy = this.#battleManager.enemy;
            this.#historyManager.addEnemyDamage(
              enemy?.name ?? '?',
              enemy?.level ?? 0,
              battleDamage,
            );
          }
          if (enemyKilled) {
            const dead = this.#battleManager.enemy;
            this.#historyManager.addEnemyDefeated(dead?.name ?? '?', dead?.level ?? 0);
          }
        }
        if (!enemyKilled) {
          contamination = this.#battleManager.contaminate(this.#gm.grid);
          if (contamination) {
            this.#historyManager.addContamination(contamination.tile.value);
          }
        }
      }
    }

    // ── Sync DOM + visuals after all logic ──
    const windDir =
      this.#powerManager?.windDirection ?? this.#battlePowerManager?.windDirection ?? null;
    const preserveIds =
      this.#pendingDestructionTiles.size > 0 ? new Set(this.#pendingDestructionTiles.keys()) : null;
    this.#gm.syncTileDom(windDir, preserveIds);
    this.#updatePowerVisuals();

    // Safety: if powers/effects destroyed every tile, start the empty-grid timer
    if (this.#gm.grid.getAllTiles().length === 0) {
      this.#startEmptyGridTimer();
    } else {
      this.#cancelEmptyGridTimer();
    }

    // Track max tile + HUD
    for (const tile of this.#gm.grid.getAllTiles()) {
      if (tile.value > this.#maxTile) this.#maxTile = tile.value;
    }
    this.#updateHUD();
    this.#gm.updateFusionIndicators();

    // Finalize history entry and auto-save
    this.#historyManager.finalizeTurn(this.#gm.grid.score);
    this.#autoSave();

    // ╔══════════════════════════════════════════════════════════╗
    // ║  ANIMATION PHASE — interruptible by next move           ║
    // ╚══════════════════════════════════════════════════════════╝

    const shouldAnimate = !moveResult.cancelled && moveGen === this.#moveGen;

    // ── Free-mode power animations ──
    if (shouldAnimate && powerWork.length > 0) {
      for (const work of powerWork) {
        if (moveGen !== this.#moveGen) break;
        await this.#playPowerEffectAnimation(
          work.chosenPower,
          work.target,
          work.effectResult,
          work.pm,
        );
      }
    } else {
      // Remove destroyed tiles from DOM immediately (no animation)
      for (const work of powerWork) {
        for (const tile of work.effectResult.destroyed) {
          this.#pendingDestructionTiles.delete(tile.id);
          this.#gm.removeTileById(tile.id);
        }
      }
    }

    // ── Battle attack particles + damage visual ──
    if (battleDamage > 0) {
      if (shouldAnimate && moveGen === this.#moveGen) {
        await this.#playAttackParticles(merges);
      }
      audioManager.playSfx('enemyHurt');
      this.#showEnemyDamage(battleDamage);
      this.#updateEnemyVisual();
    }

    // ── Battle power animations ──
    if (shouldAnimate && battlePowerWork.length > 0) {
      for (const work of battlePowerWork) {
        if (moveGen !== this.#moveGen) break;
        await this.#playPowerEffectAnimation(
          work.chosenPower,
          work.target,
          work.effectResult,
          work.pm,
        );
      }
    } else {
      for (const work of battlePowerWork) {
        for (const tile of work.effectResult.destroyed) {
          this.#pendingDestructionTiles.delete(tile.id);
          this.#gm.removeTileById(tile.id);
        }
      }
    }

    // ── Enemy defeated ──
    if (enemyKilled) {
      if (shouldAnimate && moveGen === this.#moveGen) {
        await this.#onEnemyDefeated();
      } else {
        this.#onEnemyDefeatedImmediate();
      }
      this.#gm.animating = false;
      if (this.#battleManager?.allDefeated() && !this.#victoryShown) {
        this.#onVictory();
      }
      return;
    }

    // ── Enemy spawn animation ──
    if (spawnedEnemy) {
      if (shouldAnimate && moveGen === this.#moveGen) {
        await this.#onEnemySpawn(spawnedEnemy);
      } else {
        this.#onEnemySpawnImmediate(spawnedEnemy);
      }
    }

    // ── Contamination animation ──
    if (contamination) {
      if (shouldAnimate && moveGen === this.#moveGen) {
        await this.#playContaminationAnimation(contamination.tile);
      }
      // Data already applied to tile, DOM already synced
    }

    this.#gm.animating = false;

    // Check for victory (2048 tile reached) — classic and free modes only.
    // Battle mode victory is handled above when the level-2048 enemy is killed.
    if (!this.#victoryShown && this.#mode !== 'battle' && this.#maxTile >= 2048) {
      this.#onVictory();
      return;
    }

    if (this.#gridLife?.isDead || !this.#gm.grid.canMove()) {
      this.#onGameOver();
    }
  }

  /**
   * Play a power effect animation (visual only — game logic already applied).
   * @param {string} powerType
   * @param {import('../entities/tile.js').Tile} target
   * @param {{ destroyed: import('../entities/tile.js').Tile[], teleported?: object, lightningStrikes?: object[] }} effectResult
   * @param {PowerManager} [pm]
   */
  async #playPowerEffectAnimation(powerType, target, effectResult, pm) {
    // Lightning SFX is played per-strike inside the animation block below.
    if (powerType !== POWER_TYPES.LIGHTNING) {
      audioManager.playPowerSfx(powerType);
    }

    const isFirePower =
      powerType === POWER_TYPES.FIRE_H ||
      powerType === POWER_TYPES.FIRE_V ||
      powerType === POWER_TYPES.FIRE_X;

    if (isFirePower && target && effectResult.destroyed.length > 0) {
      this.#gm.playFireAnimation(powerType, target, effectResult.destroyed);
      await this.#wait(ANIM.FIRE_BALL_DURATION + ANIM.FIRE_ZAP_DURATION);
      this.#gm.removeTiles(effectResult.destroyed);
    } else if (effectResult.teleported) {
      const { tileA, tileB, oldA, oldB } = effectResult.teleported;
      await this.#gm.playTeleportAnimation(tileA, tileB, oldA, oldB, ANIM.TELEPORT_DURATION);
    } else if (powerType === POWER_TYPES.LIGHTNING && effectResult.lightningStrikes) {
      const numStrikes = effectResult.lightningStrikes.length;
      for (let i = 0; i < numStrikes; i++) {
        setTimeout(
          () => audioManager.playSfx('power:lightning'),
          i * ANIM.LIGHTNING_STRIKE_DELAY + ANIM.LIGHTNING_IMPACT_AT,
        );
      }
      this.#gm.playLightningAnimation(effectResult.lightningStrikes);
      const totalDuration =
        (numStrikes - 1) * ANIM.LIGHTNING_STRIKE_DELAY + ANIM.LIGHTNING_ANIM_DURATION;
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
        const mgr = pm ?? this.#powerManager;
        await this.#showAdsModal();
        this.#adsShown = true;
        this.#disableAds();
        this.#gm.syncTileDom(mgr?.windDirection ?? null);
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
  }

  /**
   * Show the power choice modal and wait for player to pick.
   * @param {string} powerTypeA
   * @param {string} powerTypeB
   * @returns {Promise<string>} The chosen power type
   */
  #showPowerChoiceModal(powerTypeA, powerTypeB, tile) {
    return new Promise((resolve) => {
      this.#powerChoiceModal = new PowerChoiceModal(this, {
        powerTypeA,
        powerTypeB,
        tileRow: tile.row,
        tileCol: tile.col,
        gridEl: this.#gm.gridEl,
        cellPositionFn: (r, c) => this.#gm.cellPosition(r, c),
        onChoice: (chosenType) => {
          this.#powerChoiceModal?.destroy();
          this.#powerChoiceModal = null;
          resolve(chosenType);
        },
      });
    });
  }

  /**
   * Remove ADS from all power sources so it can never be assigned again this game.
   * Called once after the ad has been displayed.
   */
  #disableAds() {
    this.#powerManager?.removePowerType(POWER_TYPES.ADS);
    this.#battlePowerManager?.removePowerType(POWER_TYPES.ADS);
    if (this.#battleManager?.enemy) {
      this.#battleManager.enemy.availablePowers = this.#battleManager.enemy.availablePowers.filter(
        (p) => p !== POWER_TYPES.ADS,
      );
    }
    for (const tile of this.#gm.grid.getAllTiles()) {
      if (tile.power === POWER_TYPES.ADS) tile.power = null;
    }
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

    // Track max tile
    for (const tile of grid.getAllTiles()) {
      if (tile.value > this.#maxTile) this.#maxTile = tile.value;
    }

    const { newBest } = this.#hudManager.updateStats({
      score: grid.score,
      moves: grid.moves,
      fusions: this.#fusions,
      maxTile: this.#maxTile,
      prevBestScore: this.#prevBestScore,
    });

    // New best score notification — fire once per game when current score beats the record
    if (newBest && !this.#bestScoreNotified) {
      this.#bestScoreNotified = true;
      this.#hudManager.showNewBestNotification();
    }
  }

  // ─── COMBO ───────────────────────────────────────
  #endCombo() {
    this.#hudManager?.cancelComboTimer();
    this.#comboBreaking = false;
    if (this.#combo <= 0) return;
    if (this.#comboMax >= 2) {
      const grid = this.#gm.grid;
      const scoreGained = grid.score - this.#comboScoreStart;
      if (scoreGained > 0) {
        const bonus = scoreGained * (this.#comboMax - 1);
        grid.score += bonus;
        this.#comboScoreTotal += bonus;
        this.#historyManager.addComboBonus(bonus);
        this.#hudManager?.showScoreBonus(bonus);
        this.#updateHUD();
      }
    }
    this.#combo = 0;
    this.#comboMax = 0;
    this.#comboScoreStart = 0;
    this.#hudManager?.resetComboDisplay();
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
    const hudRect = this.#hudManager?.hudEl?.getBoundingClientRect();
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
   * The physics world starts paused; it is resumed only during death animations.
   */
  #createPhysicsFloor() {
    // Start paused — world is only resumed when a death animation begins
    this.matter.world.pause();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const thickness = 100;
    // Top edge of the body sits exactly at viewport bottom (H)
    this.#physicsFloor = this.matter.add.rectangle(W / 2, H + thickness / 2, W * 4, thickness, {
      isStatic: true,
      label: 'floor',
      friction: 1.0,
      frictionStatic: 10.0,
      restitution: 0.02,
    });
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
        this.#historyManager.addEnemySpawn(enemy.name, enemy.level);
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
          const enemy = bm.enemy;
          this.#historyManager.addEnemyDamage(enemy?.name ?? '?', enemy?.level ?? 0, damage);
          await this.#playAttackParticles(merges);
          audioManager.playSfx('enemyHurt');
          this.#showEnemyDamage(damage);
          this.#updateEnemyVisual();
        }
        if (killed) {
          const dead = bm.enemy;
          this.#historyManager.addEnemyDefeated(dead?.name ?? '?', dead?.level ?? 0);
          await this.#onEnemyDefeated();
          return;
        }
      }

      // Enemy contaminates one tile per move
      const contamination = bm.contaminate(this.#gm.grid);
      if (contamination) {
        this.#historyManager.addContamination(contamination.tile.value);
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
    audioManager.playSfx('enemyIn');
    // Create power manager for battle contamination effects using ALL powers from this enemy
    this.#battlePowerManager = new PowerManager(enemy.availablePowers);
    // If the ad was already shown this game, prevent new enemies from using ADS
    if (this.#adsShown) {
      this.#battlePowerManager.removePowerType(POWER_TYPES.ADS);
      enemy.availablePowers = enemy.availablePowers.filter((p) => p !== POWER_TYPES.ADS);
    }

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
   * Instant enemy spawn — sets up all game state without entrance animation.
   * Used when a move was cancelled (fast play) so the enemy is ready immediately.
   * @param {import('../entities/enemy.js').Enemy} enemy
   */
  #onEnemySpawnImmediate(enemy) {
    audioManager.playSfx('enemyIn');
    this.#battlePowerManager = new PowerManager(enemy.availablePowers);
    if (this.#adsShown) {
      this.#battlePowerManager.removePowerType(POWER_TYPES.ADS);
      enemy.availablePowers = enemy.availablePowers.filter((p) => p !== POWER_TYPES.ADS);
    }
    this.#gridLife = new GridLife();
    this.#createLiquidOverlay();
    this.#renderEnemy(enemy);
    this.#positionEnemyArea();
    if (this.#enemyAreaEl) {
      this.#enemyAreaEl.style.visibility = '';
      this.#enemyAreaEl.style.display = 'flex';
      void this.#enemyAreaEl.offsetHeight;
      const cat = enemy.life.getColorCategory();
      this.#attachEnemyWave(cat, enemy.life.percent);
      this.#updateLifeVisual();
    }
  }

  /**
   * Render the enemy tile + HP bar + name label.
   * Enemy HP liquid starts at 0% so the fill transition animates on spawn.
   * @param {import('../entities/enemy.js').Enemy} enemy
   */
  #renderEnemy(enemy) {
    if (!this.#enemyAreaEl) return;

    // Destroy previous enemy fill before clearing innerHTML
    this.#enemyFillEl?.remove();
    this.#enemyFillEl = null;

    const tileClass = `fm-t${enemy.level}`;
    const bossClass = enemy.isBoss ? ' fm-enemy-boss' : '';
    const cat = enemy.life.getColorCategory();

    this.#enemyAreaEl.innerHTML = `
      <div class="fm-enemy-tile${bossClass}">
        <div class="fm-tile fm-enemy-tile-inner ${tileClass}">
          <div class="fm-enemy-bg"></div>
          <div class="fm-enemy-hp-liquid"></div>
          <div class="fm-enemy-face" data-face-category="${cat}">
            <img src="${getRandomFaceUrl(cat)}" alt="">
          </div>
        </div>
      </div>
    `;
    /* Liquid fill is created in #onEnemySpawn after display:flex + reflow
       so layout dimensions are available. */

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
   * Attach the CSS liquid fill to the enemy tile after the area is visible.
   * Must be called after enemyAreaEl.style.display = 'flex' + forced reflow.
   * @param {string} category
   * @param {number} level 0-1
   */
  #attachEnemyWave(category, level) {
    const liquidEl = this.#enemyAreaEl?.querySelector('.fm-enemy-hp-liquid');
    if (!liquidEl) return;
    this.#enemyFillEl = createLiquidFill(liquidEl, category);
    snapLiquidLevel(this.#enemyFillEl, 0);
    setLiquidLevel(this.#enemyFillEl, level);
  }

  /** Update the enemy HP bar visual. */
  #updateEnemyVisual() {
    if (!this.#enemyAreaEl || !this.#battleManager?.enemy) return;
    const enemy = this.#battleManager.enemy;
    const cat = enemy.life.getColorCategory();
    if (this.#enemyFillEl) {
      setLiquidLevel(this.#enemyFillEl, enemy.life.percent);
      setLiquidCategory(this.#enemyFillEl, cat);
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
    const dyingWave = this.#gridFillEl;
    this.#gridFillEl = null;
    const dyingLiquid = this.#liquidEl;
    this.#liquidEl = null;
    if (dyingLiquid) {
      dyingLiquid.classList.add('fm-grid-life-liquid--out');
      const removeDying = () => {
        dyingWave?.remove();
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
    this.#enemyFillEl?.remove();
    this.#enemyFillEl = null;
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
    // Victory check is handled by the caller (#executeMove) after this method returns.
  }

  /**
   * Instant enemy defeat — clears all game state without waiting for the death animation.
   * The death animation is still fired (fire-and-forget) so the enemy visually falls
   * to the graveyard even when the player moves quickly.
   */
  #onEnemyDefeatedImmediate() {
    const bm = this.#battleManager;
    if (!bm) return;
    const dead = bm.defeatEnemy();
    if (!dead) return;

    // Fire death animation without awaiting — the synchronous portion captures the
    // enemy position and spawns the physics body before we clear the DOM below.
    this.#playEnemyDeathAnimation(dead);

    bm.clearGridPowers(this.#gm.grid);
    this.#gm.syncTileDom(null);
    this.#gridLife = null;
    this.#criticalOverlay?.remove();
    this.#criticalOverlay = null;
    this.#gridFillEl?.remove();
    this.#gridFillEl = null;
    if (this.#liquidEl) {
      this.#liquidEl.remove();
      this.#liquidEl = null;
    }
    this.#enemyInfoModal?.destroy();
    this.#enemyInfoModal = null;
    this.#enemyFillEl?.remove();
    this.#enemyFillEl = null;
    if (this.#enemyAreaEl) {
      this.#enemyAreaEl.style.display = 'none';
      this.#enemyAreaEl.innerHTML = '';
    }
    this.#battlePowerManager = null;
    if (this.#gm.gridEl) {
      for (const el of this.#gm.gridEl.querySelectorAll('.fm-edge-power')) {
        el.remove();
      }
    }
    if (this.#powerInfoEl) {
      this.#powerInfoEl.style.display = 'none';
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
   * Each particle follows a quadratic Bézier curve (burst arc → enemy),
   * guaranteeing arrival at the target at t=1. Trail is derived from the
   * curve itself for a smooth, accurate arc trail. Color is gold.
   * @param {{ tile: import('../entities/tile.js').Tile }[]} merges
   */
  async #playAttackParticles(merges) {
    if (!this.#enemyAreaEl || !merges.length) return;
    const enemyTileEl = this.#enemyAreaEl.querySelector('.fm-enemy-tile');
    if (!enemyTileEl) return;

    const enemyRect = enemyTileEl.getBoundingClientRect();
    const ex = enemyRect.left + enemyRect.width / 2;
    const ey = enemyRect.top + enemyRect.height / 2;

    const COUNT = 4; // particles per merged tile
    const DURATION = 560; // ms — all particles guaranteed to arrive

    /** Quadratic Bézier position at parameter t ∈ [0,1]. */
    const bezier = (p0, p1, p2, t) => ({
      x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x,
      y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y,
    });

    const cvs = document.createElement('canvas');
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
    cvs.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1000;';
    document.body.appendChild(cvs);
    const ctx = cvs.getContext('2d');

    const particles = [];
    for (const merge of merges) {
      const tileEl = this.#gm.tileElements.get(merge.tile.id);
      if (!tileEl) continue;
      const tileRect = tileEl.getBoundingClientRect();
      const sx = tileRect.left + tileRect.width / 2;
      const sy = tileRect.top + tileRect.height / 2;

      for (let i = 0; i < COUNT; i++) {
        // Evenly distributed burst angles with slight jitter
        const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const burstDist = 55 + Math.random() * 55;
        particles.push({
          p0: { x: sx + (Math.random() - 0.5) * 6, y: sy + (Math.random() - 0.5) * 6 },
          p1: { x: sx + Math.cos(angle) * burstDist, y: sy + Math.sin(angle) * burstDist },
          p2: { x: ex + (Math.random() - 0.5) * 4, y: ey + (Math.random() - 0.5) * 4 },
          size: 3 + Math.random() * 2,
          delay: Math.random() * 0.1, // slight stagger between particles
        });
      }
    }

    if (!particles.length) {
      cvs.remove();
      return;
    }

    const startTime = performance.now();

    await new Promise((resolve) => {
      const frame = (now) => {
        const globalT = Math.min((now - startTime) / DURATION, 1);
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        for (const p of particles) {
          // Per-particle t, shifted by its delay
          const t = Math.min(Math.max((globalT - p.delay) / (1 - p.delay), 0), 1);
          if (t <= 0) continue;

          const pos = bezier(p.p0, p.p1, p.p2, t);

          // Trail: sample the curve behind the current position
          const TRAIL_STEPS = 14;
          const TRAIL_SPAN = 0.18; // how far back the trail reaches on the curve
          for (let i = 1; i <= TRAIL_STEPS; i++) {
            const progress = i / TRAIL_STEPS;
            const tA = Math.max(0, t - TRAIL_SPAN * (1 - (i - 1) / TRAIL_STEPS));
            const tB = Math.max(0, t - TRAIL_SPAN * (1 - i / TRAIL_STEPS));
            const a = bezier(p.p0, p.p1, p.p2, tA);
            const b = bezier(p.p0, p.p1, p.p2, tB);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(255,200,30,${progress * 0.65})`;
            ctx.lineWidth = p.size * progress * 0.85;
            ctx.lineCap = 'round';
            ctx.stroke();
          }

          // Outer glow
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, p.size * 2.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,180,0,0.18)';
          ctx.fill();

          // Gold body
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = '#ffb800';
          ctx.fill();

          // White core
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, p.size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }

        if (globalT < 1) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });

    cvs.remove();
  }

  /**
   * Play the contamination animation: dark particles burst from the enemy and
   * converge onto the target tile via quadratic Bézier curves with trails.
   * On arrival a dark shadow pulse flashes on the tile.
   * @param {import('../entities/tile.js').Tile} tile — The freshly contaminated tile
   */
  async #playContaminationAnimation(tile) {
    if (!this.#enemyAreaEl || !this.#gm.gridEl) return;

    const tileEl = this.#gm.tileElements.get(tile.id);
    if (!tileEl) return;

    const enemyRect = this.#enemyAreaEl.getBoundingClientRect();
    const tileRect = tileEl.getBoundingClientRect();

    const sx = enemyRect.left + enemyRect.width / 2;
    const sy = enemyRect.top + enemyRect.height / 2;
    const ex = tileRect.left + tileRect.width / 2;
    const ey = tileRect.top + tileRect.height / 2;

    const COUNT = 4;
    const DURATION = 550;

    /** Quadratic Bézier position at parameter t ∈ [0,1]. */
    const bezier = (p0, p1, p2, t) => ({
      x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x,
      y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y,
    });

    const cvs = document.createElement('canvas');
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
    cvs.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1000;';
    document.body.appendChild(cvs);
    const ctx = cvs.getContext('2d');

    const particles = [];
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const burstDist = 45 + Math.random() * 45;
      particles.push({
        p0: { x: sx + (Math.random() - 0.5) * 6, y: sy + (Math.random() - 0.5) * 6 },
        p1: { x: sx + Math.cos(angle) * burstDist, y: sy + Math.sin(angle) * burstDist },
        p2: { x: ex + (Math.random() - 0.5) * 4, y: ey + (Math.random() - 0.5) * 4 },
        size: 2.5 + Math.random() * 2,
        delay: Math.random() * 0.12,
      });
    }

    const startTime = performance.now();

    await new Promise((resolve) => {
      let impactSoundPlayed = false;
      const frame = (now) => {
        const globalT = Math.min((now - startTime) / DURATION, 1);
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        // Play contamination sound when particles are visually at the tile (~90% travel)
        if (!impactSoundPlayed && globalT >= 0.9) {
          impactSoundPlayed = true;
          audioManager.playSfx('contamination');
        }

        for (const p of particles) {
          const t = Math.min(Math.max((globalT - p.delay) / (1 - p.delay), 0), 1);
          if (t <= 0) continue;

          const pos = bezier(p.p0, p.p1, p.p2, t);

          // Trail sampled from the Bézier curve
          const TRAIL_STEPS = 12;
          const TRAIL_SPAN = 0.2;
          for (let i = 1; i <= TRAIL_STEPS; i++) {
            const progress = i / TRAIL_STEPS;
            const tA = Math.max(0, t - TRAIL_SPAN * (1 - (i - 1) / TRAIL_STEPS));
            const tB = Math.max(0, t - TRAIL_SPAN * (1 - i / TRAIL_STEPS));
            const a = bezier(p.p0, p.p1, p.p2, tA);
            const b = bezier(p.p0, p.p1, p.p2, tB);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(130,0,210,${progress * 0.6})`;
            ctx.lineWidth = p.size * progress * 0.85;
            ctx.lineCap = 'round';
            ctx.stroke();
          }

          // Outer glow (deep violet)
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, p.size * 2.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(70,0,150,0.2)';
          ctx.fill();

          // Dark purple body
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = '#5500bb';
          ctx.fill();

          // Pale violet core
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, p.size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#bb88ff';
          ctx.fill();
        }

        if (globalT < 1) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });

    cvs.remove();

    // Dark shadow pulse on the newly contaminated tile
    tileEl.classList.add('fm-tile-hit-contaminate');
    tileEl.addEventListener(
      'animationend',
      () => {
        tileEl.classList.remove('fm-tile-hit-contaminate');
      },
      { once: true },
    );
  }

  /**
   * Play enemy death animation using Phaser's Matter.js physics engine.
   * A DOM element provides the visual; a Matter rigid body drives position + rotation.
   * Bodies collide with the static floor and with each other — no hand-crafted physics.
   * @param {import('../entities/enemy.js').Enemy} enemy
   */
  async #playEnemyDeathAnimation(enemy) {
    if (!this.#enemyAreaEl) return;
    audioManager.playSfx('enemyDeath');
    // Wake the physics world for this animation; it will auto-pause once settled.
    this.matter.world.resume();

    const tileSize = this.#tileSizePx;
    const tileClass = `fm-t${enemy.level}`;

    // Find the tile wrapper to get its exact center position
    const tileWrap = this.#enemyAreaEl.querySelector('.fm-enemy-tile');
    const srcRect = (tileWrap ?? this.#enemyAreaEl).getBoundingClientRect();
    const cx = srcRect.left + srcRect.width / 2;
    const cy = srcRect.top + srcRect.height / 2;

    // ── DOM element (visual only) ──────────────────────────────────────────
    // Hide the live enemy tile immediately so there is no overlap between the
    // still-visible live tile and the newly created dead tile.
    if (this.#enemyAreaEl) this.#enemyAreaEl.style.visibility = 'hidden';

    const deadTile = document.createElement('div');
    deadTile.className = 'fm-dead-enemy';
    deadTile.style.cssText =
      `position:fixed;left:0;top:0;width:${tileSize}px;height:${tileSize}px;` +
      `pointer-events:none;transform-origin:center center;`;
    /* Position via transform (GPU-composited) — update() will keep syncing this way */
    deadTile.style.transform = `translate(${cx - tileSize / 2}px,${cy - tileSize / 2}px)`;
    deadTile.innerHTML = `
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
      chamfer: { radius: 14 }, // match CSS border-radius: 14px
      restitution: 0.2,
      friction: 0.9,
      frictionAir: 0.025, // higher air drag — smoother fall on all screen sizes
      density: 0.002,
      label: 'dead-enemy',
    });

    // Initial impulse: random horizontal kick + spin
    const M = Phaser.Physics.Matter.Matter;
    const vxDir = Math.random() > 0.5 ? 1 : -1;
    M.Body.setVelocity(body, {
      x: vxDir * Math.random(),
      y: 0,
    });
    M.Body.setAngularVelocity(body, (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.1));

    this.#deadEnemyBodies.push({ el: deadTile, body });
    this.#scheduleMatterAutoPause();

    // Brief pause so the caller waits for the tile to visually separate from
    // the enemy area before clearing it — physics continues via update().
    await this.#wait(400);
  }

  /** @type {number | null} */
  #matterPauseTimer = null;

  /** @type {number} Timestamp when the last body was added, for hard-cap timeout */
  #matterResumeAt = 0;

  /**
   * Poll every 500 ms until every dead-enemy body has gone to sleep (Matter's
   * built-in idle detection via enableSleeping:true), then pause the world.
   * Hard cap at 8 s in case a body never sleeps (extremely unlikely).
   * Resets the timer whenever a new body is added so a fresh fall is never cut short.
   */
  #scheduleMatterAutoPause() {
    if (this.#matterPauseTimer !== null) {
      clearTimeout(this.#matterPauseTimer);
    }
    this.#matterResumeAt = Date.now();
    const poll = () => {
      this.#matterPauseTimer = setTimeout(() => {
        const allSettled = this.#deadEnemyBodies.every(
          ({ body }) => body.isSleeping || body.isStatic,
        );
        if (allSettled || Date.now() - this.#matterResumeAt >= 8000) {
          this.#matterPauseTimer = null;
          if (!this.matter.world.isPaused) this.matter.world.pause();
        } else {
          poll();
        }
      }, 500);
    };
    poll();
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
    const BASE = 1.5; // base velocity delta (pixels/frame) — keep subtle
    const JITTER = 0.8; // per-body random variation for natural feel
    const dx = direction === 'right' ? BASE : direction === 'left' ? -BASE : 0;
    const dy = direction === 'down' ? BASE : direction === 'up' ? -BASE : 0;
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

  // ─── MODALS ──────────────────────────────────────
  #openHelp() {
    if (this.#helpModal) return;
    this.#helpModal = new HelpModal(this, {
      onClose: () => {
        this.#helpModal?.destroy();
        this.#helpModal = null;
      },
    });
  }

  #openHistory() {
    if (this.#historyModal) return;
    this.#historyModal = new HistoryModal(this, {
      historyManager: this.#historyManager,
      onClose: () => {
        this.#historyModal?.destroy();
        this.#historyModal = null;
      },
    });
  }

  #openMenu() {
    if (this.#menuModal || this.#gameOverModal) return;
    saveManager.saveGame({ ...this.#gm.grid.serialize(), mode: this.#mode });

    this.#menuModal = new MenuModal(this, {
      showResume: true,
      onResume: () => this.#destroyMenuModal(),
      onClassic: () => {
        this.#destroyMenuModal();
        this.scene.restart({ mode: 'classic' });
      },
      onBattle: () => {
        this.#destroyMenuModal();
        this.scene.restart({ mode: 'battle' });
      },
      onFree: () => {
        this.#destroyMenuModal();
        this.scene.restart({ mode: 'free' });
      },
      onReplay: () => {
        this.#destroyMenuModal();
        this.scene.restart({ mode: this.#mode });
      },
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
      history: this.#historyManager.serialize(),
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

  /** Persist the current game state to the auto-save slot. */
  #autoSave() {
    saveManager.autoSave(this.#buildFullSaveState());
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
      getComputedStyle(document.getElementById('game-container') ?? document.body).getPropertyValue(
        '--fm-tile-size',
      ),
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
      deadTile.style.top = `${cy - tileSize / 2}px`;
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
        chamfer: { radius: 14 },
        restitution: 0.2,
        friction: 0.9,
        frictionAir: 0.025,
        density: 0.002,
        label: 'dead-enemy',
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
    if (data.history) this.#historyManager.restore(data.history);
    this.#prevBestScore = saveManager.getBestScore(this.#mode);
    this.#bestScoreNotified = false;
    this.#hudManager?.cancelComboTimer();

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
      this.#gm.syncTileDom(
        this.#powerManager?.windDirection ?? this.#battlePowerManager?.windDirection ?? null,
      );
    }
    this.#updateHUD();
  }

  #destroyMenuModal() {
    if (this.#adminModal) {
      this.#adminModal.destroy();
      this.#adminModal = null;
    }
    if (this.#menuModal) {
      this.#menuModal.destroy();
      this.#menuModal = null;
    }
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
      onNewRecord: () => this.#hudManager?.showNewBestNotification(),
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
      onClose: () => {
        this.#adminModal?.destroy();
        this.#adminModal = null;
      },
    });
  }

  #onVictory() {
    audioManager.playSfx('victory');
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
      saveManager.clearAutoSave();
    }

    const provisionalEntry = isBattle
      ? null
      : {
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
      onContinue: isBattle
        ? undefined
        : () => {
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
    audioManager.playSfx('gameOver');
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
    saveManager.clearAutoSave();

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
      this.#hudManager?.setPredBtnVisible(false);
      return;
    }

    const directions = /** @type {const} */ (['up', 'down', 'left', 'right']);
    // Thick SVG arrow per direction
    const dirArrows = {
      up: `<svg class="fm-info-arrow" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 1 L11 7 H8 V13 H4 V7 H1 Z" fill="currentColor"/></svg>`,
      down: `<svg class="fm-info-arrow" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 13 L11 7 H8 V1 H4 V7 H1 Z" fill="currentColor"/></svg>`,
      left: `<svg class="fm-info-arrow" viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6 L7 1 V4 H13 V8 H7 V11 Z" fill="currentColor"/></svg>`,
      right: `<svg class="fm-info-arrow" viewBox="0 0 14 12" aria-hidden="true"><path d="M13 6 L7 1 V4 H1 V8 H7 V11 Z" fill="currentColor"/></svg>`,
    };

    /**
     * Build prediction line HTML strings.
     * @param {number} maxTiles - max tiles per pill row (use Infinity for modal)
     * @returns {string[]}
     */
    const buildLines = (maxTiles) => {
      const buildPills = (values) => {
        if (!values || values.length === 0) return '';
        const sorted = [...values].sort((a, b) => b - a);
        const shown = isFinite(maxTiles) ? sorted.slice(0, maxTiles) : sorted;
        return `<div class="fm-power-info-tiles">${shown.map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`).join('')}</div>`;
      };

      /** @type {string[]} */
      const result = [];

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
          )
            continue;

          const meta = POWER_META[pred.powerType];

          // Determine message key and tiles HTML
          let msgKey;
          let tilesHtml = '';
          let noColon = false;

          if (pred.exits) {
            msgKey =
              pred.powerType === POWER_TYPES.EXPEL_V ? 'pred.expel_v_off' : 'pred.expel_h_off';
            tilesHtml = buildPills([pred.tileValue]);
          } else {
            switch (pred.powerType) {
              case POWER_TYPES.FIRE_H:
              case POWER_TYPES.FIRE_V:
              case POWER_TYPES.FIRE_X:
              case POWER_TYPES.BOMB:
                msgKey = 'pred.destroy';
                tilesHtml = buildPills(pred.destroyedValues);
                break;
              case POWER_TYPES.ICE:
                msgKey = 'pred.block';
                tilesHtml = buildPills([pred.tileValue]);
                break;
              case POWER_TYPES.TELEPORT:
                msgKey = 'pred.teleport';
                tilesHtml = `<div class="fm-power-info-tiles">
                  <span class="fm-power-info-tile fm-t${pred.tileValue}">${pred.tileValue}</span>
                  <span class="fm-range-sep">↔</span>
                  <span class="fm-power-info-tile fm-t-unk">?</span>
                </div>`;
                break;
              case POWER_TYPES.EXPEL_V:
                msgKey = 'pred.expel_v_on';
                tilesHtml = buildPills([pred.tileValue]);
                break;
              case POWER_TYPES.EXPEL_H:
                msgKey = 'pred.expel_h_on';
                tilesHtml = buildPills([pred.tileValue]);
                break;
              case POWER_TYPES.WIND_UP:
              case POWER_TYPES.WIND_DOWN:
              case POWER_TYPES.WIND_LEFT:
              case POWER_TYPES.WIND_RIGHT:
                msgKey = 'pred.block';
                tilesHtml = buildPills(pred.allGridValues);
                break;
              case POWER_TYPES.LIGHTNING: {
                msgKey = 'pred.lightning';
                const rawMin = [...(pred.lightningRange?.min ?? [])].sort((a, b) => b - a);
                const rawMax = [...(pred.lightningRange?.max ?? [])].sort((a, b) => b - a);
                const minArr = isFinite(maxTiles) ? rawMin.slice(0, maxTiles) : rawMin;
                const maxArr = isFinite(maxTiles) ? rawMax.slice(0, maxTiles) : rawMax;
                const minPills =
                  rawMin.length > 0
                    ? minArr
                        .map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`)
                        .join('')
                    : `<span class="fm-range-empty">∅</span>`;
                const maxPills = maxArr
                  .map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`)
                  .join('');
                tilesHtml = `<div class="fm-power-info-range">
                  <span class="fm-range-label">(Min</span>
                  <div class="fm-power-info-tiles">${minPills}</div>
                  <span class="fm-range-label">)</span>
                  <span class="fm-range-label">(Max</span>
                  <div class="fm-power-info-tiles">${maxPills}</div>
                  <span class="fm-range-label">)</span>
                </div>`;
                break;
              }
              case POWER_TYPES.NUCLEAR:
                msgKey = 'pred.nuclear';
                tilesHtml = buildPills(pred.destroyedValues);
                break;
              case POWER_TYPES.BLIND:
                msgKey = 'pred.blind';
                tilesHtml = buildPills(pred.allGridValues);
                break;
              case POWER_TYPES.ADS: {
                const adjs = i18n.t('pred.ads_adjectives');
                const adj =
                  Array.isArray(adjs) && adjs.length > 0
                    ? adjs[Math.floor(Math.random() * adjs.length)]
                    : '';
                msgKey = 'pred.ads';
                tilesHtml = `<span class="fm-pred-ads-adj">${adj}</span>`;
                noColon = true;
                break;
              }
              default:
                msgKey = meta.nameKey;
            }
          }

          const powerIconHtml = `<svg class="fm-pred-power-ico fm-pred-power-ico--${cat}" aria-hidden="true"><use href="#${meta.svgId}"/></svg>`;
          const colonHtml = tilesHtml && !noColon ? `<span class="fm-pred-sep">:</span>` : '';

          result.push(`
            <div class="fm-power-info-line">
              <span class="fm-power-info-dir">${dirArrows[dir]}</span>
              ${powerIconHtml}
              <span class="fm-power-info-name">${i18n.t(msgKey)}</span>
              ${colonHtml}
              ${tilesHtml}
            </div>`);
        }
      }

      // Pending destruction row: tiles whose animation was cut mid-flight
      if (this.#pendingDestructionTiles.size > 0) {
        const sortedVals = [...this.#pendingDestructionTiles.values()].sort((a, b) => b - a);
        const shownVals = isFinite(maxTiles) ? sortedVals.slice(0, maxTiles) : sortedVals;
        const pills = shownVals
          .map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`)
          .join('');
        result.push(`
          <div class="fm-power-info-line fm-power-info-destroying">
            <span class="fm-info-destroy-icon">🗑</span>
            <div class="fm-power-info-tiles">${pills}</div>
          </div>`);
      }

      return result;
    };

    const MAX_TILES_PANEL = 8;
    const MAX_VISIBLE = 4;
    const lines = buildLines(MAX_TILES_PANEL);
    const linesAll = buildLines(Infinity);

    if (lines.length === 0) {
      this.#powerInfoEl.style.display = 'none';
      this.#hudManager?.setPredBtnVisible(false);
      return;
    }

    const isTruncated = lines.length > MAX_VISIBLE || linesAll.join('') !== lines.join('');
    this.#predPanelTruncated = isTruncated;

    const visible = lines.slice(0, MAX_VISIBLE);
    if (isTruncated) {
      visible.push(`<span class="fm-power-info-more-text">...</span>`);
    }

    this.#powerInfoEl.style.display = 'flex';
    this.#powerInfoEl.classList.remove('fm-power-info--clickable');
    this.#powerInfoEl.onpointerdown = null;
    this.#powerInfoEl.innerHTML = visible.join('');

    this.#hudManager?.setPredBtnVisible(isTruncated);
  }

  /** Open the full prediction modal (called by the "!" HUD button). */
  #openPredModal() {
    const pm = this.#powerManager || this.#battlePowerManager;
    if (!this.#powerInfoAllDom || !pm) return;

    const directions = /** @type {const} */ (['up', 'down', 'left', 'right']);
    const dirArrows = {
      up: `<svg class="fm-info-arrow" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 1 L11 7 H8 V13 H4 V7 H1 Z" fill="currentColor"/></svg>`,
      down: `<svg class="fm-info-arrow" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 13 L11 7 H8 V1 H4 V7 H1 Z" fill="currentColor"/></svg>`,
      left: `<svg class="fm-info-arrow" viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6 L7 1 V4 H13 V8 H7 V11 Z" fill="currentColor"/></svg>`,
      right: `<svg class="fm-info-arrow" viewBox="0 0 14 12" aria-hidden="true"><path d="M13 6 L7 1 V4 H1 V8 H7 V11 Z" fill="currentColor"/></svg>`,
    };

    const buildPills = (values) => {
      if (!values || values.length === 0) return '';
      const sorted = [...values].sort((a, b) => b - a);
      return `<div class="fm-power-info-tiles">${sorted.map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`).join('')}</div>`;
    };

    /** @type {string[]} */
    const linesAll = [];
    for (const dir of directions) {
      const predictions = pm.predictForDirection(dir, this.#gm.grid);
      if (predictions.length === 0) continue;
      for (const pred of predictions) {
        const cat = pred.exits ? 'danger' : getPowerCategory(pred.powerType);
        if (
          !pred.exits &&
          cat === 'danger' &&
          pred.powerType !== POWER_TYPES.LIGHTNING &&
          (!pred.destroyedValues || pred.destroyedValues.length === 0)
        )
          continue;
        const meta = POWER_META[pred.powerType];
        let msgKey;
        let tilesHtml = '';
        let noColon = false;
        if (pred.exits) {
          msgKey = pred.powerType === POWER_TYPES.EXPEL_V ? 'pred.expel_v_off' : 'pred.expel_h_off';
          tilesHtml = buildPills([pred.tileValue]);
        } else {
          switch (pred.powerType) {
            case POWER_TYPES.FIRE_H:
            case POWER_TYPES.FIRE_V:
            case POWER_TYPES.FIRE_X:
            case POWER_TYPES.BOMB:
              msgKey = 'pred.destroy';
              tilesHtml = buildPills(pred.destroyedValues);
              break;
            case POWER_TYPES.ICE:
              msgKey = 'pred.block';
              tilesHtml = buildPills([pred.tileValue]);
              break;
            case POWER_TYPES.TELEPORT:
              msgKey = 'pred.teleport';
              tilesHtml = `<div class="fm-power-info-tiles">
                <span class="fm-power-info-tile fm-t${pred.tileValue}">${pred.tileValue}</span>
                <span class="fm-range-sep">↔</span>
                <span class="fm-power-info-tile fm-t-unk">?</span>
              </div>`;
              break;
            case POWER_TYPES.EXPEL_V:
              msgKey = 'pred.expel_v_on';
              tilesHtml = buildPills([pred.tileValue]);
              break;
            case POWER_TYPES.EXPEL_H:
              msgKey = 'pred.expel_h_on';
              tilesHtml = buildPills([pred.tileValue]);
              break;
            case POWER_TYPES.WIND_UP:
            case POWER_TYPES.WIND_DOWN:
            case POWER_TYPES.WIND_LEFT:
            case POWER_TYPES.WIND_RIGHT:
              msgKey = 'pred.block';
              tilesHtml = buildPills(pred.allGridValues);
              break;
            case POWER_TYPES.LIGHTNING: {
              msgKey = 'pred.lightning';
              const rawMin = [...(pred.lightningRange?.min ?? [])].sort((a, b) => b - a);
              const rawMax = [...(pred.lightningRange?.max ?? [])].sort((a, b) => b - a);
              const minPills =
                rawMin.length > 0
                  ? rawMin
                      .map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`)
                      .join('')
                  : `<span class="fm-range-empty">∅</span>`;
              const maxPills = rawMax
                .map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`)
                .join('');
              tilesHtml = `<div class="fm-power-info-range">
                <span class="fm-range-label">(Min</span>
                <div class="fm-power-info-tiles">${minPills}</div>
                <span class="fm-range-label">)</span>
                <span class="fm-range-label">(Max</span>
                <div class="fm-power-info-tiles">${maxPills}</div>
                <span class="fm-range-label">)</span>
              </div>`;
              break;
            }
            case POWER_TYPES.NUCLEAR:
              msgKey = 'pred.nuclear';
              tilesHtml = buildPills(pred.destroyedValues);
              break;
            case POWER_TYPES.BLIND:
              msgKey = 'pred.blind';
              tilesHtml = buildPills(pred.allGridValues);
              break;
            case POWER_TYPES.ADS: {
              const adjs = i18n.t('pred.ads_adjectives');
              const adj =
                Array.isArray(adjs) && adjs.length > 0
                  ? adjs[Math.floor(Math.random() * adjs.length)]
                  : '';
              msgKey = 'pred.ads';
              tilesHtml = `<span class="fm-pred-ads-adj">${adj}</span>`;
              noColon = true;
              break;
            }
            default:
              msgKey = meta.nameKey;
          }
        }
        const powerIconHtml = `<svg class="fm-pred-power-ico fm-pred-power-ico--${cat}" aria-hidden="true"><use href="#${meta.svgId}"/></svg>`;
        const colonHtml = tilesHtml && !noColon ? `<span class="fm-pred-sep">:</span>` : '';
        linesAll.push(`
          <div class="fm-power-info-line">
            <span class="fm-power-info-dir">${dirArrows[dir]}</span>
            ${powerIconHtml}
            <span class="fm-power-info-name">${i18n.t(msgKey)}</span>
            ${colonHtml}
            ${tilesHtml}
          </div>`);
      }
    }

    if (this.#pendingDestructionTiles.size > 0) {
      const sortedVals = [...this.#pendingDestructionTiles.values()].sort((a, b) => b - a);
      const pills = sortedVals
        .map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`)
        .join('');
      linesAll.push(`
        <div class="fm-power-info-line fm-power-info-destroying">
          <span class="fm-info-destroy-icon">🗑</span>
          <div class="fm-power-info-tiles">${pills}</div>
        </div>`);
    }

    const overlayEl = this.#powerInfoAllDom.node.querySelector('#fm-power-info-all-overlay');
    const titleEl = this.#powerInfoAllDom.node.querySelector('#fm-power-info-all-title');
    const linesEl = this.#powerInfoAllDom.node.querySelector('#fm-power-info-all-lines');
    if (titleEl) titleEl.textContent = i18n.t('power.predictions');
    if (linesEl) linesEl.innerHTML = linesAll.join('');
    if (overlayEl) overlayEl.style.display = 'flex';
  }

  // ─── GRID LIFE ────────────────────────────────────

  /** Create (or reset) the liquid fill element inside the grid container. */
  #createLiquidOverlay() {
    // Tear down previous
    this.#gridFillEl?.remove();
    this.#gridFillEl = null;
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

    this.#gridFillEl = createLiquidFill(this.#liquidEl, 'info');
    /* Start at 0 so the fill animates from empty to full */
    snapLiquidLevel(this.#gridFillEl, 0);
  }

  /**
   * Called after damage is dealt to GridLife.
   * Plays hurt flash, shows damage popup, updates liquid, checks critical overlay.
   * @param {number} damage
   */
  #onGridLifeDamage(damage) {
    if (!this.#gridLife || damage <= 0) return;

    audioManager.playSfx('gridHurt');

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
    if (!this.#gridLife || !this.#gridFillEl) return;

    const pct = this.#gridLife.percent;
    setLiquidLevel(this.#gridFillEl, pct);

    // Colour by category
    const cat = this.#gridLife.getColorCategory();
    setLiquidCategory(this.#gridFillEl, cat);

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
    if (
      !this.#gameOver &&
      !this.#gm.animating &&
      this.#gm.grid.getAllTiles().length === 0 &&
      !this.#emptyGridTimer
    ) {
      this.#startEmptyGridTimer();
    }

    if (this.#deadEnemyBodies.length === 0) return;
    const half = this.#tileSizePx / 2;
    for (const { el, body } of this.#deadEnemyBodies) {
      if (!el.isConnected) continue;
      /* Use transform instead of left/top to avoid triggering layout reflow
         every frame. translate + rotate is GPU-composited (no main-thread work). */
      el.style.transform = `translate(${body.position.x - half}px,${body.position.y - half}px) rotate(${body.angle}rad)`;
    }
  }

  shutdown() {
    this.#inputManager?.shutdown();
    this.#hudManager?.shutdown();
    this.#cancelEmptyGridTimer();
    this.#gm.shutdown();
    this.#destroyMenuModal();
    this.#gameOverModal?.destroy();
    this.#victoryModal?.destroy();
    this.#powerSelectModal?.destroy();
    this.#powerChoiceModal?.destroy();
    this.#adminModal?.destroy();
    this.#helpModal?.destroy();
    this.#helpModal = null;
    this.#powerInfoDom?.destroy();
    this.#powerInfoAllDom?.destroy();
    this.#criticalOverlay?.remove();
    this.#criticalOverlay = null;
    this.#gridFillEl?.remove();
    this.#gridFillEl = null;
    this.#enemyFillEl?.remove();
    this.#enemyFillEl = null;
    this.#adsOverlay?.remove();
    this.#adsOverlay = null;
    document.querySelectorAll('.fm-new-best-notif').forEach((el) => el.remove());
    this.#enemyAreaEl?.remove();
    this.#enemyAreaEl = null;
    // Remove all dead enemy DOM nodes (in-flight or settled)
    document.querySelectorAll('.fm-dead-enemy').forEach((el) => el.remove());
    this.#deadEnemyBodies = [];
    if (this.#matterPauseTimer !== null) {
      clearTimeout(this.#matterPauseTimer);
      this.#matterPauseTimer = null;
    }
    // Physics bodies are destroyed with the Matter world on scene shutdown;
    // we only need to null our reference.
    this.#physicsFloor = null;
    document.querySelectorAll('.fm-contaminate-particle').forEach((el) => el.remove());
  }
}
