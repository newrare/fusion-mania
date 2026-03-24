import { POWER_META } from '../configs/constants.js';

/**
 * Represents a power instance placed on the grid edge.
 */
export class Power {
  /** @type {string} Power type (from POWER_TYPES) */
  type;

  /** @type {string | null} Grid side: 'top' | 'bottom' | 'left' | 'right' */
  side;

  /** @type {string} Unique instance ID */
  id;

  /**
   * @param {string} type — One of POWER_TYPES values
   * @param {string | null} [side=null] — Grid side where this power is placed
   */
  constructor(type, side = null) {
    this.type = type;
    this.side = side;
    this.id = `power-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Get the SVG symbol ID for this power's icon.
   * @returns {string}
   */
  get svgId() {
    return POWER_META[this.type]?.svgId ?? '';
  }

  /**
   * Get the i18n name key for this power.
   * @returns {string}
   */
  get nameKey() {
    return POWER_META[this.type]?.nameKey ?? '';
  }
}
