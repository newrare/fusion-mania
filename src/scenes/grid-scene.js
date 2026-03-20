import Phaser from 'phaser';
import {
  SCENE_KEYS,
  GRID_SIZE,
  ANIM,
  SWIPE_THRESHOLD,
  COMBO_COLORS,
} from '../configs/constants.js';
import { Grid } from '../entities/grid.js';
import { i18n } from '../managers/i18n-manager.js';
import { layout } from '../managers/layout-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { themeManager } from '../managers/theme-manager.js';
import { AnimationManager } from '../managers/animation-manager.js';
import { MenuModal } from '../components/menu-modal.js';
import { GameOverModal } from '../components/game-over-modal.js';
import { addBackground } from '../utils/background.js';

/**
 * Main gameplay scene — 2048 grid rendered with CSS DOM elements.
 */
export class GridScene extends Phaser.Scene {
  /** @type {Grid} */
  #grid;

  /** @type {string} Game mode */
  #mode = 'classic';

  /** @type {HTMLElement | null} Grid container */
  #gridEl = null;

  /** @type {HTMLElement | null} HUD container */
  #hudEl = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #gridDom = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #hudDom = null;

  /** @type {Map<string, HTMLElement>} Tile ID → DOM element */
  #tileElements = new Map();

  /** @type {AnimationManager | null} Manages all tile DOM animations */
  #animator = null;

  /**
   * True while an animation sequence is running.
   * Used by #executeMove to detect whether a snap is needed on the next move.
   */
  #animating = false;

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

  constructor() {
    super({ key: SCENE_KEYS.GRID });
    this.#grid = new Grid();
  }

  /**
   * @param {{ mode?: string, restore?: boolean }} data
   */
  init(data) {
    this.#mode = data?.mode ?? 'classic';
    this.#gameOver = false;
    this.#animating = false;
    this.#tileElements.clear();
    this.#fusions = 0;
    this.#combo = 0;
    this.#comboMax = 0;
    this.#comboScoreStart = 0;
    this.#comboEl = null;
    this.#scoreBonusEl = null;
    this.#comboTimer = null;
    this.#comboBreaking = false;
  }

  create() {
    addBackground(this);
    layout.drawDebugSafeZone(this);
    this.#createHUD();
    this.#createGridContainer();
    this.#startNewGame();
    this.#bindInput();
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

  // ─── GRID CONTAINER ──────────────────────────────
  #createGridContainer() {
    let cellsHtml = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        cellsHtml += `<div class="fm-cell" data-row="${r}" data-col="${c}"></div>`;
      }
    }

    const html = `<div class="fm-grid" id="fm-grid">${cellsHtml}<canvas class="fm-merge-canvas" id="fm-merge-canvas"></canvas></div>`;

    this.#gridDom = this.add.dom(layout.grid.x, layout.grid.y).createFromHTML(html);
    this.#gridDom.setOrigin(0.5);
    this.#gridEl = this.#gridDom.node.querySelector('#fm-grid');

    const mergeCanvas = /** @type {HTMLCanvasElement} */ (this.#gridDom.node.querySelector('#fm-merge-canvas'));
    if (mergeCanvas && this.#gridEl) {
      mergeCanvas.width = this.#gridEl.offsetWidth;
      mergeCanvas.height = this.#gridEl.offsetHeight;
    }
    this.#animator = new AnimationManager(this.#tileElements, this.#gridEl, mergeCanvas);
    this.#animator.startParticleLoop();
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
    this.#animator.clearAllTileElements();
    this.#grid.startClassic();
    this.#renderAllTiles();
    this.#updateHUD();
    this.#updateFusionIndicators();
  }

  // ─── INPUT ───────────────────────────────────────
  #bindInput() {
    // Keyboard
    this.input.keyboard.on('keydown', this.#handleKey, this);

    // Swipe (pointer)
    this.input.on('pointerdown', this.#onPointerDown, this);
    this.input.on('pointerup', this.#onPointerUp, this);
  }

  /** @param {Phaser.Input.Keyboard.Key} event */
  #handleKey = (event) => {
    if (this.#gameOver || this.#menuModal) return;

    /** @type {'up' | 'down' | 'left' | 'right' | null} */
    let direction = null;
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        direction = 'up';
        break;
      case 'ArrowDown':
      case 'KeyS':
        direction = 'down';
        break;
      case 'ArrowLeft':
      case 'KeyA':
        direction = 'left';
        break;
      case 'ArrowRight':
      case 'KeyD':
        direction = 'right';
        break;
      case 'Escape':
        this.#openMenu();
        return;
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
    if (this.#gameOver || this.#menuModal) return;

    const dx = pointer.x - this.#pointerStartX;
    const dy = pointer.y - this.#pointerStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

    /** @type {'up' | 'down' | 'left' | 'right'} */
    let direction;
    if (absDx > absDy) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }

    this.#executeMove(direction);
  };

  // ─── MOVE EXECUTION ──────────────────────────────
  /**
   * Execute a move and animate the result.
   *
   * If an animation is already running, it is interrupted immediately:
   * all tile DOM elements are snapped to their final grid positions, then
   * the new move starts. It is acceptable for the previous animation to be
   * visually incomplete — game state is always fully consistent.
   *
   * @param {'up' | 'down' | 'left' | 'right'} direction
   */
  async #executeMove(direction) {
    this.#clearFusionIndicators();

    const hasMergePossible = this.#grid.hasPossibleMerge();
    const scoreBefore = this.#grid.score;

    // Interrupt any running animation: snap DOM to current grid state instantly
    if (this.#animating) {
      this.#animator.snapToFinalState(
        this.#grid.getAllTiles(),
        (r, c) => this.#cellPosition(r, c),
      );
      // Force a synchronous reflow so the snap takes effect before re-enabling transitions
      void this.#gridEl?.offsetWidth;
      this.#animator.restoreTransitions(ANIM.SLIDE_DURATION);
    }

    const gen = this.#animator.nextGen();
    this.#animating = true;

    const result = this.#grid.move(direction);

    if (!result.moved) {
      this.#animating = false;
      this.#updateFusionIndicators();
      return;
    }

    // Update fusions counter and combo
    if (result.merges.length > 0) {
      this.#fusions += result.merges.length;
      // If a hurt/break animation is playing, finalize that combo immediately
      // so its bonus is applied before the new streak starts from 1.
      if (this.#comboBreaking) {
        this.#endCombo();
      }
      if (this.#combo === 0) {
        this.#comboScoreStart = scoreBefore;
      }
      this.#combo++;
      if (this.#combo > this.#comboMax) {
        this.#comboMax = this.#combo;
      }
      this.#updateComboDisplay(true);
    } else if (hasMergePossible) {
      // A fusion was possible but the move produced no merges → manual combo break
      this.#breakComboWithHurt();
    }
    // else: no merges possible anywhere → combo paused, no change

    // Spawn the new tile in the grid data NOW (before animations) so that
    // if this sequence is interrupted, snapToFinalState will render it correctly.
    const newTile = this.#grid.spawnTile();

    // Phase 1 — slide tiles to new positions
    this.#animator.slidePositions(result, (r, c) => this.#cellPosition(r, c));
    await this.#wait(ANIM.SLIDE_DURATION);
    if (!this.#animator.isCurrent(gen)) return;

    // Phase 2 — merge particles + bounce
    if (result.merges.length > 0) {
      this.#animator.spawnMergeParticles(
        result.merges,
        (r, c) => this.#cellPosition(r, c),
        layout.grid.tileSize,
      );
      await this.#wait(ANIM.MERGE_PARTICLES_DURATION);
      if (!this.#animator.isCurrent(gen)) return;
    }
    this.#animator.processMerges(result.merges, this.#grid.getAllTiles());
    if (result.merges.length > 0) {
      await this.#wait(ANIM.MERGE_DURATION);
      if (!this.#animator.isCurrent(gen)) return;
    }

    // Phase 3 — spawn new tile
    if (newTile) {
      this.#animator.createTileElement(
        newTile,
        true,
        (r, c) => this.#cellPosition(r, c),
        ANIM.SLIDE_DURATION,
      );
      await this.#wait(ANIM.SPAWN_DURATION);
      if (!this.#animator.isCurrent(gen)) return;
    }

    this.#updateHUD();
    this.#updateFusionIndicators();
    this.#animating = false;

    // Check game over
    if (!this.#grid.canMove()) {
      this.#onGameOver();
    }
  }

  // ─── DOM RENDERING ───────────────────────────────

  /**
   * Calculate pixel position for a grid cell.
   * @param {number} row
   * @param {number} col
   * @returns {{ x: number, y: number }}
   */
  #cellPosition(row, col) {
    const { tileSize, gap, padding } = layout.grid;
    const x = padding + col * (tileSize + gap);
    const y = padding + row * (tileSize + gap);
    return { x, y };
  }

  /**
   * Render all current tiles from grid state (initial render / new game).
   */
  #renderAllTiles() {
    for (const tile of this.#grid.getAllTiles()) {
      this.#animator.createTileElement(
        tile,
        true,
        (r, c) => this.#cellPosition(r, c),
        ANIM.SLIDE_DURATION,
      );
    }
  }

  /**
   * Update score/moves display.
   */
  #updateHUD() {
    const scoreEl = this.#hudEl?.querySelector('#fm-score');
    const movesEl = this.#hudEl?.querySelector('#fm-moves');
    const bestEl = this.#hudEl?.querySelector('#fm-best');
    const fusionsEl = this.#hudEl?.querySelector('#fm-fusions');
    if (scoreEl) scoreEl.textContent = String(this.#grid.score);
    if (movesEl) movesEl.textContent = String(this.#grid.moves);
    if (bestEl) {
      const best = Math.max(saveManager.getBestScore(this.#mode), this.#grid.score);
      bestEl.textContent = String(best);
    }
    if (fusionsEl) fusionsEl.textContent = String(this.#fusions);
  }

  // ─── COMBO ───────────────────────────────────────

  /**
   * Update the combo display element.
   * @param {boolean} animate Whether to trigger the bump animation.
   */
  #updateComboDisplay(animate) {
    if (!this.#comboEl) return;
    // Cancel any pending timer and reset all animation state cleanly
    this.#cancelComboTimer();
    this.#comboEl.classList.remove('fm-combo-hurt');
    this.#comboEl.style.removeProperty('animation');
    void this.#comboEl.offsetWidth; // reflow to restart animations
    const color = COMBO_COLORS[(this.#combo - 1) % COMBO_COLORS.length];
    this.#comboEl.style.display = 'block';
    this.#comboEl.style.color = color;
    this.#comboEl.style.textShadow =
      `-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 8px ${color}`;
    this.#comboEl.style.borderColor = color;
    this.#comboEl.innerHTML =
      `<span class="fm-hit-number">${this.#combo}</span><span class="fm-hit-label">HIT</span>`;
    // Both animations target different properties (transform vs opacity) — no conflict
    const fade = 'fm-combo-fade 3s linear forwards';
    if (animate && this.#combo >= 3) {
      this.#comboEl.style.animation = `fm-combo-shake 0.5s ease-in-out both, ${fade}`;
    } else if (animate) {
      this.#comboEl.style.animation = `fm-combo-pop 0.45s ease-out both, ${fade}`;
    } else {
      this.#comboEl.style.animation = fade;
    }
    this.#comboTimer = this.time.delayedCall(3000, () => {
      this.#endCombo();
    });
  }

  /**
   * End the current combo, apply score bonus if comboMax >= 2, and hide the display.
   */
  #endCombo() {
    this.#cancelComboTimer();
    this.#comboBreaking = false;
    if (this.#combo <= 0) return;
    if (this.#comboMax >= 2) {
      const scoreGained = this.#grid.score - this.#comboScoreStart;
      if (scoreGained > 0) {
        const bonus = scoreGained * (this.#comboMax - 1);
        this.#grid.score += bonus;
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

  /**
   * Break the combo with a visual hurt blink then end it.
   * Called when the player voluntarily skipped a possible merge.
   */
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
    // End combo after the hurt animation completes (0.6 s)
    this.#comboTimer = this.time.delayedCall(600, () => {
      this.#endCombo();
    });
  }

  /**
   * Cancel the pending inactivity combo timer, if any.
   */
  #cancelComboTimer() {
    if (this.#comboTimer) {
      this.#comboTimer.remove(false);
      this.#comboTimer = null;
    }
  }

  /**
   * Flash a floating "+N" bonus label over the score box.
   * @param {number} amount
   */
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

    // Auto-save
    saveManager.saveGame({ ...this.#grid.serialize(), mode: this.#mode });

    this.#menuModal = new MenuModal(this, {
      showResume: true,
      onResume: () => {
        this.#destroyMenuModal();
      },
      onClassic: () => {
        this.#destroyMenuModal();
        this.scene.restart({ mode: 'classic' });
      },
      onClose: () => {
        this.#destroyMenuModal();
      },
      onQuit: () => {
        this.#destroyMenuModal();
        saveManager.saveGame({ ...this.#grid.serialize(), mode: this.#mode });
        this.scene.start(SCENE_KEYS.TITLE);
      },
    });
  }

  #destroyMenuModal() {
    if (this.#menuModal) {
      this.#menuModal.destroy();
      this.#menuModal = null;
    }
  }

  #onGameOver() {
    this.#endCombo();
    this.#gameOver = true;
    saveManager.addRanking(this.#mode, this.#grid.score);
    saveManager.clearGame();

    this.#gameOverModal = new GameOverModal(this, {
      score: this.#grid.score,
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

  /**
   * Simple promise-based delay.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  #wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  // ─── IMMINENT FUSION DETECTION ────────────────────

  /**
   * Scan the grid for adjacent same-value tiles and add visual indicators.
   */
  #updateFusionIndicators() {
    this.#animator.clearFusionIndicators();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const tile = this.#grid.cells[r][c];
        if (!tile) continue;
        if (c + 1 < GRID_SIZE) {
          const right = this.#grid.cells[r][c + 1];
          if (right && right.value === tile.value) {
            this.#animator.addFusionClass(tile.id, 'fm-fuse-right');
            this.#animator.addFusionClass(right.id, 'fm-fuse-left');
          }
        }
        if (r + 1 < GRID_SIZE) {
          const bottom = this.#grid.cells[r + 1][c];
          if (bottom && bottom.value === tile.value) {
            this.#animator.addFusionClass(tile.id, 'fm-fuse-down');
            this.#animator.addFusionClass(bottom.id, 'fm-fuse-up');
          }
        }
      }
    }
  }

  /**
   * Remove all imminent-fusion classes from tile elements.
   */
  #clearFusionIndicators() {
    this.#animator.clearFusionIndicators();
  }

  shutdown() {
    this.#cancelComboTimer();
    this.#animator?.stopParticleLoop();
    this.#animator?.clearAllTileElements();
    this.#destroyMenuModal();
    this.#gameOverModal?.destroy();
    this.input.keyboard.off('keydown', this.#handleKey, this);
    this.input.off('pointerdown', this.#onPointerDown, this);
    this.input.off('pointerup', this.#onPointerUp, this);
  }
}
