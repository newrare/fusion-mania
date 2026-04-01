import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS } from '../../src/configs/constants.js';

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
});
