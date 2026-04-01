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
import { addBackground } from '../utils/background.js';

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

  /** @type {HTMLElement | null} Critical red vignette overlay */
  #criticalOverlay = null;

  /** @type {Phaser.Time.TimerEvent | null} Safety timer: spawn a tile if grid stays empty 5 s (free mode) */
  #emptyGridTimer = null;

  /** @type {Function | null} Unsubscribe from i18n locale changes */
  #unsubI18n = null;

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
    this.#criticalOverlay = null;
    this.#emptyGridTimer = null;
  }

  create() {
    this.#gm = new GridManager();
    addBackground(this);
    layout.drawDebugSafeZone(this);
    this.#createHUD();
    this.#gm.createContainer(this);

    if (this.#mode === 'free') {
      this.#createPowerInfoPanel();
    }

    this.#bindInput();

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
    const hpBox = this.#mode === 'free'
      ? `<div class="fm-score-box fm-hp-box">
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
    if (this.#gameOver || this.#menuModal || this.#powerChoiceModal) return;

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
    if (this.#gameOver || this.#menuModal || this.#powerChoiceModal) return;

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

    // Tick power state for EVERY real grid move
    if (this.#powerManager) {
      this.#powerManager.tickMove(this.#gm.grid);
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

    // Free mode safety: if powers destroyed every tile, start the empty-grid timer
    if (this.#mode === 'free') {
      if (this.#gm.grid.getAllTiles().length === 0) {
        this.#startEmptyGridTimer();
      } else {
        this.#cancelEmptyGridTimer();
      }
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

  // ─── MODALS ──────────────────────────────────────
  #openMenu() {
    if (this.#menuModal || this.#gameOverModal) return;
    saveManager.saveGame({ ...this.#gm.grid.serialize(), mode: this.#mode });

    this.#menuModal = new MenuModal(this, {
      showResume: true,
      onResume: () => this.#destroyMenuModal(),
      onClassic: () => { this.#destroyMenuModal(); this.scene.restart({ mode: 'classic' }); },
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
      if (this.#gameOver) return;
      if (this.#gm.grid.getAllTiles().length === 0) {
        const tile = this.#gm.spawnAndRender();
        if (tile) {
          this.#updateHUD();
          this.#gm.updateFusionIndicators();
        }
      }
    });
  }

  /** Cancel the empty-grid safety timer. */
  #cancelEmptyGridTimer() {
    if (this.#emptyGridTimer) {
      this.#emptyGridTimer.remove(false);
      this.#emptyGridTimer = null;
    }
  }

  /** @param {number} ms */
  #wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  // ─── POWER VISUALS ────────────────────────────────
  #updatePowerVisuals() {
    if (!this.#powerManager || !this.#gm.gridEl) return;

    // Remove old edge indicators
    for (const old of this.#gm.gridEl.querySelectorAll('.fm-edge-power')) {
      old.remove();
    }

    // Show color-only indicators on edges based on prediction
    const directions = /** @type {const} */ (['up', 'down', 'left', 'right']);
    const dirToSide = { up: 'top', down: 'bottom', left: 'left', right: 'right' };

    for (const dir of directions) {
      const color = this.#powerManager.getBadgeColor(dir, this.#gm.grid);
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
    if (!this.#powerInfoEl || !this.#powerManager) return;

    if (
      !this.#powerManager.hasPoweredTiles(this.#gm.grid) &&
      !this.#powerManager.hasActiveExpelTiles(this.#gm.grid) &&
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
      const predictions = this.#powerManager.predictForDirection(dir, this.#gm.grid);
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
    if (this.#liquidEl) this.#liquidEl.remove();
    const gridEl = this.#gm.gridEl;
    if (!gridEl) return;

    // Ensure grid is a positioning context for the liquid
    if (getComputedStyle(gridEl).position === 'static') {
      gridEl.style.position = 'relative';
    }

    this.#liquidEl = document.createElement('div');
    this.#liquidEl.className = 'fm-grid-life-liquid fm-hp-full';
    gridEl.prepend(this.#liquidEl);
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
    if (!this.#gridLife || !this.#liquidEl) return;

    const pct = this.#gridLife.percent;
    this.#liquidEl.style.setProperty('--fm-hp-pct', `${(pct * 100).toFixed(1)}%`);

    // Colour by category
    const cat = this.#gridLife.getColorCategory();
    const colors = {
      info: 'rgba(100, 180, 255, 0.22)',
      warning: 'rgba(255, 180, 60, 0.28)',
      danger: 'rgba(255, 60, 60, 0.32)',
    };
    this.#liquidEl.style.setProperty('--fm-hp-color', colors[cat]);

    // Full-height class (round all corners)
    this.#liquidEl.classList.toggle('fm-hp-full', pct > 0.98);

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
    this.input.keyboard.off('keydown', this.#handleKey, this);
    this.input.off('pointerdown', this.#onPointerDown, this);
    this.input.off('pointerup', this.#onPointerUp, this);
  }
}
