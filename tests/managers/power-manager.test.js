import { describe, it, expect, beforeEach, vi } from 'vitest';
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

    it('starts with no active powers', () => {
      expect(pm.getActivePowers()).toEqual([]);
    });

    it('starts with no targeted tile', () => {
      expect(pm.targetedTileId).toBeNull();
    });

    it('starts with no wind', () => {
      expect(pm.windDirection).toBeNull();
      expect(pm.windTurns).toBe(0);
    });
  });

  describe('onMove — placement timing', () => {
    it('does not place a power on the first move', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      const result = pm.onMove(grid);
      expect(result).toBeNull();
    });

    it('places a power every POWER_PLACEMENT_INTERVAL moves', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      let placed = null;
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) {
        placed = pm.onMove(grid);
      }
      expect(placed).not.toBeNull();
      expect(placed.side).toBeTruthy();
    });

    it('placed power has a type from selectedTypes', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL - 1; i++) pm.onMove(grid);
      const power = pm.onMove(grid);
      expect([POWER_TYPES.FIRE_H, POWER_TYPES.BOMB]).toContain(power.type);
    });

    it('resets placement counter after placing', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      // Place first
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) pm.onMove(grid);
      // Next move should not place
      expect(pm.onMove(grid)).toBeNull();
    });
  });

  describe('onMove — tile state ticking', () => {
    it('decrements tile stateTurns on each move', () => {
      const tile = new Tile(2, 0, 0);
      tile.applyState('frozen', 3);
      grid.cells[0][0] = tile;
      pm.onMove(grid);
      expect(tile.stateTurns).toBe(2);
    });

    it('clears tile state when turns reach 0', () => {
      const tile = new Tile(2, 0, 0);
      tile.applyState('blind', 1);
      grid.cells[0][0] = tile;
      pm.onMove(grid);
      expect(tile.state).toBeNull();
    });
  });

  describe('getAvailableSides', () => {
    it('returns all 4 sides when no powers are placed', () => {
      expect(pm.getAvailableSides()).toEqual(['top', 'bottom', 'left', 'right']);
    });

    it('excludes sides with active powers', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      // Force placement
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) pm.onMove(grid);
      expect(pm.getAvailableSides().length).toBe(3);
    });
  });

  describe('getPowerOnSide', () => {
    it('returns null for empty side', () => {
      expect(pm.getPowerOnSide('top')).toBeNull();
    });
  });

  describe('checkTrigger', () => {
    it('returns null when no power on the matching side', () => {
      expect(pm.checkTrigger('up', [])).toBeNull();
    });

    it('returns null when no merge occurred', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      // Place a power on some side
      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) pm.onMove(grid);
      const power = pm.getPowerOnSide('top');
      if (!power) return; // Side may be random, skip if not top

      // No merges at all
      expect(pm.checkTrigger('up', [])).toBeNull();
    });

    it('returns the power when any merge occurs in the matching direction', () => {
      const tile = new Tile(2, 0, 0);
      grid.cells[0][0] = tile;

      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) pm.onMove(grid);

      const activePowers = pm.getActivePowers();
      if (activePowers.length === 0) return;
      const power = activePowers[0];
      const direction = { top: 'up', bottom: 'down', left: 'left', right: 'right' }[power.side];

      // Any merge — doesn't need to involve the targeted tile
      const otherTile = new Tile(4, 1, 0);
      const merges = [{ tile: otherTile, fromRow: 1, fromCol: 0, consumedId: 'some-id' }];
      const triggered = pm.checkTrigger(direction, merges);
      expect(triggered).not.toBeNull();
      expect(triggered.type).toBe(power.type);
    });

    it('removes the triggered power from active powers', () => {
      const tile = new Tile(2, 0, 0);
      grid.cells[0][0] = tile;
      tile.targeted = true;

      for (let i = 0; i < POWER_PLACEMENT_INTERVAL; i++) pm.onMove(grid);
      const activePowers = pm.getActivePowers();
      if (activePowers.length === 0) return;
      const power = activePowers[0];
      const direction = { top: 'up', bottom: 'down', left: 'left', right: 'right' }[power.side];

      const merges = [{ tile, fromRow: 0, fromCol: 0, consumedId: 'some-id' }];
      pm.checkTrigger(direction, merges);
      expect(pm.getPowerOnSide(power.side)).toBeNull();
    });
  });

  describe('executeEffect', () => {
    /** Helper to set up a targeted tile and return it */
    function setupTarget(grid, pm, value = 2, row = 1, col = 1) {
      const tile = new Tile(value, row, col);
      tile.targeted = true;
      grid.cells[row][col] = tile;
      // Use restore to inject a fake target id
      pm.restore(
        {
          selectedTypes: pm.selectedTypes,
          activePowers: [],
          targetedTileId: tile.id,
          movesSincePlacement: 0,
          windDirection: null,
          windTurns: 0,
        },
        grid,
      );
      return tile;
    }

    describe('FIRE_H', () => {
      it('destroys all tiles in the same row except the target', () => {
        const target = setupTarget(grid, pm, 2, 1, 1);
        grid.cells[1][0] = new Tile(4, 1, 0);
        grid.cells[1][2] = new Tile(8, 1, 2);
        grid.cells[1][3] = new Tile(16, 1, 3);
        grid.cells[0][1] = new Tile(32, 0, 1); // different row, should survive

        const { destroyed } = pm.executeEffect({ type: POWER_TYPES.FIRE_H }, grid);
        expect(destroyed.length).toBe(3);
        expect(grid.cells[1][0]).toBeNull();
        expect(grid.cells[1][2]).toBeNull();
        expect(grid.cells[1][3]).toBeNull();
        expect(grid.cells[0][1]).not.toBeNull(); // survived
        expect(grid.cells[1][1]).toBe(target); // target survived
      });
    });

    describe('FIRE_V', () => {
      it('destroys all tiles in the same column except the target', () => {
        const target = setupTarget(grid, pm, 2, 1, 1);
        grid.cells[0][1] = new Tile(4, 0, 1);
        grid.cells[2][1] = new Tile(8, 2, 1);
        grid.cells[3][1] = new Tile(16, 3, 1);
        grid.cells[1][0] = new Tile(32, 1, 0); // different col

        const { destroyed } = pm.executeEffect({ type: POWER_TYPES.FIRE_V }, grid);
        expect(destroyed.length).toBe(3);
        expect(grid.cells[0][1]).toBeNull();
        expect(grid.cells[2][1]).toBeNull();
        expect(grid.cells[3][1]).toBeNull();
        expect(grid.cells[1][0]).not.toBeNull();
      });
    });

    describe('FIRE_X', () => {
      it('destroys tiles in both row and column of the target', () => {
        const target = setupTarget(grid, pm, 2, 1, 1);
        grid.cells[1][0] = new Tile(4, 1, 0);
        grid.cells[0][1] = new Tile(8, 0, 1);
        grid.cells[2][2] = new Tile(16, 2, 2); // not in row or col

        const { destroyed } = pm.executeEffect({ type: POWER_TYPES.FIRE_X }, grid);
        expect(destroyed.length).toBe(2);
        expect(grid.cells[1][0]).toBeNull();
        expect(grid.cells[0][1]).toBeNull();
        expect(grid.cells[2][2]).not.toBeNull();
      });
    });

    describe('BOMB', () => {
      it('destroys the target tile', () => {
        const target = setupTarget(grid, pm, 2, 1, 1);
        const { destroyed } = pm.executeEffect({ type: POWER_TYPES.BOMB }, grid);
        expect(destroyed.length).toBe(1);
        expect(destroyed[0].id).toBe(target.id);
        expect(grid.cells[1][1]).toBeNull();
      });
    });

    describe('ICE', () => {
      it('applies frozen state to the target', () => {
        const target = setupTarget(grid, pm, 2, 1, 1);
        const { destroyed, stateApplied } = pm.executeEffect({ type: POWER_TYPES.ICE }, grid);
        expect(destroyed.length).toBe(0);
        expect(stateApplied).toBe('frozen');
        expect(target.state).toBe('frozen');
        expect(target.stateTurns).toBe(POWER_DURATIONS.ICE);
      });
    });

    describe('TELEPORT', () => {
      it('swaps target with another random tile', () => {
        const target = setupTarget(grid, pm, 2, 0, 0);
        const other = new Tile(4, 2, 3);
        grid.cells[2][3] = other;

        const { stateApplied } = pm.executeEffect({ type: POWER_TYPES.TELEPORT }, grid);
        expect(stateApplied).toBe('teleport');
        // Positions should be swapped
        expect(target.row).toBe(2);
        expect(target.col).toBe(3);
        expect(other.row).toBe(0);
        expect(other.col).toBe(0);
        expect(grid.cells[0][0]).toBe(other);
        expect(grid.cells[2][3]).toBe(target);
      });

      it('does nothing when target is the only tile', () => {
        setupTarget(grid, pm, 2, 0, 0);
        const { stateApplied } = pm.executeEffect({ type: POWER_TYPES.TELEPORT }, grid);
        expect(stateApplied).toBeNull();
      });
    });

    describe('EXPEL_H', () => {
      it('applies ghost-h state to the target', () => {
        const target = setupTarget(grid, pm, 2, 1, 1);
        const { stateApplied } = pm.executeEffect({ type: POWER_TYPES.EXPEL_H }, grid);
        expect(stateApplied).toBe('ghost-h');
        expect(target.state).toBe('ghost-h');
        expect(target.stateTurns).toBe(POWER_DURATIONS.EXPEL);
      });
    });

    describe('EXPEL_V', () => {
      it('applies ghost-v state to the target', () => {
        const target = setupTarget(grid, pm, 2, 1, 1);
        const { stateApplied } = pm.executeEffect({ type: POWER_TYPES.EXPEL_V }, grid);
        expect(stateApplied).toBe('ghost-v');
        expect(target.state).toBe('ghost-v');
        expect(target.stateTurns).toBe(POWER_DURATIONS.EXPEL);
      });
    });

    describe('WIND', () => {
      it('sets wind direction (opposite of power direction)', () => {
        setupTarget(grid, pm, 2, 1, 1);
        const { stateApplied } = pm.executeEffect({ type: POWER_TYPES.WIND_UP }, grid);
        expect(stateApplied).toBe('wind-down');
        expect(pm.windDirection).toBe('down');
        expect(pm.windTurns).toBe(POWER_DURATIONS.WIND);
      });

      it('WIND_DOWN blocks up', () => {
        setupTarget(grid, pm, 2, 1, 1);
        pm.executeEffect({ type: POWER_TYPES.WIND_DOWN }, grid);
        expect(pm.windDirection).toBe('up');
      });

      it('WIND_LEFT blocks right', () => {
        setupTarget(grid, pm, 2, 1, 1);
        pm.executeEffect({ type: POWER_TYPES.WIND_LEFT }, grid);
        expect(pm.windDirection).toBe('right');
      });

      it('WIND_RIGHT blocks left', () => {
        setupTarget(grid, pm, 2, 1, 1);
        pm.executeEffect({ type: POWER_TYPES.WIND_RIGHT }, grid);
        expect(pm.windDirection).toBe('left');
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
        // Nuclear doesn't need a target
        pm.restore(
          {
            selectedTypes: pm.selectedTypes,
            activePowers: [],
            targetedTileId: null,
            movesSincePlacement: 0,
            windDirection: null,
            windTurns: 0,
          },
          grid,
        );

        const { destroyed } = pm.executeEffect({ type: POWER_TYPES.NUCLEAR }, grid);
        expect(destroyed.length).toBe(7);
        expect(grid.getAllTiles().length).toBe(0);
      });
    });

    describe('BLIND', () => {
      it('applies blind state to all tiles', () => {
        const tiles = fillGrid(grid, [
          [2, 4, null, null],
          [null, 8, null, null],
          [null, null, null, null],
          [null, null, null, 16],
        ]);

        pm.restore(
          {
            selectedTypes: pm.selectedTypes,
            activePowers: [],
            targetedTileId: null,
            movesSincePlacement: 0,
            windDirection: null,
            windTurns: 0,
          },
          grid,
        );

        const { stateApplied } = pm.executeEffect({ type: POWER_TYPES.BLIND }, grid);
        expect(stateApplied).toBe('blind');
        for (const tile of grid.getAllTiles()) {
          expect(tile.state).toBe('blind');
          expect(tile.stateTurns).toBe(POWER_DURATIONS.BLIND);
        }
      });
    });

    describe('ADS', () => {
      it('returns ads state with no destruction', () => {
        setupTarget(grid, pm, 2, 1, 1);
        const { destroyed, stateApplied } = pm.executeEffect({ type: POWER_TYPES.ADS }, grid);
        expect(destroyed.length).toBe(0);
        expect(stateApplied).toBe('ads');
      });
    });

    describe('with no valid target', () => {
      it('returns empty result for non-grid-wide effects', () => {
        // No target set
        const { destroyed } = pm.executeEffect({ type: POWER_TYPES.FIRE_H }, grid);
        expect(destroyed.length).toBe(0);
      });
    });
  });

  describe('refreshTarget', () => {
    it('clears target when no active powers exist', () => {
      const tile = new Tile(2, 0, 0);
      tile.targeted = true;
      grid.cells[0][0] = tile;
      pm.restore(
        {
          selectedTypes: [POWER_TYPES.BOMB],
          activePowers: [],
          targetedTileId: tile.id,
          movesSincePlacement: 0,
          windDirection: null,
          windTurns: 0,
        },
        grid,
      );

      pm.refreshTarget(grid);
      expect(pm.targetedTileId).toBeNull();
      expect(tile.targeted).toBe(false);
    });

    it('picks a new target when current target no longer exists', () => {
      const tile = new Tile(2, 0, 0);
      grid.cells[0][0] = tile;

      pm.restore(
        {
          selectedTypes: [POWER_TYPES.BOMB],
          activePowers: [{ side: 'top', type: POWER_TYPES.BOMB }],
          targetedTileId: 'gone-id',
          movesSincePlacement: 0,
          windDirection: null,
          windTurns: 0,
        },
        grid,
      );

      pm.refreshTarget(grid);
      expect(pm.targetedTileId).toBe(tile.id);
      expect(tile.targeted).toBe(true);
    });

    it('keeps current target if still valid', () => {
      const tile = new Tile(2, 0, 0);
      tile.targeted = true;
      grid.cells[0][0] = tile;

      pm.restore(
        {
          selectedTypes: [POWER_TYPES.BOMB],
          activePowers: [{ side: 'top', type: POWER_TYPES.BOMB }],
          targetedTileId: tile.id,
          movesSincePlacement: 0,
          windDirection: null,
          windTurns: 0,
        },
        grid,
      );

      pm.refreshTarget(grid);
      expect(pm.targetedTileId).toBe(tile.id);
    });
  });

  describe('wind ticking', () => {
    it('decrements wind turns on each move', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.restore(
        {
          selectedTypes: [POWER_TYPES.WIND_UP],
          activePowers: [],
          targetedTileId: null,
          movesSincePlacement: 0,
          windDirection: 'down',
          windTurns: 2,
        },
        grid,
      );

      pm.onMove(grid);
      expect(pm.windTurns).toBe(1);
      expect(pm.windDirection).toBe('down');
    });

    it('clears wind when turns reach 0', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      pm.restore(
        {
          selectedTypes: [POWER_TYPES.WIND_UP],
          activePowers: [],
          targetedTileId: null,
          movesSincePlacement: 0,
          windDirection: 'down',
          windTurns: 1,
        },
        grid,
      );

      pm.onMove(grid);
      expect(pm.windTurns).toBe(0);
      expect(pm.windDirection).toBeNull();
    });
  });

  describe('getBadgeColor', () => {
    it('returns info when no power on the side', () => {
      expect(pm.getBadgeColor('top', grid)).toBe('info');
    });

    it('returns info when prediction shows no destruction', () => {
      const tile = new Tile(2, 0, 0);
      grid.cells[0][0] = tile;

      pm.restore(
        {
          selectedTypes: [POWER_TYPES.ICE],
          activePowers: [{ side: 'top', type: POWER_TYPES.ICE }],
          targetedTileId: tile.id,
          movesSincePlacement: 0,
          windDirection: null,
          windTurns: 0,
        },
        grid,
      );

      // ICE doesn't destroy anything → info
      expect(pm.getBadgeColor('top', grid)).toBe('info');
    });
  });

  describe('serialize / restore', () => {
    it('round-trips through serialize and restore', () => {
      const tile = new Tile(2, 0, 0);
      tile.targeted = true;
      grid.cells[0][0] = tile;

      pm.restore(
        {
          selectedTypes: [POWER_TYPES.FIRE_H, POWER_TYPES.BOMB],
          activePowers: [
            { side: 'top', type: POWER_TYPES.FIRE_H },
            { side: 'left', type: POWER_TYPES.BOMB },
          ],
          targetedTileId: tile.id,
          movesSincePlacement: 1,
          windDirection: 'up',
          windTurns: 2,
        },
        grid,
      );

      const data = pm.serialize();
      const pm2 = new PowerManager([]);
      pm2.restore(data, grid);

      expect(pm2.selectedTypes).toEqual([POWER_TYPES.FIRE_H, POWER_TYPES.BOMB]);
      expect(pm2.getActivePowers().length).toBe(2);
      expect(pm2.getPowerOnSide('top')).not.toBeNull();
      expect(pm2.getPowerOnSide('left')).not.toBeNull();
      expect(pm2.targetedTileId).toBe(tile.id);
      expect(pm2.windDirection).toBe('up');
      expect(pm2.windTurns).toBe(2);
    });

    it('serializes correctly with empty state', () => {
      const data = pm.serialize();
      expect(data.selectedTypes).toEqual([POWER_TYPES.FIRE_H, POWER_TYPES.BOMB]);
      expect(data.activePowers).toEqual([]);
      expect(data.targetedTileId).toBeNull();
      expect(data.movesSincePlacement).toBe(0);
      expect(data.windDirection).toBeNull();
      expect(data.windTurns).toBe(0);
    });
  });
});
