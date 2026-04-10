import { STORAGE_KEYS, MAX_SAVE_SLOTS } from '../configs/constants.js';

class SaveManager {
  // ─── AUTO-SAVE ─────────────────────────────────────

  /**
   * Save game state to the auto-save slot.
   * @param {object} state — Full game state (same format as manual save slots)
   */
  autoSave(state) {
    localStorage.setItem(STORAGE_KEYS.AUTOSAVE, JSON.stringify({ ...state, date: Date.now() }));
  }

  /**
   * Load the auto-save slot.
   * @returns {object | null}
   */
  loadAutoSave() {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTOSAVE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** @returns {boolean} */
  hasAutoSave() {
    return localStorage.getItem(STORAGE_KEYS.AUTOSAVE) !== null;
  }

  /** Clear the auto-save slot. */
  clearAutoSave() {
    localStorage.removeItem(STORAGE_KEYS.AUTOSAVE);
  }

  // ─── LEGACY SAVE (quick save on menu open) ────────
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
    rankings[mode].sort((a, b) => this.#compareEntries(a, b));
    rankings[mode] = rankings[mode].slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.RANKINGS, JSON.stringify(rankings));
  }

  /**
   * Compare two ranking entries for sorting (DESC rank = index 0 is best).
   * All modes: score DESC → date ASC (oldest wins tie).
   * @param {object} a
   * @param {object} b
   * @returns {number}
   */
  #compareEntries(a, b) {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.date ?? 0) - (b.date ?? 0);
  }

  /**
   * Get top 10 scores for a mode, sorted by score DESC.
   * @param {string} mode
   * @returns {{ score: number, date: number }[]}
   */
  getRankings(mode) {
    const rankings = this.#loadRankings();
    const list = rankings[mode] ?? [];
    return [...list].sort((a, b) => this.#compareEntries(a, b));
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
    let best = 0;
    for (const entry of list) {
      if (entry.score > best) best = entry.score;
    }
    return best;
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

  // ─── SAVE SLOTS ────────────────────────────────────

  /**
   * Get all save slots.
   * @returns {(object | null)[]} Array of up to MAX_SAVE_SLOTS entries (null = empty).
   */
  getSlots() {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVE_SLOTS);
    if (!raw) return [];
    try {
      const slots = JSON.parse(raw);
      if (!Array.isArray(slots)) return [];
      // Migrate: compact any null gaps left by older save format
      const compacted = slots.filter((s) => s != null);
      if (compacted.length !== slots.length) {
        localStorage.setItem(STORAGE_KEYS.SAVE_SLOTS, JSON.stringify(compacted));
      }
      return compacted;
    } catch {
      return [];
    }
  }

  /**
   * Save a full game state to the first available slot.
   * If all slots are occupied, the oldest save (by date) is overwritten.
   * @param {object} state — Full game state
   * @returns {number} Slot index used
   */
  saveSlot(state) {
    const slots = this.getSlots();
    // Prefer an empty slot first
    let idx = slots.findIndex((s) => s == null);
    if (idx === -1) {
      if (slots.length < MAX_SAVE_SLOTS) {
        idx = slots.length;
      } else {
        // All slots full — evict the oldest save
        let oldestDate = Infinity;
        for (let i = 0; i < slots.length; i++) {
          const d = slots[i]?.date ?? 0;
          if (d < oldestDate) {
            oldestDate = d;
            idx = i;
          }
        }
      }
    }
    slots[idx] = { ...state, date: Date.now() };
    localStorage.setItem(STORAGE_KEYS.SAVE_SLOTS, JSON.stringify(slots));
    return idx;
  }

  /**
   * Load a saved game from a slot.
   * @param {number} idx — Slot index
   * @returns {object | null}
   */
  loadSlot(idx) {
    const slots = this.getSlots();
    return slots[idx] ?? null;
  }

  /**
   * Delete a save slot.
   * @param {number} idx — Slot index
   */
  deleteSlot(idx) {
    const slots = this.getSlots();
    if (idx >= 0 && idx < slots.length) {
      slots.splice(idx, 1); // compact: no null gaps
      localStorage.setItem(STORAGE_KEYS.SAVE_SLOTS, JSON.stringify(slots));
    }
  }

  /**
   * Get a summary of all slots (for display in load modal).
   * @returns {{ index: number, mode: string, date: number, score: number, maxTile: number, moves: number }[]}
   */
  getSlotSummaries() {
    const slots = this.getSlots();
    const summaries = [];
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s) {
        summaries.push({
          index: i,
          mode: s.mode ?? 'classic',
          date: s.date ?? 0,
          score: s.score ?? 0,
          maxTile: s.maxTile ?? 0,
          moves: s.moves ?? 0,
        });
      }
    }
    return summaries;
  }

  /** @returns {boolean} Always true — saveSlot() evicts the oldest when all slots are full */
  hasAvailableSlot() {
    return true;
  }
}

export const saveManager = new SaveManager();
