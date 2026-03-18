import Phaser from 'phaser';
import {
  SCENE_KEYS,
  GAME_WIDTH,
  GAME_HEIGHT,
  GRID_SIZE,
  TILE_SIZE,
  GRID_GAP,
  GRID_PADDING,
  ANIM,
  SWIPE_THRESHOLD,
} from '../configs/constants.js';
import { Grid } from '../entities/grid.js';
import { i18n } from '../managers/i18n-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { MenuModal } from '../components/menu-modal.js';
import { GameOverModal } from '../components/game-over-modal.js';

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

  /** @type {boolean} Lock input during animations */
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

    this.#hudDom = this.add.dom(GAME_WIDTH / 2, 0).createFromHTML(html);
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
    // Create the grid with empty cells
    let cellsHtml = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        cellsHtml += `<div class="fm-cell" data-row="${r}" data-col="${c}"></div>`;
      }
    }

    const html = `<div class="fm-grid" id="fm-grid">${cellsHtml}</div>`;

    const gridY = GAME_HEIGHT * 0.45;
    this.#gridDom = this.add.dom(GAME_WIDTH / 2, gridY).createFromHTML(html);
    this.#gridDom.setOrigin(0.5);
    this.#gridEl = this.#gridDom.node.querySelector('#fm-grid');
  }

  // ─── GAME FLOW ───────────────────────────────────
  #startNewGame() {
    this.#clearAllTileElements();
    this.#grid.startClassic();
    this.#renderAllTiles();
    this.#updateHUD();
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
    if (this.#animating || this.#gameOver || this.#menuModal) return;

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
    if (this.#animating || this.#gameOver || this.#menuModal) return;

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
   * @param {'up' | 'down' | 'left' | 'right'} direction
   */
  async #executeMove(direction) {
    if (this.#animating) return;
    this.#animating = true;

    const result = this.#grid.move(direction);

    if (!result.moved) {
      this.#animating = false;
      return;
    }

    // Animate slides + merges using CSS transitions
    this.#updateTilePositions(result);

    // Wait for slide animation
    await this.#wait(ANIM.SLIDE_DURATION);

    // Process merges: update classes, play merge anim
    this.#processMerges(result.merges);

    // Wait for merge animation
    if (result.merges.length > 0) {
      await this.#wait(ANIM.MERGE_DURATION);
    }

    // Spawn new tile
    const newTile = this.#grid.spawnTile();
    if (newTile) {
      this.#createTileElement(newTile, true);
    }

    await this.#wait(ANIM.SPAWN_DURATION);

    this.#updateHUD();
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
    const x = GRID_PADDING + col * (TILE_SIZE + GRID_GAP);
    const y = GRID_PADDING + row * (TILE_SIZE + GRID_GAP);
    return { x, y };
  }

  /**
   * Create a DOM element for a tile.
   * @param {import('../entities/tile.js').Tile} tile
   * @param {boolean} [animate=false] Whether to play spawn animation
   */
  #createTileElement(tile, animate = false) {
    const el = document.createElement('div');
    el.className = `fm-tile fm-t${tile.value}`;
    if (animate) el.classList.add('fm-tile--spawn');

    el.innerHTML = `<span class="fm-val">${tile.value}</span>`;
    el.dataset.tileId = tile.id;

    const { x, y } = this.#cellPosition(tile.row, tile.col);
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.setProperty('--slide-duration', `${ANIM.SLIDE_DURATION}ms`);

    if (animate) {
      el.addEventListener('animationend', () => {
        el.classList.remove('fm-tile--spawn');
      }, { once: true });
    }

    this.#gridEl?.appendChild(el);
    this.#tileElements.set(tile.id, el);
  }

  /**
   * Render all current tiles from grid state.
   */
  #renderAllTiles() {
    for (const tile of this.#grid.getAllTiles()) {
      this.#createTileElement(tile, true);
    }
  }

  /**
   * Update positions of moved tiles.
   * @param {{ movements: { tile: import('../entities/tile.js').Tile, fromRow: number, fromCol: number }[], merges: { tile: import('../entities/tile.js').Tile, fromRow: number, fromCol: number }[] }} result
   */
  #updateTilePositions(result) {
    // Move slid tiles
    for (const { tile } of result.movements) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      const { x, y } = this.#cellPosition(tile.row, tile.col);
      el.style.transform = `translate(${x}px, ${y}px)`;
    }

    // Move merged tiles toward merge target
    for (const { tile, fromRow, fromCol } of result.merges) {
      // The "tile" here is the surviving tile after merge — we need to move
      // the consumed tile's element toward it. But since grid.move() already
      // removed the consumed tile, we need the surviving element.
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      const { x, y } = this.#cellPosition(tile.row, tile.col);
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  /**
   * After slide animation: update merge tile values and play merge animation.
   * @param {{ tile: import('../entities/tile.js').Tile, fromRow: number, fromCol: number }[]} merges
   */
  #processMerges(merges) {
    for (const { tile } of merges) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;

      // Update value and classes
      el.className = `fm-tile fm-t${tile.value} fm-tile--merge`;
      const valEl = el.querySelector('.fm-val');
      if (valEl) valEl.textContent = String(tile.value);

      el.addEventListener('animationend', () => {
        el.classList.remove('fm-tile--merge');
      }, { once: true });
    }

    // Remove consumed tiles (tiles that no longer exist in the grid)
    const activeTileIds = new Set(this.#grid.getAllTiles().map((t) => t.id));
    for (const [id, el] of this.#tileElements) {
      if (!activeTileIds.has(id)) {
        el.remove();
        this.#tileElements.delete(id);
      }
    }
  }

  /**
   * Remove all tile DOM elements.
   */
  #clearAllTileElements() {
    for (const el of this.#tileElements.values()) {
      el.remove();
    }
    this.#tileElements.clear();
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

  shutdown() {
    this.#destroyMenuModal();
    this.#gameOverModal?.destroy();
    this.#clearAllTileElements();
    this.input.keyboard.off('keydown', this.#handleKey, this);
    this.input.off('pointerdown', this.#onPointerDown, this);
    this.input.off('pointerup', this.#onPointerUp, this);
  }
}
