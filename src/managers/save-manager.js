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
   * @param {{
   *   maxTile?: number,
   *   moves?: number,
   *   fusions?: number,
   *   comboScore?: number,
   *   powers?: string[],
   *   enemiesDefeated?: number,
   *   enemyMaxLevel?: number,
   *   defeatedEnemies?: { name: string, level: number }[],
   * }} extra
   */
  addRanking(mode, score, extra = {}) {
    const rankings = this.#loadRankings();
    if (!rankings[mode]) rankings[mode] = [];
    const entry = { score, date: Date.now() };
    if (extra.maxTile != null) entry.maxTile = extra.maxTile;
    if (extra.moves != null) entry.moves = extra.moves;
    if (extra.fusions != null) entry.fusions = extra.fusions;
    if (extra.comboScore != null) entry.comboScore = extra.comboScore;
    if (extra.powers) entry.powers = extra.powers;
    if (extra.enemiesDefeated != null) entry.enemiesDefeated = extra.enemiesDefeated;
    if (extra.enemyMaxLevel != null) entry.enemyMaxLevel = extra.enemyMaxLevel;
    if (extra.defeatedEnemies) entry.defeatedEnemies = extra.defeatedEnemies;
    rankings[mode].push(entry);
    rankings[mode].sort((a, b) => this.#compareEntries(mode, a, b));
    rankings[mode] = rankings[mode].slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.RANKINGS, JSON.stringify(rankings));
  }

  /**
   * Compare two ranking entries for sorting (DESC rank = index 0 is best).
   * Battle: enemyMaxLevel DESC → score DESC → date ASC (oldest wins tie).
   * Classic / Free: score DESC → date ASC (oldest wins tie).
   * @param {string} mode
   * @param {object} a
   * @param {object} b
   * @returns {number}
   */
  #compareEntries(mode, a, b) {
    if (mode === 'battle') {
      const lvlDiff = (b.enemyMaxLevel ?? 0) - (a.enemyMaxLevel ?? 0);
      if (lvlDiff !== 0) return lvlDiff;
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.date ?? 0) - (b.date ?? 0);
    }
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.date ?? 0) - (b.date ?? 0);
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
