import { describe, it, expect, beforeEach } from 'vitest';
import { Enemy, ENEMY_NAMES } from '../../src/entities/enemy.js';
import { BATTLE, POWER_TYPES } from '../../src/configs/constants.js';

describe('Enemy', () => {
  describe('ENEMY_NAMES', () => {
    it('has exactly 100 names', () => {
      expect(ENEMY_NAMES.length).toBe(100);
    });

    it('names are unique', () => {
      const unique = new Set(ENEMY_NAMES);
      expect(unique.size).toBe(ENEMY_NAMES.length);
    });

    it('each name is a single word (no spaces)', () => {
      for (const name of ENEMY_NAMES) {
        expect(name.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('constructor', () => {
    it('creates an enemy with given level', () => {
      const enemy = new Enemy(2);
      expect(enemy.level).toBe(2);
    });

    it('assigns a random name from ENEMY_NAMES if none given', () => {
      const enemy = new Enemy(4);
      expect(ENEMY_NAMES).toContain(enemy.name);
    });

    it('accepts a custom name override', () => {
      const enemy = new Enemy(8, 'CustomBoss');
      expect(enemy.name).toBe('CustomBoss');
    });

    it('sets HP proportional to log2(level)', () => {
      const enemy = new Enemy(2);
      // log2(2) = 1, HP = 1 * HP_PER_LEVEL = 10
      expect(enemy.life.maxHp).toBe(1 * BATTLE.HP_PER_LEVEL);
    });

    it('boss (2048) has highest HP', () => {
      const enemy = new Enemy(2048);
      // log2(2048) = 11, HP = 11 * HP_PER_LEVEL
      expect(enemy.life.maxHp).toBe(11 * BATTLE.HP_PER_LEVEL);
    });

    it('assigns correct available powers for level 2', () => {
      const enemy = new Enemy(2);
      expect(enemy.availablePowers).toEqual([POWER_TYPES.ICE]);
    });

    it('assigns correct available powers for level 4', () => {
      const enemy = new Enemy(4);
      expect(enemy.availablePowers).toEqual([
        POWER_TYPES.WIND_UP, POWER_TYPES.WIND_DOWN,
        POWER_TYPES.WIND_LEFT, POWER_TYPES.WIND_RIGHT,
      ]);
    });

    it('assigns correct available powers for level 16 (blind)', () => {
      const enemy = new Enemy(16);
      expect(enemy.availablePowers).toEqual([POWER_TYPES.BLIND]);
    });

    it('boss (2048) has all powers', () => {
      const enemy = new Enemy(2048);
      expect(enemy.availablePowers).toContain(POWER_TYPES.NUCLEAR);
      expect(enemy.availablePowers).toContain(POWER_TYPES.BOMB);
      expect(enemy.availablePowers).toContain(POWER_TYPES.FIRE_X);
      expect(enemy.availablePowers).toContain(POWER_TYPES.ICE);
    });

    it('level 1024 does NOT have nuclear', () => {
      const lp = BATTLE.LEVEL_POWERS[1024];
      expect(lp).not.toContain(POWER_TYPES.NUCLEAR);
    });
  });

  describe('isDead', () => {
    it('returns false when alive', () => {
      const enemy = new Enemy(2);
      expect(enemy.isDead).toBe(false);
    });

    it('returns true when HP reaches 0', () => {
      const enemy = new Enemy(2);
      // Deal massive damage
      enemy.takeDamage([2048, 2048, 2048, 2048, 2048]);
      expect(enemy.isDead).toBe(true);
    });
  });

  describe('isBoss', () => {
    it('returns true for level 2048', () => {
      const enemy = new Enemy(2048);
      expect(enemy.isBoss).toBe(true);
    });

    it('returns false for other levels', () => {
      expect(new Enemy(2).isBoss).toBe(false);
      expect(new Enemy(1024).isBoss).toBe(false);
    });
  });

  describe('takeDamage', () => {
    it('reduces enemy HP', () => {
      const enemy = new Enemy(8);
      const initialHp = enemy.life.currentHp;
      enemy.takeDamage([4]);
      expect(enemy.life.currentHp).toBeLessThan(initialHp);
    });

    it('returns damage dealt', () => {
      const enemy = new Enemy(4);
      const damage = enemy.takeDamage([4]);
      expect(damage).toBeGreaterThan(0);
    });
  });

  describe('pickRandomPower', () => {
    it('returns a power from availablePowers', () => {
      const enemy = new Enemy(4);
      const power = enemy.pickRandomPower();
      expect(enemy.availablePowers).toContain(power);
    });

    it('returns null if no powers available', () => {
      const enemy = new Enemy(99999); // Invalid level, no powers
      expect(enemy.pickRandomPower()).toBeNull();
    });
  });

  describe('serialize / restore', () => {
    it('round-trips correctly', () => {
      const enemy = new Enemy(32, 'TestBoss');
      enemy.takeDamage([8]);
      const data = enemy.serialize();

      const restored = Enemy.restore(data);
      expect(restored.name).toBe('TestBoss');
      expect(restored.level).toBe(32);
      expect(restored.life.currentHp).toBe(enemy.life.currentHp);
      expect(restored.life.maxHp).toBe(enemy.life.maxHp);
    });
  });

  describe('HP formula for all levels', () => {
    for (const level of BATTLE.LEVELS) {
      it(`level ${level} has HP = log2(${level}) * ${BATTLE.HP_PER_LEVEL}`, () => {
        const enemy = new Enemy(level);
        const expectedHp = Math.ceil(Math.log2(level)) * BATTLE.HP_PER_LEVEL;
        expect(enemy.life.maxHp).toBe(expectedHp);
      });
    }
  });

  describe('available powers per level', () => {
    for (const level of BATTLE.LEVELS) {
      it(`level ${level} has powers defined`, () => {
        const enemy = new Enemy(level);
        expect(enemy.availablePowers.length).toBeGreaterThan(0);
      });
    }
  });
});
