import { describe, it, expect, beforeEach } from 'vitest';
import { Enemy, ENEMY_NAMES } from '../../src/entities/enemy.js';
import { BATTLE, POWER_TYPES } from '../../src/configs/constants.js';

describe('Enemy', () => {
  describe('ENEMY_NAMES', () => {
    it('has at least 50 names', () => {
      expect(ENEMY_NAMES.length).toBeGreaterThanOrEqual(50);
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
      const enemy = new Enemy(2, 'chiller');
      expect(enemy.level).toBe(2);
    });

    it('stores the profile key', () => {
      const enemy = new Enemy(4, 'hurricane');
      expect(enemy.profile).toBe('hurricane');
    });

    it('assigns a random name from ENEMY_NAMES if none given', () => {
      const enemy = new Enemy(4, 'hurricane');
      expect(ENEMY_NAMES).toContain(enemy.name);
    });

    it('accepts a custom name override', () => {
      const enemy = new Enemy(8, 'chiller', 'CustomBoss');
      expect(enemy.name).toBe('CustomBoss');
    });

    it('sets HP proportional to log2(level)', () => {
      const enemy = new Enemy(2, 'chiller');
      // log2(2) = 1, HP = 1 * HP_PER_LEVEL = 10
      expect(enemy.life.maxHp).toBe(1 * BATTLE.HP_PER_LEVEL);
    });

    it('boss (2048) has highest HP', () => {
      const enemy = new Enemy(2048, 'overlord');
      // log2(2048) = 11, HP = 11 * HP_PER_LEVEL
      expect(enemy.life.maxHp).toBe(11 * BATTLE.HP_PER_LEVEL);
    });

    it('chiller profile has ICE in its stock', () => {
      const enemy = new Enemy(2, 'chiller');
      expect(enemy.availablePowers).toContain(POWER_TYPES.ICE);
      expect(enemy.powerStock[POWER_TYPES.ICE]).toBeGreaterThan(0);
    });

    it('hurricane profile has all four wind directions in its stock', () => {
      const enemy = new Enemy(4, 'hurricane');
      const types = enemy.availablePowers;
      expect(types).toContain(POWER_TYPES.WIND_UP);
      expect(types).toContain(POWER_TYPES.WIND_DOWN);
      expect(types).toContain(POWER_TYPES.WIND_LEFT);
      expect(types).toContain(POWER_TYPES.WIND_RIGHT);
    });

    it('specter profile has BLIND and TELEPORT in its stock', () => {
      const enemy = new Enemy(16, 'specter');
      expect(enemy.availablePowers).toContain(POWER_TYPES.BLIND);
      expect(enemy.availablePowers).toContain(POWER_TYPES.TELEPORT);
    });

    it('overlord profile has NUCLEAR, BOMB, FIRE_X, ICE in its stock', () => {
      const enemy = new Enemy(2048, 'overlord');
      expect(enemy.availablePowers).toContain(POWER_TYPES.NUCLEAR);
      expect(enemy.availablePowers).toContain(POWER_TYPES.BOMB);
      expect(enemy.availablePowers).toContain(POWER_TYPES.FIRE_X);
      expect(enemy.availablePowers).toContain(POWER_TYPES.ICE);
    });

    it('chiller profile does NOT have nuclear in its stock', () => {
      const enemy = new Enemy(1024, 'chiller');
      expect(enemy.availablePowers).not.toContain(POWER_TYPES.NUCLEAR);
    });

    it('falls back to empty stock for unknown profile', () => {
      const enemy = new Enemy(4, 'nonexistent');
      expect(enemy.availablePowers).toHaveLength(0);
    });
  });

  describe('powerStock / consumePower', () => {
    it('initial stock is a copy (mutation is local)', () => {
      const enemy = new Enemy(2, 'chiller');
      const otherEnemy = new Enemy(2, 'chiller');
      enemy.powerStock[POWER_TYPES.ICE] = 0;
      expect(otherEnemy.powerStock[POWER_TYPES.ICE]).toBeGreaterThan(0);
    });

    it('consumePower decrements the count', () => {
      const enemy = new Enemy(2, 'chiller');
      const before = enemy.powerStock[POWER_TYPES.ICE];
      expect(enemy.consumePower(POWER_TYPES.ICE)).toBe(true);
      expect(enemy.powerStock[POWER_TYPES.ICE]).toBe(before - 1);
    });

    it('consumePower removes the key when it reaches 0', () => {
      const enemy = new Enemy(2, 'chiller');
      while (enemy.powerStock[POWER_TYPES.ICE] > 0) enemy.consumePower(POWER_TYPES.ICE);
      expect(enemy.powerStock[POWER_TYPES.ICE]).toBeUndefined();
      expect(enemy.availablePowers).not.toContain(POWER_TYPES.ICE);
    });

    it('consumePower returns false when no charge remains', () => {
      const enemy = new Enemy(2, 'chiller');
      enemy.powerStock = {};
      expect(enemy.consumePower(POWER_TYPES.ICE)).toBe(false);
    });

    it('hasAnyStock reflects remaining charges', () => {
      const enemy = new Enemy(2, 'chiller');
      expect(enemy.hasAnyStock()).toBe(true);
      enemy.powerStock = {};
      expect(enemy.hasAnyStock()).toBe(false);
    });
  });

  describe('isDead', () => {
    it('returns false when alive', () => {
      const enemy = new Enemy(2, 'chiller');
      expect(enemy.isDead).toBe(false);
    });

    it('returns true when HP reaches 0', () => {
      const enemy = new Enemy(2, 'chiller');
      // Deal massive damage
      enemy.takeDamage([2048, 2048, 2048, 2048, 2048]);
      expect(enemy.isDead).toBe(true);
    });
  });

  describe('isBoss', () => {
    it('returns true for level 2048', () => {
      const enemy = new Enemy(2048, 'overlord');
      expect(enemy.isBoss).toBe(true);
    });

    it('returns false for other levels', () => {
      expect(new Enemy(2, 'chiller').isBoss).toBe(false);
      expect(new Enemy(1024, 'chiller').isBoss).toBe(false);
    });
  });

  describe('takeDamage', () => {
    it('reduces enemy HP', () => {
      const enemy = new Enemy(8, 'chiller');
      const initialHp = enemy.life.currentHp;
      enemy.takeDamage([4]);
      expect(enemy.life.currentHp).toBeLessThan(initialHp);
    });

    it('returns damage dealt', () => {
      const enemy = new Enemy(4, 'hurricane');
      const damage = enemy.takeDamage([4]);
      expect(damage).toBeGreaterThan(0);
    });
  });

  describe('pickRandomPower', () => {
    it('returns a power from availablePowers', () => {
      const enemy = new Enemy(4, 'hurricane');
      const power = enemy.pickRandomPower();
      expect(enemy.availablePowers).toContain(power);
    });

    it('returns null if no powers available', () => {
      const enemy = new Enemy(4, 'nonexistent'); // unknown profile → empty stock
      expect(enemy.pickRandomPower()).toBeNull();
    });
  });

  describe('serialize / restore', () => {
    it('round-trips correctly (including profile and powerStock)', () => {
      const enemy = new Enemy(32, 'flare', 'TestBoss');
      enemy.takeDamage([8]);
      enemy.consumePower(POWER_TYPES.FIRE_H);
      const data = enemy.serialize();

      const restored = Enemy.restore(data);
      expect(restored.name).toBe('TestBoss');
      expect(restored.level).toBe(32);
      expect(restored.profile).toBe('flare');
      expect(restored.life.currentHp).toBe(enemy.life.currentHp);
      expect(restored.life.maxHp).toBe(enemy.life.maxHp);
      expect(restored.powerStock).toEqual(enemy.powerStock);
    });
  });

  describe('HP formula for standard tile values', () => {
    for (const level of [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]) {
      it(`level ${level} has HP = ceil(log2(${level})) * ${BATTLE.HP_PER_LEVEL}`, () => {
        const enemy = new Enemy(level, 'chiller');
        const expectedHp = Math.ceil(Math.log2(level)) * BATTLE.HP_PER_LEVEL;
        expect(enemy.life.maxHp).toBe(expectedHp);
      });
    }
  });

  describe('available powers per profile', () => {
    for (const [name, stock] of Object.entries(BATTLE.ENEMY_PROFILES)) {
      it(`${name} profile has powers defined`, () => {
        const enemy = new Enemy(8, name);
        expect(enemy.availablePowers.length).toBeGreaterThan(0);
        expect(enemy.availablePowers).toEqual(Object.keys(stock));
      });
    }
  });
});
