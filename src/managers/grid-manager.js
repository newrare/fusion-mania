import { Grid } from '../entities/grid.js';
import { Tile } from '../entities/tile.js';
import { AnimationManager } from './animation-manager.js';
import { TileRenderer } from '../components/tile-renderer.js';
import { GRID_SIZE, ANIM } from '../configs/constants.js';
import { layout } from './layout-manager.js';

/**
 * Manages the 4×4 grid DOM, tile rendering, animation sequencing,
 * and imminent-fusion indicators. Extracted from GameScene to keep
 * the scene file focused on game flow, input, and UI.
 */
export class GridManager {
  /** @type {Grid} */
  #grid;

  /** @type {HTMLElement | null} */
  #gridEl = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #gridDom = null;

  /** @type {Map<string, HTMLElement>} tile.id → DOM element */
  #tileElements = new Map();

  /** @type {AnimationManager | null} */
  #animator = null;

  /** @type {boolean} True while an animation sequence is running */
  #animating = false;

  /** @type {HTMLElement | null} Global wind overlay element on the grid */
  #windOverlayEl = null;

  /** @type {string | null} Current wind direction for dedup */
  #currentWindDir = null;

  /** @type {number} Current wind turns for dedup */
  #currentWindTurns = -1;

  constructor() {
    this.#grid = new Grid();
  }

  // ─── Public accessors ────────────────────────────

  /** @returns {Grid} */
  get grid() {
    return this.#grid;
  }

  /** @returns {HTMLElement | null} */
  get gridEl() {
    return this.#gridEl;
  }

  /** @returns {boolean} */
  get animating() {
    return this.#animating;
  }

  set animating(val) {
    this.#animating = val;
  }

  /** @returns {Map<string, HTMLElement>} */
  get tileElements() {
    return this.#tileElements;
  }

  // ─── Grid container ──────────────────────────────

  /**
   * Create the grid DOM container and attach it to the scene.
   * @param {Phaser.Scene} scene
   * @returns {{ gridEl: HTMLElement, mergeCanvas: HTMLCanvasElement | null }}
   */
  createContainer(scene) {
    let cellsHtml = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        cellsHtml += `<div class="fm-cell" data-row="${r}" data-col="${c}"></div>`;
      }
    }

    const html = `<div class="fm-grid" id="fm-grid">${cellsHtml}<canvas class="fm-merge-canvas" id="fm-merge-canvas"></canvas></div>`;

    this.#gridDom = scene.add.dom(layout.grid.x, layout.grid.y).createFromHTML(html);
    this.#gridDom.setOrigin(0.5);
    this.#gridEl = this.#gridDom.node.querySelector('#fm-grid');

    const mergeCanvas = /** @type {HTMLCanvasElement} */ (
      this.#gridDom.node.querySelector('#fm-merge-canvas')
    );
    if (mergeCanvas && this.#gridEl) {
      mergeCanvas.width = this.#gridEl.offsetWidth;
      mergeCanvas.height = this.#gridEl.offsetHeight;
    }

    this.#animator = new AnimationManager(this.#tileElements, this.#gridEl, mergeCanvas);
    this.#animator.startParticleLoop();

    return { gridEl: this.#gridEl, mergeCanvas };
  }

  // ─── Cell position ───────────────────────────────

  /**
   * Calculate pixel position for a grid cell.
   * @param {number} row
   * @param {number} col
   * @returns {{ x: number, y: number }}
   */
  cellPosition(row, col) {
    const { tileSize, gap, padding } = layout.grid;
    const x = padding + col * (tileSize + gap);
    const y = padding + row * (tileSize + gap);
    return { x, y };
  }

  // ─── Game flow ───────────────────────────────────

  /**
   * Start a new game: reset grid and render initial tiles.
   */
  startNewGame() {
    this.#animator.clearAllTileElements();
    this.#grid.startClassic();
    this.renderAllTiles();
  }

  /**
   * Render all tiles currently in the grid (initial / restart).
   */
  renderAllTiles() {
    for (const tile of this.#grid.getAllTiles()) {
      this.#animator.createTileElement(
        tile,
        true,
        (r, c) => this.cellPosition(r, c),
        ANIM.SLIDE_DURATION,
      );
    }
  }

  // ─── Move + animation sequence ───────────────────

  /**
   * Play a short directional bump on all tiles (blocked-move feedback).
   * @param {'up' | 'down' | 'left' | 'right'} direction
   */
  bumpTiles(direction) {
    this.#animator.bumpInDirection(direction);
  }

  /**
   * Snap the DOM to the true grid state (for interrupting an animation).
   */
  snapToGrid() {
    this.#animator.snapToFinalState(this.#grid.getAllTiles(), (r, c) => this.cellPosition(r, c));
    void this.#gridEl?.offsetWidth;
    this.#animator.restoreTransitions(ANIM.SLIDE_DURATION);
  }

  /**
   * Execute a move, animate the result, and return move metadata.
   *
   * Only handles grid logic + animation. Combo, power, and HUD logic
   * remain in GameScene.
   *
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @param {(ms: number) => Promise<void>} waitFn — Phaser-aware delay
   * @param {(() => void) | null} [onSlideStart] — called synchronously once tile slides begin
   * @param {((merges: object[]) => void) | null} [onMergeStart] — called just before the merge bounce animation, receives the merges array
   * @returns {Promise<{
   *   moved: boolean,
   *   merges: object[],
   *   expelled: Tile[],
   *   newTile: Tile | null,
   *   hasMergePossible: boolean,
   *   scoreBefore: number,
   *   cancelled: boolean
   * } | null>}
   */
  async executeMove(direction, waitFn, onSlideStart = null, onMergeStart = null) {
    const hasMergePossible = this.#grid.hasPossibleMerge();
    const scoreBefore = this.#grid.score;

    if (this.#animating) {
      this.snapToGrid();
    }

    const gen = this.#animator.nextGen();
    this.#animating = true;

    const result = this.#grid.move(direction);

    if (!result.moved) {
      this.#animating = false;
      return {
        moved: false,
        merges: [],
        expelled: [],
        newTile: null,
        hasMergePossible,
        scoreBefore,
        cancelled: false,
      };
    }

    // Capture move number synchronously — reading it after an await would return
    // a stale value if another move ran while this one was animating.
    const moveNumber = this.#grid.moves;

    // Spawn new tile in grid data before animations
    const newTile = this.#grid.spawnTile();

    // Phase 1 — slide + expel-to-edge (run concurrently, same duration)
    this.#animator.slideExpelledToEdge(result.expelled, direction, layout.grid.tileSize);
    this.#animator.slidePositions(result, (r, c) => this.cellPosition(r, c));
    onSlideStart?.();
    await waitFn(ANIM.SLIDE_DURATION);
    // Remove expelled tiles after their screen-exit animation completes
    for (const tile of result.expelled) {
      this.removeTileById(tile.id);
    }
    if (!this.#animator.isCurrent(gen))
      return {
        moved: true,
        merges: result.merges,
        expelled: result.expelled,
        newTile,
        hasMergePossible,
        scoreBefore,
        moveNumber,
        cancelled: true,
      };

    // Phase 2 — merge particles + bounce
    if (result.merges.length > 0) {
      this.#animator.spawnMergeParticles(
        result.merges,
        (r, c) => this.cellPosition(r, c),
        layout.grid.tileSize,
      );
      await waitFn(ANIM.MERGE_PARTICLES_DURATION);
      if (!this.#animator.isCurrent(gen))
        return {
          moved: true,
          merges: result.merges,
          expelled: result.expelled,
          newTile,
          hasMergePossible,
          scoreBefore,
          moveNumber,
          cancelled: true,
        };
    }
    onMergeStart?.(result.merges);
    this.#animator.processMerges(result.merges, this.#grid.getAllTiles());
    if (result.merges.length > 0) {
      await waitFn(ANIM.MERGE_DURATION);
      // Explicitly remove consumed elements — animationend is not reliable enough
      // when a spawn animation is concurrently running on the same element.
      this.#animator.clearConsumedElements();
      if (!this.#animator.isCurrent(gen))
        return {
          moved: true,
          merges: result.merges,
          expelled: result.expelled,
          newTile,
          hasMergePossible,
          scoreBefore,
          moveNumber,
          cancelled: true,
        };
    }

    // Phase 3 — spawn new tile
    if (newTile) {
      this.#animator.createTileElement(
        newTile,
        true,
        (r, c) => this.cellPosition(r, c),
        ANIM.SLIDE_DURATION,
      );
      await waitFn(ANIM.SPAWN_DURATION);
      if (!this.#animator.isCurrent(gen))
        return {
          moved: true,
          merges: result.merges,
          expelled: result.expelled,
          newTile,
          hasMergePossible,
          scoreBefore,
          moveNumber,
          cancelled: true,
        };
    }

    return {
      moved: true,
      merges: result.merges,
      expelled: result.expelled,
      newTile,
      hasMergePossible,
      scoreBefore,
      moveNumber,
      cancelled: false,
    };
  }

  // ─── Power destruction helpers ───────────────────

  /**
   * Apply danger overlay to tiles about to be destroyed.
   * @param {Tile[]} tiles
   */
  applyDangerOverlay(tiles) {
    for (const tile of tiles) {
      const el = this.#tileElements.get(tile.id);
      if (el) TileRenderer.applyDanger(el);
    }
  }

  /**
   * Launch the FUSEAU fireball(s) and staggered ZAP destruction animation
   * for a fire power. Call this instead of `applyDangerOverlay`/`removeTiles`
   * for FIRE_H, FIRE_V, and FIRE_X powers.
   *
   * @param {string} powerType  POWER_TYPES.FIRE_H / FIRE_V / FIRE_X
   * @param {import('../entities/tile.js').Tile} targetTile  The surviving target tile
   * @param {import('../entities/tile.js').Tile[]} destroyedTiles
   */
  playFireAnimation(powerType, targetTile, destroyedTiles) {
    for (const tile of destroyedTiles) {
      const el = this.#tileElements.get(tile.id);
      if (el) TileRenderer.clearStateOnly(el);
    }
    this.#animator?.playFireAnimation(
      powerType,
      targetTile,
      destroyedTiles,
      (r, c) => this.cellPosition(r, c),
      layout.grid.tileSize,
    );
  }

  /**
   * Play lightning strike animations for 1–3 column strikes.
   * @param {{ col: number, row: number, tile: import('../entities/tile.js').Tile | null }[]} strikes
   */
  playLightningAnimation(strikes) {
    this.#animator?.playLightningAnimation(
      strikes,
      (r, c) => this.cellPosition(r, c),
      layout.grid.tileSize,
      ANIM.LIGHTNING_ANIM_DURATION,
      ANIM.LIGHTNING_STRIKE_DELAY,
    );
  }

  /**
   * Play the bomb explosion scene and tile destruction animations.
   * @param {import('../entities/tile.js').Tile} targetTile  Emitter tile
   * @param {import('../entities/tile.js').Tile[]} destroyedTiles  All tiles being destroyed
   */
  playBombAnimation(targetTile, destroyedTiles) {
    for (const tile of destroyedTiles) {
      const el = this.#tileElements.get(tile.id);
      if (el) TileRenderer.clearStateOnly(el);
    }
    this.#animator?.playBombAnimation(
      targetTile,
      destroyedTiles,
      (r, c) => this.cellPosition(r, c),
      layout.grid.tileSize,
    );
  }

  /**
   * Play the nuclear full-screen blast and tile fly-out animations.
   * @param {import('../entities/tile.js').Tile[]} destroyedTiles
   */
  playNuclearAnimation(destroyedTiles) {
    for (const tile of destroyedTiles) {
      const el = this.#tileElements.get(tile.id);
      if (el) TileRenderer.clearStateOnly(el);
    }
    this.#animator?.playNuclearAnimation(destroyedTiles);
  }

  /**
   * Animate a cross-arc swap for the Teleport power.
   * DOM elements must still be at their pre-swap CSS positions when called.
   *
   * @param {import('../entities/tile.js').Tile} tileA  Post-swap tile (was at oldA)
   * @param {import('../entities/tile.js').Tile} tileB  Post-swap tile (was at oldB)
   * @param {{ row: number, col: number }} oldA  Pre-swap position of tileA
   * @param {{ row: number, col: number }} oldB  Pre-swap position of tileB
   * @param {number} duration  ms
   * @returns {Promise<void>}
   */
  playTeleportAnimation(tileA, tileB, oldA, oldB, duration) {
    return (
      this.#animator?.playTeleportAnimation(
        tileA,
        tileB,
        oldA,
        oldB,
        (r, c) => this.cellPosition(r, c),
        duration,
      ) ?? Promise.resolve()
    );
  }

  /**
   * Remove destroyed tiles from the DOM.
   * @param {Tile[]} tiles
   */
  removeTiles(tiles) {
    for (const tile of tiles) {
      this.removeTileById(tile.id);
    }
  }

  /**
   * Remove a single tile DOM element by its id.
   * @param {string} id
   */
  removeTileById(id) {
    const el = this.#tileElements.get(id);
    if (el) {
      el.remove();
      this.#tileElements.delete(id);
    }
  }

  // ─── DOM sync ────────────────────────────────────

  /**
   * Sync tile DOM elements with grid truth.
   * Removes orphaned elements and applies visual state.
   * @param {string | null} [windDirection]
   * @param {Set<string> | null} [preserveIds]
   * @param {number} [windTurns]
   */
  syncTileDom(windDirection = null, preserveIds = null, windTurns = 0) {
    this.#updateWindOverlay(windDirection, windTurns);
    const gridTileIds = new Set(this.#grid.getAllTiles().map((t) => t.id));

    for (const [id, el] of this.#tileElements) {
      if (!gridTileIds.has(id) && !(preserveIds && preserveIds.has(id))) {
        el.remove();
        this.#tileElements.delete(id);
      }
    }

    for (const tile of this.#grid.getAllTiles()) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      TileRenderer.applyState(el, tile, { windDirection });
    }
  }

  // ─── Wind overlay ────────────────────────────────

  /** Maps blocked direction → blow direction (visual CSS class suffix) */
  static #WIND_CSS_DIR = { up: 'down', down: 'up', left: 'right', right: 'left' };

  /** Streak layouts per intensity level. Counts: strong=12, medium=9, weak=6. */
  static #WIND_STREAKS = {
    strong: [
      { pos: '4%', dur: '0.78s', dl: '0s', thick: '2px', len: '54%' },
      { pos: '12%', dur: '0.68s', dl: '-0.28s', thick: '1.5px', len: '44%' },
      { pos: '20%', dur: '0.85s', dl: '-0.55s', thick: '3.5px', len: '64%' },
      { pos: '29%', dur: '0.70s', dl: '-0.12s', thick: '1.5px', len: '42%' },
      { pos: '37%', dur: '0.82s', dl: '-0.78s', thick: '2.5px', len: '56%' },
      { pos: '46%', dur: '0.72s', dl: '-0.42s', thick: '2px', len: '50%' },
      { pos: '54%', dur: '0.80s', dl: '-0.90s', thick: '1.5px', len: '46%' },
      { pos: '62%', dur: '0.66s', dl: '-0.20s', thick: '3px', len: '60%' },
      { pos: '71%', dur: '0.76s', dl: '-0.62s', thick: '2px', len: '50%' },
      { pos: '80%', dur: '0.63s', dl: '-1.00s', thick: '1.5px', len: '44%' },
      { pos: '88%', dur: '0.83s', dl: '-0.35s', thick: '2.5px', len: '54%' },
      { pos: '95%', dur: '0.71s', dl: '-0.75s', thick: '1.5px', len: '40%' },
    ],
    medium: [
      { pos: '5%', dur: '0.95s', dl: '0s', thick: '2px', len: '50%' },
      { pos: '17%', dur: '0.85s', dl: '-0.45s', thick: '2.5px', len: '58%' },
      { pos: '28%', dur: '1.05s', dl: '-0.22s', thick: '2px', len: '48%' },
      { pos: '40%', dur: '0.90s', dl: '-0.75s', thick: '3px', len: '54%' },
      { pos: '52%', dur: '1.00s', dl: '-1.10s', thick: '2px', len: '52%' },
      { pos: '63%', dur: '0.88s', dl: '-0.32s', thick: '2.5px', len: '46%' },
      { pos: '74%', dur: '0.95s', dl: '-0.60s', thick: '2px', len: '56%' },
      { pos: '84%', dur: '0.82s', dl: '-0.88s', thick: '1.5px', len: '44%' },
      { pos: '93%', dur: '1.02s', dl: '-0.18s', thick: '2px', len: '50%' },
    ],
    weak: [
      { pos: '10%', dur: '1.30s', dl: '0s', thick: '2px', len: '46%' },
      { pos: '26%', dur: '1.50s', dl: '-0.55s', thick: '2.5px', len: '54%' },
      { pos: '44%', dur: '1.35s', dl: '-1.10s', thick: '2px', len: '48%' },
      { pos: '60%', dur: '1.45s', dl: '-0.30s', thick: '2.5px', len: '52%' },
      { pos: '75%', dur: '1.25s', dl: '-0.80s', thick: '2px', len: '44%' },
      { pos: '90%', dur: '1.40s', dl: '-1.30s', thick: '2px', len: '50%' },
    ],
  };

  /**
   * Create or remove the wind overlay on the grid element.
   * No-ops if wind direction and turns have not changed.
   * @param {string | null} windDir — blocked direction (up/down/left/right) or null
   * @param {number} windTurns — remaining wind turns
   */
  #updateWindOverlay(windDir, windTurns) {
    if (windDir === this.#currentWindDir && windTurns === this.#currentWindTurns) return;
    this.#currentWindDir = windDir;
    this.#currentWindTurns = windTurns;
    if (this.#windOverlayEl) {
      this.#windOverlayEl.remove();
      this.#windOverlayEl = null;
    }
    if (!windDir || !this.#gridEl) return;
    const cssDir = GridManager.#WIND_CSS_DIR[windDir] ?? windDir;
    const intensity = windTurns >= 3 ? 'strong' : windTurns === 2 ? 'medium' : 'weak';
    const overlay = document.createElement('div');
    overlay.className = `fm-wind-overlay fm-wind-overlay--${cssDir} fm-wind-overlay--${intensity}`;
    for (const s of GridManager.#WIND_STREAKS[intensity]) {
      const streak = document.createElement('span');
      streak.className = 'fm-wind-streak';
      streak.style.cssText = `--fm-wpos:${s.pos};--fm-wdur:${s.dur};--fm-wdl:${s.dl};--fm-wthick:${s.thick};--fm-wlen:${s.len}`;
      overlay.appendChild(streak);
    }
    this.#gridEl.appendChild(overlay);
    this.#windOverlayEl = overlay;
  }

  // ─── Fusion indicators ───────────────────────────

  /**
   * Scan the grid for adjacent same-value tiles and add visual indicators.
   */
  updateFusionIndicators() {
    this.#animator.clearFusionIndicators();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const tile = this.#grid.cells[r][c];
        if (!tile) continue;
        if (c + 1 < GRID_SIZE) {
          const right = this.#grid.cells[r][c + 1];
          if (right && right.value === tile.value) {
            this.#animator.addFusionArc(tile.id, right.id, 'h');
          }
        }
        if (r + 1 < GRID_SIZE) {
          const bottom = this.#grid.cells[r + 1][c];
          if (bottom && bottom.value === tile.value) {
            this.#animator.addFusionArc(tile.id, bottom.id, 'v');
          }
        }
      }
    }
  }

  /** Remove all fusion indicator classes. */
  clearFusionIndicators() {
    this.#animator.clearFusionIndicators();
  }

  // ─── Admin helpers ───────────────────────────────

  /**
   * Clear all tiles from grid and DOM.
   */
  clearGrid() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        this.#grid.cells[r][c] = null;
      }
    }
    this.#animator.clearAllTileElements();
  }

  /**
   * Add a tile with a specific value to a random empty cell.
   * @param {number} value
   * @returns {Tile | null}
   */
  addTileValue(value) {
    const empty = this.#grid.getEmptyCells();
    if (!empty.length) return null;
    const { row, col } = empty[Math.floor(Math.random() * empty.length)];
    const tile = new Tile(value, row, col);
    this.#grid.cells[row][col] = tile;
    this.#animator.createTileElement(
      tile,
      true,
      (r, c) => this.cellPosition(r, c),
      ANIM.SLIDE_DURATION,
    );
    return tile;
  }

  /**
   * Spawn a new tile using the standard weighted-random logic and render it.
   * Used by the empty-grid safety mechanism.
   * @returns {Tile | null}
   */
  spawnAndRender() {
    const tile = this.#grid.spawnTile();
    if (!tile) return null;
    this.#animator.createTileElement(
      tile,
      true,
      (r, c) => this.cellPosition(r, c),
      ANIM.SLIDE_DURATION,
    );
    return tile;
  }

  /**
   * Add a tile with a specific state to a random empty cell.
   * @param {string} state
   * @returns {Tile | null}
   */
  addTileState(state) {
    const empty = this.#grid.getEmptyCells();
    if (!empty.length) return null;
    const { row, col } = empty[Math.floor(Math.random() * empty.length)];
    const tile = new Tile(2, row, col);
    if (state === 'targeted') {
      tile.targeted = true;
    } else if (state !== 'normal') {
      tile.applyState(state, 999);
    }
    this.#grid.cells[row][col] = tile;
    this.#animator.createTileElement(
      tile,
      true,
      (r, c) => this.cellPosition(r, c),
      ANIM.SLIDE_DURATION,
    );
    return tile;
  }

  // ─── Lifecycle ───────────────────────────────────

  /** Stop particle loop and clean up. */
  shutdown() {
    this.#animator?.stopParticleLoop();
    this.#animator?.clearAllTileElements();
  }
}
