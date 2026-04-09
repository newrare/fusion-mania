import { describe, it, expect } from 'vitest';
import { Power } from '../../src/entities/power.js';
import {
  POWER_TYPES,
  POWER_META,
  POWER_CATEGORIES,
  POWER_DURATIONS,
} from '../../src/configs/constants.js';

describe('Power', () => {
  it('creates a power with type and side', () => {
    const p = new Power(POWER_TYPES.FIRE_H, 'top');
    expect(p.type).toBe('fire-h');
    expect(p.side).toBe('top');
  });

  it('side defaults to null', () => {
    const p = new Power(POWER_TYPES.BOMB);
    expect(p.side).toBeNull();
  });

  it('generates a unique id', () => {
    const p1 = new Power(POWER_TYPES.ICE);
    const p2 = new Power(POWER_TYPES.ICE);
    expect(p1.id).not.toBe(p2.id);
  });

  it('id starts with "power-"', () => {
    const p = new Power(POWER_TYPES.NUCLEAR);
    expect(p.id.startsWith('power-')).toBe(true);
  });

  describe('svgId getter', () => {
    it('returns the correct SVG symbol ID', () => {
      const p = new Power(POWER_TYPES.FIRE_X, 'left');
      expect(p.svgId).toBe('s-fire-x');
    });

    it('returns empty string for unknown type', () => {
      const p = new Power('nonexistent');
      expect(p.svgId).toBe('');
    });

    it('matches POWER_META for every power type', () => {
      for (const [key, type] of Object.entries(POWER_TYPES)) {
        const p = new Power(type);
        expect(p.svgId).toBe(POWER_META[type].svgId);
      }
    });
  });

  describe('nameKey getter', () => {
    it('returns the correct i18n key', () => {
      const p = new Power(POWER_TYPES.BLIND);
      expect(p.nameKey).toBe('power.blind');
    });

    it('returns empty string for unknown type', () => {
      const p = new Power('nonexistent');
      expect(p.nameKey).toBe('');
    });

    it('matches POWER_META for every power type', () => {
      for (const [key, type] of Object.entries(POWER_TYPES)) {
        const p = new Power(type);
        expect(p.nameKey).toBe(POWER_META[type].nameKey);
      }
    });
  });

  // ─── Static methods ────────────────────────────

  describe('Power.svgId()', () => {
    it('returns correct SVG ID for each type', () => {
      expect(Power.svgId(POWER_TYPES.BOMB)).toBe('s-bomb');
      expect(Power.svgId(POWER_TYPES.LIGHTNING)).toBe('s-lightning');
    });

    it('returns empty string for unknown type', () => {
      expect(Power.svgId('nope')).toBe('');
    });
  });

  describe('Power.nameKey()', () => {
    it('returns correct i18n key', () => {
      expect(Power.nameKey(POWER_TYPES.ICE)).toBe('power.ice');
    });
  });

  describe('Power.category()', () => {
    it('returns danger for destructive powers', () => {
      for (const type of POWER_CATEGORIES.danger) {
        expect(Power.category(type)).toBe('danger');
      }
    });

    it('returns warning for status powers', () => {
      for (const type of POWER_CATEGORIES.warning) {
        expect(Power.category(type)).toBe('warning');
      }
    });

    it('returns info for passive powers', () => {
      for (const type of POWER_CATEGORIES.info) {
        expect(Power.category(type)).toBe('info');
      }
    });

    it('returns info for unknown types', () => {
      expect(Power.category('nope')).toBe('info');
    });
  });

  describe('instance category getter', () => {
    it('delegates to static method', () => {
      const p = new Power(POWER_TYPES.FIRE_H);
      expect(p.category).toBe('danger');
    });
  });

  describe('Power.isDestructive()', () => {
    it('true for fire/bomb/lightning/nuclear', () => {
      expect(Power.isDestructive(POWER_TYPES.FIRE_H)).toBe(true);
      expect(Power.isDestructive(POWER_TYPES.BOMB)).toBe(true);
      expect(Power.isDestructive(POWER_TYPES.NUCLEAR)).toBe(true);
    });

    it('false for non-destructive', () => {
      expect(Power.isDestructive(POWER_TYPES.ICE)).toBe(false);
      expect(Power.isDestructive(POWER_TYPES.TELEPORT)).toBe(false);
    });
  });

  describe('Power.isGridWide()', () => {
    it('true for nuclear, blind, ads, lightning', () => {
      expect(Power.isGridWide(POWER_TYPES.NUCLEAR)).toBe(true);
      expect(Power.isGridWide(POWER_TYPES.BLIND)).toBe(true);
      expect(Power.isGridWide(POWER_TYPES.ADS)).toBe(true);
      expect(Power.isGridWide(POWER_TYPES.LIGHTNING)).toBe(true);
    });

    it('false for targeted powers', () => {
      expect(Power.isGridWide(POWER_TYPES.FIRE_H)).toBe(false);
      expect(Power.isGridWide(POWER_TYPES.ICE)).toBe(false);
    });
  });

  describe('Power.duration()', () => {
    it('returns correct duration for timed powers', () => {
      expect(Power.duration(POWER_TYPES.ICE)).toBe(POWER_DURATIONS.ICE);
      expect(Power.duration(POWER_TYPES.BLIND)).toBe(POWER_DURATIONS.BLIND);
      expect(Power.duration(POWER_TYPES.EXPEL_H)).toBe(POWER_DURATIONS.EXPEL);
      expect(Power.duration(POWER_TYPES.WIND_UP)).toBe(POWER_DURATIONS.WIND);
    });

    it('returns 0 for instant powers', () => {
      expect(Power.duration(POWER_TYPES.FIRE_H)).toBe(0);
      expect(Power.duration(POWER_TYPES.BOMB)).toBe(0);
      expect(Power.duration(POWER_TYPES.NUCLEAR)).toBe(0);
    });
  });

  describe('instance duration getter', () => {
    it('delegates to static method', () => {
      const p = new Power(POWER_TYPES.ICE);
      expect(p.duration).toBe(POWER_DURATIONS.ICE);
    });
  });

  describe('Power.allTypes()', () => {
    it('returns all power type strings', () => {
      const types = Power.allTypes();
      expect(types).toEqual(Object.values(POWER_TYPES));
    });

    it('returns a new array each call', () => {
      expect(Power.allTypes()).not.toBe(Power.allTypes());
    });
  });
});
