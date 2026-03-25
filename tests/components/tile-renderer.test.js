// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { TileRenderer } from '../../src/components/tile-renderer.js';
import { Tile } from '../../src/entities/tile.js';

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

    it('includes fm-state-ghost for ghost states', () => {
      tile.applyState('ghost-h', 3);
      expect(TileRenderer.stateClasses(tile)).toContain('fm-state-ghost');
    });

    it('includes fm-state-blind for blind state', () => {
      tile.applyState('blind', 5);
      expect(TileRenderer.stateClasses(tile)).toContain('fm-state-blind');
    });

    it('includes wind classes when windDirection is set', () => {
      const classes = TileRenderer.stateClasses(tile, { windDirection: 'up' });
      expect(classes).toContain('fm-state-wind');
      expect(classes).toContain('fm-state-wind-up');
    });

    it('state takes priority over targeted — no accumulation', () => {
      tile.targeted = true;
      tile.applyState('ice', 3);
      const classes = TileRenderer.stateClasses(tile, { windDirection: 'left' });
      expect(classes).not.toContain('fm-state-active');
      expect(classes).toContain('fm-state-ice');
      expect(classes).toContain('fm-state-wind');
      expect(classes).toContain('fm-state-wind-left');
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
