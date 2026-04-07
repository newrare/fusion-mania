import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS, MAX_SAVE_SLOTS } from '../../src/configs/constants.js';

// Mock localStorage
const store = {};
const localStorageMock = {
  getItem: vi.fn((key) => store[key] ?? null),
  setItem: vi.fn((key, value) => { store[key] = value; }),
  removeItem: vi.fn((key) => { delete store[key]; }),
};
vi.stubGlobal('localStorage', localStorageMock);

// Import after mocking
const { saveManager } = await import('../../src/managers/save-manager.js');

describe('SaveManager', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.clearAllMocks();
  });

  describe('saveGame / loadGame', () => {
    it('saves and loads game state', () => {
      const state = {
        grid: [[0, 2, 0, 0], [0, 0, 4, 0], [0, 0, 0, 0], [0, 0, 0, 8]],
        score: 100,
        moves: 5,
        mode: 'classic',
      };
      saveManager.saveGame(state);
      const loaded = saveManager.loadGame();
      expect(loaded).toEqual(state);
    });

    it('returns null when no save exists', () => {
      expect(saveManager.loadGame()).toBeNull();
    });
  });

  describe('hasSave / clearGame', () => {
    it('returns false when no save', () => {
      expect(saveManager.hasSave()).toBe(false);
    });

    it('returns true after saving', () => {
      saveManager.saveGame({ grid: [], score: 0, moves: 0, mode: 'classic' });
      expect(saveManager.hasSave()).toBe(true);
    });

    it('clears the save', () => {
      saveManager.saveGame({ grid: [], score: 0, moves: 0, mode: 'classic' });
      saveManager.clearGame();
      expect(saveManager.hasSave()).toBe(false);
    });
  });

  describe('rankings', () => {
    it('adds and retrieves rankings', () => {
      saveManager.addRanking('classic', 500);
      saveManager.addRanking('classic', 1000);
      saveManager.addRanking('classic', 200);

      const rankings = saveManager.getRankings('classic');
      expect(rankings.length).toBe(3);
      expect(rankings[0].score).toBe(1000);
      expect(rankings[1].score).toBe(500);
      expect(rankings[2].score).toBe(200);
    });

    it('keeps only top 10', () => {
      for (let i = 0; i < 15; i++) {
        saveManager.addRanking('classic', (i + 1) * 100);
      }
      expect(saveManager.getRankings('classic').length).toBe(10);
    });

    it('returns empty array for unknown mode', () => {
      expect(saveManager.getRankings('unknown')).toEqual([]);
    });

    it('returns best score', () => {
      saveManager.addRanking('classic', 300);
      saveManager.addRanking('classic', 800);
      expect(saveManager.getBestScore('classic')).toBe(800);
    });

    it('returns 0 when no rankings', () => {
      expect(saveManager.getBestScore('classic')).toBe(0);
    });

    it('resets rankings', () => {
      saveManager.addRanking('classic', 100);
      saveManager.resetRankings();
      expect(saveManager.getRankings('classic')).toEqual([]);
    });

    it('stores extra data (maxTile, moves, fusions, powers)', () => {
      saveManager.addRanking('free', 500, {
        maxTile: 256,
        moves: 40,
        fusions: 20,
        powers: ['fire-h', 'bomb'],
      });
      const rankings = saveManager.getRankings('free');
      expect(rankings.length).toBe(1);
      expect(rankings[0].score).toBe(500);
      expect(rankings[0].maxTile).toBe(256);
      expect(rankings[0].moves).toBe(40);
      expect(rankings[0].fusions).toBe(20);
      expect(rankings[0].powers).toEqual(['fire-h', 'bomb']);
    });

    it('returns best max tile', () => {
      saveManager.addRanking('classic', 100, { maxTile: 128 });
      saveManager.addRanking('classic', 500, { maxTile: 512 });
      saveManager.addRanking('classic', 300, { maxTile: 256 });
      expect(saveManager.getBestMaxTile('classic')).toBe(512);
    });

    it('returns 0 for best max tile when no rankings', () => {
      expect(saveManager.getBestMaxTile('classic')).toBe(0);
    });

    it('handles rankings without maxTile gracefully', () => {
      saveManager.addRanking('classic', 100);
      expect(saveManager.getBestMaxTile('classic')).toBe(0);
    });
  });

  describe('save slots', () => {
    it('returns empty array when no slots exist', () => {
      expect(saveManager.getSlots()).toEqual([]);
    });

    it('saves a slot and loads it back', () => {
      const state = {
        mode: 'classic',
        score: 500,
        maxTile: 128,
        moves: 20,
        grid: { cells: [[{ v: 2 }, null, null, null]], score: 500, moves: 20 },
      };
      const idx = saveManager.saveSlot(state);
      expect(idx).toBe(0);
      const loaded = saveManager.loadSlot(0);
      expect(loaded.mode).toBe('classic');
      expect(loaded.score).toBe(500);
      expect(loaded.date).toBeGreaterThan(0);
    });

    it('saves to consecutive slots', () => {
      saveManager.saveSlot({ mode: 'classic', score: 100 });
      saveManager.saveSlot({ mode: 'battle', score: 200 });
      const slots = saveManager.getSlots();
      expect(slots.length).toBe(2);
      expect(slots[0].mode).toBe('classic');
      expect(slots[1].mode).toBe('battle');
    });

    it('appends after delete (no null slots to reuse)', () => {
      saveManager.saveSlot({ mode: 'classic', score: 100 }); // slot 0
      saveManager.saveSlot({ mode: 'battle', score: 200 });  // slot 1
      saveManager.deleteSlot(0); // battle shifts to slot 0; array length = 1
      const idx = saveManager.saveSlot({ mode: 'free', score: 300 });
      // New save appends at index 1 (first available position)
      expect(idx).toBe(1);
      expect(saveManager.loadSlot(0).mode).toBe('battle');
      expect(saveManager.loadSlot(1).mode).toBe('free');
    });

    it('evicts the oldest slot when all are full', () => {
      // Fill all slots; slot 0 will be the oldest
      for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        saveManager.saveSlot({ mode: 'classic', score: i * 100 });
      }
      // Saving again should overwrite the oldest (slot 0) and return a valid index
      const idx = saveManager.saveSlot({ mode: 'free', score: 999 });
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(MAX_SAVE_SLOTS);
      const overwritten = saveManager.loadSlot(idx);
      expect(overwritten.mode).toBe('free');
      expect(overwritten.score).toBe(999);
    });

    it('deletes a slot and compacts the array (no null gaps)', () => {
      saveManager.saveSlot({ mode: 'classic', score: 100 });
      saveManager.saveSlot({ mode: 'battle', score: 200 });
      saveManager.deleteSlot(0);
      // After deletion slot 0 is removed; former slot 1 becomes slot 0
      expect(saveManager.loadSlot(0).mode).toBe('battle');
      expect(saveManager.loadSlot(1)).toBeNull();
    });

    it('returns slot summaries', () => {
      saveManager.saveSlot({ mode: 'classic', score: 500, maxTile: 256, moves: 30 });
      saveManager.saveSlot({ mode: 'free', score: 800, maxTile: 512, moves: 50 });
      const summaries = saveManager.getSlotSummaries();
      expect(summaries.length).toBe(2);
      expect(summaries[0].mode).toBe('classic');
      expect(summaries[0].score).toBe(500);
      expect(summaries[0].maxTile).toBe(256);
      expect(summaries[1].mode).toBe('free');
    });

    it('hasAvailableSlot returns true when slots available', () => {
      expect(saveManager.hasAvailableSlot()).toBe(true);
    });

    it('hasAvailableSlot always returns true (eviction prevents full state)', () => {
      for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        saveManager.saveSlot({ mode: 'classic', score: i });
      }
      expect(saveManager.hasAvailableSlot()).toBe(true);
    });

    it('hasAvailableSlot is always true (eviction prevents exhaustion)', () => {
      for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        saveManager.saveSlot({ mode: 'classic', score: i });
      }
      saveManager.deleteSlot(3);
      expect(saveManager.hasAvailableSlot()).toBe(true);
    });

    it('loadSlot returns null for out-of-range index', () => {
      expect(saveManager.loadSlot(99)).toBeNull();
    });

    it('compacts the array on delete (no null gaps)', () => {
      saveManager.saveSlot({ mode: 'classic', score: 100 });
      saveManager.saveSlot({ mode: 'battle', score: 200 });
      saveManager.deleteSlot(1);
      const slots = saveManager.getSlots();
      expect(slots.length).toBe(1);
      expect(slots[0].mode).toBe('classic');
    });
  });
});
