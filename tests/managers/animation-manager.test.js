// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnimationManager } from '../../src/managers/animation-manager.js';
import { Tile } from '../../src/entities/tile.js';

/** @param {number} row @param {number} col @returns {{ x: number, y: number }} */
const cellPosFn = (row, col) => ({ x: col * 100, y: row * 100 });

describe('AnimationManager', () => {
  /** @type {Map<string, HTMLElement>} */
  let tileElements;
  /** @type {HTMLElement} */
  let gridEl;
  /** @type {AnimationController} */
  let controller;

  beforeEach(() => {
    tileElements = new Map();
    gridEl = document.createElement('div');
    document.body.appendChild(gridEl);
    controller = new AnimationManager(tileElements, gridEl, null);
  });

  afterEach(() => {
    gridEl.remove();
  });

  // ─── Generation counter ───────────────────────────

  describe('generation counter', () => {
    it('nextGen returns 1 on first call', () => {
      expect(controller.nextGen()).toBe(1);
    });

    it('isCurrent returns true for the current generation', () => {
      const gen = controller.nextGen();
      expect(controller.isCurrent(gen)).toBe(true);
    });

    it('isCurrent returns false after another nextGen call', () => {
      const gen = controller.nextGen();
      controller.nextGen();
      expect(controller.isCurrent(gen)).toBe(false);
    });

    it('each nextGen call increments the counter', () => {
      const g1 = controller.nextGen();
      const g2 = controller.nextGen();
      const g3 = controller.nextGen();
      expect(g2).toBe(g1 + 1);
      expect(g3).toBe(g2 + 1);
    });
  });

  // ─── createTileElement ───────────────────────────

  describe('createTileElement', () => {
    it('creates element with fm-tile and value class', () => {
      const tile = new Tile(4, 1, 2);
      const el = controller.createTileElement(tile, false, cellPosFn, 120);
      expect(el.classList.contains('fm-tile')).toBe(true);
      expect(el.classList.contains('fm-t4')).toBe(true);
    });

    it('renders tile value in a .fm-val span', () => {
      const tile = new Tile(8, 0, 0);
      const el = controller.createTileElement(tile, false, cellPosFn, 120);
      expect(el.querySelector('.fm-val')?.textContent).toBe('8');
    });

    it('positions element at the correct pixel coordinates', () => {
      const tile = new Tile(2, 1, 2);
      const el = controller.createTileElement(tile, false, cellPosFn, 120);
      expect(el.style.left).toBe('200px');
      expect(el.style.top).toBe('100px');
    });

    it('adds fm-tile--spawn class when animate=true', () => {
      const tile = new Tile(2, 0, 0);
      const el = controller.createTileElement(tile, true, cellPosFn, 120);
      expect(el.classList.contains('fm-tile--spawn')).toBe(true);
    });

    it('does not add fm-tile--spawn when animate=false', () => {
      const tile = new Tile(2, 0, 0);
      const el = controller.createTileElement(tile, false, cellPosFn, 120);
      expect(el.classList.contains('fm-tile--spawn')).toBe(false);
    });

    it('registers element in the tileElements map', () => {
      const tile = new Tile(2, 0, 0);
      controller.createTileElement(tile, false, cellPosFn, 120);
      expect(tileElements.has(tile.id)).toBe(true);
    });

    it('appends element to gridEl', () => {
      const tile = new Tile(2, 0, 0);
      const el = controller.createTileElement(tile, false, cellPosFn, 120);
      expect(gridEl.contains(el)).toBe(true);
    });

    it('does not set --slide-duration when slideDuration is 0', () => {
      const tile = new Tile(2, 0, 0);
      const el = controller.createTileElement(tile, false, cellPosFn, 0);
      expect(el.style.getPropertyValue('--slide-duration')).toBe('');
    });
  });

  // ─── snapToFinalState ────────────────────────────

  describe('snapToFinalState', () => {
    it('removes orphaned elements not present in allTiles', () => {
      const tile = new Tile(2, 0, 0);
      const el = document.createElement('div');
      gridEl.appendChild(el);
      tileElements.set(tile.id, el);

      controller.snapToFinalState([], cellPosFn);

      expect(tileElements.has(tile.id)).toBe(false);
      expect(gridEl.contains(el)).toBe(false);
    });

    it('snaps surviving tiles to their grid positions', () => {
      const tile = new Tile(2, 2, 3);
      const el = document.createElement('div');
      el.style.left = '999px';
      el.style.top = '888px';
      gridEl.appendChild(el);
      tileElements.set(tile.id, el);

      controller.snapToFinalState([tile], cellPosFn);

      expect(el.style.left).toBe('300px');
      expect(el.style.top).toBe('200px');
    });

    it('disables CSS transitions on snapped tiles', () => {
      const tile = new Tile(2, 0, 0);
      const el = document.createElement('div');
      gridEl.appendChild(el);
      tileElements.set(tile.id, el);

      controller.snapToFinalState([tile], cellPosFn);

      expect(el.style.transition).toBe('none');
    });

    it('removes animation classes from snapped tiles', () => {
      const tile = new Tile(4, 0, 0);
      const el = document.createElement('div');
      el.classList.add('fm-tile--merge', 'fm-tile--spawn', 'fm-tile--consumed');
      gridEl.appendChild(el);
      tileElements.set(tile.id, el);

      controller.snapToFinalState([tile], cellPosFn);

      expect(el.classList.contains('fm-tile--merge')).toBe(false);
      expect(el.classList.contains('fm-tile--spawn')).toBe(false);
      expect(el.classList.contains('fm-tile--consumed')).toBe(false);
    });

    it('creates DOM elements for tiles missing from tileElements', () => {
      const tile = new Tile(8, 1, 1);

      // tile is in the grid but has no DOM element yet
      controller.snapToFinalState([tile], cellPosFn);

      expect(tileElements.has(tile.id)).toBe(true);
      const el = tileElements.get(tile.id);
      expect(el?.classList.contains('fm-t8')).toBe(true);
    });

    it('positions newly created snap elements correctly', () => {
      const tile = new Tile(16, 3, 2);

      controller.snapToFinalState([tile], cellPosFn);

      const el = tileElements.get(tile.id);
      expect(el?.style.left).toBe('200px');
      expect(el?.style.top).toBe('300px');
    });

    it('flushes consumed elements orphaned by a previous merge', () => {
      // Simulate a merge: consumed element is tracked but not in allTiles
      const survivor = new Tile(4, 0, 0);
      const consumed = new Tile(2, 0, 1);
      const survivorEl = document.createElement('div');
      survivorEl.innerHTML = '<span class="fm-val">2</span>';
      const consumedEl = document.createElement('div');
      gridEl.appendChild(survivorEl);
      gridEl.appendChild(consumedEl);
      tileElements.set(survivor.id, survivorEl);
      tileElements.set(consumed.id, consumedEl);

      // processMerges tracks consumedEl and removes it from tileElements
      controller.processMerges([{ tile: survivor, consumedId: consumed.id }], [survivor]);
      expect(gridEl.contains(consumedEl)).toBe(true); // still in DOM

      // snapToFinalState must flush it even without clearConsumedElements being called first
      controller.snapToFinalState([survivor], cellPosFn);
      expect(gridEl.contains(consumedEl)).toBe(false);
    });

    it('syncs stale value class when processMerges was cancelled before it ran', () => {
      // Simulate: grid.move() doubled tile (512→1024) but processMerges never ran.
      // The DOM element still has fm-t512; snapToFinalState must update it to fm-t1024.
      const tile = new Tile(1024, 0, 0); // grid data: already doubled
      const el = document.createElement('div');
      el.className = 'fm-tile fm-t512';   // stale DOM value class
      el.innerHTML = '<span class="fm-val">512</span>';
      gridEl.appendChild(el);
      tileElements.set(tile.id, el);

      controller.snapToFinalState([tile], cellPosFn);

      expect(el.classList.contains('fm-t1024')).toBe(true);
      expect(el.classList.contains('fm-t512')).toBe(false);
      expect(el.querySelector('.fm-val')?.textContent).toBe('1024');
    });

    it('preserves state classes when syncing value class', () => {
      const tile = new Tile(64, 0, 0);
      const el = document.createElement('div');
      el.className = 'fm-tile fm-t32 fm-state-freeze'; // stale value + state class
      el.innerHTML = '<span class="fm-val">32</span>';
      gridEl.appendChild(el);
      tileElements.set(tile.id, el);

      controller.snapToFinalState([tile], cellPosFn);

      expect(el.classList.contains('fm-t64')).toBe(true);
      expect(el.classList.contains('fm-t32')).toBe(false);
      expect(el.classList.contains('fm-state-freeze')).toBe(true); // preserved
    });
  });

  // ─── restoreTransitions ──────────────────────────

  describe('restoreTransitions', () => {
    it('clears inline transition style on all elements', () => {
      const tile = new Tile(2, 0, 0);
      const el = document.createElement('div');
      el.style.transition = 'none';
      gridEl.appendChild(el);
      tileElements.set(tile.id, el);

      controller.restoreTransitions(120);

      expect(el.style.transition).toBe('');
    });

    it('sets --slide-duration CSS custom property', () => {
      const tile = new Tile(2, 0, 0);
      const el = document.createElement('div');
      gridEl.appendChild(el);
      tileElements.set(tile.id, el);

      controller.restoreTransitions(150);

      expect(el.style.getPropertyValue('--slide-duration')).toBe('150ms');
    });
  });

  // ─── slidePositions ──────────────────────────────

  describe('slidePositions', () => {
    it('moves a regular tile to its new position', () => {
      const tile = new Tile(2, 0, 3);
      const el = document.createElement('div');
      el.style.left = '0px';
      el.style.top = '0px';
      gridEl.appendChild(el);
      tileElements.set(tile.id, el);

      controller.slidePositions({ movements: [{ tile }], merges: [] }, cellPosFn);

      expect(el.style.left).toBe('300px');
      expect(el.style.top).toBe('0px');
    });

    it('slides both survivor and consumed tiles to the merge target', () => {
      const survivor = new Tile(4, 0, 3);
      const consumed = new Tile(2, 0, 2);
      const consumedId = consumed.id;

      const survivorEl = document.createElement('div');
      const consumedEl = document.createElement('div');
      survivorEl.style.left = '300px';
      consumedEl.style.left = '200px';
      gridEl.appendChild(survivorEl);
      gridEl.appendChild(consumedEl);
      tileElements.set(survivor.id, survivorEl);
      tileElements.set(consumedId, consumedEl);

      controller.slidePositions(
        { movements: [], merges: [{ tile: survivor, consumedId }] },
        cellPosFn,
      );

      expect(survivorEl.style.left).toBe('300px');
      expect(consumedEl.style.left).toBe('300px');
    });

    it('ignores unknown tile IDs gracefully', () => {
      const tile = new Tile(2, 0, 0);
      // No element registered — should not throw
      expect(() =>
        controller.slidePositions({ movements: [{ tile }], merges: [] }, cellPosFn),
      ).not.toThrow();
    });
  });

  // ─── processMerges ───────────────────────────────

  describe('processMerges', () => {
    it('adds fm-tile--merge to the surviving tile', () => {
      const tile = new Tile(4, 0, 0);
      const consumed = new Tile(2, 0, 1);
      const el = document.createElement('div');
      el.innerHTML = '<span class="fm-val">2</span>';
      const consumedEl = document.createElement('div');
      gridEl.appendChild(el);
      gridEl.appendChild(consumedEl);
      tileElements.set(tile.id, el);
      tileElements.set(consumed.id, consumedEl);

      controller.processMerges([{ tile, consumedId: consumed.id }], [tile]);

      expect(el.classList.contains('fm-tile--merge')).toBe(true);
    });

    it('adds fm-tile--consumed to the consumed tile', () => {
      const tile = new Tile(4, 0, 0);
      const consumed = new Tile(2, 0, 1);
      const el = document.createElement('div');
      el.innerHTML = '<span class="fm-val">2</span>';
      const consumedEl = document.createElement('div');
      gridEl.appendChild(el);
      gridEl.appendChild(consumedEl);
      tileElements.set(tile.id, el);
      tileElements.set(consumed.id, consumedEl);

      controller.processMerges([{ tile, consumedId: consumed.id }], [tile]);

      expect(consumedEl.classList.contains('fm-tile--consumed')).toBe(true);
    });

    it('removes consumed tile from the tileElements map', () => {
      const tile = new Tile(4, 0, 0);
      const consumed = new Tile(2, 0, 1);
      const el = document.createElement('div');
      el.innerHTML = '<span class="fm-val">2</span>';
      const consumedEl = document.createElement('div');
      gridEl.appendChild(el);
      gridEl.appendChild(consumedEl);
      tileElements.set(tile.id, el);
      tileElements.set(consumed.id, consumedEl);

      controller.processMerges([{ tile, consumedId: consumed.id }], [tile]);

      expect(tileElements.has(consumed.id)).toBe(false);
    });

    it('updates the value text of the surviving tile', () => {
      const tile = new Tile(4, 0, 0);
      const consumed = new Tile(2, 0, 1);
      const el = document.createElement('div');
      el.innerHTML = '<span class="fm-val">2</span>';
      const consumedEl = document.createElement('div');
      gridEl.appendChild(el);
      gridEl.appendChild(consumedEl);
      tileElements.set(tile.id, el);
      tileElements.set(consumed.id, consumedEl);

      controller.processMerges([{ tile, consumedId: consumed.id }], [tile]);

      expect(el.querySelector('.fm-val')?.textContent).toBe('4');
    });

    it('removes safety-net orphaned elements not in allTiles', () => {
      const tile = new Tile(4, 0, 0);
      const orphan = new Tile(2, 0, 1);
      const el = document.createElement('div');
      el.innerHTML = '<span class="fm-val">4</span>';
      const orphanEl = document.createElement('div');
      gridEl.appendChild(el);
      gridEl.appendChild(orphanEl);
      tileElements.set(tile.id, el);
      tileElements.set(orphan.id, orphanEl);

      // orphan is NOT in allTiles — processMerges should clean it up
      controller.processMerges([], [tile]);

      expect(tileElements.has(orphan.id)).toBe(false);
    });

    it('tracks consumed element for explicit removal via clearConsumedElements', () => {
      const tile = new Tile(4, 0, 0);
      const consumed = new Tile(2, 0, 1);
      const el = document.createElement('div');
      el.innerHTML = '<span class="fm-val">2</span>';
      const consumedEl = document.createElement('div');
      gridEl.appendChild(el);
      gridEl.appendChild(consumedEl);
      tileElements.set(tile.id, el);
      tileElements.set(consumed.id, consumedEl);

      controller.processMerges([{ tile, consumedId: consumed.id }], [tile]);

      // Element still in DOM (animation playing), not yet removed
      expect(gridEl.contains(consumedEl)).toBe(true);

      // clearConsumedElements forces removal
      controller.clearConsumedElements();
      expect(gridEl.contains(consumedEl)).toBe(false);
    });
  });

  // ─── clearConsumedElements ───────────────────────

  describe('clearConsumedElements', () => {
    it('removes all consumed elements from the DOM', () => {
      const tile = new Tile(4, 0, 0);
      const c1 = new Tile(2, 0, 1);
      const c2 = new Tile(2, 1, 0);
      const el = document.createElement('div');
      el.innerHTML = '<span class="fm-val">2</span>';
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      gridEl.appendChild(el);
      gridEl.appendChild(el1);
      gridEl.appendChild(el2);
      tileElements.set(tile.id, el);
      tileElements.set(c1.id, el1);
      tileElements.set(c2.id, el2);

      controller.processMerges(
        [{ tile, consumedId: c1.id }, { tile, consumedId: c2.id }],
        [tile],
      );
      controller.clearConsumedElements();

      expect(gridEl.contains(el1)).toBe(false);
      expect(gridEl.contains(el2)).toBe(false);
    });

    it('is idempotent — calling twice does not throw', () => {
      expect(() => {
        controller.clearConsumedElements();
        controller.clearConsumedElements();
      }).not.toThrow();
    });
  });

  // ─── clearAllTileElements ────────────────────────

  describe('clearAllTileElements', () => {
    it('removes all elements from the DOM', () => {
      const t1 = new Tile(2, 0, 0);
      const t2 = new Tile(4, 0, 1);
      const e1 = document.createElement('div');
      const e2 = document.createElement('div');
      gridEl.appendChild(e1);
      gridEl.appendChild(e2);
      tileElements.set(t1.id, e1);
      tileElements.set(t2.id, e2);

      controller.clearAllTileElements();

      expect(gridEl.contains(e1)).toBe(false);
      expect(gridEl.contains(e2)).toBe(false);
    });

    it('empties the tileElements map', () => {
      const t1 = new Tile(2, 0, 0);
      const e1 = document.createElement('div');
      tileElements.set(t1.id, e1);

      controller.clearAllTileElements();

      expect(tileElements.size).toBe(0);
    });
  });

  // ─── spawnMergeParticles ─────────────────────────

  describe('spawnMergeParticles', () => {
    it('does not throw with a valid tile and tileSize', () => {
      const tile = new Tile(4, 1, 1);
      expect(() =>
        controller.spawnMergeParticles([{ tile }], cellPosFn, 80),
      ).not.toThrow();
    });
  });
});
