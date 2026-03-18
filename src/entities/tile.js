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
  }
}
