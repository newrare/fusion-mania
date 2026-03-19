import Phaser from 'phaser';
import {
  SCENE_KEYS,
  GRID_SIZE,
  ANIM,
  SWIPE_THRESHOLD,
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
        <div class="fm-score-box">
          <span class="fm-score-label">${i18n.t('game.score')}</span>
          <span class="fm-score-value" id="fm-score">0</span>
        </div>
        <div class="fm-score-box">
          <span class="fm-score-label">${i18n.t('game.best')}</span>
          <span class="fm-score-value" id="fm-best">${saveManager.getBestScore(this.#mode)}</span>
        </div>
        <div class="fm-score-box">
          <span class="fm-score-label">${i18n.t('game.moves')}</span>
          <span class="fm-score-value" id="fm-moves">0</span>
        </div>
        <div class="fm-menu-btn" id="fm-menu-btn">☰</div>
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
    if (scoreEl) scoreEl.textContent = String(this.#grid.score);
    if (movesEl) movesEl.textContent = String(this.#grid.moves);
    if (bestEl) {
      const best = Math.max(saveManager.getBestScore(this.#mode), this.#grid.score);
      bestEl.textContent = String(best);
    }
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

  /** CSS classes for imminent-fusion glow/pull */
  static #FUSE_CLASSES = ['fm-fuse-right', 'fm-fuse-left', 'fm-fuse-down', 'fm-fuse-up'];

  /**
   * Scan the grid for adjacent same-value tiles and add visual indicators.
   */
  #updateFusionIndicators() {
    this.#clearFusionIndicators();

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const tile = this.#grid.cells[r][c];
        if (!tile) continue;

        // Check right neighbor
        if (c + 1 < GRID_SIZE) {
          const right = this.#grid.cells[r][c + 1];
          if (right && right.value === tile.value) {
            this.#tileElements.get(tile.id)?.classList.add('fm-fuse-right');
            this.#tileElements.get(right.id)?.classList.add('fm-fuse-left');
          }
        }
        // Check bottom neighbor
        if (r + 1 < GRID_SIZE) {
          const bottom = this.#grid.cells[r + 1][c];
          if (bottom && bottom.value === tile.value) {
            this.#tileElements.get(tile.id)?.classList.add('fm-fuse-down');
            this.#tileElements.get(bottom.id)?.classList.add('fm-fuse-up');
          }
        }
      }
    }
  }

  /**
   * Remove all imminent-fusion classes from tile elements.
   */
  #clearFusionIndicators() {
    for (const el of this.#tileElements.values()) {
      el.classList.remove(...GridScene.#FUSE_CLASSES);
    }
  }

  shutdown() {
    this.#animator?.stopParticleLoop();
    this.#animator?.clearAllTileElements();
    this.#destroyMenuModal();
    this.#gameOverModal?.destroy();
    this.input.keyboard.off('keydown', this.#handleKey, this);
    this.input.off('pointerdown', this.#onPointerDown, this);
    this.input.off('pointerup', this.#onPointerUp, this);
  }
}
