import { describe, it, expect } from 'vitest';
import { clamp, randomInt, shuffle, weightedPick } from '../../src/utils/math.js';

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when below', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('clamps to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('randomInt', () => {
  it('returns a value within the range', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomInt(1, 6);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
    }
  });

  it('returns an integer', () => {
    const val = randomInt(0, 100);
    expect(Number.isInteger(val)).toBe(true);
  });

  it('works with same min and max', () => {
    expect(randomInt(5, 5)).toBe(5);
  });
});

describe('shuffle', () => {
  it('returns the same array reference', () => {
    const arr = [1, 2, 3];
    expect(shuffle(arr)).toBe(arr);
  });

  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

describe('weightedPick', () => {
  it('returns one of the provided values', () => {
    const values = [2, 4];
    const weights = [0.9, 0.1];
    for (let i = 0; i < 50; i++) {
      const result = weightedPick(values, weights);
      expect(values).toContain(result);
    }
  });

  it('returns the only value when weight is 1', () => {
    expect(weightedPick([42], [1.0])).toBe(42);
  });
});
