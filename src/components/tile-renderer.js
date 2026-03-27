/**
 * Centralised tile DOM rendering.
 *
 * Each tile state (normal, frozen, ghost, blind, active/targeted, wind, danger)
 * gets a clean, self-contained CSS class set. When the state changes the element
 * is rebuilt from a deterministic template — no leftover classes.
 *
 * Powered tiles use a flip-card structure (front = tile, back = power face)
 * with a periodic flipY animation that pauses during moves.
 */

import { POWER_META, getPowerCategory } from '../configs/constants.js';
import { i18n } from '../managers/i18n-manager.js';

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

    // 5. Ensure the value class (fm-tN) matches the tile value (must be before #syncPowerFlip)
    TileRenderer.syncValueClass(el, tile.value);

    // 6. Handle power flip-card
    TileRenderer.#syncPowerFlip(el, tile);

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
   * Pause flip animations on all powered tiles (call before a move).
   * @param {Map<string, HTMLElement>} tileElements
   */
  static pauseFlips(tileElements) {
    for (const el of tileElements.values()) {
      const card = el.querySelector('.fm-flip-card');
      if (card) {
        card.style.animationPlayState = 'paused';
        card.style.transform = 'rotateY(0deg)';
      }
    }
  }

  /**
   * Resume flip animations on powered tiles (call after a move completes).
   * @param {Map<string, HTMLElement>} tileElements
   */
  static resumeFlips(tileElements) {
    for (const el of tileElements.values()) {
      const card = el.querySelector('.fm-flip-card');
      if (card) {
        card.style.animationPlayState = '';
        card.style.transform = '';
      }
    }
  }

  /**
   * Sync the flip-card structure for a powered tile.
   * If the tile has a power, build/update the flip structure.
   * If no power, strip it and restore the simple layout.
   * @param {HTMLElement} el
   * @param {import('../entities/tile.js').Tile} tile
   */
  static #syncPowerFlip(el, tile) {
    const hasFlip = el.classList.contains('fm-tile-powered');

    if (!tile.power) {
      if (hasFlip) {
        TileRenderer.#removeFlipStructure(el, tile);
      }
      return;
    }

    const meta = POWER_META[tile.power];
    if (!meta) return;

    const category = getPowerCategory(tile.power);

    if (hasFlip) {
      // Update existing flip structure
      TileRenderer.#updateFlipStructure(el, tile, meta, category);
    } else {
      // Build flip structure
      TileRenderer.#buildFlipStructure(el, tile, meta, category);
    }
  }

  /**
   * Build the flip-card DOM structure inside the tile element.
   * @param {HTMLElement} el
   * @param {import('../entities/tile.js').Tile} tile
   * @param {{ svgId: string, nameKey: string }} meta
   * @param {'danger' | 'warning' | 'info'} category
   */
  static #buildFlipStructure(el, tile, meta, category) {
    // Read computed colors BEFORE adding fm-tile-powered (which forces background: transparent)
    const cs = window.getComputedStyle(el);
    el.style.setProperty('--fm-tile-bg', cs.backgroundColor);
    el.style.setProperty('--fm-tile-color', cs.color);
    el.style.setProperty('--fm-tile-border', cs.borderColor);

    el.classList.add('fm-tile-powered');

    const valText = tile.state === 'blind' ? '?' : String(tile.value);
    const powerName = i18n.t(meta.nameKey);

    el.innerHTML = `
      <div class="fm-flip-card">
        <div class="fm-flip-front">
          <span class="fm-val">${valText}</span>
          <div class="fm-pwr-hint">
            <svg><use href="#${meta.svgId}"/></svg>
            <span>${powerName}</span>
            <svg><use href="#${meta.svgId}"/></svg>
          </div>
        </div>
        <div class="fm-flip-back fm-pw-${category}">
          <div class="fm-back-ico"><svg><use href="#${meta.svgId}"/></svg></div>
          <div class="fm-bval">${tile.value}</div>
        </div>
      </div>`;
  }

  /**
   * Update an existing flip structure (e.g. when value changes after merge).
   * @param {HTMLElement} el
   * @param {import('../entities/tile.js').Tile} tile
   * @param {{ svgId: string, nameKey: string }} meta
   * @param {'danger' | 'warning' | 'info'} category
   */
  static #updateFlipStructure(el, tile, meta, category) {
    const valEl = el.querySelector('.fm-flip-front .fm-val');
    if (valEl) valEl.textContent = tile.state === 'blind' ? '?' : String(tile.value);

    const bvalEl = el.querySelector('.fm-bval');
    if (bvalEl) bvalEl.textContent = String(tile.value);

    const back = el.querySelector('.fm-flip-back');
    if (back) {
      back.classList.remove('fm-pw-danger', 'fm-pw-warning', 'fm-pw-info');
      back.classList.add(`fm-pw-${category}`);
    }

    // Re-read colors: fm-tile-powered forces background:transparent, so temporarily remove it
    el.classList.remove('fm-tile-powered');
    const cs = window.getComputedStyle(el);
    el.style.setProperty('--fm-tile-bg', cs.backgroundColor);
    el.style.setProperty('--fm-tile-color', cs.color);
    el.style.setProperty('--fm-tile-border', cs.borderColor);
    el.classList.add('fm-tile-powered');
  }

  /**
   * Remove the flip structure and restore the simple tile layout.
   * @param {HTMLElement} el
   * @param {import('../entities/tile.js').Tile} tile
   */
  static #removeFlipStructure(el, tile) {
    el.classList.remove('fm-tile-powered');
    el.innerHTML = `<span class="fm-val">${tile.state === 'blind' ? '?' : String(tile.value)}</span>`;
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
