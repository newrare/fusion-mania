import { Tile } from './tile.js';
import { GRID_SIZE, SPAWN_VALUES, SPAWN_WEIGHTS } from '../configs/constants.js';
import { weightedPick } from '../utils/math.js';

/**
 * Pure game logic for a 2048 grid. No rendering — just state and rules.
 */
export class Grid {
  /** @type {(Tile | null)[][]} 4x4 grid of tiles */
  cells;

  /** @type {number} Current score */
  score = 0;

  /** @type {number} Total moves */
  moves = 0;

  constructor() {
    this.cells = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => null),
    );
  }

  /**
   * Initialize a new classic game: empty grid + 2 random tiles.
   */
  startClassic() {
    this.cells = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => null),
    );
    this.score = 0;
    this.moves = 0;
    this.spawnTile();
    this.spawnTile();
  }

  /**
   * Restore grid state from a saved flat array.
   * @param {{ grid: number[][], score: number, moves: number }} state
   */
  restore(state) {
    this.score = state.score;
    this.moves = state.moves;
    this.cells = state.grid.map((row, r) =>
      row.map((val, c) => (val ? new Tile(val, r, c) : null)),
    );
  }

  /**
   * Serialize current state to a plain object for saving.
   * @returns {{ grid: number[][], score: number, moves: number }}
   */
  serialize() {
    return {
      grid: this.cells.map((row) => row.map((tile) => (tile ? tile.value : 0))),
      score: this.score,
      moves: this.moves,
    };
  }

  /**
   * Get all empty cell coordinates.
   * @returns {{ row: number, col: number }[]}
   */
  getEmptyCells() {
    const empty = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!this.cells[r][c]) empty.push({ row: r, col: c });
      }
    }
    return empty;
  }

  /**
   * Spawn a new tile in a random empty cell.
   * @returns {Tile | null} The spawned tile, or null if grid is full.
   */
  spawnTile() {
    const empty = this.getEmptyCells();
    if (empty.length === 0) return null;
    const idx = Math.floor(Math.random() * empty.length);
    const { row, col } = empty[idx];
    const value = weightedPick(SPAWN_VALUES, SPAWN_WEIGHTS);
    const tile = new Tile(value, row, col);
    this.cells[row][col] = tile;
    return tile;
  }

  /**
   * Move all tiles in a direction. Returns move result for animations.
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @returns {{ moved: boolean, merges: { tile: Tile, fromRow: number, fromCol: number }[], movements: { tile: Tile, fromRow: number, fromCol: number }[] }}
   */
  move(direction) {
    // Reset merged flags
    for (const row of this.cells) {
      for (const tile of row) {
        if (tile) tile.merged = false;
      }
    }

    const merges = [];
    const movements = [];
    let moved = false;

    const traversals = this.#getTraversals(direction);

    for (const row of traversals.rows) {
      for (const col of traversals.cols) {
        const tile = this.cells[row][col];
        if (!tile) continue;

        const { targetRow, targetCol, mergeTile } = this.#findTarget(tile, direction);

        if (mergeTile) {
          // Merge
          const fromRow = tile.row;
          const fromCol = tile.col;
          this.cells[tile.row][tile.col] = null;
          this.cells[mergeTile.row][mergeTile.col] = null;

          mergeTile.value *= 2;
          mergeTile.merged = true;
          this.cells[mergeTile.row][mergeTile.col] = mergeTile;
          this.score += mergeTile.value;

          merges.push({ tile: mergeTile, fromRow, fromCol });
          moved = true;
        } else if (targetRow !== tile.row || targetCol !== tile.col) {
          // Slide
          const fromRow = tile.row;
          const fromCol = tile.col;
          this.cells[tile.row][tile.col] = null;
          tile.row = targetRow;
          tile.col = targetCol;
          this.cells[targetRow][targetCol] = tile;

          movements.push({ tile, fromRow, fromCol });
          moved = true;
        }
      }
    }

    if (moved) {
      this.moves++;
    }

    return { moved, merges, movements };
  }

  /**
   * Check if any move is possible.
   * @returns {boolean}
   */
  canMove() {
    // If there's an empty cell, can always move
    if (this.getEmptyCells().length > 0) return true;

    // Check for possible merges
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const val = this.cells[r][c]?.value;
        if (val === undefined) continue;
        // Check right neighbor
        if (c + 1 < GRID_SIZE && this.cells[r][c + 1]?.value === val) return true;
        // Check bottom neighbor
        if (r + 1 < GRID_SIZE && this.cells[r + 1][c]?.value === val) return true;
      }
    }
    return false;
  }

  /**
   * Check if the player reached 2048.
   * @returns {boolean}
   */
  hasWon() {
    for (const row of this.cells) {
      for (const tile of row) {
        if (tile && tile.value >= 2048) return true;
      }
    }
    return false;
  }

  /**
   * Get all current tiles (non-null).
   * @returns {Tile[]}
   */
  getAllTiles() {
    const tiles = [];
    for (const row of this.cells) {
      for (const tile of row) {
        if (tile) tiles.push(tile);
      }
    }
    return tiles;
  }

  /**
   * Determine traversal order based on direction.
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @returns {{ rows: number[], cols: number[] }}
   */
  #getTraversals(direction) {
    const rows = [...Array(GRID_SIZE).keys()];
    const cols = [...Array(GRID_SIZE).keys()];

    if (direction === 'down') rows.reverse();
    if (direction === 'right') cols.reverse();

    return { rows, cols };
  }

  /**
   * Find the farthest available position and potential merge target.
   * @param {Tile} tile
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @returns {{ targetRow: number, targetCol: number, mergeTile: Tile | null }}
   */
  #findTarget(tile, direction) {
    const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
    const [dr, dc] = delta[direction];

    let prevRow = tile.row;
    let prevCol = tile.col;
    let nextRow = tile.row + dr;
    let nextCol = tile.col + dc;

    while (
      nextRow >= 0 && nextRow < GRID_SIZE &&
      nextCol >= 0 && nextCol < GRID_SIZE
    ) {
      const target = this.cells[nextRow][nextCol];
      if (target) {
        // Can merge?
        if (target.value === tile.value && !target.merged) {
          return { targetRow: nextRow, targetCol: nextCol, mergeTile: target };
        }
        // Blocked by different tile
        break;
      }
      prevRow = nextRow;
      prevCol = nextCol;
      nextRow += dr;
      nextCol += dc;
    }

    return { targetRow: prevRow, targetCol: prevCol, mergeTile: null };
  }
}
