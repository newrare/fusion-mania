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
  'fm-state-ghost-v',
  'fm-state-ghost-h',
  'fm-state-blind',
  'fm-state-danger',
  'fm-state-wind',
  'fm-state-wind-up',
  'fm-state-wind-down',
  'fm-state-wind-left',
  'fm-state-wind-right',
];

/**
 * Maps a blocked direction (stored in windDirection) to its opposite
 * (the actual wind-blow direction), which determines the CSS class and visual.
 * e.g. windDirection='down' (blocks downward) → wind blows upward → class fm-state-wind-up
 */
const WIND_CSS_DIR = { up: 'down', down: 'up', left: 'right', right: 'left' };

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
      case 'ghost-v':
        classes.push('fm-state-ghost-v');
        break;
      case 'ghost-h':
        classes.push('fm-state-ghost-h');
        break;
      case 'blind':
        classes.push('fm-state-blind');
        break;
      default:
        if (tile.targeted) {
          classes.push('fm-state-active');
        }
        break;
    }

    if (opts.windDirection) {
      // CSS class uses the wind-blow direction (opposite of the blocked direction)
      const cssDir = WIND_CSS_DIR[opts.windDirection] ?? opts.windDirection;
      classes.push('fm-state-wind', `fm-state-wind-${cssDir}`);
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
    // Detect ice → non-ice or non-ice → ice transition before stripping classes
    const wasIce = el.classList.contains('fm-state-ice');
    const isIce = tile.state === 'ice';
    const isBlind = tile.state === 'blind';
    const isGhostH = tile.state === 'ghost-h';
    const isGhostV = tile.state === 'ghost-v';
    const isExpel = isGhostH || isGhostV;

    // 1. Delta-update state classes — never strip-then-re-add; avoids 1-frame flash
    //    on fm-state-blind (which uses animation:none) or other animated states.
    const desiredClasses = new Set(TileRenderer.stateClasses(tile, opts));
    for (const cls of STATE_CLASSES) {
      if (desiredClasses.has(cls)) {
        if (!el.classList.contains(cls)) el.classList.add(cls);
      } else {
        el.classList.remove(cls);
      }
    }

    // 2. Manage snowflakes — only rebuild if count changed to avoid animation restarts
    const neededCount = isIce ? Math.max(1, Math.min(tile.stateTurns, 6)) : 0;
    const currentCount = Number(el.dataset.snowCount ?? -1);
    if (neededCount !== currentCount) {
      for (const child of el.querySelectorAll('.fm-snowflake')) {
        child.remove();
      }
      el.dataset.snowCount = String(neededCount);
    }

    // 2b. Manage blind marks — only rebuild if count changed
    const neededBlind = isBlind ? Math.max(1, Math.min(tile.stateTurns, 3)) : 0;
    const currentBlind = Number(el.dataset.blindCount ?? -1);
    if (neededBlind !== currentBlind) {
      for (const child of el.querySelectorAll('.fm-blind-mark')) {
        child.remove();
      }
      el.dataset.blindCount = String(neededBlind);
    }

    // 2c. Manage expel marks — only rebuild if count changed
    const neededExpel = isExpel ? Math.max(1, Math.min(tile.stateTurns, 3)) : 0;
    const currentExpel = Number(el.dataset.expelCount ?? -1);
    if (neededExpel !== currentExpel) {
      for (const child of el.querySelectorAll('.fm-expel-mark')) {
        child.remove();
      }
      el.dataset.expelCount = String(neededExpel);
    }

    // 3. Inject state-specific children (only if count was reset above)
    if (isIce && neededCount !== currentCount) {
      TileRenderer.#injectSnowflakes(el, tile.stateTurns);
    }
    if (isBlind && neededBlind !== currentBlind) {
      TileRenderer.#injectBlindMarks(el, tile.stateTurns);
    }
    if (isExpel && neededExpel !== currentExpel) {
      TileRenderer.#injectExpelMarks(el, tile.state, tile.stateTurns);
    }

    // 4a. Play freeze-enter animation when transitioning into ice
    if (isIce && !wasIce) {
      el.classList.add('fm-state-ice-enter');
      el.addEventListener('animationend', () => el.classList.remove('fm-state-ice-enter'), {
        once: true,
      });
    }

    // 4b. Play melt-exit animation when transitioning out of ice
    if (!isIce && wasIce) {
      el.classList.add('fm-state-ice-exit');
      el.addEventListener('animationend', () => el.classList.remove('fm-state-ice-exit'), {
        once: true,
      });
    }

    // 4. Ensure the value class (fm-tN) matches the tile value
    TileRenderer.syncValueClass(el, tile.value);

    // 5. Ensure the displayed value is correct
    const valEl = el.querySelector('.fm-val');
    if (valEl) {
      valEl.textContent = tile.state === 'blind' ? '?' : String(tile.value);
    }
  }

  /**
   * Make sure the element carries exactly `fm-t{value}` and no other `fm-t*` class.
   * @param {HTMLElement} el
   * @param {number} value
   */
  static syncValueClass(el, value) {
    const target = `fm-t${value}`;
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
    for (const cls of STATE_CLASSES) {
      el.classList.remove(cls);
    }
    for (const child of el.querySelectorAll('.fm-snowflake, .fm-blind-mark, .fm-expel-mark')) {
      child.remove();
    }
    delete el.dataset.snowCount;
    delete el.dataset.blindCount;
    delete el.dataset.expelCount;
    el.classList.add('fm-state-danger');
  }

  /**
   * Strip all state classes and injected children from a tile element
   * without applying the danger overlay. Use before animation-based destruction
   * (fire, bomb, nuclear) to remove `animation: none !important` from ice/blind.
   * @param {HTMLElement} el
   */
  static clearStateOnly(el) {
    for (const cls of STATE_CLASSES) {
      el.classList.remove(cls);
    }
    for (const child of el.querySelectorAll('.fm-snowflake, .fm-blind-mark, .fm-expel-mark')) {
      child.remove();
    }
    delete el.dataset.snowCount;
    delete el.dataset.blindCount;
    delete el.dataset.expelCount;
  }

  /**
   * Inject animated snowflake children for the ice tile state.
   * The number of snowflakes matches the remaining state turns (max 6).
   * @param {HTMLElement} el
   * @param {number} [turns]
   */
  static #injectSnowflakes(el, turns = 6) {
    const flakes = [
      { top: '8%', left: '12%', sz: '0.75rem', sd: '3.2s', sdl: '0s' },
      { top: '14%', left: '60%', sz: '0.55rem', sd: '2.8s', sdl: '-1s' },
      { top: '35%', left: '80%', sz: '0.85rem', sd: '3.6s', sdl: '-2s' },
      { top: '52%', left: '25%', sz: '0.65rem', sd: '2.5s', sdl: '-0.6s' },
      { top: '70%', left: '55%', sz: '0.70rem', sd: '3.0s', sdl: '-1.4s' },
      { top: '20%', left: '42%', sz: '0.50rem', sd: '4.0s', sdl: '-2.5s' },
    ];
    const count = Math.max(1, Math.min(turns, flakes.length));
    for (const f of flakes.slice(0, count)) {
      const span = document.createElement('span');
      span.className = 'fm-snowflake';
      span.textContent = '❄';
      span.style.cssText = `top:${f.top};left:${f.left};font-size:${f.sz};--fm-sd:${f.sd};--fm-sdl:${f.sdl}`;
      el.appendChild(span);
    }
  }

  /**
   * Inject animated expel-mark children for the ghost-h / ghost-v tile state.
   * The number of marks matches the remaining state turns (max 3).
   * Uses s-exp-r for horizontal expel, s-exp-d (rotated 90°) for vertical expel.
   * @param {HTMLElement} el
   * @param {'ghost-h'|'ghost-v'} state
   * @param {number} [turns]
   */
  static #injectExpelMarks(el, state, turns = 3) {
    const symId = state === 'ghost-h' ? 's-exp-r' : 's-exp-d';
    const marks = [
      { top: '10%', left: '55%', sz: '0.80rem', ed: '2.5s', edl: '0s' },
      { top: '42%', left: '14%', sz: '0.70rem', ed: '2.9s', edl: '-1.0s' },
      { top: '68%', left: '62%', sz: '0.75rem', ed: '2.7s', edl: '-1.8s' },
    ];
    const count = Math.max(1, Math.min(turns, marks.length));
    for (const m of marks.slice(0, count)) {
      const span = document.createElement('span');
      span.className = 'fm-expel-mark';
      span.style.cssText = `top:${m.top};left:${m.left};--fm-esz:${m.sz};--fm-ed:${m.ed};--fm-edl:${m.edl}`;
      span.innerHTML = `<svg class="fm-expel-ico" aria-hidden="true"><use href="#${symId}"/></svg>`;
      el.appendChild(span);
    }
  }

  /**
   * Inject animated blind-mark children for the blind tile state.
   * The number of marks matches the remaining state turns (max 3).
   * @param {HTMLElement} el
   * @param {number} [turns]
   */
  static #injectBlindMarks(el, turns = 3) {
    const marks = [
      { top: '10%', left: '14%', sz: '0.80rem', bd: '2.6s', bdl: '0s' },
      { top: '38%', left: '58%', sz: '0.70rem', bd: '3.0s', bdl: '-1.0s' },
      { top: '65%', left: '28%', sz: '0.75rem', bd: '2.8s', bdl: '-1.8s' },
    ];
    const count = Math.max(1, Math.min(turns, marks.length));
    for (const m of marks.slice(0, count)) {
      const span = document.createElement('span');
      span.className = 'fm-blind-mark';
      span.textContent = '?';
      span.style.cssText = `top:${m.top};left:${m.left};font-size:${m.sz};--fm-bd:${m.bd};--fm-bdl:${m.bdl}`;
      el.appendChild(span);
    }
  }
}
