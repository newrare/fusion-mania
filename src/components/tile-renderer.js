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
  'fm-state-ice',
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
      case 'ice':
        classes.push('fm-state-ice');
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

    // 2. Remove any snowflakes from a previous ice state
    for (const child of el.querySelectorAll('.fm-snowflake')) {
      child.remove();
    }

    // 3. Apply current state classes
    for (const cls of TileRenderer.stateClasses(tile, opts)) {
      el.classList.add(cls);
    }

    // 4. Inject snowflake children for ice state
    if (tile.state === 'ice') {
      TileRenderer.#injectSnowflakes(el);
    }

    // 5. Ensure the displayed value is correct
    const valEl = el.querySelector('.fm-val');
    if (valEl) {
      valEl.textContent = tile.state === 'blind' ? '?' : String(tile.value);
    }

    // 6. Ensure the value class (fm-tN) matches the tile value
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
    // Remove snowflakes from ice state if present
    for (const child of el.querySelectorAll('.fm-snowflake')) {
      child.remove();
    }
    el.classList.add('fm-state-danger');
  }

  /**
   * Inject animated snowflake children for the ice tile state.
   * @param {HTMLElement} el
   */
  static #injectSnowflakes(el) {
    const flakes = [
      { top: '8%',  left: '12%', sz: '0.75rem', sd: '3.2s', sdl: '0s'   },
      { top: '14%', left: '60%', sz: '0.55rem', sd: '2.8s', sdl: '-1s'  },
      { top: '35%', left: '80%', sz: '0.85rem', sd: '3.6s', sdl: '-2s'  },
      { top: '52%', left: '25%', sz: '0.65rem', sd: '2.5s', sdl: '-0.6s'},
      { top: '70%', left: '55%', sz: '0.70rem', sd: '3.0s', sdl: '-1.4s'},
      { top: '20%', left: '42%', sz: '0.50rem', sd: '4.0s', sdl: '-2.5s'},
    ];
    for (const f of flakes) {
      const span = document.createElement('span');
      span.className = 'fm-snowflake';
      span.textContent = '❄';
      span.style.cssText =
        `top:${f.top};left:${f.left};font-size:${f.sz};--fm-sd:${f.sd};--fm-sdl:${f.sdl}`;
      el.appendChild(span);
    }
  }
}