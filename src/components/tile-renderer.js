/**
 * Centralised tile DOM rendering.
 *
 * Each tile state (normal, frozen, ghost, blind, active/targeted, wind, danger)
 * gets a clean, self-contained CSS class set. When the state changes the element
 * is rebuilt from a deterministic template — no leftover classes.
 */

/** All state-related CSS classes that may appear on a tile element. */
const STATE_CLASSES = [
  'fm-state-active',
  'fm-state-freeze',
  'fm-state-ghost',
  'fm-state-blind',
  'fm-state-danger',
  'fm-state-wind',
  'fm-state-wind-up',
  'fm-state-wind-down',
  'fm-state-wind-left',
  'fm-state-wind-right',
];

export class TileRenderer {
  /**
   * Build the full class-list for a tile based on its current state.
   * @param {import('../entities/tile.js').Tile} tile
   * @param {{ windDirection?: string | null }} [opts]
   * @returns {string[]} CSS classes to apply (does NOT include fm-tile / fm-tN)
   */
  static stateClasses(tile, opts = {}) {
    const classes = [];

    switch (tile.state) {
      case 'frozen':
        classes.push('fm-state-freeze');
        break;
      case 'ghost-h':
      case 'ghost-v':
        classes.push('fm-state-ghost');
        break;
      case 'blind':
        classes.push('fm-state-blind');
        break;
      default:
        // Only show targeted visual when the tile has no other state
        if (tile.targeted) {
          classes.push('fm-state-active');
        }
        break;
    }

    if (opts.windDirection) {
      classes.push('fm-state-wind', `fm-state-wind-${opts.windDirection}`);
    }

    return classes;
  }

  /**
   * Apply the correct state to a tile DOM element. Strips all old state classes
   * first, then applies only what the tile data says.
   *
   * @param {HTMLElement} el
   * @param {import('../entities/tile.js').Tile} tile
   * @param {{ windDirection?: string | null }} [opts]
   */
  static applyState(el, tile, opts = {}) {
    // 1. Strip every state class in one pass
    for (const cls of STATE_CLASSES) {
      el.classList.remove(cls);
    }

    // 2. Apply current state classes
    for (const cls of TileRenderer.stateClasses(tile, opts)) {
      el.classList.add(cls);
    }

    // 3. Ensure the displayed value is correct
    const valEl = el.querySelector('.fm-val');
    if (valEl) {
      valEl.textContent = tile.state === 'blind' ? '?' : String(tile.value);
    }

    // 4. Ensure the value class (fm-tN) matches the tile value
    TileRenderer.syncValueClass(el, tile.value);
  }

  /**
   * Make sure the element carries exactly `fm-t{value}` and no other `fm-t*` class.
   * @param {HTMLElement} el
   * @param {number} value
   */
  static syncValueClass(el, value) {
    const target = `fm-t${value}`;
    // Quick check — skip DOM work if already correct
    if (el.classList.contains(target)) return;
    for (const cls of [...el.classList]) {
      if (cls.startsWith('fm-t') && cls !== 'fm-tile' && cls !== target) {
        el.classList.remove(cls);
      }
    }
    el.classList.add(target);
  }

  /**
   * Apply a transient danger overlay (used before destroying a tile).
   * @param {HTMLElement} el
   */
  static applyDanger(el) {
    // Strip conflicting states but keep base tile identity
    for (const cls of STATE_CLASSES) {
      el.classList.remove(cls);
    }
    el.classList.add('fm-state-danger');
  }
}
