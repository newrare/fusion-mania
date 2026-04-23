// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';

import { TileRenderer } from '../../src/components/tile-renderer.js';
import { Tile } from '../../src/entities/tile.js';
import { POWER_TYPES } from '../../src/configs/constants.js';

describe('TileRenderer', () => {
  /** @type {Tile} */
  let tile;

  /** @type {HTMLElement} */
  let el;

  beforeEach(() => {
    tile = new Tile(8, 1, 2);
    el = document.createElement('div');
    el.className = 'fm-tile fm-t8';
    el.innerHTML = '<span class="fm-val">8</span>';
  });

  describe('stateClasses', () => {
    it('returns empty array for default tile', () => {
      expect(TileRenderer.stateClasses(tile)).toEqual([]);
    });

    it('includes fm-state-active when targeted', () => {
      tile.targeted = true;
      expect(TileRenderer.stateClasses(tile)).toContain('fm-state-active');
    });

    it('includes fm-state-ice for ice state', () => {
      tile.applyState('ice', 5);
      expect(TileRenderer.stateClasses(tile)).toContain('fm-state-ice');
    });

    it('includes fm-state-ghost-h for ghost-h state', () => {
      tile.applyState('ghost-h', 3);
      expect(TileRenderer.stateClasses(tile)).toContain('fm-state-ghost-h');
      expect(TileRenderer.stateClasses(tile)).not.toContain('fm-state-ghost-v');
    });

    it('includes fm-state-ghost-v for ghost-v state', () => {
      tile.applyState('ghost-v', 3);
      expect(TileRenderer.stateClasses(tile)).toContain('fm-state-ghost-v');
      expect(TileRenderer.stateClasses(tile)).not.toContain('fm-state-ghost-h');
    });

    it('includes fm-state-blind for blind state', () => {
      tile.applyState('blind', 5);
      expect(TileRenderer.stateClasses(tile)).toContain('fm-state-blind');
    });

    it('includes wind classes when windDirection is set — CSS class uses blow direction (opposite of blocked)', () => {
      // windDirection:'down' means movement blocked downward → wind blows UP → fm-state-wind-up
      const classes = TileRenderer.stateClasses(tile, { windDirection: 'down' });
      expect(classes).toContain('fm-state-wind');
      expect(classes).toContain('fm-state-wind-up');
    });

    it('maps each blocked direction to the correct CSS blow direction', () => {
      const cases = [
        { blocked: 'down', cssDir: 'up' },
        { blocked: 'up', cssDir: 'down' },
        { blocked: 'right', cssDir: 'left' },
        { blocked: 'left', cssDir: 'right' },
      ];
      for (const { blocked, cssDir } of cases) {
        const classes = TileRenderer.stateClasses(tile, { windDirection: blocked });
        expect(classes).toContain(`fm-state-wind-${cssDir}`);
        expect(classes).not.toContain(`fm-state-wind-${blocked}`);
      }
    });

    it('state takes priority over targeted — no accumulation', () => {
      tile.targeted = true;
      tile.applyState('ice', 3);
      // windDirection:'left' blocks left → wind blows right → fm-state-wind-right
      const classes = TileRenderer.stateClasses(tile, { windDirection: 'left' });
      expect(classes).not.toContain('fm-state-active');
      expect(classes).toContain('fm-state-ice');
      expect(classes).toContain('fm-state-wind');
      expect(classes).toContain('fm-state-wind-right');
    });
  });

  describe('applyState', () => {
    it('strips old state classes before applying new ones', () => {
      el.classList.add('fm-state-ice', 'fm-state-wind', 'fm-state-wind-up');
      tile.targeted = true;
      TileRenderer.applyState(el, tile);
      expect(el.classList.contains('fm-state-active')).toBe(true);
      expect(el.classList.contains('fm-state-ice')).toBe(false);
      expect(el.classList.contains('fm-state-wind')).toBe(false);
      expect(el.classList.contains('fm-state-wind-up')).toBe(false);
    });

    it('adds fm-state-wind and direction class when windDirection is active', () => {
      TileRenderer.applyState(el, tile, { windDirection: 'down' });
      // windDirection 'down' (blocks down) → blow direction 'up' → fm-state-wind-up
      expect(el.classList.contains('fm-state-wind')).toBe(true);
      expect(el.classList.contains('fm-state-wind-up')).toBe(true);
    });

    it('maps each windDirection to the opposite blow-direction CSS class', () => {
      const cases = { up: 'down', down: 'up', left: 'right', right: 'left' };
      for (const [blocked, blow] of Object.entries(cases)) {
        TileRenderer.applyState(el, tile, { windDirection: blocked });
        expect(el.classList.contains(`fm-state-wind-${blow}`)).toBe(true);
      }
    });

    it('removes wind classes when windDirection is cleared', () => {
      TileRenderer.applyState(el, tile, { windDirection: 'down' });
      expect(el.classList.contains('fm-state-wind')).toBe(true);
      TileRenderer.applyState(el, tile);
      expect(el.classList.contains('fm-state-wind')).toBe(false);
      expect(el.classList.contains('fm-state-wind-up')).toBe(false);
    });

    it('sets value text to "?" for blind state', () => {
      tile.applyState('blind', 5);
      TileRenderer.applyState(el, tile);
      expect(el.querySelector('.fm-val').textContent).toBe('?');
    });

    it('restores value text after blind state clears', () => {
      tile.applyState('blind', 1);
      TileRenderer.applyState(el, tile);
      expect(el.querySelector('.fm-val').textContent).toBe('?');
      tile.tickState(); // clears blind
      TileRenderer.applyState(el, tile);
      expect(el.querySelector('.fm-val').textContent).toBe('8');
    });

    it('syncs value class when tile value changes', () => {
      tile.value = 16;
      TileRenderer.applyState(el, tile);
      expect(el.classList.contains('fm-t16')).toBe(true);
      expect(el.classList.contains('fm-t8')).toBe(false);
    });
  });

  describe('targeted tile', () => {
    it('adds fm-state-active when tile.targeted is true', () => {
      tile.targeted = true;
      TileRenderer.applyState(el, tile);
      expect(el.classList.contains('fm-state-active')).toBe(true);
    });

    it('does not add fm-state-active when tile.targeted is false', () => {
      TileRenderer.applyState(el, tile);
      expect(el.classList.contains('fm-state-active')).toBe(false);
    });
  });

  describe('applyDanger', () => {
    it('strips all states and adds fm-state-danger', () => {
      el.classList.add('fm-state-active', 'fm-state-ice');
      TileRenderer.applyDanger(el);
      expect(el.classList.contains('fm-state-danger')).toBe(true);
      expect(el.classList.contains('fm-state-active')).toBe(false);
      expect(el.classList.contains('fm-state-ice')).toBe(false);
    });
  });

  describe('syncValueClass', () => {
    it('adds the correct value class', () => {
      TileRenderer.syncValueClass(el, 16);
      expect(el.classList.contains('fm-t16')).toBe(true);
    });

    it('does not remove fm-tile base class', () => {
      TileRenderer.syncValueClass(el, 16);
      expect(el.classList.contains('fm-tile')).toBe(true);
    });

    it('removes old value class', () => {
      TileRenderer.syncValueClass(el, 16);
      expect(el.classList.contains('fm-t8')).toBe(false);
    });
  });
});
