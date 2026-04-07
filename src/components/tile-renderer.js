/**
 * Centralised tile DOM rendering.
 *
 * Each tile state (normal, frozen, ghost, blind, active/targeted, wind, danger)
 * gets a clean, self-contained CSS class set. When the state changes the element
 * is rebuilt from a deterministic template — no leftover classes.
 *
 * Powered tiles use a heartbeat-toggle animation: the tile value and the power
 * icon alternate on a 3-second cycle via CSS cross-fade (fm-hb-val / fm-hb-ico).
 * Small sparkle copies of the power icon float around the tile background as an
 * ambient indicator, coloured by category (danger / warning / info).
 */

import { POWER_META, getPowerCategory } from '../configs/constants.js';

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

/**
 * Deterministic positions for wind-line elements (percentage along the cross-axis).
 * Horizontal wind (right/left): position = top%. Vertical wind (up/down): position = left%.
 */
const WIND_LINE_LAYOUT = [
  { pos: 12, dur: 0.90, dl:  0.00 },
  { pos: 27, dur: 1.20, dl: -0.55 },
  { pos: 44, dur: 0.80, dl: -1.10 },
  { pos: 58, dur: 1.10, dl: -0.35 },
  { pos: 70, dur: 0.95, dl: -1.70 },
  { pos: 83, dur: 1.30, dl: -0.85 },
];


/**
 * Deterministic spread of sparkle positions across the tile.
 * Values are percentages (kept 12–80 to stay inside the rounded tile).
 * 6 particles gives good coverage without clutter.
 */
const SPARKLE_LAYOUT = [
  { left: 12, top: 10, size: 9,  dur: 2.1, dl: 0    },
  { left: 72, top: 14, size: 11, dur: 3.4, dl: -1.1 },
  { left: 28, top: 68, size: 8,  dur: 2.7, dl: -0.5 },
  { left: 60, top: 55, size: 13, dur: 3.9, dl: -2.0 },
  { left: 80, top: 38, size: 10, dur: 2.4, dl: -1.6 },
  { left: 18, top: 40, size: 12, dur: 4.2, dl: -3.0 },
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
   * Also handles the power flip-card structure.
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

    // 2. Remove children from previous states (snowflakes, wind lines)
    for (const child of el.querySelectorAll('.fm-snowflake, .fm-wind-line')) {
      child.remove();
    }

    // 3. Apply current state classes
    for (const cls of TileRenderer.stateClasses(tile, opts)) {
      el.classList.add(cls);
    }

    // 4. Inject state-specific children
    if (tile.state === 'ice') {
      TileRenderer.#injectSnowflakes(el);
    }
    if (opts.windDirection) {
      const cssDir = WIND_CSS_DIR[opts.windDirection] ?? opts.windDirection;
      TileRenderer.#injectWindLines(el, cssDir);
    }

    // 5. Ensure the value class (fm-tN) matches the tile value (must be before #syncPowerFlip)
    TileRenderer.syncValueClass(el, tile.value);

    // 6. Handle power heartbeat-toggle
    TileRenderer.#syncPowerAnim(el, tile);

    // 7. Ensure the displayed value is correct
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
    for (const child of el.querySelectorAll('.fm-snowflake')) {
      child.remove();
    }
    el.classList.add('fm-state-danger');
  }

  /**
   * Sync the heartbeat-toggle structure for a powered tile.
   * If the tile has a power, build/update the structure.
   * If no power, strip it and restore the simple layout.
   * @param {HTMLElement} el
   * @param {import('../entities/tile.js').Tile} tile
   */
  static #syncPowerAnim(el, tile) {
    const hasPower = el.classList.contains('fm-tile-powered');
    // Also detect stale .fm-pw-face left behind when processMerges resets el.className
    const hasStaleFace = !hasPower && !!el.querySelector('.fm-pw-face');

    if (!tile.power) {
      if (hasPower || hasStaleFace) TileRenderer.#removePowerStructure(el, tile);
      return;
    }

    const meta = POWER_META[tile.power];
    if (!meta) return;

    const category = getPowerCategory(tile.power);

    if (hasPower) {
      TileRenderer.#updatePowerStructure(el, tile, meta, category);
    } else {
      TileRenderer.#buildPowerStructure(el, tile, meta, category);
    }
  }

  /**
   * Build the heartbeat-toggle DOM structure inside the tile element.
   * Injects sparkle particles (small power icons) as ambient category indicator.
   * @param {HTMLElement} el
   * @param {import('../entities/tile.js').Tile} tile
   * @param {{ svgId: string }} meta
   * @param {'danger' | 'warning' | 'info'} category
   */
  static #buildPowerStructure(el, tile, meta, category) {
    el.classList.add('fm-tile-powered');
    const valText = tile.state === 'blind' ? '?' : String(tile.value);
    el.innerHTML = `
      ${TileRenderer.#sparklesHtml(meta.svgId)}
      <span class="fm-val">${valText}</span>
      <div class="fm-pw-face fm-pw-${category}">
        <svg><use href="#${meta.svgId}"/></svg>
      </div>`;
  }

  /**
   * Update an existing power structure (e.g. when value changes after merge).
   * Re-colours sparkles if the category has changed.
   * @param {HTMLElement} el
   * @param {import('../entities/tile.js').Tile} tile
   * @param {{ svgId: string }} meta
   * @param {'danger' | 'warning' | 'info'} category
   */
  static #updatePowerStructure(el, tile, meta, category) {
    const valEl = el.querySelector('.fm-val');
    if (valEl) valEl.textContent = tile.state === 'blind' ? '?' : String(tile.value);

    const face = el.querySelector('.fm-pw-face');
    if (face) {
      face.classList.remove('fm-pw-danger', 'fm-pw-warning', 'fm-pw-info');
      face.classList.add(`fm-pw-${category}`);
    }

  }

  /**
   * Remove the power structure and restore the simple tile layout.
   * @param {HTMLElement} el
   * @param {import('../entities/tile.js').Tile} tile
   */
  static #removePowerStructure(el, tile) {
    el.classList.remove('fm-tile-powered');
    el.innerHTML = `<span class="fm-val">${tile.state === 'blind' ? '?' : String(tile.value)}</span>`;
  }

  /**
   * Build HTML for the sparkle particles (small power icons, one per layout slot).
   * Uses deterministic positions so layout is stable across re-renders.
   * Colour is inherited via currentColor from the tile (same as fm-val).
   * @param {string} svgId
   * @returns {string}
   */
  static #sparklesHtml(svgId) {
    return SPARKLE_LAYOUT.map(({ left, top, size, dur, dl }) =>
      `<svg class="fm-pw-sparkle" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;--fm-sp-dur:${dur}s;--fm-sp-dl:${dl}s"><use href="#${svgId}"/></svg>`
    ).join('');
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

  /**
   * Inject animated wind-line children for the wind tile state.
   * @param {HTMLElement} el
   * @param {'up' | 'down' | 'left' | 'right'} cssDir — wind-blow direction (CSS class direction)
   */
  static #injectWindLines(el, cssDir) {
    const isHorizontal = cssDir === 'right' || cssDir === 'left';
    const posProp = isHorizontal ? 'top' : 'left';
    for (const { pos, dur, dl } of WIND_LINE_LAYOUT) {
      const line = document.createElement('div');
      line.className = 'fm-wind-line';
      line.style.cssText = `${posProp}:${pos}%;--fm-wd:${dur}s;--fm-wdl:${dl}s;`;
      el.appendChild(line);
    }
  }
}
