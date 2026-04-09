# Animation System — Fusion Mania

## Overview

All DOM-based tile animations are managed by **`AnimationManager`** (`src/managers/animation-manager.js`).
`GridManager` creates one instance and delegates all visual work to it.

`AnimationManager` has **no Phaser dependency** — it only manipulates DOM elements, CSS classes, and a canvas 2D context. This makes it easy to unit-test in isolation and keeps `GameScene` thin.

## Animation Layers

| Layer           | Mechanism                                                | Duration    |
|-----------------|----------------------------------------------------------|-------------|
| Tile slide      | CSS `left`/`top` transition                              | 120 ms      |
| Merge bounce    | `@keyframes fm-merge` on `.fm-tile--merge`               | 300 ms      |
| Consumed fade   | `@keyframes fm-consumed` on `.fm-tile--consumed`         | 100 ms      |
| Spawn pop       | `@keyframes fm-spawn` on `.fm-tile--spawn`               | 200 ms      |
| Merge particles | Canvas rAF loop (`startParticleLoop`)                    | 80 ms burst |
| Fusion glow     | `@keyframes fm-fusion-edge-pulse` + `fm-pull-*` infinite | ∞           |

Durations are defined as constants in `src/configs/constants.js` under the `ANIM` object.

## Interruption Model

Players can input a new move at any time, including mid-animation. The game must remain responsive — it is acceptable for an in-progress animation to be visually incomplete.

### How it works

When `GridManager.executeMove` is called while `#animating` is `true`:

1. **Snap** — `animator.snapToFinalState(allTiles, cellPositionFn)` is called synchronously:
   - Orphaned (consumed) tile elements are removed from the DOM and the tracking map.
   - Surviving tiles are snapped: `transition: none`, final `left`/`top` applied, animation classes cleared.
   - Any tiles in the grid data that lack a DOM element are created instantly (no spawn animation).
   - In-flight particles are cleared.
2. **Reflow** — `void gridEl.offsetWidth` forces a synchronous browser reflow so the snap commits before transitions are re-enabled.
3. **Restore** — `animator.restoreTransitions(SLIDE_DURATION)` re-enables CSS transitions on all elements.
4. **Advance generation** — `animator.nextGen()` increments the internal generation counter.
   Each `await` in the previous animation coroutine is followed by:
   ```js
   if (!this.#animator.isCurrent(gen)) return;
   ```
   This causes any stale coroutine to exit cleanly as soon as its next checkpoint is reached.

### Why `grid.spawnTile()` is called before `await`

The new tile is added to the `Grid` data model **synchronously**, before the first `await` in `#executeMove`. If a subsequent move interrupts the sequence, `snapToFinalState` will correctly include the new tile when it reconciles the DOM with the grid state.

## `AnimationManager` API

```js
import { AnimationManager } from '../managers/animation-manager.js';

const animator = new AnimationManager(tileElements, gridEl, mergeCanvas);
```

| Method                                                       | Purpose                                                          |
|--------------------------------------------------------------|------------------------------------------------------------------|
| `createTileElement(tile, animate, cellPosFn, slideDuration)` | Create and insert a tile DOM element                             |
| `clearAllTileElements()`                                     | Remove all tile elements and clear the map                       |
| `slidePositions(result, cellPosFn)`                          | Apply new `left`/`top` to moved/merged tiles                     |
| `processMerges(merges, allTiles)`                            | Play merge bounce + consumed fade; clean up orphans              |
| `snapToFinalState(allTiles, cellPosFn)`                      | Instantly reconcile DOM with grid state (for interruption)       |
| `restoreTransitions(slideDuration)`                          | Re-enable CSS transitions after a snap                           |
| `spawnMergeParticles(merges, cellPosFn, tileSize)`           | Burst particles at merge target positions                        |
| `startParticleLoop()`                                        | Start the rAF canvas draw loop                                   |
| `stopParticleLoop()`                                         | Cancel the rAF loop and clear particles                          |
| `nextGen()`                                                  | Advance to the next animation generation; returns the new number |
| `isCurrent(gen)`                                             | Returns `true` if `gen` is still the active generation           |

## Extending the Animation System

To add a new animation (e.g. a power activation effect):

1. Add the keyframe in `src/styles/main.css` and a CSS class to trigger it.
2. Add a method to `AnimationManager` that adds/removes that class on the relevant tile element(s).
3. Call the method from `GameScene` at the appropriate phase, followed by `await this.#wait(DURATION)` and an `isCurrent` guard.
4. Write a unit test in `tests/managers/animation-manager.test.js` that checks the class is applied/removed correctly.

## Unit Testing

`AnimationManager` can be fully tested in a JSDOM/happy-dom environment with no Phaser setup:

```js
// @vitest-environment happy-dom
import { AnimationManager } from '../../src/managers/animation-manager.js';
import { Tile } from '../../src/entities/tile.js';

const cellPosFn = (row, col) => ({ x: col * 100, y: row * 100 });

const tileElements = new Map();
const gridEl = document.createElement('div');
const animator = new AnimationManager(tileElements, gridEl, null);

// Test generation counter
const gen = animator.nextGen();
animator.nextGen(); // simulate a second move interrupting the first
assert(!animator.isCurrent(gen)); // first sequence is now stale

// Test snap
const tile = new Tile(4, 1, 2);
const el = document.createElement('div');
tileElements.set(tile.id, el);
animator.snapToFinalState([tile], cellPosFn);
assert(el.style.left === '200px');
assert(el.style.transition === 'none');
```

See `tests/managers/animation-manager.test.js` for the full test suite (31 tests).
