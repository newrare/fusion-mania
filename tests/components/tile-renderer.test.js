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
        { blocked: 'down',  cssDir: 'up'    },
        { blocked: 'up',    cssDir: 'down'  },
        { blocked: 'right', cssDir: 'left'  },
        { blocked: 'left',  cssDir: 'right' },
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

    it('injects fm-wind-line elements when windDirection is active', () => {
      TileRenderer.applyState(el, tile, { windDirection: 'down' });
      const lines = el.querySelectorAll('.fm-wind-line');
      expect(lines.length).toBeGreaterThan(0);
      // Horizontal wind (up/down blow) → lines positioned with left%
      for (const line of lines) {
        expect(line.style.left).toMatch(/%$/);
      }
    });

    it('fm-wind-line elements use top% for horizontal wind (right/left blow)', () => {
      TileRenderer.applyState(el, tile, { windDirection: 'up' }); // blocks up → blows down → horizontal? No wait...
      // windDirection:'up' blocks up → blow direction = 'down' → vertical animation → left%
      // windDirection:'right' blocks right → blow direction = 'left' → horizontal → top%
      TileRenderer.applyState(el, tile, { windDirection: 'right' });
      const lines = el.querySelectorAll('.fm-wind-line');
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.style.top).toMatch(/%$/);
      }
    });

    it('removes old fm-wind-line elements when state changes', () => {
      TileRenderer.applyState(el, tile, { windDirection: 'down' });
      expect(el.querySelectorAll('.fm-wind-line').length).toBeGreaterThan(0);
      // Apply again without wind — lines should be removed
      TileRenderer.applyState(el, tile);
      expect(el.querySelectorAll('.fm-wind-line').length).toBe(0);
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

  describe('power animation', () => {
    it('adds fm-tile-powered and fm-pw-face when tile has a power', () => {
      tile.power = POWER_TYPES.FIRE_H; // danger
      TileRenderer.applyState(el, tile);
      expect(el.classList.contains('fm-tile-powered')).toBe(true);
      expect(el.querySelector('.fm-pw-face')).not.toBeNull();
    });

    it('injects sparkle particles with the correct category colour', () => {
      tile.power = POWER_TYPES.FIRE_H; // danger category → #b91c1c
      TileRenderer.applyState(el, tile);
      const sparkles = el.querySelectorAll('.fm-pw-sparkle');
      expect(sparkles.length).toBeGreaterThan(0);
      // Every sparkle must carry the category icon colour
      for (const sp of sparkles) {
        expect(sp.style.color).toBe('#b91c1c');
      }
    });

    it('sparkles carry the category icon colour (warning)', () => {
      tile.power = POWER_TYPES.TELEPORT; // warning → #b45309
      TileRenderer.applyState(el, tile);
      const sparkles = el.querySelectorAll('.fm-pw-sparkle');
      for (const sp of sparkles) {
        expect(sp.style.color).toBe('#b45309');
      }
    });

    it('sparkles carry the category icon colour (info)', () => {
      tile.power = POWER_TYPES.ICE; // info → #1d4ed8
      TileRenderer.applyState(el, tile);
      const sparkles = el.querySelectorAll('.fm-pw-sparkle');
      for (const sp of sparkles) {
        expect(sp.style.color).toBe('#1d4ed8');
      }
    });

    it('sets the correct category class on fm-pw-face', () => {
      tile.power = POWER_TYPES.FIRE_H; // danger
      TileRenderer.applyState(el, tile);
      expect(el.querySelector('.fm-pw-face.fm-pw-danger')).not.toBeNull();

      tile.power = POWER_TYPES.TELEPORT; // warning
      TileRenderer.applyState(el, tile);
      expect(el.querySelector('.fm-pw-face.fm-pw-warning')).not.toBeNull();

      tile.power = POWER_TYPES.ICE; // info
      TileRenderer.applyState(el, tile);
      expect(el.querySelector('.fm-pw-face.fm-pw-info')).not.toBeNull();
    });

    it('updates category class and sparkle colours when power changes type', () => {
      tile.power = POWER_TYPES.FIRE_H; // danger
      TileRenderer.applyState(el, tile);
      tile.power = POWER_TYPES.ICE; // info
      TileRenderer.applyState(el, tile);
      const face = el.querySelector('.fm-pw-face');
      expect(face.classList.contains('fm-pw-info')).toBe(true);
      expect(face.classList.contains('fm-pw-danger')).toBe(false);
      // Sparkle colours must match the new category icon colour (info → #1d4ed8)
      for (const sp of el.querySelectorAll('.fm-pw-sparkle')) {
        expect(sp.style.color).toBe('#1d4ed8');
      }
    });

    it('removes fm-tile-powered, fm-pw-face and sparkles when power is cleared', () => {
      tile.power = POWER_TYPES.FIRE_H;
      TileRenderer.applyState(el, tile);
      tile.power = null;
      TileRenderer.applyState(el, tile);
      expect(el.classList.contains('fm-tile-powered')).toBe(false);
      expect(el.querySelector('.fm-pw-face')).toBeNull();
      expect(el.querySelectorAll('.fm-pw-sparkle').length).toBe(0);
    });

    it('preserves fm-val with correct value inside powered tile', () => {
      tile.power = POWER_TYPES.LIGHTNING;
      TileRenderer.applyState(el, tile);
      expect(el.querySelector('.fm-val').textContent).toBe('8');
    });

    it('shows "?" in fm-val when blind state is active on powered tile', () => {
      tile.power = POWER_TYPES.FIRE_H;
      tile.applyState('blind', 3);
      TileRenderer.applyState(el, tile);
      expect(el.querySelector('.fm-val').textContent).toBe('?');
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
