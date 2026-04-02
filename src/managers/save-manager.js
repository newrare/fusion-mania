import { STORAGE_KEYS } from '../configs/constants.js';

class SaveManager {
  /**
   * Save current game state to localStorage.
   * @param {{ grid: number[][], score: number, moves: number, mode: string }} state
   */
  saveGame(state) {
    localStorage.setItem(STORAGE_KEYS.SAVE, JSON.stringify(state));
  }

  /**
   * Load saved game state.
   * @returns {{ grid: number[][], score: number, moves: number, mode: string } | null}
   */
  loadGame() {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Clear current saved game. */
  clearGame() {
    localStorage.removeItem(STORAGE_KEYS.SAVE);
  }

  /** @returns {boolean} */
  hasSave() {
    return localStorage.getItem(STORAGE_KEYS.SAVE) !== null;
  }

  /**
   * Add a score to rankings for a given mode.
   * @param {string} mode - 'classic' | 'battle' | 'free'
   * @param {number} score
   * @param {{ maxTile?: number, moves?: number, fusions?: number, powers?: string[] }} extra
   */
  addRanking(mode, score, extra = {}) {
    const rankings = this.#loadRankings();
    if (!rankings[mode]) rankings[mode] = [];
    const entry = { score, date: Date.now() };
    if (extra.maxTile != null) entry.maxTile = extra.maxTile;
    if (extra.moves != null) entry.moves = extra.moves;
    if (extra.fusions != null) entry.fusions = extra.fusions;
    if (extra.powers) entry.powers = extra.powers;
    if (extra.enemiesDefeated != null) entry.enemiesDefeated = extra.enemiesDefeated;
    if (extra.enemyMaxLevel != null) entry.enemyMaxLevel = extra.enemyMaxLevel;
    rankings[mode].push(entry);
    rankings[mode].sort((a, b) => b.score - a.score);
    rankings[mode] = rankings[mode].slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.RANKINGS, JSON.stringify(rankings));
  }

  /**
   * Get top 10 scores for a mode.
   * @param {string} mode
   * @returns {{ score: number, date: number }[]}
   */
  getRankings(mode) {
    const rankings = this.#loadRankings();
    return rankings[mode] ?? [];
  }

  /** Reset all rankings. */
  resetRankings() {
    localStorage.removeItem(STORAGE_KEYS.RANKINGS);
  }

  /**
   * Get best score for a mode.
   * @param {string} mode
   * @returns {number}
   */
  getBestScore(mode) {
    const list = this.getRankings(mode);
    return list.length > 0 ? list[0].score : 0;
  }

  /**
   * Get best max tile across all rankings for a mode.
   * @param {string} mode
   * @returns {number}
   */
  getBestMaxTile(mode) {
    const list = this.getRankings(mode);
    let best = 0;
    for (const entry of list) {
      if (entry.maxTile > best) best = entry.maxTile;
    }
    return best;
  }

  /** @returns {Record<string, { score: number, date: number }[]>} */
  #loadRankings() {
    const raw = localStorage.getItem(STORAGE_KEYS.RANKINGS);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

export const saveManager = new SaveManager();
