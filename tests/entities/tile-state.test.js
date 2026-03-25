import { describe, it, expect, beforeEach } from 'vitest';
import { Tile } from '../../src/entities/tile.js';

describe('Tile – state system', () => {
  /** @type {Tile} */
  let tile;

  beforeEach(() => {
    tile = new Tile(8, 1, 2);
  });

  it('starts with no state', () => {
    expect(tile.state).toBeNull();
    expect(tile.stateTurns).toBe(0);
    expect(tile.targeted).toBe(false);
  });

  describe('applyState', () => {
    it('sets state and turns', () => {
      tile.applyState('ice', 5);
      expect(tile.state).toBe('ice');
      expect(tile.stateTurns).toBe(5);
    });

    it('overwrites an existing state', () => {
      tile.applyState('ice', 3);
      tile.applyState('blind', 2);
      expect(tile.state).toBe('blind');
      expect(tile.stateTurns).toBe(2);
    });
  });

  describe('clearState', () => {
    it('resets state and turns to defaults', () => {
      tile.applyState('ice', 3);
      tile.clearState();
      expect(tile.state).toBeNull();
      expect(tile.stateTurns).toBe(0);
    });

    it('is safe to call with no active state', () => {
      tile.clearState();
      expect(tile.state).toBeNull();
      expect(tile.stateTurns).toBe(0);
    });
  });

  describe('tickState', () => {
    it('decrements stateTurns by 1', () => {
      tile.applyState('ice', 3);
      tile.tickState();
      expect(tile.stateTurns).toBe(2);
      expect(tile.state).toBe('ice');
    });

    it('clears state when turns reach 0', () => {
      tile.applyState('blind', 1);
      tile.tickState();
      expect(tile.state).toBeNull();
      expect(tile.stateTurns).toBe(0);
    });

    it('does nothing when no state is active', () => {
      tile.tickState();
      expect(tile.state).toBeNull();
      expect(tile.stateTurns).toBe(0);
    });

    it('counts down correctly over multiple ticks', () => {
      tile.applyState('ghost-v', 3);
      tile.tickState(); // 2
      tile.tickState(); // 1
      expect(tile.stateTurns).toBe(1);
      expect(tile.state).toBe('ghost-v');
      tile.tickState(); // 0 → cleared
      expect(tile.state).toBeNull();
    });
  });

  describe('targeted flag', () => {
    it('can be set to true', () => {
      tile.targeted = true;
      expect(tile.targeted).toBe(true);
    });

    it('is independent of state', () => {
      tile.targeted = true;
      tile.applyState('frozen', 5);
      expect(tile.targeted).toBe(true);
      tile.clearState();
      expect(tile.targeted).toBe(true);
    });
  });
});
