/**
 * Manages the chronological event log for a single game session.
 * Pure data — no Phaser or DOM dependency.
 *
 * Each player move creates a "turn" containing the move direction, score delta,
 * fusion count, and a list of sub-events (fusions, powers, enemy actions, etc.).
 * Turns are stored most-recent-first for display purposes.
 */
export class HistoryManager {
  /** @type {Array<import('./history-manager.js').HistoryTurn>} Most recent first */
  #turns = [];

  /** @type {import('./history-manager.js').HistoryTurn | null} */
  #current = null;

  /** Maximum number of turns to keep (prevents unbounded memory growth) */
  static MAX_TURNS = 500;

  /**
   * Begin a new turn entry.
   * @param {number} moveNumber
   * @param {'up'|'down'|'left'|'right'} direction
   * @param {number} scoreBefore — score snapshot before the move
   */
  beginTurn(moveNumber, direction, scoreBefore) {
    this.#current = {
      move: moveNumber,
      direction,
      scoreBefore,
      scoreAfter: scoreBefore,
      fusions: 0,
      entries: [],
    };
  }

  /**
   * Record tile fusions that happened in this turn.
   * @param {Array<[number, number]>} pairs — e.g. [[2,2],[8,8]]
   */
  addFusions(pairs) {
    if (!this.#current || pairs.length === 0) return;
    this.#current.fusions += pairs.length;
    this.#current.entries.push({ type: 'fusion', pairs });
  }

  /**
   * Record a power activation.
   * @param {string} powerType — power identifier
   */
  addPower(powerType) {
    if (!this.#current) return;
    // Merge with existing power entry if present
    const existing = this.#current.entries.find((e) => e.type === 'power');
    if (existing) {
      existing.powers.push(powerType);
    } else {
      this.#current.entries.push({ type: 'power', powers: [powerType] });
    }
  }

  /**
   * Record tile contamination by an enemy.
   * @param {number} tileValue — value of the contaminated tile
   */
  addContamination(tileValue) {
    if (!this.#current) return;
    this.#current.entries.push({ type: 'contamination', value: tileValue });
  }

  /**
   * Record an enemy spawn event.
   * @param {string} name
   * @param {number} level
   */
  addEnemySpawn(name, level) {
    if (!this.#current) return;
    this.#current.entries.push({ type: 'enemy_spawn', name, level });
  }

  /**
   * Record damage dealt to an enemy.
   * @param {string} name
   * @param {number} level
   * @param {number} damage
   */
  addEnemyDamage(name, level, damage) {
    if (!this.#current) return;
    this.#current.entries.push({ type: 'enemy_damage', name, level, damage });
  }

  /**
   * Record that an enemy was defeated.
   * @param {string} name
   * @param {number} level
   */
  addEnemyDefeated(name, level) {
    if (!this.#current) return;
    this.#current.entries.push({ type: 'enemy_defeated', name, level });
  }

  /**
   * Record damage dealt to the grid (Free / Battle mode HP bar).
   * Merges into the existing grid_damage entry for the turn if one exists.
   * @param {number} damage
   */
  addGridDamage(damage) {
    if (!this.#current || damage <= 0) return;
    const existing = this.#current.entries.find((e) => e.type === 'grid_damage');
    if (existing) {
      existing.damage += damage;
    } else {
      this.#current.entries.push({ type: 'grid_damage', damage });
    }
  }

  /**
   * Record tiles lost (destroyed by powers or expelled).
   * Merges into the existing tiles_lost entry for the turn if one exists.
   * @param {number[]} values — tile values that were removed
   */
  addTilesLost(values) {
    if (!this.#current || values.length === 0) return;
    const existing = this.#current.entries.find((e) => e.type === 'tiles_lost');
    if (existing) {
      existing.values.push(...values);
    } else {
      this.#current.entries.push({ type: 'tiles_lost', values });
    }
  }

  /**
   * Record combo bonus points earned.
   * @param {number} points
   */
  addComboBonus(points) {
    if (!this.#current) return;
    this.#current.entries.push({ type: 'combo_bonus', points });
  }

  /**
   * Finalize the current turn: compute score delta and push to history.
   * @param {number} scoreAfter — score after the move
   */
  finalizeTurn(scoreAfter) {
    if (!this.#current) return;
    this.#current.scoreAfter = scoreAfter;
    const scoreGained = scoreAfter - this.#current.scoreBefore;
    if (scoreGained > 0) {
      this.#current.entries.push({ type: 'score', points: scoreGained });
    }
    // Skip turns where nothing interesting happened (tiles may have slid but
    // no merges, powers, enemy events, or score gain occurred).
    if (this.#current.entries.length === 0) {
      this.#current = null;
      return;
    }
    this.#turns.unshift(this.#current);
    if (this.#turns.length > HistoryManager.MAX_TURNS) {
      this.#turns.length = HistoryManager.MAX_TURNS;
    }
    this.#current = null;
  }

  /** @returns {Array<object>} All turns, most recent first */
  getTurns() {
    return this.#turns;
  }

  /** @returns {number} Total number of recorded turns */
  get length() {
    return this.#turns.length;
  }

  /** Clear all history */
  clear() {
    this.#turns = [];
    this.#current = null;
  }

  /**
   * Serialize for save/load.
   * @returns {Array<object>}
   */
  serialize() {
    return this.#turns;
  }

  /**
   * Restore from serialized data.
   * @param {Array<object>} data
   */
  restore(data) {
    this.#turns = Array.isArray(data) ? data : [];
    this.#current = null;
  }
}

/**
 * @typedef {object} HistoryTurn
 * @property {number} move
 * @property {string} direction
 * @property {number} scoreBefore
 * @property {number} scoreAfter
 * @property {number} fusions
 * @property {Array<HistoryEntry>} entries
 */

/**
 * @typedef {object} HistoryEntry
 * @property {string} type
 * @property {Array<[number,number]>} [pairs]
 * @property {string[]} [powers]
 * @property {number} [value]
 * @property {string} [name]
 * @property {number} [level]
 * @property {number} [damage]
 * @property {number[]} [values]
 * @property {number} [points]
 */
