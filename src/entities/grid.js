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
   * Serialize full state including tile powers, states, and targeted flags.
   * @returns {{ cells: (object | null)[][], score: number, moves: number }}
   */
  serializeFull() {
    return {
      cells: this.cells.map((row) =>
        row.map((tile) => {
          if (!tile) return null;
          const t = { v: tile.value };
          if (tile.power) t.p = tile.power;
          if (tile.state) { t.s = tile.state; t.st = tile.stateTurns; }
          if (tile.targeted) t.tg = true;
          return t;
        }),
      ),
      score: this.score,
      moves: this.moves,
    };
  }

  /**
   * Restore grid from full serialized data (with powers, states).
   * @param {{ cells: (object | null)[][], score: number, moves: number }} state
   */
  restoreFull(state) {
    this.score = state.score;
    this.moves = state.moves;
    this.cells = state.cells.map((row, r) =>
      row.map((data, c) => {
        if (!data) return null;
        const tile = new Tile(data.v, r, c);
        if (data.p) tile.power = data.p;
        if (data.s) { tile.state = data.s; tile.stateTurns = data.st ?? 0; }
        if (data.tg) tile.targeted = true;
        return tile;
      }),
    );
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
   * @returns {{
   *   moved: boolean,
   *   merges: { tile: Tile, fromRow: number, fromCol: number, consumedId: string, consumedPower: string | null }[],
   *   movements: { tile: Tile, fromRow: number, fromCol: number }[],
   *   expelled: Tile[]
   * }}
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
    const expelled = [];
    let moved = false;

    const traversals = this.#getTraversals(direction);

    for (const row of traversals.rows) {
      for (const col of traversals.cols) {
        const tile = this.cells[row][col];
        if (!tile) continue;
        // Iced tiles cannot move
        if (tile.state === 'ice') continue;

        const { targetRow, targetCol, mergeTile, exits } = this.#findTarget(tile, direction);

        if (exits) {
          // Expel: tile exits the grid — AnimationManager will fly it to the screen edge
          this.cells[tile.row][tile.col] = null;
          expelled.push(tile);
          // Do NOT add to movements — slideExpelledToEdge handles the animation
          moved = true;
        } else if (mergeTile) {
          // Merge
          const fromRow = tile.row;
          const fromCol = tile.col;
          const consumedId = tile.id;
          const consumedPower = tile.power ?? null;
          this.cells[tile.row][tile.col] = null;
          this.cells[mergeTile.row][mergeTile.col] = null;

          mergeTile.value *= 2;
          mergeTile.merged = true;
          // Reset to normal state after fusion — no stacking of special states
          mergeTile.clearState();
          mergeTile.targeted = false;
          this.cells[mergeTile.row][mergeTile.col] = mergeTile;
          this.score += mergeTile.value;

          merges.push({ tile: mergeTile, fromRow, fromCol, consumedId, consumedPower });
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

    return { moved, merges, movements, expelled };
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
   * Check if any move in any direction could produce a merge.
   * Collapses empty cells per row/column and checks for consecutive same values.
   * @returns {boolean}
   */
  hasPossibleMerge() {
    for (let r = 0; r < GRID_SIZE; r++) {
      /** @type {number[]} */
      const rowVals = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.cells[r][c]) rowVals.push(this.cells[r][c].value);
      }
      for (let i = 0; i < rowVals.length - 1; i++) {
        if (rowVals[i] === rowVals[i + 1]) return true;
      }
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      /** @type {number[]} */
      const colVals = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        if (this.cells[r][c]) colVals.push(this.cells[r][c].value);
      }
      for (let i = 0; i < colVals.length - 1; i++) {
        if (colVals[i] === colVals[i + 1]) return true;
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
   * Ghost tiles (expel state) bypass the border in their sensitive axis and
   * exit the grid when nothing blocks them.
   *
   * @param {Tile} tile
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @returns {{ targetRow: number, targetCol: number, mergeTile: Tile | null, exits: boolean }}
   */
  #findTarget(tile, direction) {
    const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
    const [dr, dc] = delta[direction];

    // A ghost-v tile is insensitive to top/bottom borders; ghost-h to left/right.
    const canExit =
      (tile.state === 'ghost-v' && (direction === 'up' || direction === 'down')) ||
      (tile.state === 'ghost-h' && (direction === 'left' || direction === 'right'));

    let prevRow = tile.row;
    let prevCol = tile.col;
    let nextRow = tile.row + dr;
    let nextCol = tile.col + dc;

    while (true) {
      const outOfBounds =
        nextRow < 0 || nextRow >= GRID_SIZE ||
        nextCol < 0 || nextCol >= GRID_SIZE;

      if (outOfBounds) {
        if (canExit) {
          // Tile exits the grid — targetRow/Col unused (AnimationManager handles screen-exit)
          return { targetRow: prevRow, targetCol: prevCol, mergeTile: null, exits: true };
        }
        break;
      }

      const target = this.cells[nextRow][nextCol];
      if (target) {
        // Can merge if same value and not yet merged (iced tiles CAN be merged into).
        if (target.value === tile.value && !target.merged) {
          return { targetRow: nextRow, targetCol: nextCol, mergeTile: target, exits: false };
        }
        // Blocked by a different tile (or already-merged tile) — expel stops here too
        break;
      }
      prevRow = nextRow;
      prevCol = nextCol;
      nextRow += dr;
      nextCol += dc;
    }

    return { targetRow: prevRow, targetCol: prevCol, mergeTile: null, exits: false };
  }

  /**
   * Simulate a move without mutating the grid. Returns the resulting tile
   * positions and which tiles would merge (used for power prediction).
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @param {{ iceIds?: Set<string>, windBlock?: string | null }} [opts]
   * @returns {{ moved: boolean, merges: { tileId: string, value: number, row: number, col: number, consumedId: string }[], positions: Map<string, { row: number, col: number }> }}
   */
  simulateMove(direction, opts = {}) {
    const iceIds = opts.iceIds ?? new Set();
    const windBlock = opts.windBlock ?? null;

    // If wind blocks this direction, nothing moves
    if (windBlock === direction) {
      return { moved: false, merges: [], positions: new Map() };
    }

    // Deep-copy cell values
    /** @type {{ id: string, value: number, row: number, col: number, merged: boolean }[][]} */
    const sim = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => null),
    );
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const t = this.cells[r][c];
        if (t) {
          sim[r][c] = { id: t.id, value: t.value, row: r, col: c, merged: false };
        }
      }
    }

    const traversals = this.#getTraversals(direction);
    const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
    const [dr, dc] = delta[direction];

    const merges = [];
    const positions = new Map();
    let moved = false;

    for (const row of traversals.rows) {
      for (const col of traversals.cols) {
        const tile = sim[row][col];
        if (!tile) continue;
        if (iceIds.has(tile.id)) {
          positions.set(tile.id, { row, col });
          continue;
        }

        let prevR = row;
        let prevC = col;
        let nextR = row + dr;
        let nextC = col + dc;

        let mergeTile = null;
        while (nextR >= 0 && nextR < GRID_SIZE && nextC >= 0 && nextC < GRID_SIZE) {
          const target = sim[nextR][nextC];
          if (target) {
            if (target.value === tile.value && !target.merged) {
              // Iced tiles CAN be merged into; the merge clears the ice state in the real move.
              mergeTile = target;
            }
            break;
          }
          prevR = nextR;
          prevC = nextC;
          nextR += dr;
          nextC += dc;
        }

        if (mergeTile) {
          sim[row][col] = null;
          sim[mergeTile.row][mergeTile.col] = null;
          mergeTile.value *= 2;
          mergeTile.merged = true;
          sim[mergeTile.row][mergeTile.col] = mergeTile;
          merges.push({
            tileId: mergeTile.id,
            value: mergeTile.value,
            row: mergeTile.row,
            col: mergeTile.col,
            consumedId: tile.id,
          });
          positions.set(mergeTile.id, { row: mergeTile.row, col: mergeTile.col });
          moved = true;
        } else if (prevR !== row || prevC !== col) {
          sim[row][col] = null;
          tile.row = prevR;
          tile.col = prevC;
          sim[prevR][prevC] = tile;
          positions.set(tile.id, { row: prevR, col: prevC });
          moved = true;
        } else {
          positions.set(tile.id, { row, col });
        }
      }
    }

    return { moved, merges, positions };
  }
}
