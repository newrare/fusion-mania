/**
 * All valid tile state identifiers.
 * 'normal' maps to null/no-state internally; the others are named states.
 */
export const TILE_STATE_IDS = ['normal', 'ice', 'ghost-h', 'ghost-v', 'blind', 'targeted'];

/**
 * Pure data class representing a single tile on the grid.
 * No Phaser dependency — purely logic.
 */
export class Tile {
  /** @type {number} Tile value (2, 4, 8, …) */
  value;

  /** @type {number} Row position (0-3) */
  row;

  /** @type {number} Column position (0-3) */
  col;

  /** @type {string | null} Unique ID for DOM element tracking */
  id;

  /** @type {boolean} Whether this tile was just merged this turn */
  merged;

  /** @type {string | null} Active state: null | 'ice' | 'ghost-h' | 'ghost-v' | 'blind' */
  state;

  /** @type {number} Remaining moves for the active state (0 = no state) */
  stateTurns;

  /** @type {number} Cooldown moves after ice expires (prevents immediate re-freeze) */
  iceCooldown;

  /** @type {number} Cooldown moves after blind expires (prevents immediate re-blind) */
  blindCooldown;

  /** @type {boolean} Whether this tile is the current power target */
  targeted;

  /**
   * @param {number} value
   * @param {number} row
   * @param {number} col
   */
  constructor(value, row, col) {
    this.value = value;
    this.row = row;
    this.col = col;
    this.id = `tile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.merged = false;
    this.state = null;
    this.stateTurns = 0;
    this.iceCooldown = 0;
    this.blindCooldown = 0;
    this.targeted = false;
  }

  /**
   * Apply a timed state to this tile.
   * @param {string} state — State identifier
   * @param {number} turns — Duration in moves
   */
  applyState(state, turns) {
    this.state = state;
    this.stateTurns = turns;
  }

  /**
   * Clear the active state.
   */
  clearState() {
    this.state = null;
    this.stateTurns = 0;
  }

  /**
   * Decrement the state turn counter. Clears the state if it reaches 0.
   * Also decrements iceCooldown when applicable.
   */
  tickState() {
    let justExpiredIce = false;
    let justExpiredBlind = false;
    if (this.stateTurns > 0) {
      this.stateTurns--;
      if (this.stateTurns <= 0) {
        justExpiredIce = this.state === 'ice';
        justExpiredBlind = this.state === 'blind';
        this.clearState();
      }
    }
    // Decrement cooldowns — but not in the same tick they were just set.
    if (!justExpiredIce && this.iceCooldown > 0) this.iceCooldown--;
    if (!justExpiredBlind && this.blindCooldown > 0) this.blindCooldown--;
    // Apply cooldowns AFTER decrement so they last at least 1 full move.
    if (justExpiredIce) this.iceCooldown = 1;
    if (justExpiredBlind) this.blindCooldown = 1;
  }
}
