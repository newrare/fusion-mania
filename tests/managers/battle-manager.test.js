import { describe, it, expect, beforeEach } from 'vitest';
import { BattleManager } from '../../src/managers/battle-manager.js';
import { Grid } from '../../src/entities/grid.js';
import { Tile } from '../../src/entities/tile.js';
import { BATTLE, POWER_TYPES } from '../../src/configs/constants.js';

describe('BattleManager', () => {
  /** @type {BattleManager} */
  let bm;
  /** @type {Grid} */
  let grid;

  beforeEach(() => {
    bm = new BattleManager();
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
      grid.cells[0][0] = new Tile(2, 0, 0);
      let enemy = null;
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        enemy = bm.tickClassicPhase(grid);
      }
      expect(enemy).not.toBeNull();
      expect(enemy.level).toBe(2);
    });

    it('does not spawn enemy if max tile is too low', () => {
      // First enemy requires tile value 2, which is present
      // But for level 4 enemy, need tile 4
      grid.cells[0][0] = new Tile(2, 0, 0);
      // Defeat level 2 first
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      // Now in battle phase with level 2 enemy
      bm.applyMergeDamage([{ tile: { value: 2048 } }]);
      bm.defeatEnemy();

      // Try to spawn level 4 - but max tile is only 2
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        const result = bm.tickClassicPhase(grid);
        if (result) {
          // Should not happen since max tile < 4
          expect(false).toBe(true);
        }
      }
    });

    it('spawns level 4 enemy after level 2 is defeated and tile 4 exists', () => {
      grid.cells[0][0] = new Tile(4, 0, 0);

      // Spawn and defeat level 2
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      expect(bm.enemy.level).toBe(2);

      // Kill enemy
      bm.applyMergeDamage([{ tile: { value: 2048 } }, { tile: { value: 2048 } }, { tile: { value: 2048 } }]);
      bm.defeatEnemy();

      // Now tick for level 4
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      expect(bm.enemy).not.toBeNull();
      expect(bm.enemy.level).toBe(4);
    });

    it('returns null during battle phase', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
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
    it('returns null when no enemy is active', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      expect(bm.contaminate(grid)).toBeNull();
    });

    it('assigns a power to a random unpowered tile', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[1][1] = new Tile(4, 1, 1);
      // Spawn enemy
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      expect(bm.enemy).not.toBeNull();

      const result = bm.contaminate(grid);
      expect(result).not.toBeNull();
      expect(result.tile.power).toBe(result.power);
    });

    it('does not contaminate tiles that already have a power', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][0].power = POWER_TYPES.ICE;
      // Only one tile on grid, already has power
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      const result = bm.contaminate(grid);
      expect(result).toBeNull();
    });

    it('does not contaminate tiles with active state', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][0].applyState('ice', 3);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      const result = bm.contaminate(grid);
      expect(result).toBeNull();
    });
  });

  describe('applyMergeDamage', () => {
    beforeEach(() => {
      grid.cells[0][0] = new Tile(2, 0, 0);
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
      grid.cells[0][0] = new Tile(2, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
    });

    it('marks the enemy level as defeated', () => {
      bm.defeatEnemy();
      expect(bm.defeatedLevels.has(2)).toBe(true);
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
      expect(bm.maxEnemyLevel).toBe(2);
    });

    it('returns the dead enemy', () => {
      const dead = bm.defeatEnemy();
      expect(dead).not.toBeNull();
      expect(dead.level).toBe(2);
    });
  });

  describe('clearGridPowers', () => {
    it('removes all powers from grid tiles', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      grid.cells[0][0].power = POWER_TYPES.ICE;
      grid.cells[1][1] = new Tile(4, 1, 1);
      grid.cells[1][1].power = POWER_TYPES.BOMB;
      grid.cells[2][2] = new Tile(8, 2, 2);
      grid.cells[2][2].applyState('blind', 3);

      bm.clearGridPowers(grid);

      for (const tile of grid.getAllTiles()) {
        expect(tile.power).toBeNull();
        expect(tile.state).toBeNull();
      }
    });
  });

  describe('allDefeated', () => {
    it('returns false initially', () => {
      expect(bm.allDefeated()).toBe(false);
    });
  });

  describe('level progression', () => {
    it('enemies appear in order: 2, 4, 8, ..., 2048', () => {
      const defeated = [];
      for (const level of BATTLE.LEVELS) {
        grid.cells[0][0] = new Tile(level, 0, 0);
        for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
          bm.tickClassicPhase(grid);
        }
        expect(bm.enemy).not.toBeNull();
        expect(bm.enemy.level).toBe(level);
        defeated.push(level);

        // Kill enemy
        bm.applyMergeDamage([
          { tile: { value: 2048 } },
          { tile: { value: 2048 } },
          { tile: { value: 2048 } },
          { tile: { value: 2048 } },
          { tile: { value: 2048 } },
        ]);
        bm.defeatEnemy();
      }
      expect(defeated).toEqual(BATTLE.LEVELS);
      expect(bm.allDefeated()).toBe(true);
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
      grid.cells[0][0] = new Tile(2, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      bm.applyMergeDamage([{ tile: { value: 4 } }]);

      const data = bm.serialize();
      const bm2 = new BattleManager();
      bm2.restore(data);

      expect(bm2.isBattlePhase).toBe(true);
      expect(bm2.enemy.level).toBe(2);
      expect(bm2.enemy.life.currentHp).toBe(bm.enemy.life.currentHp);
    });

    it('round-trips defeated levels', () => {
      grid.cells[0][0] = new Tile(2, 0, 0);
      for (let i = 0; i < BATTLE.CLASSIC_MOVES; i++) {
        bm.tickClassicPhase(grid);
      }
      bm.defeatEnemy();

      const data = bm.serialize();
      const bm2 = new BattleManager();
      bm2.restore(data);

      expect(bm2.defeatedLevels.has(2)).toBe(true);
      expect(bm2.enemiesDefeated).toBe(1);
    });
  });
});
