import { describe, it, expect } from 'vitest';
import { Power } from '../../src/entities/power.js';
import { POWER_TYPES, POWER_META } from '../../src/configs/constants.js';

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
});
