import { describe, it, expect, beforeEach } from 'vitest';
import { PowerManager } from '../../src/managers/power-manager.js';
import { Grid } from '../../src/entities/grid.js';
import { Tile } from '../../src/entities/tile.js';
import {
  POWER_TYPES,
  POWER_PLACEMENT_INTERVAL,
  POWER_DURATIONS,
  GRID_SIZE,
} from '../../src/configs/constants.js';

/**
 * Helper: fill specific cells with tiles by value matrix.
 * @param {Grid} grid
 * @param {(number | null)[][]} matrix — 4x4
 * @returns {Map<string, Tile>} key = "r,c", value = tile
 */
function fillGrid(grid, matrix) {
  const map = new Map();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = matrix[r][c];
      if (v) {
        const t = new Tile(v, r, c);
        grid.cells[r][c] = t;
        map.set(`${r},${c}`, t);
      } else {
        grid.cells[r][c] = null;
      }
    }
  }
  return map;
}

describe('PowerManager', () => {
  /** @type {Grid} */
  let grid;
  /** @type {PowerManager} */
  let pm;

  beforeEach(() => {
    grid = new Grid();
    pm = new PowerManager([POWER_TYPES.FIRE_H, POWER_TYPES.BOMB]);
  });

  describe('constructor', () => {
    it('stores selected types as a copy', () => {
      const types = [POWER_TYPES.ICE];
      const pm2 = new PowerManager(types);
      types.push(POWER_TYPES.BOMB);
      expect(pm2.selectedTypes).toEqual([POWER_TYPES.ICE]);
    });

    it('starts with empty edges', () => {
      expect(pm.edges).toEqual({ top: null, bottom: null, left: null, right: null });
    });

    it('starts with no targeted tile and no wind', () => {
      expect(pm.targetedTileId).toBeNull();
      expect(pm.windDirection).toBeNull();
      expect(pm.windTurns).toBe(0);
    });
  });

  describe('onMove — power placement', () => {
    it('does not assign a power on the first tick', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.tickMove(grid);
      const result = pm.onMove(grid);
      expect(result).toBeNull();
    });

    it('charges an edge after POWER_PLACEMENT_INTERVAL ticks (edge-charged pool)', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      let result = null;
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) {
        pm.tickMove(grid);
        result = pm.onMove(grid);
      }
      expect(result).not.toBeNull();
      expect(result.kind).toBe('edge');
      expect(['top', 'bottom', 'left', 'right']).toContain(result.side);
      expect(pm.edges[result.side]).toBe(result.type);
    });

    it('applies a direct power immediately on the grid', () => {
      const pmDirect = new PowerManager([POWER_TYPES.ICE]);
      grid.cells[0][0] = new Tile(2, 0, 0);
      let result = null;
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) {
        pmDirect.tickMove(grid);
        result = pmDirect.onMove(grid);
      }
      expect(result).not.toBeNull();
      expect(result.kind).toBe('direct');
      expect(result.tile.state).toBe('ice');
    });

    it('skips edge placement when all 4 edges are full', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.chargeEdge('top', POWER_TYPES.FIRE_H);
      pm.chargeEdge('bottom', POWER_TYPES.FIRE_H);
      pm.chargeEdge('left', POWER_TYPES.FIRE_H);
      pm.chargeEdge('right', POWER_TYPES.FIRE_H);
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) pm.tickMove(grid);
      expect(pm.onMove(grid)).toBeNull();
    });
  });

  describe('edge charging / firing', () => {
    it('chargeEdge stores power on the given side', () => {
      expect(pm.chargeEdge('top', POWER_TYPES.BOMB)).toBe(true);
      expect(pm.edges.top).toBe(POWER_TYPES.BOMB);
    });

    it('chargeRandomFreeEdge picks one of the free sides', () => {
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.chargeEdge('bottom', POWER_TYPES.BOMB);
      pm.chargeEdge('left', POWER_TYPES.BOMB);
      const side = pm.chargeRandomFreeEdge(POWER_TYPES.FIRE_H);
      expect(side).toBe('right');
      expect(pm.edges.right).toBe(POWER_TYPES.FIRE_H);
    });

    it('chargeRandomFreeEdge returns null when no free side', () => {
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.chargeEdge('bottom', POWER_TYPES.BOMB);
      pm.chargeEdge('left', POWER_TYPES.BOMB);
      pm.chargeEdge('right', POWER_TYPES.BOMB);
      expect(pm.chargeRandomFreeEdge(POWER_TYPES.FIRE_H)).toBeNull();
    });

    it('fireEdge(up) consumes the top-edge power', () => {
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      const fired = pm.fireEdge('up');
      expect(fired).toEqual({ type: POWER_TYPES.BOMB, side: 'top' });
      expect(pm.edges.top).toBeNull();
    });

    it('fireEdge maps directions to sides correctly', () => {
      pm.chargeEdge('top', POWER_TYPES.FIRE_H);
      pm.chargeEdge('bottom', POWER_TYPES.FIRE_V);
      pm.chargeEdge('left', POWER_TYPES.BOMB);
      pm.chargeEdge('right', POWER_TYPES.NUCLEAR);
      expect(pm.fireEdge('up').type).toBe(POWER_TYPES.FIRE_H);
      expect(pm.fireEdge('down').type).toBe(POWER_TYPES.FIRE_V);
      expect(pm.fireEdge('left').type).toBe(POWER_TYPES.BOMB);
      expect(pm.fireEdge('right').type).toBe(POWER_TYPES.NUCLEAR);
    });

    it('fireEdge returns null when the edge is empty', () => {
      expect(pm.fireEdge('up')).toBeNull();
    });

    it('clearEdges empties all four sides', () => {
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.chargeEdge('right', POWER_TYPES.FIRE_H);
      pm.clearEdges();
      expect(pm.edges).toEqual({ top: null, bottom: null, left: null, right: null });
    });
  });

  describe('refreshTargetedTile', () => {
    it('clears the target when no edge needs a target', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.chargeEdge('top', POWER_TYPES.WIND_UP);
      pm.refreshTargetedTile(grid);
      expect(pm.targetedTileId).toBeNull();
      expect(grid.cells[0][0].targeted).toBe(false);
    });

    it('picks a tile when at least one edge needs a target', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.refreshTargetedTile(grid);
      expect(pm.targetedTileId).toBe(grid.cells[0][0].id);
      expect(grid.cells[0][0].targeted).toBe(true);
    });

    it('never picks a frozen tile as target', () => {
      const iced = new Tile(2, 0, 0);
      iced.applyState('ice', POWER_DURATIONS.ICE);
      grid.cells[0][0] = iced;
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.refreshTargetedTile(grid);
      expect(pm.targetedTileId).toBeNull();
    });

    it('keeps the same target across calls while it stays valid', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[1][1] = new Tile(4, 1, 1);
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.refreshTargetedTile(grid);
      const first = pm.targetedTileId;
      pm.refreshTargetedTile(grid);
      expect(pm.targetedTileId).toBe(first);
    });

    it('re-picks a new target when the previous one disappears', () => {
      const t = new Tile(2, 0, 0);
      grid.cells[0][0] = t;
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.refreshTargetedTile(grid);
      grid.cells[0][0] = null;
      grid.cells[1][1] = new Tile(4, 1, 1);
      pm.refreshTargetedTile(grid);
      expect(pm.targetedTileId).toBe(grid.cells[1][1].id);
    });
  });

  describe('applyDirectPower', () => {
    it('applies ice on a random tile without a state', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      const tile = pm.applyDirectPower(POWER_TYPES.ICE, grid);
      expect(tile).toBe(grid.cells[0][0]);
      expect(tile.state).toBe('ice');
      expect(tile.stateTurns).toBe(POWER_DURATIONS.ICE);
    });

    it('applies expel-h as ghost-h', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      const tile = pm.applyDirectPower(POWER_TYPES.EXPEL_H, grid);
      expect(tile.state).toBe('ghost-h');
    });

    it('applies expel-v as ghost-v', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      const tile = pm.applyDirectPower(POWER_TYPES.EXPEL_V, grid);
      expect(tile.state).toBe('ghost-v');
    });

    it('rejects non-direct powers', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      expect(pm.applyDirectPower(POWER_TYPES.BOMB, grid)).toBeNull();
    });

    it('returns null when no tile is eligible (all tiles in a state)', () => {
      const iced = new Tile(2, 0, 0);
      iced.applyState('ice', 3);
      grid.cells[0][0] = iced;
      expect(pm.applyDirectPower(POWER_TYPES.ICE, grid)).toBeNull();
    });
  });

  describe('executeEffect', () => {
    it('FIRE_H destroys the target row (target survives)', () => {
      fillGrid(grid, [
        [2, 4, 8, 16],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      const target = grid.cells[0][2];
      const res = pm.executeEffect(POWER_TYPES.FIRE_H, grid, target);
      expect(res.destroyed.map((t) => t.value).sort((a, b) => a - b)).toEqual([2, 4, 16]);
      expect(grid.cells[0][2]).toBe(target);
    });

    it('FIRE_V destroys the target column', () => {
      fillGrid(grid, [
        [2, null, null, null],
        [4, null, null, null],
        [8, null, null, null],
        [16, null, null, null],
      ]);
      const target = grid.cells[0][0];
      const res = pm.executeEffect(POWER_TYPES.FIRE_V, grid, target);
      expect(res.destroyed.map((t) => t.value).sort((a, b) => a - b)).toEqual([4, 8, 16]);
    });

    it('FIRE_X destroys row and column', () => {
      fillGrid(grid, [
        [2, 4, 8, 16],
        [32, null, null, null],
        [64, null, null, null],
        [128, null, null, null],
      ]);
      const target = grid.cells[0][0];
      const res = pm.executeEffect(POWER_TYPES.FIRE_X, grid, target);
      expect(res.destroyed.length).toBe(6);
    });

    it('BOMB destroys the target tile and its 4 orthogonal neighbours', () => {
      fillGrid(grid, [
        [null, 2, null, null],
        [4, 8, 16, null],
        [null, 32, null, null],
        [null, null, null, null],
      ]);
      const target = grid.cells[1][1];
      const res = pm.executeEffect(POWER_TYPES.BOMB, grid, target);
      expect(res.destroyed.length).toBe(5);
      expect(grid.cells[1][1]).toBeNull();
    });

    it('NUCLEAR destroys every tile', () => {
      fillGrid(grid, [
        [2, 4, null, null],
        [null, 8, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      const res = pm.executeEffect(POWER_TYPES.NUCLEAR, grid, null);
      expect(res.destroyed.length).toBe(3);
      expect(grid.getAllTiles().length).toBe(0);
    });

    it('TELEPORT swaps two tiles', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[3][3] = new Tile(4, 3, 3);
      const target = grid.cells[0][0];
      const res = pm.executeEffect(POWER_TYPES.TELEPORT, grid, target);
      expect(res.teleported).toBeDefined();
      expect(grid.cells[0][0].value).toBe(4);
      expect(grid.cells[3][3].value).toBe(2);
    });

    it('BLIND puts every visible tile in blind state', () => {
      fillGrid(grid, [
        [2, 4, null, null],
        [null, 8, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      pm.executeEffect(POWER_TYPES.BLIND, grid, null);
      for (const t of grid.getAllTiles()) expect(t.state).toBe('blind');
    });

    it('BLIND skips tiles that are already blind', () => {
      fillGrid(grid, [
        [2, 4, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      const [t1, t2] = grid.getAllTiles();
      t1.applyState('blind', 3);
      pm.executeEffect(POWER_TYPES.BLIND, grid, null);
      // Already-blind tile keeps its original stateTurns (not overwritten)
      expect(t1.stateTurns).toBe(3);
      // Other tile gets blinded normally
      expect(t2.state).toBe('blind');
    });

    it('BLIND skips the newTile passed as 4th argument', () => {
      fillGrid(grid, [
        [2, 4, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      const tiles = grid.getAllTiles();
      const newTile = tiles[0];
      pm.executeEffect(POWER_TYPES.BLIND, grid, null, newTile);
      expect(newTile.state).toBeNull();
      expect(tiles[1].state).toBe('blind');
    });

    it('BLIND skips tiles with blindCooldown > 0', () => {
      fillGrid(grid, [
        [2, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      const [t] = grid.getAllTiles();
      t.blindCooldown = 1;
      pm.executeEffect(POWER_TYPES.BLIND, grid, null);
      expect(t.state).toBeNull();
    });

    it('WIND_UP blocks downward movement for WIND duration', () => {
      pm.executeEffect(POWER_TYPES.WIND_UP, grid, null);
      expect(pm.windDirection).toBe('down');
      expect(pm.windTurns).toBe(POWER_DURATIONS.WIND);
    });

    it('LIGHTNING destroys 1–3 top-of-column tiles', () => {
      fillGrid(grid, [
        [2, 4, 8, 16],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      const res = pm.executeEffect(POWER_TYPES.LIGHTNING, grid, null);
      expect(res.destroyed.length).toBeGreaterThanOrEqual(1);
      expect(res.destroyed.length).toBeLessThanOrEqual(3);
    });

    it('ADS returns a stateApplied marker', () => {
      const res = pm.executeEffect(POWER_TYPES.ADS, grid, null);
      expect(res.stateApplied).toBe('ads');
    });
  });

  describe('wind ticking', () => {
    it('decrements windTurns on tickMove', () => {
      pm.executeEffect(POWER_TYPES.WIND_UP, grid, null);
      const before = pm.windTurns;
      pm.tickMove(grid);
      expect(pm.windTurns).toBe(before - 1);
    });

    it('clears wind after it reaches 0', () => {
      pm.executeEffect(POWER_TYPES.WIND_UP, grid, null);
      for (let i = 0; i < POWER_DURATIONS.WIND; i++) pm.tickMove(grid);
      expect(pm.windDirection).toBeNull();
    });
  });

  describe('tile state ticking', () => {
    it('decrements tile state counters on tickMove', () => {
      const t = new Tile(2, 0, 0);
      t.applyState('ice', 2);
      grid.cells[0][0] = t;
      pm.tickMove(grid);
      expect(t.stateTurns).toBe(1);
    });

    it('clears the state when counter reaches 0', () => {
      const t = new Tile(2, 0, 0);
      t.applyState('blind', 1);
      grid.cells[0][0] = t;
      pm.tickMove(grid);
      expect(t.state).toBeNull();
    });
  });

  describe('getBadgeColor', () => {
    it('returns null when the corresponding edge is empty', () => {
      expect(pm.getBadgeColor('up', grid)).toBeNull();
    });

    it('returns danger for a destructive power that would destroy tiles', () => {
      fillGrid(grid, [
        [2, 4, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      pm.chargeEdge('right', POWER_TYPES.BOMB);
      pm.refreshTargetedTile(grid);
      expect(pm.getBadgeColor('right', grid)).toBe('danger');
    });

    it('downgrades a destructive power to info when nothing would be destroyed', () => {
      // Single tile on the grid, fire-H: row only contains the target → no destruction
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[2][0] = new Tile(2, 2, 0);
      pm.chargeEdge('top', POWER_TYPES.FIRE_H);
      pm.refreshTargetedTile(grid);
      // Swipe up merges the two 2s → survivor is alone on its row → fire-h destroys nothing
      expect(pm.getBadgeColor('up', grid)).toBe('info');
    });

    it('returns warning for a warning-tier power', () => {
      // Tiles must be able to move on the swipe so it isn't cancelled.
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[3][3] = new Tile(4, 3, 3);
      pm.chargeEdge('bottom', POWER_TYPES.TELEPORT);
      pm.refreshTargetedTile(grid);
      expect(pm.getBadgeColor('down', grid)).toBe('warning');
    });

    it('returns info for an info-tier power (wind)', () => {
      grid.cells[0][1] = new Tile(2, 0, 1);
      grid.cells[0][3] = new Tile(4, 0, 3);
      pm.chargeEdge('left', POWER_TYPES.WIND_UP);
      expect(pm.getBadgeColor('left', grid)).toBe('info');
    });
  });

  describe('predictForDirection', () => {
    it('returns null when no edge is charged', () => {
      expect(pm.predictForDirection('up', grid)).toBeNull();
    });

    it('fire-h predicts the post-swipe row destruction', () => {
      fillGrid(grid, [
        [2, 4, 8, 16],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      // Force targeted to the last tile of row 0 (unique target).
      pm.chargeEdge('right', POWER_TYPES.FIRE_H);
      // Right-swipe doesn't move anything in row 0 since 2/4/8/16 can't merge.
      // But it's still a bump. Re-target manually on (0,3):
      pm.refreshTargetedTile(grid);
      // simulateMove('right') will bump (no move) → cancelled
      const pred = pm.predictForDirection('right', grid);
      expect(pred.cancelled).toBe(true);
    });

    it('fire-h destroys the row after a valid swipe moves tiles', () => {
      fillGrid(grid, [
        [null, null, 2, null],
        [null, null, 4, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      pm.chargeEdge('right', POWER_TYPES.FIRE_H);
      pm.refreshTargetedTile(grid);
      const target = pm.getTargetedTile(grid);
      const pred = pm.predictForDirection('right', grid);
      expect(pred.severity).toBe(target.row === 0 || target.row === 1 ? 'info' : 'info');
      // Post-swipe, the targeted tile is alone on its row → 0 destroyed.
      expect(pred.destroyedValues).toEqual([]);
    });

    it('fire-h predicts danger when targeted tile is consumed by a merge', () => {
      const targetTile = new Tile(2, 0, 0);
      grid.cells[0][0] = targetTile;
      grid.cells[1][0] = new Tile(8, 1, 0);
      pm.chargeEdge('right', POWER_TYPES.FIRE_H);
      pm.refreshTargetedTile(grid);
      // Force target to be targetTile (only eligible, since 8 is also eligible but pick may vary)
      pm.chargeEdge('right', POWER_TYPES.FIRE_H);
      // Pin the target to targetTile by clearing other tiles and refreshing
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) grid.cells[r][c] = null;
      grid.cells[0][0] = targetTile;
      pm.refreshTargetedTile(grid);
      // Now add a matching 2-tile in same row — they will merge on swipe-right
      grid.cells[0][1] = new Tile(2, 0, 1);
      // Add a tile in row 0 that will survive the merge (different value)
      grid.cells[0][3] = new Tile(8, 0, 3);
      // Swipe right: targetTile [0][0] is consumed. Surviving merged tile lands at [0][3]?
      // Actually [0][1]=2 also moves right and merges with targetTile...
      // Let's just check severity and that it's not empty
      const pred = pm.predictForDirection('right', grid);
      expect(pred.severity).toBe('danger');
      expect(pred.destroyedValues.length).toBeGreaterThan(0);
    });

    it('fire-v predicts danger when targeted tile is consumed by a merge', () => {
      // Targeted tile at [0][0], a matching 2 at [1][0]: swipe-down consumes [0][0].
      // Surviving merged tile lands at [1][0] (value 4). fire_v should see col 0
      // and report the 8 at [3][0] as destroyed.
      const targetTile = new Tile(2, 0, 0);
      const pm2 = new PowerManager([POWER_TYPES.FIRE_V]);
      pm2.chargeEdge('bottom', POWER_TYPES.FIRE_V);
      grid.cells[0][0] = targetTile;
      pm2.refreshTargetedTile(grid);
      grid.cells[1][0] = new Tile(2, 1, 0);
      grid.cells[3][0] = new Tile(8, 3, 0);
      const pred = pm2.predictForDirection('down', grid);
      // targetTile [0][0] is consumed by merge with [1][0]. Survivor is at [1][0] (value 4).
      // fire_v on col 0: destroys the 8 at row 3 (survivor at row 1 is the target, survives).
      expect(pred.severity).toBe('danger');
      expect(pred.destroyedValues.length).toBeGreaterThan(0);
    });

    it('fire-x predicts danger when targeted tile is consumed by a merge', () => {
      const targetTile = new Tile(2, 0, 0);
      grid.cells[0][0] = targetTile;
      pm.chargeEdge('right', POWER_TYPES.FIRE_X);
      // Clear grid and pin target
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) grid.cells[r][c] = null;
      grid.cells[0][0] = targetTile;
      const pm2 = new PowerManager([POWER_TYPES.FIRE_X]);
      pm2.chargeEdge('right', POWER_TYPES.FIRE_X);
      pm2.refreshTargetedTile(grid);
      // Add matching tile in row 0 → merge on swipe-right
      grid.cells[0][1] = new Tile(2, 0, 1);
      // Add tile in row 0 for fire_x cross to destroy
      grid.cells[0][3] = new Tile(16, 0, 3);
      const pred = pm2.predictForDirection('right', grid);
      expect(pred.severity).toBe('danger');
      expect(pred.destroyedValues.length).toBeGreaterThan(0);
    });

    it('bomb predicts the post-swipe neighbours', () => {
      fillGrid(grid, [
        [2, 4, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      pm.chargeEdge('right', POWER_TYPES.BOMB);
      pm.refreshTargetedTile(grid);
      const pred = pm.predictForDirection('right', grid);
      // After swipe-right, 2 and 4 end up in cells [0][2] and [0][3].
      // Whichever is targeted, the bomb destroys both.
      expect(pred.destroyedValues.sort((a, b) => a - b)).toEqual([2, 4]);
      expect(pred.severity).toBe('danger');
    });

    it('bomb shows danger when targeted tile is consumed by a merge', () => {
      // Set up only the targeted tile first so refreshTargetedTile picks it.
      const targetTile = new Tile(2, 0, 0);
      grid.cells[0][0] = targetTile;
      pm.chargeEdge('right', POWER_TYPES.BOMB);
      pm.refreshTargetedTile(grid); // targetTile is now the only eligible tile → it becomes the target
      // Add a matching tile — they will merge on swipe-right.
      grid.cells[0][1] = new Tile(2, 0, 1);
      // Swipe right: targetTile (at [0][0]) is consumed by the merge with [0][1].
      // The bomb must redirect to the surviving merged tile (value 4 at [0][3]).
      const pred = pm.predictForDirection('right', grid);
      expect(pred.severity).toBe('danger');
      expect(pred.destroyedValues).toEqual([4]);
    });

    it('nuclear destroys all post-swipe tiles', () => {
      fillGrid(grid, [
        [2, 2, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ]);
      pm.chargeEdge('right', POWER_TYPES.NUCLEAR);
      pm.refreshTargetedTile(grid);
      const pred = pm.predictForDirection('right', grid);
      // After swipe-right the two 2s merge into a single 4.
      expect(pred.destroyedValues).toEqual([4]);
      expect(pred.severity).toBe('danger');
    });

    it('wind returns info severity and all grid values', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][1] = new Tile(2, 0, 1);
      pm.chargeEdge('left', POWER_TYPES.WIND_UP);
      const pred = pm.predictForDirection('left', grid);
      expect(pred.severity).toBe('info');
      // After left-swipe, the two 2s merge into a 4.
      expect(pred.affectedValues).toEqual([4]);
    });

    it('is cancelled when wind blocks the direction', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.executeEffect(POWER_TYPES.WIND_DOWN, grid, null); // blocks up
      const pred = pm.predictForDirection('up', grid);
      expect(pred.cancelled).toBe(true);
    });
  });

  describe('lightningPotentialTargets', () => {
    it('returns the top tile of each non-empty column', () => {
      fillGrid(grid, [
        [2, null, null, null],
        [null, 8, null, null],
        [null, null, 4, null],
        [null, null, null, null],
      ]);
      const tops = pm.lightningPotentialTargets(grid).map((t) => t.value);
      expect(tops.sort()).toEqual([2, 4, 8]);
    });
  });

  describe('hasEdgePowers / hasActiveExpelTiles', () => {
    it('hasEdgePowers is false when no edge is charged', () => {
      expect(pm.hasEdgePowers()).toBe(false);
    });

    it('hasEdgePowers is true when any edge is charged', () => {
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      expect(pm.hasEdgePowers()).toBe(true);
    });

    it('hasActiveExpelTiles detects ghost states', () => {
      const t = new Tile(2, 0, 0);
      t.applyState('ghost-v', 4);
      grid.cells[0][0] = t;
      expect(pm.hasActiveExpelTiles(grid)).toBe(true);
    });
  });

  describe('serialize / restore', () => {
    it('round-trips edges, target, and wind state', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.refreshTargetedTile(grid);
      pm.executeEffect(POWER_TYPES.WIND_DOWN, grid, null);

      const snapshot = pm.serialize();
      const pm2 = new PowerManager([]);
      pm2.restore(snapshot);

      expect(pm2.edges.top).toBe(POWER_TYPES.BOMB);
      expect(pm2.targetedTileId).toBe(pm.targetedTileId);
      expect(pm2.windDirection).toBe('up');
      expect(pm2.windTurns).toBe(POWER_DURATIONS.WIND);
    });
  });

  describe('removePowerType', () => {
    it('removes a type from the selected pool', () => {
      pm.removePowerType(POWER_TYPES.BOMB);
      expect(pm.selectedTypes).toEqual([POWER_TYPES.FIRE_H]);
    });
  });
});
