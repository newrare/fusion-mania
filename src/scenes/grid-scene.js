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

  /** @type {boolean} Lock input during animations */
  #animating = false;

  /** @type {boolean} Game over state */
  #gameOver = false;

  /** @type {MenuModal | null} */
  #menuModal = null;

  /** @type {GameOverModal | null} */
  #gameOverModal = null;

  /** @type {HTMLCanvasElement | null} Canvas for merge particles */
  #mergeCanvas = null;

  /** @type {CanvasRenderingContext2D | null} */
  #mergeCtx = null;

  /** @type {Array<{x:number,y:number,vx:number,vy:number,tx:number,ty:number,r:number,life:number,decay:number,rgb:string}>} */
  #mergeParticles = [];

  /** @type {number | null} */
  #mergeRaf = null;

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

    this.#mergeCanvas = /** @type {HTMLCanvasElement} */ (this.#gridDom.node.querySelector('#fm-merge-canvas'));
    if (this.#mergeCanvas && this.#gridEl) {
      this.#mergeCanvas.width = this.#gridEl.offsetWidth;
      this.#mergeCanvas.height = this.#gridEl.offsetHeight;
      this.#mergeCtx = this.#mergeCanvas.getContext('2d');
    }
    this.#startMergeParticleLoop();
  }

  // ─── GAME FLOW ───────────────────────────────────
  #startNewGame() {
    this.#clearAllTileElements();
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

    // Clear imminent-fusion indicators before move
    this.#clearFusionIndicators();

    const result = this.#grid.move(direction);

    if (!result.moved) {
      this.#animating = false;
      this.#updateFusionIndicators();
      return;
    }

    // Animate slides + merges using CSS transitions
    this.#updateTilePositions(result);

    // Wait for slide animation
    await this.#wait(ANIM.SLIDE_DURATION);

    // Process merges: spawn particles, update classes, play merge anim
    if (result.merges.length > 0) {
      this.#spawnMergeParticles(result.merges);
      await this.#wait(ANIM.MERGE_PARTICLES_DURATION);
    }
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
    // Use left/top for positioning — transform stays free for animations
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
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
   * Update positions of moved/merged tiles (all use left/top transition).
   * @param {{ movements: { tile: import('../entities/tile.js').Tile, fromRow: number, fromCol: number }[], merges: { tile: import('../entities/tile.js').Tile, fromRow: number, fromCol: number, consumedId: string }[] }} result
   */
  #updateTilePositions(result) {
    // Slide regular movements
    for (const { tile } of result.movements) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      const { x, y } = this.#cellPosition(tile.row, tile.col);
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
    }

    // Slide both the survivor AND the consumed tile toward the merge target
    for (const { tile, consumedId } of result.merges) {
      const { x, y } = this.#cellPosition(tile.row, tile.col);

      // Move the surviving tile (may already be at target, transition is instant)
      const survivorEl = this.#tileElements.get(tile.id);
      if (survivorEl) {
        survivorEl.style.left = `${x}px`;
        survivorEl.style.top  = `${y}px`;
      }

      // Slide the consumed tile to the merge target so it visually collides
      const consumedEl = this.#tileElements.get(consumedId);
      if (consumedEl) {
        consumedEl.style.left = `${x}px`;
        consumedEl.style.top  = `${y}px`;
      }
    }
  }

  /**
   * After slide: fade out consumed tiles, update survivor classes, play merge bounce.
   * @param {{ tile: import('../entities/tile.js').Tile, fromRow: number, fromCol: number, consumedId: string }[]} merges
   */
  #processMerges(merges) {
    const activeTileIds = new Set(this.#grid.getAllTiles().map((t) => t.id));

    for (const { tile, consumedId } of merges) {
      // Play fade-out on the consumed tile, remove it when done
      const consumedEl = this.#tileElements.get(consumedId);
      if (consumedEl) {
        consumedEl.classList.add('fm-tile--consumed');
        consumedEl.addEventListener('animationend', () => {
          consumedEl.remove();
        }, { once: true });
        this.#tileElements.delete(consumedId);
      }

      // Update surviving tile value + play bounce
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      el.className = `fm-tile fm-t${tile.value} fm-tile--merge`;
      const valEl = el.querySelector('.fm-val');
      if (valEl) valEl.textContent = String(tile.value);
      el.addEventListener('animationend', () => {
        el.classList.remove('fm-tile--merge');
      }, { once: true });
    }

    // Remove any other orphaned tile elements (safety net)
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

  // ─── MERGE PARTICLES ────────────────────────────

  /** Continuously draw merge particles on the canvas overlay */
  #startMergeParticleLoop() {
    const draw = () => {
      this.#mergeRaf = requestAnimationFrame(draw);
      const ctx = this.#mergeCtx;
      const cvs = this.#mergeCanvas;
      if (!ctx || !cvs) return;

      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const particles = this.#mergeParticles;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy) + 0.001;
        const force = Math.min(0.24, 5.0 / (dist + 3));
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0 || dist < 4) {
          particles.splice(i, 1);
          continue;
        }
        const a = Math.min(p.life, 1);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
        g.addColorStop(0, `rgba(${p.rgb},${a})`);
        g.addColorStop(1, `rgba(${p.rgb},0)`);
        ctx.beginPath();
        ctx.fillStyle = g;
        ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    this.#mergeRaf = requestAnimationFrame(draw);
  }

  /**
   * Burst particles at the position of each merge target.
   * @param {{ tile: import('../entities/tile.js').Tile, fromRow: number, fromCol: number }[]} merges
   */
  #spawnMergeParticles(merges) {
    const { tileSize, gap, padding } = layout.grid;
    for (const { tile } of merges) {
      const cx = padding + tile.col * (tileSize + gap) + tileSize / 2;
      const cy = padding + tile.row * (tileSize + gap) + tileSize / 2;
      const count = 28;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 0.4 + Math.random() * 2.5;
        this.#mergeParticles.push({
          x: cx + (Math.random() - 0.5) * tileSize * 0.8,
          y: cy + (Math.random() - 0.5) * tileSize * 0.8,
          vx: Math.cos(angle) * spd * (Math.random() < 0.5 ? 0.3 : 1),
          vy: Math.sin(angle) * spd * (Math.random() < 0.5 ? 0.3 : 1),
          tx: cx,
          ty: cy,
          r: 1.2 + Math.random() * 2.5,
          life: 0.7 + Math.random() * 0.3,
          decay: 0.008 + Math.random() * 0.014,
          rgb: i < count / 2 ? '250,204,21' : '200,160,255',
        });
      }
    }
  }

  shutdown() {
    if (this.#mergeRaf) {
      cancelAnimationFrame(this.#mergeRaf);
      this.#mergeRaf = null;
    }
    this.#mergeParticles.length = 0;
    this.#destroyMenuModal();
    this.#gameOverModal?.destroy();
    this.#clearAllTileElements();
    this.input.keyboard.off('keydown', this.#handleKey, this);
    this.input.off('pointerdown', this.#onPointerDown, this);
    this.input.off('pointerup', this.#onPointerUp, this);
  }
}
