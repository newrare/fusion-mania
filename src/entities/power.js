import {
  POWER_TYPES,
  POWER_META,
  POWER_CATEGORIES,
  POWER_DURATIONS,
} from '../configs/constants.js';

/**
 * Central authority for power metadata and instances.
 *
 * Can be used as an instance (for power objects placed on the grid)
 * or via static methods for pure metadata lookups by type string.
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

  // ─── Instance getters (delegate to static) ─────

  /** @returns {string} SVG symbol ID */
  get svgId() {
    return Power.svgId(this.type);
  }

  /** @returns {string} i18n name key */
  get nameKey() {
    return Power.nameKey(this.type);
  }

  /** @returns {'danger' | 'warning' | 'info'} */
  get category() {
    return Power.category(this.type);
  }

  /** @returns {boolean} */
  get isDestructive() {
    return Power.isDestructive(this.type);
  }

  /** @returns {boolean} */
  get isGridWide() {
    return Power.isGridWide(this.type);
  }

  /** @returns {number} Default duration in moves (0 if not a timed effect) */
  get duration() {
    return Power.duration(this.type);
  }

  // ─── Static lookups by type string ─────────────

  /**
   * Get the SVG symbol ID for a power type.
   * @param {string} type
   * @returns {string}
   */
  static svgId(type) {
    return POWER_META[type]?.svgId ?? '';
  }

  /**
   * Get the i18n name key for a power type.
   * @param {string} type
   * @returns {string}
   */
  static nameKey(type) {
    return POWER_META[type]?.nameKey ?? '';
  }

  /**
   * Get the badge color category for a power type.
   * @param {string} type
   * @returns {'danger' | 'warning' | 'info'}
   */
  static category(type) {
    if (POWER_CATEGORIES.danger.includes(type)) return 'danger';
    if (POWER_CATEGORIES.warning.includes(type)) return 'warning';
    return 'info';
  }

  /**
   * Whether a power type destroys tiles (fire, bomb, lightning, nuclear).
   * @param {string} type
   * @returns {boolean}
   */
  static isDestructive(type) {
    return POWER_CATEGORIES.danger.includes(type);
  }

  /**
   * Whether a power type affects the whole grid (no specific target tile needed).
   * @param {string} type
   * @returns {boolean}
   */
  static isGridWide(type) {
    return (
      type === POWER_TYPES.NUCLEAR ||
      type === POWER_TYPES.BLIND ||
      type === POWER_TYPES.ADS ||
      type === POWER_TYPES.LIGHTNING
    );
  }

  /**
   * Default duration in moves for timed power effects.
   * Returns 0 for instant/non-timed powers.
   * @param {string} type
   * @returns {number}
   */
  static duration(type) {
    switch (type) {
      case POWER_TYPES.ICE:
        return POWER_DURATIONS.ICE;
      case POWER_TYPES.BLIND:
        return POWER_DURATIONS.BLIND;
      case POWER_TYPES.EXPEL_H:
      case POWER_TYPES.EXPEL_V:
        return POWER_DURATIONS.EXPEL;
      case POWER_TYPES.WIND_UP:
      case POWER_TYPES.WIND_DOWN:
      case POWER_TYPES.WIND_LEFT:
      case POWER_TYPES.WIND_RIGHT:
        return POWER_DURATIONS.WIND;
      default:
        return 0;
    }
  }

  /**
   * Return all registered power type strings.
   * @returns {string[]}
   */
  static allTypes() {
    return Object.values(POWER_TYPES);
  }
}
