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

    it('starts with no wind', () => {
      expect(pm.windDirection).toBeNull();
      expect(pm.windTurns).toBe(0);
    });
  });

  describe('onMove — power assignment to tiles', () => {
    it('does not assign a power on the first move', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.tickMove(grid);
      const result = pm.onMove(grid);
      expect(result).toBeNull();
    });

    it('assigns a power every POWER_PLACEMENT_INTERVAL moves', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      let result = null;
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) {
        pm.tickMove(grid);
        result = pm.onMove(grid);
      }
      expect(result).not.toBeNull();
      expect(result.power).toBeTruthy();
    });

    it('assigned power is from selectedTypes', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL - 1; i++) {
        pm.tickMove(grid);
        pm.onMove(grid);
      }
      pm.tickMove(grid);
      const tile = pm.onMove(grid);
      expect([POWER_TYPES.FIRE_H, POWER_TYPES.BOMB]).toContain(tile.power);
    });

    it('does not assign power to tiles that already have one', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.ICE;
      grid.cells[0][0] = t1;
      const t2 = new Tile(4, 0, 1);
      grid.cells[0][1] = t2;

      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) {
        pm.tickMove(grid);
        pm.onMove(grid);
      }
      // t2 should have received the power, not t1
      expect(t2.power).toBeTruthy();
    });

    it('does not assign power to tiles with an active state', () => {
      const t1 = new Tile(2, 0, 0);
      t1.applyState('ice', 3); // frozen — not a valid candidate
      grid.cells[0][0] = t1;
      const t2 = new Tile(4, 0, 1); // normal — valid candidate
      grid.cells[0][1] = t2;

      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) {
        pm.tickMove(grid);
        pm.onMove(grid);
      }
      expect(t2.power).toBeTruthy();
      expect(t1.power).toBeFalsy();
    });

    it('resets placement counter after assigning', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) {
        pm.tickMove(grid);
        pm.onMove(grid);
      }
      pm.tickMove(grid);
      expect(pm.onMove(grid)).toBeNull();
    });

    it('returns null when all tiles already have powers', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.ICE;
      grid.cells[0][0] = t1;
      // Only tile has power, so no candidate

      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) {
        pm.tickMove(grid);
        pm.onMove(grid);
      }
      // Should have tried but failed since t1 already has power
      // Actually the counter resets even when assignment fails — let's test the next interval
      grid.cells[0][0] = t1; // ensure still there
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) {
        pm.tickMove(grid);
      }
      const result = pm.onMove(grid);
      expect(result).toBeNull();
    });
  });

  describe('tickMove — tile state ticking', () => {
    it('decrements tile stateTurns on each move', () => {
      const tile = new Tile(2, 0, 0);
      tile.applyState('ice', 3);
      grid.cells[0][0] = tile;
      pm.tickMove(grid);
      expect(tile.stateTurns).toBe(2);
    });

    it('clears tile state when turns reach 0', () => {
      const tile = new Tile(2, 0, 0);
      tile.applyState('blind', 1);
      grid.cells[0][0] = tile;
      pm.tickMove(grid);
      expect(tile.state).toBeNull();
    });
  });

  describe('checkMergeTriggers', () => {
    it('returns empty array when no powered tiles merge', () => {
      const survivor = new Tile(4, 0, 0);
      grid.cells[0][0] = survivor;
      const merges = [
        { tile: survivor, fromRow: 0, fromCol: 1, consumedId: 'some-id', consumedPower: null },
      ];
      expect(pm.checkMergeTriggers(merges, grid)).toEqual([]);
    });

    it('triggers when survivor has a power', () => {
      const survivor = new Tile(4, 0, 0);
      survivor.power = POWER_TYPES.BOMB;
      grid.cells[0][0] = survivor;
      const merges = [
        { tile: survivor, fromRow: 0, fromCol: 1, consumedId: 'some-id', consumedPower: null },
      ];

      const triggers = pm.checkMergeTriggers(merges, grid);
      expect(triggers.length).toBe(1);
      expect(triggers[0].powerType).toBe(POWER_TYPES.BOMB);
      expect(triggers[0].needsChoice).toBe(false);
      expect(survivor.power).toBeNull(); // Power consumed
    });

    it('triggers when consumed tile had a power', () => {
      const survivor = new Tile(4, 0, 0);
      grid.cells[0][0] = survivor;
      const merges = [
        {
          tile: survivor,
          fromRow: 0,
          fromCol: 1,
          consumedId: 'some-id',
          consumedPower: POWER_TYPES.ICE,
        },
      ];

      const triggers = pm.checkMergeTriggers(merges, grid);
      expect(triggers.length).toBe(1);
      expect(triggers[0].powerType).toBe(POWER_TYPES.ICE);
      expect(triggers[0].needsChoice).toBe(false);
    });

    it('triggers once when both tiles have the same power', () => {
      const survivor = new Tile(4, 0, 0);
      survivor.power = POWER_TYPES.FIRE_H;
      grid.cells[0][0] = survivor;
      const merges = [
        {
          tile: survivor,
          fromRow: 0,
          fromCol: 1,
          consumedId: 'some-id',
          consumedPower: POWER_TYPES.FIRE_H,
        },
      ];

      const triggers = pm.checkMergeTriggers(merges, grid);
      expect(triggers.length).toBe(1);
      expect(triggers[0].powerType).toBe(POWER_TYPES.FIRE_H);
      expect(triggers[0].needsChoice).toBe(false);
    });

    it('returns needsChoice when tiles have different powers', () => {
      const survivor = new Tile(4, 0, 0);
      survivor.power = POWER_TYPES.FIRE_H;
      grid.cells[0][0] = survivor;
      const merges = [
        {
          tile: survivor,
          fromRow: 0,
          fromCol: 1,
          consumedId: 'some-id',
          consumedPower: POWER_TYPES.BOMB,
        },
      ];

      const triggers = pm.checkMergeTriggers(merges, grid);
      expect(triggers.length).toBe(1);
      expect(triggers[0].powerType).toBe(POWER_TYPES.FIRE_H);
      expect(triggers[0].powerTypeB).toBe(POWER_TYPES.BOMB);
      expect(triggers[0].needsChoice).toBe(true);
    });

    it('handles multiple merges with powers', () => {
      const s1 = new Tile(4, 0, 0);
      s1.power = POWER_TYPES.BOMB;
      const s2 = new Tile(8, 1, 0);
      s2.power = POWER_TYPES.ICE;
      grid.cells[0][0] = s1;
      grid.cells[1][0] = s2;

      const merges = [
        { tile: s1, fromRow: 0, fromCol: 1, consumedId: 'id1', consumedPower: null },
        { tile: s2, fromRow: 1, fromCol: 1, consumedId: 'id2', consumedPower: null },
      ];

      const triggers = pm.checkMergeTriggers(merges, grid);
      expect(triggers.length).toBe(2);
    });
  });

  describe('executeEffect', () => {
    describe('FIRE_H', () => {
      it('destroys all tiles in the same row except the target', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        grid.cells[1][0] = new Tile(4, 1, 0);
        grid.cells[1][2] = new Tile(8, 1, 2);
        grid.cells[1][3] = new Tile(16, 1, 3);
        grid.cells[0][1] = new Tile(32, 0, 1);

        const { destroyed } = pm.executeEffect(POWER_TYPES.FIRE_H, grid, target);
        expect(destroyed.length).toBe(3);
        expect(grid.cells[1][0]).toBeNull();
        expect(grid.cells[1][2]).toBeNull();
        expect(grid.cells[1][3]).toBeNull();
        expect(grid.cells[0][1]).not.toBeNull();
        expect(grid.cells[1][1]).toBe(target);
      });
    });

    describe('FIRE_V', () => {
      it('destroys all tiles in the same column except the target', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        grid.cells[0][1] = new Tile(4, 0, 1);
        grid.cells[2][1] = new Tile(8, 2, 1);
        grid.cells[3][1] = new Tile(16, 3, 1);
        grid.cells[1][0] = new Tile(32, 1, 0);

        const { destroyed } = pm.executeEffect(POWER_TYPES.FIRE_V, grid, target);
        expect(destroyed.length).toBe(3);
        expect(grid.cells[0][1]).toBeNull();
        expect(grid.cells[2][1]).toBeNull();
        expect(grid.cells[3][1]).toBeNull();
        expect(grid.cells[1][0]).not.toBeNull();
      });
    });

    describe('FIRE_X', () => {
      it('destroys tiles in both row and column of the target', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        grid.cells[1][0] = new Tile(4, 1, 0);
        grid.cells[0][1] = new Tile(8, 0, 1);
        grid.cells[2][2] = new Tile(16, 2, 2);

        const { destroyed } = pm.executeEffect(POWER_TYPES.FIRE_X, grid, target);
        expect(destroyed.length).toBe(2);
        expect(grid.cells[1][0]).toBeNull();
        expect(grid.cells[0][1]).toBeNull();
        expect(grid.cells[2][2]).not.toBeNull();
      });
    });

    describe('BOMB', () => {
      it('destroys the target tile', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        const { destroyed } = pm.executeEffect(POWER_TYPES.BOMB, grid, target);
        expect(destroyed.length).toBe(1);
        expect(destroyed[0].id).toBe(target.id);
        expect(grid.cells[1][1]).toBeNull();
      });
    });

    describe('ICE', () => {
      it('applies ice state to the target', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        const { destroyed, stateApplied } = pm.executeEffect(POWER_TYPES.ICE, grid, target);
        expect(destroyed.length).toBe(0);
        expect(stateApplied).toBe('ice');
        expect(target.state).toBe('ice');
        expect(target.stateTurns).toBe(POWER_DURATIONS.ICE);
      });
    });

    describe('TELEPORT', () => {
      it('swaps target with another random tile', () => {
        const target = new Tile(4, 0, 0);
        grid.cells[0][0] = target;
        const other = new Tile(8, 2, 3);
        grid.cells[2][3] = other;

        const { stateApplied } = pm.executeEffect(POWER_TYPES.TELEPORT, grid, target);
        expect(stateApplied).toBe('teleport');
        expect(target.row).toBe(2);
        expect(target.col).toBe(3);
        expect(other.row).toBe(0);
        expect(other.col).toBe(0);
      });

      it('does nothing when target is the only tile', () => {
        const target = new Tile(4, 0, 0);
        grid.cells[0][0] = target;
        const { stateApplied } = pm.executeEffect(POWER_TYPES.TELEPORT, grid, target);
        expect(stateApplied).toBeNull();
      });
    });

    describe('EXPEL_H', () => {
      it('applies ghost-h state to the target', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        const { stateApplied } = pm.executeEffect(POWER_TYPES.EXPEL_H, grid, target);
        expect(stateApplied).toBe('ghost-h');
        expect(target.state).toBe('ghost-h');
        expect(target.stateTurns).toBe(POWER_DURATIONS.EXPEL);
      });
    });

    describe('EXPEL_V', () => {
      it('applies ghost-v state to the target', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        const { stateApplied } = pm.executeEffect(POWER_TYPES.EXPEL_V, grid, target);
        expect(stateApplied).toBe('ghost-v');
        expect(target.state).toBe('ghost-v');
        expect(target.stateTurns).toBe(POWER_DURATIONS.EXPEL);
      });
    });

    describe('WIND', () => {
      it('sets wind direction (opposite of power direction)', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        const { stateApplied } = pm.executeEffect(POWER_TYPES.WIND_UP, grid, target);
        expect(stateApplied).toBe('wind-down');
        expect(pm.windDirection).toBe('down');
        expect(pm.windTurns).toBe(POWER_DURATIONS.WIND);
      });

      it('WIND_DOWN blocks up', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        pm.executeEffect(POWER_TYPES.WIND_DOWN, grid, target);
        expect(pm.windDirection).toBe('up');
      });

      it('WIND_LEFT blocks right', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        pm.executeEffect(POWER_TYPES.WIND_LEFT, grid, target);
        expect(pm.windDirection).toBe('right');
      });

      it('WIND_RIGHT blocks left', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        pm.executeEffect(POWER_TYPES.WIND_RIGHT, grid, target);
        expect(pm.windDirection).toBe('left');
      });
    });

    describe('LIGHTNING', () => {
      it('returns lightningStrikes with 1–3 entries', () => {
        fillGrid(grid, [
          [2, 4, 8, 16],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ]);

        const results = new Set();
        for (let i = 0; i < 40; i++) {
          const { lightningStrikes } = pm.executeEffect(POWER_TYPES.LIGHTNING, grid, null);
          results.add(lightningStrikes.length);
          // Restore grid each iteration
          for (let c = 0; c < GRID_SIZE; c++) grid.cells[0][c] = new Tile([2, 4, 8, 16][c], 0, c);
        }
        expect(results.has(1) || results.has(2) || results.has(3)).toBe(true);
        expect([...results].every((n) => n >= 1 && n <= 3)).toBe(true);
      });

      it('strikes are unique columns', () => {
        fillGrid(grid, [
          [2, 4, 8, 16],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ]);
        for (let i = 0; i < 20; i++) {
          // Restore grid
          for (let c = 0; c < GRID_SIZE; c++) grid.cells[0][c] = new Tile([2, 4, 8, 16][c], 0, c);
          const { lightningStrikes } = pm.executeEffect(POWER_TYPES.LIGHTNING, grid, null);
          const cols = lightningStrikes.map((s) => s.col);
          expect(new Set(cols).size).toBe(cols.length);
        }
      });

      it('destroys the top tile of each struck column', () => {
        fillGrid(grid, [
          [2, 4, 8, 16],
          [32, 64, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ]);

        const { destroyed, lightningStrikes } = pm.executeEffect(POWER_TYPES.LIGHTNING, grid, null);

        for (const strike of lightningStrikes) {
          if (strike.tile) {
            expect(destroyed).toContain(strike.tile);
            expect(grid.cells[strike.row][strike.col]).toBeNull();
          }
        }
      });

      it('strike targets top row (row 0) when column is empty', () => {
        // All columns empty
        const { lightningStrikes } = pm.executeEffect(POWER_TYPES.LIGHTNING, grid, null);
        for (const strike of lightningStrikes) {
          expect(strike.tile).toBeNull();
          expect(strike.row).toBe(0);
        }
        expect(grid.getAllTiles().length).toBe(0);
      });

      it('destroys nothing when all struck columns are empty', () => {
        const { destroyed } = pm.executeEffect(POWER_TYPES.LIGHTNING, grid, null);
        expect(destroyed.length).toBe(0);
      });

      it('hits top-most tile when tiles are not in row 0', () => {
        // Only tiles in row 2
        grid.cells[2][0] = new Tile(8, 2, 0);
        grid.cells[2][1] = new Tile(16, 2, 1);
        grid.cells[2][2] = new Tile(32, 2, 2);
        grid.cells[2][3] = new Tile(64, 2, 3);

        for (let attempt = 0; attempt < 20; attempt++) {
          // Restore grid
          grid.cells[2][0] = new Tile(8, 2, 0);
          grid.cells[2][1] = new Tile(16, 2, 1);
          grid.cells[2][2] = new Tile(32, 2, 2);
          grid.cells[2][3] = new Tile(64, 2, 3);

          const { lightningStrikes } = pm.executeEffect(POWER_TYPES.LIGHTNING, grid, null);
          for (const strike of lightningStrikes) {
            if (strike.tile) {
              expect(strike.row).toBe(2);
            }
          }
          // Restore cleared cells
          for (let c = 0; c < GRID_SIZE; c++) grid.cells[2][c] = new Tile([8, 16, 32, 64][c], 2, c);
        }
      });
    });

    describe('NUCLEAR', () => {
      it('destroys all tiles', () => {
        fillGrid(grid, [
          [2, 4, 8, 16],
          [32, 64, null, null],
          [null, null, null, null],
          [null, null, null, 128],
        ]);

        const { destroyed } = pm.executeEffect(POWER_TYPES.NUCLEAR, grid, null);
        expect(destroyed.length).toBe(7);
        expect(grid.getAllTiles().length).toBe(0);
      });
    });

    describe('BLIND', () => {
      it('applies blind state to all tiles', () => {
        fillGrid(grid, [
          [2, 4, null, null],
          [null, 8, null, null],
          [null, null, null, null],
          [null, null, null, 16],
        ]);

        const { stateApplied } = pm.executeEffect(POWER_TYPES.BLIND, grid, null);
        expect(stateApplied).toBe('blind');
        for (const tile of grid.getAllTiles()) {
          expect(tile.state).toBe('blind');
          expect(tile.stateTurns).toBe(POWER_DURATIONS.BLIND);
        }
      });
    });

    describe('ADS', () => {
      it('returns ads state with no destruction', () => {
        const target = new Tile(4, 1, 1);
        grid.cells[1][1] = target;
        const { destroyed, stateApplied } = pm.executeEffect(POWER_TYPES.ADS, grid, target);
        expect(destroyed.length).toBe(0);
        expect(stateApplied).toBe('ads');
      });
    });

    describe('with no valid target', () => {
      it('returns empty result for non-grid-wide effects', () => {
        const { destroyed } = pm.executeEffect(POWER_TYPES.FIRE_H, grid, null);
        expect(destroyed.length).toBe(0);
      });
    });
  });

  describe('getBadgeColor', () => {
    it('returns null when no powered tiles would merge', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][1] = new Tile(4, 0, 1);
      expect(pm.getBadgeColor('up', grid)).toBeNull();
    });

    it('returns danger for destructive powers when tiles would be destroyed', () => {
      // t1 (FIRE_H) merges with t2; t3 is in t1's row and would be destroyed
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.FIRE_H;
      const t2 = new Tile(2, 1, 0);
      const t3 = new Tile(4, 0, 1); // same row as t1 — FIRE_H destroys it
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;
      grid.cells[0][1] = t3;
      expect(pm.getBadgeColor('up', grid)).toBe('danger');
    });

    it('returns null for danger power when no tiles would be destroyed', () => {
      // FIRE_H on an isolated row — nothing else to burn
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.FIRE_H;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;
      expect(pm.getBadgeColor('up', grid)).toBeNull();
    });

    it('returns warning for non-destructive warning powers (teleport/expel/blind)', () => {
      // TELEPORT repositions tiles — always shown regardless of destruction
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.TELEPORT;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;
      expect(pm.getBadgeColor('up', grid)).toBe('warning');
    });

    it('returns info for non-destructive info powers (wind/ice)', () => {
      // ICE applies a state — always shown regardless of destruction
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.ICE;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;
      expect(pm.getBadgeColor('up', grid)).toBe('info');
    });

    it('prioritizes danger over warning and info', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.ICE; // info
      const t2 = new Tile(2, 1, 0);
      const t3 = new Tile(4, 0, 1);
      t3.power = POWER_TYPES.FIRE_H; // danger
      const t4 = new Tile(4, 1, 1);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;
      grid.cells[0][1] = t3;
      grid.cells[1][1] = t4;
      expect(pm.getBadgeColor('up', grid)).toBe('danger');
    });

    describe('expel exit predictions', () => {
      it('returns danger for a ghost-v tile with clear path going up', () => {
        const ghost = new Tile(8, 2, 1);
        ghost.applyState('ghost-v', 3);
        grid.cells[2][1] = ghost;
        // No blocker in rows 0 and 1 of col 1
        expect(pm.getBadgeColor('up', grid)).toBe('danger');
      });

      it('returns danger for a ghost-v tile with clear path going down', () => {
        const ghost = new Tile(8, 1, 1);
        ghost.applyState('ghost-v', 3);
        grid.cells[1][1] = ghost;
        expect(pm.getBadgeColor('down', grid)).toBe('danger');
      });

      it('returns danger for a ghost-h tile with clear path going left', () => {
        const ghost = new Tile(8, 1, 2);
        ghost.applyState('ghost-h', 3);
        grid.cells[1][2] = ghost;
        expect(pm.getBadgeColor('left', grid)).toBe('danger');
      });

      it('returns danger for a ghost-h tile with clear path going right', () => {
        const ghost = new Tile(8, 1, 1);
        ghost.applyState('ghost-h', 3);
        grid.cells[1][1] = ghost;
        expect(pm.getBadgeColor('right', grid)).toBe('danger');
      });

      it('returns null when ghost-v tile is blocked going up', () => {
        const ghost = new Tile(8, 2, 1);
        ghost.applyState('ghost-v', 3);
        grid.cells[2][1] = ghost;
        grid.cells[0][1] = new Tile(4, 0, 1); // blocker
        expect(pm.getBadgeColor('up', grid)).toBeNull();
      });

      it('returns null for ghost-v on wrong direction (left/right)', () => {
        const ghost = new Tile(8, 2, 1);
        ghost.applyState('ghost-v', 3);
        grid.cells[2][1] = ghost;
        expect(pm.getBadgeColor('left', grid)).toBeNull();
        expect(pm.getBadgeColor('right', grid)).toBeNull();
      });

      it('includes exits:true and destroyedValues in prediction', () => {
        const ghost = new Tile(8, 2, 1);
        ghost.applyState('ghost-v', 3);
        grid.cells[2][1] = ghost;
        const preds = pm.predictForDirection('up', grid);
        expect(preds.length).toBe(1);
        expect(preds[0].exits).toBe(true);
        expect(preds[0].tileValue).toBe(8);
        expect(preds[0].destroyedValues).toEqual([8]);
      });

      it('expel merge trigger includes mergeSourceValue', () => {
        const t1 = new Tile(8, 0, 0);
        t1.power = POWER_TYPES.EXPEL_V;
        const t2 = new Tile(8, 1, 0);
        grid.cells[0][0] = t1;
        grid.cells[1][0] = t2;
        const preds = pm.predictForDirection('up', grid);
        expect(preds.length).toBe(1);
        expect(preds[0].mergeSourceValue).toBe(8);
        expect(preds[0].tileValue).toBe(16);
        expect(preds[0].exits).toBeFalsy();
      });
    });
  });

  describe('hasActiveExpelTiles', () => {
    it('returns false when no ghost tiles exist', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      expect(pm.hasActiveExpelTiles(grid)).toBe(false);
    });

    it('returns true when a ghost-v tile exists', () => {
      const t = new Tile(2, 0, 0);
      t.applyState('ghost-v', 3);
      grid.cells[0][0] = t;
      expect(pm.hasActiveExpelTiles(grid)).toBe(true);
    });

    it('returns true when a ghost-h tile exists', () => {
      const t = new Tile(2, 0, 0);
      t.applyState('ghost-h', 3);
      grid.cells[0][0] = t;
      expect(pm.hasActiveExpelTiles(grid)).toBe(true);
    });
  });

  describe('predictForDirection — LIGHTNING lightningRange', () => {
    it('includes lightningRange on a LIGHTNING prediction', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.LIGHTNING;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;
      grid.cells[0][1] = new Tile(4, 0, 1);
      grid.cells[0][2] = new Tile(8, 0, 2);

      const pm2 = new PowerManager([POWER_TYPES.LIGHTNING]);
      const preds = pm2.predictForDirection('up', grid);
      const lightPred = preds.find((p) => p.powerType === POWER_TYPES.LIGHTNING);
      expect(lightPred).toBeDefined();
      expect(lightPred.lightningRange).toBeDefined();
      expect(Array.isArray(lightPred.lightningRange.min)).toBe(true);
      expect(Array.isArray(lightPred.lightningRange.max)).toBe(true);
    });

    it('min has 1 value when all 4 columns have tiles (no empty column)', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.LIGHTNING;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;
      grid.cells[0][1] = new Tile(4, 0, 1);
      grid.cells[0][2] = new Tile(8, 0, 2);
      grid.cells[0][3] = new Tile(16, 0, 3);

      const pm2 = new PowerManager([POWER_TYPES.LIGHTNING]);
      const preds = pm2.predictForDirection('up', grid);
      const lightPred = preds.find((p) => p.powerType === POWER_TYPES.LIGHTNING);
      // All 4 columns filled → min = [lowest top-tile], not empty
      expect(lightPred.lightningRange.min.length).toBe(1);
      expect(lightPred.lightningRange.max.length).toBeLessThanOrEqual(3);
      expect(lightPred.lightningRange.max.length).toBeGreaterThanOrEqual(1);
    });

    it('min is empty when some columns are empty (strike can land on an empty col)', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.LIGHTNING;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;
      // columns 1, 2, 3 are empty after merge

      const pm2 = new PowerManager([POWER_TYPES.LIGHTNING]);
      const preds = pm2.predictForDirection('up', grid);
      const lightPred = preds.find((p) => p.powerType === POWER_TYPES.LIGHTNING);
      // Only column 0 has a tile (merged), columns 1-3 are empty → min = ∅
      expect(lightPred.lightningRange.min).toEqual([]);
    });

    it('min is empty when only 1 column has tiles (user-reported case: min ≠ 8)', () => {
      // Exactly the reported bug: 1 column with tile value 8, rest empty
      grid.cells[0][2] = new Tile(8, 0, 2);
      const t1 = new Tile(4, 1, 2);
      t1.power = POWER_TYPES.LIGHTNING;
      const t2 = new Tile(4, 2, 2);
      grid.cells[1][2] = t1;
      grid.cells[2][2] = t2;

      const pm2 = new PowerManager([POWER_TYPES.LIGHTNING]);
      const preds = pm2.predictForDirection('up', grid);
      const lightPred = preds.find((p) => p.powerType === POWER_TYPES.LIGHTNING);
      // 3 columns empty → a strike can always miss → min must be []
      expect(lightPred.lightningRange.min).toEqual([]);
    });

    it('max values are sorted descending', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.LIGHTNING;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;
      grid.cells[0][1] = new Tile(4, 0, 1);
      grid.cells[0][2] = new Tile(16, 0, 2);
      grid.cells[0][3] = new Tile(8, 0, 3);

      const pm2 = new PowerManager([POWER_TYPES.LIGHTNING]);
      const preds = pm2.predictForDirection('up', grid);
      const lightPred = preds.find((p) => p.powerType === POWER_TYPES.LIGHTNING);
      const max = lightPred.lightningRange.max;
      for (let i = 1; i < max.length; i++) {
        expect(max[i - 1]).toBeGreaterThanOrEqual(max[i]);
      }
    });
  });

  describe('predictForDirection', () => {
    it('returns empty when no powered tiles would merge', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][1] = new Tile(4, 0, 1); // different value — no merge
      expect(pm.predictForDirection('left', grid)).toEqual([]);
    });

    it('returns a prediction when a powered tile would merge', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.ICE;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;

      const preds = pm.predictForDirection('up', grid);
      expect(preds.length).toBe(1);
      expect(preds[0].powerType).toBe(POWER_TYPES.ICE);
    });

    it('returns empty when wind blocks the direction — even with powered tiles that would merge', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.ICE;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;

      // Wind is blocking the 'up' direction
      pm.restore({
        selectedTypes: pm.selectedTypes,
        movesSincePlacement: 0,
        windDirection: 'up',
        windTurns: 2,
      });

      expect(pm.predictForDirection('up', grid)).toEqual([]);
    });

    it('still returns predictions for unblocked directions when wind is active', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.ICE;
      const t2 = new Tile(2, 0, 1);
      grid.cells[0][0] = t1;
      grid.cells[0][1] = t2;

      // Wind blocks 'up', but 'left' is free
      pm.restore({
        selectedTypes: pm.selectedTypes,
        movesSincePlacement: 0,
        windDirection: 'up',
        windTurns: 2,
      });

      const preds = pm.predictForDirection('left', grid);
      expect(preds.length).toBe(1);
      expect(preds[0].powerType).toBe(POWER_TYPES.ICE);
    });
  });

  describe('getBadgeColor — wind blocking', () => {
    it('returns null for a direction blocked by wind even with powered tiles', () => {
      const t1 = new Tile(2, 0, 0);
      t1.power = POWER_TYPES.ICE;
      const t2 = new Tile(2, 1, 0);
      grid.cells[0][0] = t1;
      grid.cells[1][0] = t2;

      pm.restore({
        selectedTypes: pm.selectedTypes,
        movesSincePlacement: 0,
        windDirection: 'up',
        windTurns: 3,
      });

      // 'up' is blocked — no merge will happen so no badge
      expect(pm.getBadgeColor('up', grid)).toBeNull();
      // 'down' is not blocked — but no merge in that direction either for this layout
      // Just verify the blocked direction is null
    });
  });

  describe('wind ticking', () => {
    it('decrements wind turns on each move', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.restore({
        selectedTypes: [POWER_TYPES.WIND_UP],
        movesSincePlacement: 0,
        windDirection: 'down',
        windTurns: 2,
      });

      pm.tickMove(grid);
      expect(pm.windTurns).toBe(1);
      expect(pm.windDirection).toBe('down');
    });

    it('clears wind when turns reach 0', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.restore({
        selectedTypes: [POWER_TYPES.WIND_UP],
        movesSincePlacement: 0,
        windDirection: 'down',
        windTurns: 1,
      });

      pm.tickMove(grid);
      expect(pm.windTurns).toBe(0);
      expect(pm.windDirection).toBeNull();
    });
  });

  describe('serialize / restore', () => {
    it('round-trips through serialize and restore', () => {
      pm.restore({
        selectedTypes: [POWER_TYPES.FIRE_H, POWER_TYPES.BOMB],
        movesSincePlacement: 1,
        windDirection: 'up',
        windTurns: 2,
      });

      const data = pm.serialize();
      const pm2 = new PowerManager([]);
      pm2.restore(data);

      expect(pm2.selectedTypes).toEqual([POWER_TYPES.FIRE_H, POWER_TYPES.BOMB]);
      expect(pm2.windDirection).toBe('up');
      expect(pm2.windTurns).toBe(2);
    });

    it('serializes correctly with empty state', () => {
      const data = pm.serialize();
      expect(data.selectedTypes).toEqual([POWER_TYPES.FIRE_H, POWER_TYPES.BOMB]);
      expect(data.movesSincePlacement).toBe(0);
      expect(data.windDirection).toBeNull();
      expect(data.windTurns).toBe(0);
    });
  });

  describe('hasPoweredTiles', () => {
    it('returns false when no tiles have powers', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      expect(pm.hasPoweredTiles(grid)).toBe(false);
    });

    it('returns true when a tile has a power', () => {
      const t = new Tile(2, 0, 0);
      t.power = POWER_TYPES.BOMB;
      grid.cells[0][0] = t;
      expect(pm.hasPoweredTiles(grid)).toBe(true);
    });
  });
});
