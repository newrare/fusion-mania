import Phaser from 'phaser';
import {
  SCENE_KEYS,
  SWIPE_THRESHOLD,
  COMBO_COLORS,
  POWER_META,
  POWER_TYPES,
  ANIM,
} from '../configs/constants.js';
import { i18n } from '../managers/i18n-manager.js';
import { layout } from '../managers/layout-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { GridManager } from '../managers/grid-manager.js';
import { PowerManager } from '../managers/power-manager.js';
import { TileRenderer } from '../components/tile-renderer.js';
import { MenuModal } from '../components/menu-modal.js';
import { GameOverModal } from '../components/game-over-modal.js';
import { PowerSelectModal } from '../components/power-select-modal.js';
import { PowerChoiceModal } from '../components/power-choice-modal.js';
import { AdminModal } from '../components/admin-modal.js';
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

  /** @type {string[] | null} Pending selected power types (from modal) */
  #pendingPowerTypes = null;

  constructor() {
    super({ key: SCENE_KEYS.GRID });
    this.#gm = new GridManager();
  }

  /** @param {{ mode?: string, restore?: boolean, selectedPowers?: string[] }} data */
  init(data) {
    this.#mode = data?.mode ?? 'classic';
    this.#gameOver = false;
    this.#fusions = 0;
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
    this.#pendingPowerTypes = data?.selectedPowers ?? null;
    this.#skipNextPointerUp = false;
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
          <div class="fm-score-box">
            <span class="fm-score-label">${i18n.t('game.moves')}</span>
            <span class="fm-score-value" id="fm-moves">0</span>
          </div>
          <div class="fm-score-box">
            <span class="fm-score-label">${i18n.t('game.fusions')}</span>
            <span class="fm-score-value" id="fm-fusions">0</span>
          </div>
          <div class="fm-score-wrap">
            <div class="fm-score-box">
              <span class="fm-score-label">${i18n.t('game.score')}</span>
              <span class="fm-score-value" id="fm-score">0</span>
            </div>
            <div class="fm-combo-display" id="fm-combo-display" style="display:none"></div>
            <div class="fm-score-bonus" id="fm-score-bonus"></div>
          </div>
          <div class="fm-score-box">
            <span class="fm-score-label">${i18n.t('game.best')}</span>
            <span class="fm-score-value" id="fm-best">${saveManager.getBestScore(this.#mode)}</span>
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
  }

  // ─── POWER SELECT MODAL ──────────────────────────
  #showPowerSelectModal() {
    this.#powerSelectModal = new PowerSelectModal(this, {
      onStart: (selectedTypes) => {
        this.#skipNextPointerUp = true;
        this.#powerSelectModal?.destroy();
        this.#powerSelectModal = null;
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
    this.#powerInfoDom = this.add.dom(layout.safe.left, gridBottom + 10).createFromHTML(html);
    this.#powerInfoDom.setOrigin(0, 0);
    this.#powerInfoEl = this.#powerInfoDom.node.querySelector('#fm-power-info');
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

    // Pause flip animations during move
    if (this.#powerManager) {
      TileRenderer.pauseFlips(this.#gm.tileElements);
    }

    const waitFn = (ms) => this.#wait(ms);
    const moveResult = await this.#gm.executeMove(direction, waitFn);

    if (!moveResult.moved) {
      this.#gm.updateFusionIndicators();
      this.#updatePowerVisuals();
      if (this.#powerManager) TileRenderer.resumeFlips(this.#gm.tileElements);
      return;
    }

    // Tick power state for EVERY real grid move
    if (this.#powerManager) {
      this.#powerManager.tickMove(this.#gm.grid);
    }

    if (moveResult.cancelled) return;

    const { merges, hasMergePossible, scoreBefore } = moveResult;

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

    // Resume flip animations
    if (this.#powerManager) {
      TileRenderer.resumeFlips(this.#gm.tileElements);
    }

    this.#updateHUD();
    this.#gm.updateFusionIndicators();
    this.#gm.animating = false;

    if (!this.#gm.grid.canMove()) {
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

    if (isFirePower && target && effectResult.destroyed.length > 0) {
      this.#gm.playFireAnimation(powerType, target, effectResult.destroyed);
      await this.#wait(ANIM.FIRE_BALL_DURATION + ANIM.FIRE_ZAP_DURATION);
      this.#gm.removeTiles(effectResult.destroyed);
    } else if (effectResult.teleported) {
      const { tileA, tileB, oldA, oldB } = effectResult.teleported;
      await this.#gm.playTeleportAnimation(tileA, tileB, oldA, oldB, ANIM.TELEPORT_DURATION);
    } else {
      this.#gm.applyDangerOverlay(effectResult.destroyed);
      if (effectResult.destroyed.length > 0) {
        await this.#wait(400);
        this.#gm.removeTiles(effectResult.destroyed);
      }
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
    this.#endCombo();
    this.#gameOver = true;
    saveManager.addRanking(this.#mode, this.#gm.grid.score);
    saveManager.clearGame();

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

    if (!this.#powerManager.hasPoweredTiles(this.#gm.grid)) {
      this.#powerInfoEl.style.display = 'none';
      return;
    }

    const directions = /** @type {const} */ (['up', 'down', 'left', 'right']);
    const dirLabels = {
      up: i18n.t('free.move_up'),
      down: i18n.t('free.move_down'),
      left: i18n.t('free.move_left'),
      right: i18n.t('free.move_right'),
    };

    let html = '';
    for (const dir of directions) {
      const predictions = this.#powerManager.predictForDirection(dir, this.#gm.grid);
      if (predictions.length === 0) continue;

      for (const pred of predictions) {
        const meta = POWER_META[pred.powerType];
        const powerName = i18n.t(meta.nameKey);

        let tilesHtml = '';
        if (pred.destroyedValues && pred.destroyedValues.length > 0) {
          const pills = pred.destroyedValues
            .map((v) => `<span class="fm-power-info-tile fm-t${v}">${v}</span>`)
            .join('');
          tilesHtml = `<div class="fm-power-info-tiles">${pills}</div>`;
        }

        html += `
          <div class="fm-power-info-line">
            <span class="fm-power-info-dir">${dirLabels[dir]}</span>
            <span>${powerName}</span>
            ${tilesHtml}
          </div>`;
      }
    }

    if (html) {
      this.#powerInfoEl.style.display = 'flex';
      this.#powerInfoEl.innerHTML = html;
    } else {
      this.#powerInfoEl.style.display = 'none';
    }
  }

  shutdown() {
    this.#cancelComboTimer();
    this.#gm.shutdown();
    this.#destroyMenuModal();
    this.#gameOverModal?.destroy();
    this.#powerSelectModal?.destroy();
    this.#powerChoiceModal?.destroy();
    this.#adminModal?.destroy();
    this.#powerInfoDom?.destroy();
    this.input.keyboard.off('keydown', this.#handleKey, this);
    this.input.off('pointerdown', this.#onPointerDown, this);
    this.input.off('pointerup', this.#onPointerUp, this);
  }
}
