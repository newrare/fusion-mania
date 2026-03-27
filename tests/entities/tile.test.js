import { describe, it, expect } from 'vitest';
import { Tile } from '../../src/entities/tile.js';

describe('Tile', () => {
  it('creates a tile with value, row, and col', () => {
    const tile = new Tile(2, 0, 1);
    expect(tile.value).toBe(2);
    expect(tile.row).toBe(0);
    expect(tile.col).toBe(1);
  });

  it('generates a unique id', () => {
    const t1 = new Tile(2, 0, 0);
    const t2 = new Tile(4, 1, 1);
    expect(t1.id).not.toBe(t2.id);
  });

  it('starts with merged = false', () => {
    const tile = new Tile(8, 2, 3);
    expect(tile.merged).toBe(false);
  });

  it('id is a non-empty string', () => {
    const tile = new Tile(16, 0, 0);
    expect(typeof tile.id).toBe('string');
    expect(tile.id.length).toBeGreaterThan(0);
  });

  it('starts with power = null', () => {
    const tile = new Tile(2, 0, 0);
    expect(tile.power).toBeNull();
  });

  it('can have a power assigned', () => {
    const tile = new Tile(2, 0, 0);
    tile.power = 'fire-h';
    expect(tile.power).toBe('fire-h');
  });
});
