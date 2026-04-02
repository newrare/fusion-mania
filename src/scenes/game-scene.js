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
import { GridLife } from '../entities/grid-life.js';
import { BattleManager } from '../managers/battle-manager.js';
import { BATTLE } from '../configs/constants.js';
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

  /** @type {number} Highest tile value reached this game */
  #maxTile = 0;

  /** @type {string[] | null} Selected power types for this free-mode game */
  #selectedPowers = null;

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

  /** @type {MatterJS.BodyType | null} Static floor body at viewport bottom */
  #physicsFloor = null;

  /** Tile size in CSS pixels, cached from --fm-tile-size after create(). */
  #tileSizePx = 64;

  constructor() {
    super({ key: SCENE_KEYS.GRID });
    this.#gm = new GridManager();
  }

  /** @param {{ mode?: string, restore?: boolean, selectedPowers?: string[] }} data */
  init(data) {
    this.#mode = data?.mode ?? 'classic';
    this.#gameOver = false;
    this.#fusions = 0;
    this.#maxTile = 0;
    this.#selectedPowers = null;
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
    // Battle mode
    this.#battleManager = null;
    this.#enemyAreaEl = null;
    this.#enemyWave = null;
    this.#battlePowerManager = null;
    this.#deadEnemyBodies = [];
    this.#physicsFloor = null;
  }

  create() {
    // Defensive cleanup: remove any DOM nodes from a previous game that may
    // have survived shutdown (e.g. if an animation was in flight).
    document.querySelectorAll(
      '.fm-dead-enemy, .fm-enemy-area, .fm-contaminate-particle, .fm-critical-overlay'
    ).forEach((el) => el.remove());

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

    if (this.#mode === 'free' && !this.#pendingPowerTypes) {
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
    const hpBox = (this.#mode === 'free' || this.#mode === 'battle')
      ? `<div class="fm-score-box fm-hp-box" id="fm-hp-box" style="${this.#mode === 'battle' ? 'display:none' : ''}">
            <span class="fm-score-label" id="fm-label-hp">${i18n.t('game.hp')}</span>
            <span class="fm-score-value" id="fm-hp"></span>
          </div>`
      : '';

    const html = `
      <div class="fm-hud">
        <div class="fm-hud-row">
          <div class="fm-score-box">
            <span class="fm-score-label" id="fm-label-moves">${i18n.t('game.moves')}</span>
            <span class="fm-score-value" id="fm-moves">0</span>
          </div>
          <div class="fm-score-box">
            <span class="fm-score-label" id="fm-label-fusions">${i18n.t('game.fusions')}</span>
            <span class="fm-score-value" id="fm-fusions">0</span>
          </div>
          ${hpBox}
          <div class="fm-score-box">
            <span class="fm-score-label" id="fm-label-max-tile">${i18n.t('game.max_tile')}</span>
            <span class="fm-score-value" id="fm-max-tile">0</span>
          </div>
          <div class="fm-score-wrap">
            <div class="fm-score-box">
              <span class="fm-score-label" id="fm-label-score">${i18n.t('game.score')}</span>
              <span class="fm-score-value" id="fm-score">0</span>
            </div>
            <div class="fm-combo-display" id="fm-combo-display" style="display:none"></div>
            <div class="fm-score-bonus" id="fm-score-bonus"></div>
          </div>
          <div class="fm-score-box">
            <span class="fm-score-label" id="fm-label-best">${i18n.t('game.best')}</span>
            <span class="fm-score-value" id="fm-best">${saveManager.getBestScore(this.#mode)}</span>
          </div>
          <div class="fm-score-box">
            <span class="fm-score-label" id="fm-label-best-tile">${i18n.t('game.best_tile')}</span>
            <span class="fm-score-value" id="fm-best-max-tile">${saveManager.getBestMaxTile(this.#mode)}</span>
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
      'fm-label-hp':        'game.hp',
    };
    for (const [id, key] of Object.entries(map)) {
      const node = el.querySelector(`#${id}`);
      if (node) node.textContent = i18n.t(key);
    }
  }

  // ─── POWER SELECT MODAL ──────────────────────────
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
    this.#combo = 0;
    this.#comboMax = 0;
    this.#comboScoreStart = 0;
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
    if (this.#gameOver || this.#menuModal || this.#powerChoiceModal || this.#powerSelectModal) return;

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
    if (this.#gameOver || this.#menuModal || this.#powerChoiceModal || this.#powerSelectModal) return;

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
    const moveResult = await this.#gm.executeMove(direction, waitFn);

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
      if (this.#combo === 0) this.#comboScoreStart = scoreBefore;
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

        await this.#executePowerEffect(chosenPower, trigger.tile);
      }

      this.#powerManager.onMove(this.#gm.grid);
      this.#gm.syncTileDom(this.#powerManager.windDirection);
      this.#updatePowerVisuals();
    }

    // ── Battle power system (contaminated tile effects) ──
    if (this.#battlePowerManager && merges.length > 0) {
      const triggers = this.#battlePowerManager.checkMergeTriggers(merges, this.#gm.grid);

      for (const trigger of triggers) {
        let chosenPower = trigger.powerType;

        if (trigger.needsChoice) {
          chosenPower = await this.#showPowerChoiceModal(trigger.powerType, trigger.powerTypeB);
        }

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
      await this.#showAdsModal();
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
   * @returns {Promise<void>}
   */
  #showAdsModal() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'fm-ads-overlay';
      overlay.innerHTML = `
        <div class="fm-ads-container">
          <div class="fm-ads-label">${i18n.t('ads.label')}</div>
          <div class="fm-ads-placeholder">📱</div>
          <div class="fm-ads-timer" id="fm-ads-timer">3</div>
        </div>`;
      document.body.appendChild(overlay);
      this.#adsOverlay = overlay;

      let remaining = Math.ceil(ANIM.ADS_DURATION / 1000);
      const timerEl = overlay.querySelector('#fm-ads-timer');

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
        overlay.remove();
        this.#adsOverlay = null;
        resolve();
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

    const hpEl = this.#hudEl?.querySelector('#fm-hp');
    if (hpEl && this.#gridLife) {
      hpEl.textContent = `${Math.ceil(this.#gridLife.currentHp)}/${this.#gridLife.maxHp}`;
    }
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
    // z-index 5: visible above grid tiles but deliberately below modal overlays (z-index 100).
    // The CSS :has(.fm-modal-overlay) rule hides this element entirely when any modal is open.
    this.#enemyAreaEl.style.zIndex = '5';
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
      { isStatic: true, label: 'floor', friction: 1.5, restitution: 0.05 },
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
      // Battle phase: apply merge damage, enemy contaminates
      if (merges.length > 0) {
        const { damage, killed } = bm.applyMergeDamage(merges);
        if (damage > 0) {
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

    // Show HP box in HUD
    const hpBox = this.#hudEl?.querySelector('#fm-hp-box');
    if (hpBox) hpBox.style.display = '';

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
      const nameEl = this.#enemyAreaEl.querySelector('.fm-enemy-name');

      if (nameEl) nameEl.classList.add('fm-enemy-name-appear');

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
      <div class="fm-enemy-name ${tileClass}">${enemy.name}</div>
      <div class="fm-enemy-tile${bossClass}">
        <div class="fm-tile fm-enemy-tile-inner ${tileClass}">
          <div class="fm-enemy-hp-liquid"></div>
        </div>
      </div>
      <div class="fm-enemy-hp-text">${Math.ceil(enemy.life.currentHp)}/${enemy.life.maxHp}</div>
    `;
    /* LiquidWave is created in #onEnemySpawn after display:flex + reflow
       so getBoundingClientRect() returns correct tile dimensions. */
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
    const hpText = this.#enemyAreaEl.querySelector('.fm-enemy-hp-text');
    if (hpText) {
      hpText.textContent = `${Math.ceil(enemy.life.currentHp)}/${enemy.life.maxHp}`;
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

    // Hide HP box in HUD
    const hpBox = this.#hudEl?.querySelector('#fm-hp-box');
    if (hpBox) hpBox.style.display = 'none';

    // Death animation: gray out, move to graveyard
    await this.#playEnemyDeathAnimation(dead);

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
  }

  /**
   * Play the contamination animation: particle from enemy to tile.
   * @param {import('../entities/tile.js').Tile} tile — The freshly contaminated tile
   */
  async #playContaminationAnimation(tile) {
    if (!this.#enemyAreaEl || !this.#gm.gridEl) return;

    const tileEl = this.#gm.tileElements.get(tile.id);
    if (!tileEl) return;

    const enemyRect = this.#enemyAreaEl.getBoundingClientRect();
    const tileRect = tileEl.getBoundingClientRect();

    const particle = document.createElement('div');
    particle.className = 'fm-contaminate-particle';
    particle.style.left = `${enemyRect.left + enemyRect.width / 2}px`;
    particle.style.top = `${enemyRect.top + enemyRect.height / 2}px`;
    document.body.appendChild(particle);

    // Animate to target tile
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
                             `z-index:3;pointer-events:none;transform-origin:center center;`;
    deadTile.style.left = `${cx - tileSize / 2}px`;
    deadTile.style.top  = `${cy - tileSize / 2}px`;
    deadTile.innerHTML  = `
      <div class="fm-tile fm-dead-enemy-inner ${tileClass}">
        <span class="fm-dead-enemy-label">${enemy.name}</span>
      </div>`;
    document.body.appendChild(deadTile);

    // ── Matter.js physics body ─────────────────────────────────────────────
    // this.matter.add.rectangle() creates a raw Matter Body and adds it to the world.
    const body = this.matter.add.rectangle(cx, cy, tileSize, tileSize, {
      chamfer    : { radius: 14 }, // match CSS border-radius: 14px
      restitution : 0.30,   // bounciness
      friction    : 0.90,   // floor friction
      frictionAir : 0.008,  // air resistance
      density     : 0.002,
      label       : 'dead-enemy',
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
      await this.#showAdsModal();
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
      onAdmin: () => this.#openAdminMenu(),
    });
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
      onResume: () => this.#destroyMenuModal(),
      onClose: () => { this.#adminModal?.destroy(); this.#adminModal = null; },
    });
  }

  #onGameOver() {
    this.#cancelEmptyGridTimer();
    this.#endCombo();
    this.#gameOver = true;
    const extra = {
      maxTile: this.#maxTile,
      moves: this.#gm.grid.moves,
      fusions: this.#fusions,
    };
    if (this.#selectedPowers) extra.powers = [...this.#selectedPowers];
    if (this.#battleManager) {
      extra.enemiesDefeated = this.#battleManager.enemiesDefeated;
      extra.enemyMaxLevel = this.#battleManager.maxEnemyLevel;
    }
    saveManager.addRanking(this.#mode, this.#gm.grid.score, extra);
    saveManager.clearGame();

    this.#criticalOverlay?.classList.add('fm-critical-overlay--stopped');

    this.#gameOverModal = new GameOverModal(this, {
      score: this.#gm.grid.score,
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
    this.#enemyAreaEl?.remove();
    this.#enemyAreaEl = null;
    // Remove all dead enemy DOM nodes (in-flight or settled)
    document.querySelectorAll('.fm-dead-enemy').forEach((el) => el.remove());
    this.#deadEnemyBodies = [];
    // Physics bodies are destroyed with the Matter world on scene shutdown;
    // we only need to null our reference.
    this.#physicsFloor = null;
    document.querySelectorAll('.fm-contaminate-particle').forEach((el) => el.remove());
    this.input.keyboard.off('keydown', this.#handleKey, this);
    this.input.off('pointerdown', this.#onPointerDown, this);
    this.input.off('pointerup', this.#onPointerUp, this);
  }
}
