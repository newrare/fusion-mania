import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from '../../src/entities/grid.js';
import { Tile } from '../../src/entities/tile.js';
import { GRID_SIZE } from '../../src/configs/constants.js';

describe('Grid', () => {
  /** @type {Grid} */
  let grid;

  beforeEach(() => {
    grid = new Grid();
  });

  describe('constructor', () => {
    it('creates a 4x4 grid of nulls', () => {
      expect(grid.cells.length).toBe(GRID_SIZE);
      for (const row of grid.cells) {
        expect(row.length).toBe(GRID_SIZE);
        for (const cell of row) {
          expect(cell).toBeNull();
        }
      }
    });

    it('starts with score 0', () => {
      expect(grid.score).toBe(0);
    });

    it('starts with moves 0', () => {
      expect(grid.moves).toBe(0);
    });
  });

  describe('startClassic', () => {
    it('resets and spawns exactly 2 tiles', () => {
      grid.startClassic();
      const tiles = grid.getAllTiles();
      expect(tiles.length).toBe(2);
    });

    it('tiles have value 2 or 4', () => {
      grid.startClassic();
      for (const tile of grid.getAllTiles()) {
        expect([2, 4]).toContain(tile.value);
      }
    });

    it('resets score and moves', () => {
      grid.score = 100;
      grid.moves = 50;
      grid.startClassic();
      expect(grid.score).toBe(0);
      expect(grid.moves).toBe(0);
    });
  });

  describe('getEmptyCells', () => {
    it('returns 16 cells for empty grid', () => {
      expect(grid.getEmptyCells().length).toBe(16);
    });

    it('returns 14 cells after startClassic', () => {
      grid.startClassic();
      expect(grid.getEmptyCells().length).toBe(14);
    });
  });

  describe('spawnTile', () => {
    it('places a tile in an empty cell', () => {
      const tile = grid.spawnTile();
      expect(tile).not.toBeNull();
      expect(grid.cells[tile.row][tile.col]).toBe(tile);
    });

    it('returns null when grid is full', () => {
      // Fill the entire grid
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          grid.cells[r][c] = new Tile(2, r, c);
        }
      }
      expect(grid.spawnTile()).toBeNull();
    });
  });

  describe('move', () => {
    it('slides tiles to the left', () => {
      grid.cells[0][3] = new Tile(2, 0, 3);
      const result = grid.move('left');
      expect(result.moved).toBe(true);
      expect(grid.cells[0][0]?.value).toBe(2);
      expect(grid.cells[0][3]).toBeNull();
    });

    it('slides tiles to the right', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      const result = grid.move('right');
      expect(result.moved).toBe(true);
      expect(grid.cells[0][3]?.value).toBe(2);
      expect(grid.cells[0][0]).toBeNull();
    });

    it('slides tiles up', () => {
      grid.cells[3][0] = new Tile(2, 3, 0);
      const result = grid.move('up');
      expect(result.moved).toBe(true);
      expect(grid.cells[0][0]?.value).toBe(2);
      expect(grid.cells[3][0]).toBeNull();
    });

    it('slides tiles down', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      const result = grid.move('down');
      expect(result.moved).toBe(true);
      expect(grid.cells[3][0]?.value).toBe(2);
      expect(grid.cells[0][0]).toBeNull();
    });

    it('merges two equal tiles', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][1] = new Tile(2, 0, 1);
      const result = grid.move('left');
      expect(result.moved).toBe(true);
      expect(result.merges.length).toBe(1);
      expect(grid.cells[0][0]?.value).toBe(4);
      expect(grid.cells[0][1]).toBeNull();
    });

    it('adds merged value to score', () => {
      grid.cells[0][0] = new Tile(4, 0, 0);
      grid.cells[0][1] = new Tile(4, 0, 1);
      grid.move('left');
      expect(grid.score).toBe(8);
    });

    it('increments moves on a valid move', () => {
      grid.cells[0][3] = new Tile(2, 0, 3);
      grid.move('left');
      expect(grid.moves).toBe(1);
    });

    it('does not increment moves when no tile moved', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.move('left');
      expect(grid.moves).toBe(0);
    });

    it('does not merge a tile twice in one move', () => {
      // [2, 2, 4, _] → move left → [4, 4, _, _] not [8, _, _, _]
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][1] = new Tile(2, 0, 1);
      grid.cells[0][2] = new Tile(4, 0, 2);
      grid.move('left');
      expect(grid.cells[0][0]?.value).toBe(4);
      expect(grid.cells[0][1]?.value).toBe(4);
    });

    it('handles multiple merges in one row', () => {
      // [2, 2, 2, 2] → move left → [4, 4, _, _]
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][1] = new Tile(2, 0, 1);
      grid.cells[0][2] = new Tile(2, 0, 2);
      grid.cells[0][3] = new Tile(2, 0, 3);
      grid.move('left');
      expect(grid.cells[0][0]?.value).toBe(4);
      expect(grid.cells[0][1]?.value).toBe(4);
      expect(grid.cells[0][2]).toBeNull();
      expect(grid.cells[0][3]).toBeNull();
      expect(grid.score).toBe(8);
    });

    it('returns moved=false when no tile can move', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      const result = grid.move('left');
      expect(result.moved).toBe(false);
    });

    it('returns expelled: [] when no expel tiles', () => {
      grid.cells[0][3] = new Tile(2, 0, 3);
      const result = grid.move('left');
      expect(result.expelled).toEqual([]);
    });
  });

  describe('expel mechanic (ghost-v / ghost-h)', () => {
    it('ghost-v tile exits grid when moving up with no blocker', () => {
      const tile = new Tile(2, 2, 1);
      tile.applyState('ghost-v', 5);
      grid.cells[2][1] = tile;
      const result = grid.move('up');
      expect(result.expelled).toContain(tile);
      expect(grid.cells[2][1]).toBeNull();
      expect(result.moved).toBe(true);
    });

    it('ghost-v tile exits grid when moving down with no blocker', () => {
      const tile = new Tile(2, 1, 1);
      tile.applyState('ghost-v', 5);
      grid.cells[1][1] = tile;
      const result = grid.move('down');
      expect(result.expelled).toContain(tile);
      expect(grid.cells[1][1]).toBeNull();
    });

    it('ghost-h tile exits grid when moving left with no blocker', () => {
      const tile = new Tile(2, 1, 2);
      tile.applyState('ghost-h', 5);
      grid.cells[1][2] = tile;
      const result = grid.move('left');
      expect(result.expelled).toContain(tile);
      expect(grid.cells[1][2]).toBeNull();
    });

    it('ghost-h tile exits grid when moving right with no blocker', () => {
      const tile = new Tile(2, 1, 1);
      tile.applyState('ghost-h', 5);
      grid.cells[1][1] = tile;
      const result = grid.move('right');
      expect(result.expelled).toContain(tile);
      expect(grid.cells[1][1]).toBeNull();
    });

    it('ghost-v tile is stopped by another tile (not expelled)', () => {
      const tile = new Tile(4, 2, 1);
      tile.applyState('ghost-v', 5);
      grid.cells[2][1] = tile;
      grid.cells[0][1] = new Tile(8, 0, 1); // blocker at the top
      const result = grid.move('up');
      expect(result.expelled).toEqual([]);
      expect(grid.cells[1][1]).toBe(tile); // stopped behind blocker
    });

    it('ghost-v tile merges with equal tile instead of exiting', () => {
      const tile = new Tile(4, 2, 1);
      tile.applyState('ghost-v', 5);
      grid.cells[2][1] = tile;
      grid.cells[0][1] = new Tile(4, 0, 1); // same value at top
      const result = grid.move('up');
      expect(result.expelled).toEqual([]);
      expect(result.merges.length).toBe(1);
    });

    it('ghost-v does NOT exit on left/right moves (only vertical)', () => {
      const tile = new Tile(2, 1, 1);
      tile.applyState('ghost-v', 5);
      grid.cells[1][1] = tile;
      const result = grid.move('left');
      expect(result.expelled).toEqual([]);
      expect(grid.cells[1][0]).toBe(tile); // slides normally to left edge
    });

    it('ghost-h does NOT exit on up/down moves (only horizontal)', () => {
      const tile = new Tile(2, 2, 1);
      tile.applyState('ghost-h', 5);
      grid.cells[2][1] = tile;
      const result = grid.move('up');
      expect(result.expelled).toEqual([]);
      expect(grid.cells[0][1]).toBe(tile); // slides normally to top edge
    });

    it('expelled tile is NOT in movements (AnimationManager handles screen-exit separately)', () => {
      const tile = new Tile(2, 2, 1);
      tile.applyState('ghost-v', 5);
      grid.cells[2][1] = tile;
      const result = grid.move('up');
      const movement = result.movements.find((m) => m.tile === tile);
      expect(movement).toBeUndefined();
      expect(result.expelled).toContain(tile);
    });

    it('normal tile is not expelled (border still blocks it)', () => {
      const tile = new Tile(2, 0, 1);
      grid.cells[0][1] = tile;
      const result = grid.move('up');
      expect(result.expelled).toEqual([]);
      expect(result.moved).toBe(false);
    });
  });

  describe('canMove', () => {
    it('returns true for empty grid', () => {
      expect(grid.canMove()).toBe(true);
    });

    it('returns true when merge is possible', () => {
      // Fill grid with alternating values but leave one merge
      let val = 2;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          grid.cells[r][c] = new Tile(val, r, c);
          val = val === 2 ? 4 : 2;
        }
        // Shift pattern per row to avoid accidental vertical merges
        if (r % 2 === 0) val = 4;
        else val = 2;
      }
      // Create one merge opportunity
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][1] = new Tile(2, 0, 1);
      expect(grid.canMove()).toBe(true);
    });

    it('returns false when grid is full with no merges', () => {
      const values = [
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 2, 4],
        [8, 16, 32, 64],
      ];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          grid.cells[r][c] = new Tile(values[r][c], r, c);
        }
      }
      expect(grid.canMove()).toBe(false);
    });
  });

  describe('hasWon', () => {
    it('returns false for empty grid', () => {
      expect(grid.hasWon()).toBe(false);
    });

    it('returns true when 2048 tile exists', () => {
      grid.cells[0][0] = new Tile(2048, 0, 0);
      expect(grid.hasWon()).toBe(true);
    });

    it('returns true for values beyond 2048', () => {
      grid.cells[2][2] = new Tile(4096, 2, 2);
      expect(grid.hasWon()).toBe(true);
    });
  });

  describe('serialize / restore', () => {
    it('serializes and restores grid state', () => {
      grid.startClassic();
      grid.score = 42;
      grid.moves = 7;

      const state = grid.serialize();
      const newGrid = new Grid();
      newGrid.restore(state);

      expect(newGrid.score).toBe(42);
      expect(newGrid.moves).toBe(7);
      expect(newGrid.getAllTiles().length).toBe(grid.getAllTiles().length);

      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const origVal = grid.cells[r][c]?.value ?? 0;
          const restoredVal = newGrid.cells[r][c]?.value ?? 0;
          expect(restoredVal).toBe(origVal);
        }
      }
    });

    it('serializes empty cells as 0', () => {
      const state = grid.serialize();
      for (const row of state.grid) {
        for (const val of row) {
          expect(val).toBe(0);
        }
      }
    });
  });

  describe('getAllTiles', () => {
    it('returns empty array for empty grid', () => {
      expect(grid.getAllTiles()).toEqual([]);
    });

    it('returns all placed tiles', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[1][1] = new Tile(4, 1, 1);
      grid.cells[3][3] = new Tile(8, 3, 3);
      expect(grid.getAllTiles().length).toBe(3);
    });
  });

  describe('simulateMove', () => {
    it('does not mutate the real grid', () => {
      grid.cells[0][3] = new Tile(2, 0, 3);
      const id = grid.cells[0][3].id;
      grid.simulateMove('left');
      // Original tile should still be at [0][3]
      expect(grid.cells[0][3]).not.toBeNull();
      expect(grid.cells[0][3].id).toBe(id);
      expect(grid.cells[0][0]).toBeNull();
    });

    it('reports moved=true when tiles slide', () => {
      grid.cells[0][3] = new Tile(2, 0, 3);
      const result = grid.simulateMove('left');
      expect(result.moved).toBe(true);
    });

    it('reports moved=false when nothing can slide', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      const result = grid.simulateMove('left');
      expect(result.moved).toBe(false);
    });

    it('detects merges', () => {
      const t1 = new Tile(2, 0, 0);
      const t2 = new Tile(2, 0, 1);
      grid.cells[0][0] = t1;
      grid.cells[0][1] = t2;
      const result = grid.simulateMove('left');
      expect(result.merges.length).toBe(1);
      expect(result.merges[0].value).toBe(4);
    });

    it('provides final positions for all tiles', () => {
      const t = new Tile(2, 0, 3);
      grid.cells[0][3] = t;
      const result = grid.simulateMove('left');
      const pos = result.positions.get(t.id);
      expect(pos).toEqual({ row: 0, col: 0 });
    });

    it('respects iceIds — iced tiles do not move', () => {
      const frozen = new Tile(2, 0, 3);
      grid.cells[0][3] = frozen;
      const result = grid.simulateMove('left', { iceIds: new Set([frozen.id]) });
      const pos = result.positions.get(frozen.id);
      expect(pos).toEqual({ row: 0, col: 3 });
      expect(result.moved).toBe(false);
    });

    it('respects windBlock — blocks the entire direction', () => {
      grid.cells[0][3] = new Tile(2, 0, 3);
      const result = grid.simulateMove('left', { windBlock: 'left' });
      expect(result.moved).toBe(false);
      expect(result.merges).toEqual([]);
    });

    it('iced tiles block other tiles from merging through them', () => {
      const frozen = new Tile(2, 0, 1);
      const slider = new Tile(2, 0, 3);
      grid.cells[0][1] = frozen;
      grid.cells[0][3] = slider;
      frozen.applyState('ice', 4);
      const result = grid.simulateMove('left', { iceIds: new Set([frozen.id]) });
      // Slider merges INTO the iced tile (ice is cleared on real move)
      expect(result.merges.length).toBe(1);
      expect(result.merges[0].tileId).toBe(frozen.id);
    });
  });
});
