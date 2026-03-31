import { GRID_LIFE } from '../configs/constants.js';

/**
 * Pure game logic for the grid's hit-point bar (Free mode).
 * Tracks HP, computes damage from destroyed / expelled tiles, and provides
 * colour-category helpers for the liquid visual.
 *
 * No Phaser or DOM dependency — rendering is handled by GameScene.
 */
export class GridLife {
  /** @type {number} */
  #maxHp;

  /** @type {number} */
  #currentHp;

  /** @type {number} */
  #damageMultiplier;

  /** @type {number} Total tiles destroyed so far (drives difficulty scaling) */
  #totalDestroyed = 0;

  /**
   * @param {number} [maxHp]
   * @param {number} [damageMultiplier]
   */
  constructor(maxHp = GRID_LIFE.MAX_HP, damageMultiplier = GRID_LIFE.DAMAGE_MULTIPLIER) {
    this.#maxHp = maxHp;
    this.#currentHp = maxHp;
    this.#damageMultiplier = damageMultiplier;
  }

  /** @returns {number} */
  get currentHp() { return this.#currentHp; }

  /** @returns {number} */
  get maxHp() { return this.#maxHp; }

  /** @returns {number} 0 – 1 */
  get percent() { return Math.max(0, this.#currentHp / this.#maxHp); }

  /** @returns {boolean} */
  get isDead() { return this.#currentHp <= 0; }

  /** @returns {number} */
  get totalDestroyed() { return this.#totalDestroyed; }

  /** @returns {boolean} HP below critical threshold */
  get isCritical() { return this.percent <= GRID_LIFE.CRITICAL_THRESHOLD; }

  /**
   * Compute and apply damage from destroying tiles.
   *
   * Formula per tile: log2(value) × damageMultiplier
   * Then the sum is scaled by (1 + totalDestroyed × SCALING_FACTOR).
   *
   * @param {number[]} tileValues — values of the destroyed / expelled tiles
   * @returns {number} Total (rounded) damage dealt this call
   */
  takeDamage(tileValues) {
    if (tileValues.length === 0) return 0;

    let raw = 0;
    for (const value of tileValues) {
      raw += Math.log2(value);
    }
    raw *= this.#damageMultiplier;

    const scaling = 1 + this.#totalDestroyed * GRID_LIFE.SCALING_FACTOR;
    const damage = Math.max(1, Math.round(raw * scaling));

    this.#totalDestroyed += tileValues.length;
    this.#currentHp = Math.max(0, this.#currentHp - damage);
    return damage;
  }

  /**
   * Colour category for the liquid visual.
   * @returns {'info' | 'warning' | 'danger'}
   */
  getColorCategory() {
    const pct = this.percent;
    if (pct > 0.6) return 'info';
    if (pct > 0.3) return 'warning';
    return 'danger';
  }

  /** @returns {object} */
  serialize() {
    return {
      maxHp: this.#maxHp,
      currentHp: this.#currentHp,
      damageMultiplier: this.#damageMultiplier,
      totalDestroyed: this.#totalDestroyed,
    };
  }

  /** @param {object} data */
  restore(data) {
    this.#maxHp = data.maxHp ?? GRID_LIFE.MAX_HP;
    this.#currentHp = data.currentHp ?? this.#maxHp;
    this.#damageMultiplier = data.damageMultiplier ?? GRID_LIFE.DAMAGE_MULTIPLIER;
    this.#totalDestroyed = data.totalDestroyed ?? 0;
  }
}
