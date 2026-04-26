import { describe, it, expect, beforeEach } from 'vitest';
import { BattleManager } from '../../src/managers/battle-manager.js';
import { PowerManager } from '../../src/managers/power-manager.js';
import { Grid } from '../../src/entities/grid.js';
import { Tile } from '../../src/entities/tile.js';
import { BATTLE, POWER_TYPES } from '../../src/configs/constants.js';

describe('BattleManager', () => {
  /** @type {BattleManager} */
  let bm;
  /** @type {Grid} */
  let grid;

  beforeEach(() => {
    bm = new BattleManager(0); // BL0: chiller / lv16
    grid = new Grid();
  });

  describe('initial state', () => {
    it('starts in classic phase', () => {
      expect(bm.isClassicPhase).toBe(true);
      expect(bm.isBattlePhase).toBe(false);
    });

    it('starts with 0 classic moves', () => {
      expect(bm.classicMoves).toBe(0);
    });

    it('starts with no enemy', () => {
      expect(bm.enemy).toBeNull();
    });

    it('starts with 0 enemies defeated', () => {
      expect(bm.enemiesDefeated).toBe(0);
    });
  });

  describe('tickClassicPhase', () => {
    it('increments classic move counter', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      bm.tickClassicPhase(grid);
      expect(bm.classicMoves).toBe(1);
    });

    it('does not spawn enemy before CLASSIC_MOVES', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES - 1; i++) {
        const result = bm.tickClassicPhase(grid);
        expect(result).toBeNull();
      }
    });

    it('spawns enemy after CLASSIC_MOVES if max tile requirement is met', () => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      let enemy = null;
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        enemy = bm.tickClassicPhase(grid);
      }
      expect(enemy).not.toBeNull();
      expect(enemy.level).toBe(16);
    });

    it('does not spawn enemy if max tile is too low', () => {
      // BL1: phantom/lv8 → frostbite/lv16. Defeat lv8 with tile 8,
      // then lv16 must not spawn because max tile (8) < 16.
      const bmMulti = new BattleManager(1);
      grid.cells[0][0] = new Tile(8, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bmMulti.tickClassicPhase(grid);
      }
      bmMulti.applyMergeDamage([{ tile: { value: 2048 } }]);
      bmMulti.defeatEnemy();

      // Try to spawn lv16 — should not appear since max tile is 8
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        const result = bmMulti.tickClassicPhase(grid);
        expect(result).toBeNull();
      }
    });

    it('spawns second enemy after first is defeated and tile requirement is met', () => {
      // BL1: phantom/lv8 → frostbite/lv16
      const bmMulti = new BattleManager(1);
      grid.cells[0][0] = new Tile(16, 0, 0);

      // Spawn and defeat phantom/lv8
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bmMulti.tickClassicPhase(grid);
      }
      expect(bmMulti.enemy.level).toBe(8);

      bmMulti.applyMergeDamage([
        { tile: { value: 2048 } },
        { tile: { value: 2048 } },
        { tile: { value: 2048 } },
      ]);
      bmMulti.defeatEnemy();

      // Now tick for frostbite/lv16
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bmMulti.tickClassicPhase(grid);
      }
      expect(bmMulti.enemy).not.toBeNull();
      expect(bmMulti.enemy.level).toBe(16);
    });

    it('returns null during battle phase', () => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      // Spawn enemy
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      expect(bm.isBattlePhase).toBe(true);
      // Try ticking again — should return null
      const result = bm.tickClassicPhase(grid);
      expect(result).toBeNull();
    });
  });

  describe('contaminate', () => {
    /** @type {PowerManager} */
    let pm;
    beforeEach(() => {
      pm = new PowerManager([]);
    });

    it('returns null when no enemy is active', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      expect(bm.contaminate(grid, pm)).toBeNull();
    });

    it('direct powers (ice) pick a tile without applying state (deferred to after animation)', () => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      grid.cells[1][1] = new Tile(16, 1, 1);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) bm.tickClassicPhase(grid);
      // Force only ICE so contaminate always produces a direct result
      bm.enemy.powerStock = { [POWER_TYPES.ICE]: 3 };
      const result = bm.contaminate(grid, pm);
      expect(result).not.toBeNull();
      expect(result.kind).toBe('direct');
      expect(result.tile).not.toBeNull();
      // State is NOT applied here — the scene applies it after the animation plays.
      expect(result.tile.state).toBeNull();
    });

    it('edge-charged powers (e.g. bomb) are placed on a grid edge', () => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) bm.tickClassicPhase(grid);
      // Force the enemy to only have BOMB (edge-charged)
      bm.enemy.powerStock = { [POWER_TYPES.BOMB]: 1 };

      const result = bm.contaminate(grid, pm);
      expect(result).not.toBeNull();
      expect(result.kind).toBe('edge');
      expect(['top', 'bottom', 'left', 'right']).toContain(result.side);
      expect(pm.edges[result.side]).toBe(POWER_TYPES.BOMB);
    });

    it('decrements the enemy stock after each cast', () => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) bm.tickClassicPhase(grid);
      bm.enemy.powerStock = { [POWER_TYPES.ICE]: 2 };
      bm.contaminate(grid, pm);
      expect(bm.enemy.powerStock[POWER_TYPES.ICE]).toBe(1);
    });

    it('returns null when the enemy stock is empty', () => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) bm.tickClassicPhase(grid);
      bm.enemy.powerStock = {};
      expect(bm.contaminate(grid, pm)).toBeNull();
    });
  });

  describe('applyMergeDamage', () => {
    beforeEach(() => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
    });

    it('deals damage to the active enemy', () => {
      const initialHp = bm.enemy.life.currentHp;
      bm.applyMergeDamage([{ tile: { value: 4 } }]);
      expect(bm.enemy.life.currentHp).toBeLessThan(initialHp);
    });

    it('returns damage dealt and killed status', () => {
      const result = bm.applyMergeDamage([{ tile: { value: 4 } }]);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.killed).toBe(false);
    });

    it('returns killed=true when enemy HP reaches 0', () => {
      const result = bm.applyMergeDamage([
        { tile: { value: 2048 } },
        { tile: { value: 2048 } },
        { tile: { value: 2048 } },
        { tile: { value: 2048 } },
      ]);
      expect(result.killed).toBe(true);
    });

    it('returns 0 damage when no merges', () => {
      const result = bm.applyMergeDamage([]);
      expect(result.damage).toBe(0);
    });

    it('returns 0 damage when no enemy', () => {
      bm.defeatEnemy();
      const result = bm.applyMergeDamage([{ tile: { value: 4 } }]);
      expect(result.damage).toBe(0);
    });
  });

  describe('defeatEnemy', () => {
    beforeEach(() => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
    });

    it('marks the enemy level as defeated', () => {
      bm.defeatEnemy();
      expect(bm.defeatedLevels.has(16)).toBe(true);
    });

    it('returns to classic phase', () => {
      bm.defeatEnemy();
      expect(bm.isClassicPhase).toBe(true);
    });

    it('resets classic move counter', () => {
      bm.defeatEnemy();
      expect(bm.classicMoves).toBe(0);
    });

    it('increments enemies defeated count', () => {
      bm.defeatEnemy();
      expect(bm.enemiesDefeated).toBe(1);
    });

    it('tracks maxEnemyLevel as highest defeated level', () => {
      expect(bm.maxEnemyLevel).toBe(0); // none defeated yet
      bm.defeatEnemy();
      expect(bm.maxEnemyLevel).toBe(16);
    });

    it('returns the dead enemy', () => {
      const dead = bm.defeatEnemy();
      expect(dead).not.toBeNull();
      expect(dead.level).toBe(16);
    });
  });

  describe('clearGridPowers', () => {
    it('clears tile states and edge charges', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][0].applyState('ice', 3);
      grid.cells[1][1] = new Tile(4, 1, 1);
      grid.cells[1][1].applyState('blind', 2);

      const pm = new PowerManager([]);
      pm.chargeEdge('top', POWER_TYPES.BOMB);
      pm.chargeEdge('left', POWER_TYPES.FIRE_H);

      bm.clearGridPowers(grid, pm);

      for (const tile of grid.getAllTiles()) {
        expect(tile.state).toBeNull();
      }
      expect(pm.edges).toEqual({ top: null, bottom: null, left: null, right: null });
    });
  });

  describe('allDefeated', () => {
    it('returns false initially', () => {
      expect(bm.allDefeated()).toBe(false);
    });
  });

  describe('level progression', () => {
    it('enemies appear in order from the battle level sequence', () => {
      // Use battle level 0: a single chiller/lv16 enemy
      const bmLv = new BattleManager(0);
      grid.cells[0][0] = new Tile(16, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bmLv.tickClassicPhase(grid);
      }
      expect(bmLv.enemy).not.toBeNull();
      expect(bmLv.enemy.level).toBe(16);
      bmLv.applyMergeDamage([
        { tile: { value: 2048 } },
        { tile: { value: 2048 } },
        { tile: { value: 2048 } },
      ]);
      bmLv.defeatEnemy();
      expect(bmLv.allDefeated()).toBe(true);
    });
  });

  describe('serialize / restore', () => {
    it('round-trips empty state', () => {
      const data = bm.serialize();
      const bm2 = new BattleManager();
      bm2.restore(data);
      expect(bm2.isClassicPhase).toBe(true);
      expect(bm2.classicMoves).toBe(0);
    });

    it('round-trips active enemy state', () => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      bm.applyMergeDamage([{ tile: { value: 4 } }]);

      const data = bm.serialize();
      const bm2 = new BattleManager(0);
      bm2.restore(data);

      expect(bm2.isBattlePhase).toBe(true);
      expect(bm2.enemy.level).toBe(16);
      expect(bm2.enemy.life.currentHp).toBe(bm.enemy.life.currentHp);
    });

    it('round-trips defeated levels', () => {
      grid.cells[0][0] = new Tile(16, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      bm.defeatEnemy();

      const data = bm.serialize();
      const bm2 = new BattleManager(0);
      bm2.restore(data);

      expect(bm2.defeatedLevels.has(16)).toBe(true);
      expect(bm2.enemiesDefeated).toBe(1);
    });
  });
});
