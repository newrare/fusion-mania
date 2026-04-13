import { ANIM, POWER_TYPES, GRID_SIZE } from '../configs/constants.js';

/**
 * Manages all DOM-based tile animations for the game grid.
 * Independent of Phaser — only depends on DOM + CSS.
 *
 * Cancellation model: each call to `nextGen()` advances an internal counter.
 * Any in-progress animation sequence checks `isCurrent(gen)` after each await;
 * if the generation has changed, it returns early, leaving the DOM in whatever
 * partial state it was in. The caller is responsible for calling
 * `snapToFinalState()` before starting a new sequence so the DOM always
 * reflects the true grid state.
 */

/**
 * @typedef {{
 *   x: number, y: number, vx: number, vy: number,
 *   tx: number, ty: number, r: number,
 *   life: number, decay: number, rgb: string
 * }} Particle
 */

export class AnimationManager {
  /** @type {Map<string, HTMLElement>} tile.id → DOM element */
  #tileElements;

  /** @type {HTMLElement | null} Grid container */
  #gridEl;

  /** @type {HTMLCanvasElement | null} */
  #mergeCanvas;

  /** @type {CanvasRenderingContext2D | null} */
  #mergeCtx;

  /** @type {Particle[]} */
  #mergeParticles = [];

  /** @type {number | null} rAF handle */
  #mergeRaf = null;

  /** @type {number} Incremented on each new/cancelled move to invalidate stale animations */
  #gen = 0;

  /**
   * Fireball DOM elements currently in flight for fire-power animations.
   * Tracked so they can be removed synchronously by `snapToFinalState`.
   * @type {Set<HTMLElement>}
   */
  #pendingFireballs = new Set();

  /**
   * Lightning scene DOM elements currently in flight.
   * Tracked so they can be removed synchronously by `snapToFinalState`.
   * @type {Set<HTMLElement>}
   */
  #pendingLightningScenes = new Set();

  /**
   * Bomb scene DOM elements currently in flight.
   * @type {Set<HTMLElement>}
   */
  #pendingBombScenes = new Set();

  /**
   * Nuclear blast overlay element (appended to document.body).
   * @type {Set<HTMLElement>}
   */
  #pendingNuclearElements = new Set();

  /**
   * Consumed tile DOM elements waiting to be removed from the DOM.
   * Populated by processMerges(); explicitly flushed by clearConsumedElements().
   * This avoids reliance on `animationend` which can silently fail to fire
   * (e.g. when a spawn animation is already running on the same element).
   * @type {Set<HTMLElement>}
   */
  #consumedElements = new Set();

  /**
   * Active arc SVG elements keyed by a pair id ("tileA:tileB").
   * @type {Map<string, SVGElement>}
   */
  #arcElements = new Map();

  /**
   * Pull directions active per tile id — used to pick the right keyframe.
   * A tile with two opposing pulls (e.g. right + left) gets no pull animation.
   * @type {Map<string, Set<string>>}
   */
  #tilePullDirs = new Map();

  /**
   * rAF handle for the arc animation loop.
   * @type {number | null}
   */
  #arcRaf = null;

  /**
   * @param {Map<string, HTMLElement>} tileElements Shared tile ID → DOM element map
   * @param {HTMLElement | null} gridEl Grid container element
   * @param {HTMLCanvasElement | null} mergeCanvas Canvas for particle effects (optional)
   */
  constructor(tileElements, gridEl, mergeCanvas) {
    this.#tileElements = tileElements;
    this.#gridEl = gridEl;
    this.#mergeCanvas = mergeCanvas;
    this.#mergeCtx = mergeCanvas?.getContext?.('2d') ?? null;
  }

  // ─── Cancellation API ────────────────────────────

  /**
   * Advance to the next animation generation.
   * All in-progress sequences of earlier generations will self-cancel.
   * @returns {number} The new generation number
   */
  nextGen() {
    return ++this.#gen;
  }

  /**
   * Whether the given generation is still the active one (not superseded).
   * @param {number} gen
   * @returns {boolean}
   */
  isCurrent(gen) {
    return gen === this.#gen;
  }

  // ─── Snap API ────────────────────────────────────

  /**
   * Instantly sync all tile DOM elements to their logical grid positions.
   * - Removes orphaned (consumed) tile elements.
   * - Snaps surviving tiles: disables CSS transition, applies final `left`/`top`, clears animation classes.
   * - Creates DOM elements for tiles that are in the grid but not yet rendered.
   * - Clears in-flight particles.
   *
   * Call this before starting a new move to interrupt an in-progress animation.
   *
   * @param {import('../entities/tile.js').Tile[]} allTiles All tiles currently in the grid
   * @param {(row: number, col: number) => { x: number, y: number }} cellPositionFn
   */
  snapToFinalState(allTiles, cellPositionFn) {
    // Remove any in-flight fireballs from fire-power animations
    for (const el of this.#pendingFireballs) {
      if (el.isConnected) el.remove();
    }
    this.#pendingFireballs.clear();

    // Remove any in-flight lightning scenes
    for (const el of this.#pendingLightningScenes) {
      if (el.isConnected) el.remove();
    }
    this.#pendingLightningScenes.clear();

    // Remove any in-flight bomb scenes
    for (const el of this.#pendingBombScenes) {
      if (el.isConnected) el.remove();
    }
    this.#pendingBombScenes.clear();

    // Remove nuclear blast overlay (appended to document.body)
    for (const el of this.#pendingNuclearElements) {
      if (el.isConnected) el.remove();
    }
    this.#pendingNuclearElements.clear();

    // Force-remove any consumed elements that animationend didn't clean up
    this.clearConsumedElements();

    const activeIds = new Set(allTiles.map((t) => t.id));

    // Remove orphaned (consumed / partially-animated) elements
    for (const [id, el] of this.#tileElements) {
      if (!activeIds.has(id)) {
        el.remove();
        this.#tileElements.delete(id);
      }
    }

    // Snap surviving tiles — disable transition, apply final position, clear animation classes,
    // and sync value class + text in case processMerges was cancelled mid-animation.
    this.clearFusionIndicators();
    for (const tile of allTiles) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      el.style.transition = 'none';
      el.classList.remove(
        'fm-tile--spawn',
        'fm-tile--merge',
        'fm-tile--consumed',
        'fm-tile--lightning',
        'fm-tile--bomb',
        'fm-tile--nuclear',
      );
      // If the tile lost its power mid-animation (e.g. cut during merge), strip leftover power children
      if (!el.classList.contains('fm-tile-powered')) {
        for (const child of el.querySelectorAll('.fm-pw-face, .fm-pw-sparkle')) child.remove();
      }

      // Sync value class (e.g. fm-t512 → fm-t1024) to match grid data.
      // This handles the case where grid.move() doubled a tile's value but
      // processMerges was never called (move cancelled before Phase 2).
      const staleValueClass = [...el.classList].find((c) => /^fm-t\d+$/.test(c));
      const correctValueClass = `fm-t${tile.value}`;
      if (staleValueClass !== correctValueClass) {
        if (staleValueClass) el.classList.remove(staleValueClass);
        el.classList.add(correctValueClass);
        const valEl = el.querySelector('.fm-val');
        if (valEl) valEl.textContent = String(tile.value);
      }

      const { x, y } = cellPositionFn(tile.row, tile.col);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }

    // Create DOM elements for tiles spawned in the grid but not yet rendered
    for (const tile of allTiles) {
      if (!this.#tileElements.has(tile.id)) {
        this.createTileElement(tile, false, cellPositionFn, 0);
      }
    }

    // Clear in-flight particles (canvas is cleared on next rAF frame)
    this.#mergeParticles.length = 0;
  }

  /**
   * Re-enable CSS slide transitions on all elements (call after snap + forced reflow).
   * A forced reflow between `snapToFinalState` and `restoreTransitions` ensures the
   * browser does not optimise away the snap (e.g. `void el.offsetWidth` works).
   * @param {number} slideDuration Transition duration in ms
   */
  restoreTransitions(slideDuration) {
    for (const el of this.#tileElements.values()) {
      el.style.transition = '';
      el.style.setProperty('--slide-duration', `${slideDuration}ms`);
    }
  }

  // ─── Animation Primitives ────────────────────────

  /**
   * Play a short directional bump on all tiles to signal that no move was possible.
   * @param {'up' | 'down' | 'left' | 'right'} direction
   */
  bumpInDirection(direction) {
    const cls = `fm-tile--bump-${direction}`;
    for (const el of this.#tileElements.values()) {
      el.classList.remove(
        'fm-tile--bump-up',
        'fm-tile--bump-down',
        'fm-tile--bump-left',
        'fm-tile--bump-right',
      );
      void el.offsetWidth; /* force reflow so re-triggering the same direction restarts the animation */
      el.classList.add(cls);
      el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
    }
  }

  /**
   * Slide moved/merged tiles to their new CSS positions (uses `left`/`top` transition).
   * The DOM transition begins immediately; the caller awaits the slide duration.
   *
   * @param {{ movements: { tile: import('../entities/tile.js').Tile }[], merges: { tile: import('../entities/tile.js').Tile, consumedId: string }[] }} result
   * @param {(row: number, col: number) => { x: number, y: number }} cellPositionFn
   */
  slidePositions(result, cellPositionFn) {
    for (const { tile } of result.movements) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      const { x, y } = cellPositionFn(tile.row, tile.col);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }

    for (const { tile, consumedId } of result.merges) {
      const { x, y } = cellPositionFn(tile.row, tile.col);

      const survivorEl = this.#tileElements.get(tile.id);
      if (survivorEl) {
        survivorEl.style.left = `${x}px`;
        survivorEl.style.top = `${y}px`;
      }

      // Slide consumed tile to the merge target so it visually collides
      const consumedEl = this.#tileElements.get(consumedId);
      if (consumedEl) {
        consumedEl.style.left = `${x}px`;
        consumedEl.style.top = `${y}px`;
      }
    }
  }

  /**
   * Animate expelled (expel-power) tiles flying to the screen edge.
   * Uses the same duration as the regular tile slide (ANIM.SLIDE_DURATION) with
   * ease-in-out so the exit feels like a natural continuation of the grid movement.
   *
   * @param {import('../entities/tile.js').Tile[]} expelled  Tiles that exited the grid
   * @param {'up'|'down'|'left'|'right'} direction  Move direction that caused the exit
   * @param {number} tileSize  Width/height of a tile in px
   */
  slideExpelledToEdge(expelled, direction, tileSize) {
    if (!expelled.length || !this.#gridEl) return;

    const rect = this.#gridEl.getBoundingClientRect();
    const dur = ANIM.SLIDE_DURATION;

    for (const tile of expelled) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;

      const startLeft = parseFloat(el.style.left) || 0;
      const startTop = parseFloat(el.style.top) || 0;
      let endLeft = startLeft;
      let endTop = startTop;

      switch (direction) {
        case 'up':
          endTop = -(rect.top + tileSize + 20);
          break;
        case 'down':
          endTop = window.innerHeight - rect.top + tileSize + 20;
          break;
        case 'left':
          endLeft = -(rect.left + tileSize + 20);
          break;
        case 'right':
          endLeft = window.innerWidth - rect.left + tileSize + 20;
          break;
      }

      el.style.transition = `left ${dur}ms ease-in-out, top ${dur}ms ease-in-out`;
      void el.offsetWidth; // force reflow so start position commits before animation
      el.style.left = `${endLeft}px`;
      el.style.top = `${endTop}px`;
    }
  }

  /**
   * Apply post-slide merge visuals:
   * - Fade out consumed tiles (adds `.fm-tile--consumed`, removes element on `animationend`).
   * - Update surviving tile value and play bounce (adds `.fm-tile--merge`).
   * - Safety-removes any remaining orphaned elements.
   *
   * @param {{ tile: import('../entities/tile.js').Tile, consumedId: string }[]} merges
   * @param {import('../entities/tile.js').Tile[]} allTiles Active tiles after merge
   */
  processMerges(merges, allTiles) {
    const activeIds = new Set(allTiles.map((t) => t.id));

    for (const { tile, consumedId } of merges) {
      const consumedEl = this.#tileElements.get(consumedId);
      if (consumedEl) {
        consumedEl.classList.add('fm-tile--consumed');
        // Track for explicit removal — do NOT rely on animationend which can
        // silently fail when another animation is already running on the element.
        this.#consumedElements.add(consumedEl);
        this.#tileElements.delete(consumedId);
      }

      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      el.className = `fm-tile fm-t${tile.value} fm-tile--merge`;
      // Remove all state/power children left from before merge
      for (const child of el.querySelectorAll(
        '.fm-snowflake, .fm-pw-face, .fm-pw-sparkle, .fm-wind-line',
      ))
        child.remove();
      const valEl = el.querySelector('.fm-val');
      if (valEl) valEl.textContent = String(tile.value);
      el.addEventListener('animationend', () => el.classList.remove('fm-tile--merge'), {
        once: true,
      });
    }

    // Safety net: remove any remaining orphaned elements
    for (const [id, el] of this.#tileElements) {
      if (!activeIds.has(id)) {
        el.remove();
        this.#tileElements.delete(id);
      }
    }
  }

  /**
   * Create and insert a DOM element for a tile.
   * @param {import('../entities/tile.js').Tile} tile
   * @param {boolean} animate Whether to play the spawn pop animation
   * @param {(row: number, col: number) => { x: number, y: number }} cellPositionFn
   * @param {number} slideDuration CSS slide transition duration in ms (0 = no transition)
   * @returns {HTMLElement} The created element
   */
  createTileElement(tile, animate, cellPositionFn, slideDuration) {
    const el = document.createElement('div');
    el.className = `fm-tile fm-t${tile.value}`;
    if (animate) el.classList.add('fm-tile--spawn');
    el.innerHTML = `<span class="fm-val">${tile.value}</span>`;
    el.dataset.tileId = tile.id;

    const { x, y } = cellPositionFn(tile.row, tile.col);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (slideDuration > 0) {
      el.style.setProperty('--slide-duration', `${slideDuration}ms`);
    }

    if (animate) {
      el.addEventListener('animationend', () => el.classList.remove('fm-tile--spawn'), {
        once: true,
      });
    }

    this.#gridEl?.appendChild(el);
    this.#tileElements.set(tile.id, el);
    return el;
  }

  /**
   * Remove all fusion arc SVG elements and stop the animation loop.
   */
  clearFusionIndicators() {
    if (this.#arcRaf !== null) {
      cancelAnimationFrame(this.#arcRaf);
      this.#arcRaf = null;
    }
    for (const svg of this.#arcElements.values()) {
      if (svg.isConnected) svg.remove();
    }
    this.#arcElements.clear();
    for (const el of this.#tileElements.values()) {
      el.style.animation = '';
    }
    this.#tilePullDirs.clear();
  }

  /**
   * Register a fusion pair and draw an electric arc between the two tiles.
   * Each pair is identified by "idA:idB" and gets its own SVG arc element.
   * @param {string} idA - tile id of the first tile
   * @param {string} idB - tile id of the second tile
   * @param {'h' | 'v'} axis - 'h' for horizontal pair (A left of B), 'v' for vertical (A above B)
   */
  addFusionArc(idA, idB, axis) {
    const elA = this.#tileElements.get(idA);
    const elB = this.#tileElements.get(idB);
    if (!elA || !elB || !this.#gridEl) return;

    const key = `${idA}:${idB}`;
    if (this.#arcElements.has(key)) return;

    /* Apply pull animation to each tile toward the other.
     * A tile pulling in two opposing directions (e.g. left + right) gets no pull. */
    const pullA = axis === 'h' ? 'right' : 'down';
    const pullB = axis === 'h' ? 'left' : 'up';
    AnimationManager.#applyPull(elA, idA, pullA, this.#tilePullDirs);
    AnimationManager.#applyPull(elB, idB, pullB, this.#tilePullDirs);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fm-fuse-arc');
    svg.style.cssText = 'position:absolute;pointer-events:none;overflow:visible;z-index:5;';

    /* Glow filter definition */
    const ns = 'http://www.w3.org/2000/svg';
    const filterId = `ffa-${idA.slice(-4)}`;
    const defs = document.createElementNS(ns, 'defs');
    const filt = document.createElementNS(ns, 'filter');
    filt.setAttribute('id', filterId);
    filt.setAttribute('x', '-50%');
    filt.setAttribute('y', '-50%');
    filt.setAttribute('width', '200%');
    filt.setAttribute('height', '200%');
    const blur = document.createElementNS(ns, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '1.2');
    blur.setAttribute('result', 'coloredBlur');
    const merge = document.createElementNS(ns, 'feMerge');
    const mn1 = document.createElementNS(ns, 'feMergeNode');
    mn1.setAttribute('in', 'coloredBlur');
    const mn2 = document.createElementNS(ns, 'feMergeNode');
    mn2.setAttribute('in', 'SourceGraphic');
    merge.append(mn1, mn2);
    filt.append(blur, merge);
    defs.append(filt);
    svg.append(defs);

    /* The arc polyline — points updated every frame */
    const line = document.createElementNS(ns, 'polyline');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'rgba(180,220,255,0.75)');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('filter', `url(#${filterId})`);
    svg.append(line);

    this.#gridEl.appendChild(svg);
    this.#arcElements.set(key, svg);

    /* Bind a per-frame updater that repositions the SVG and redraws the arc */
    svg._update = () => {
      const gridRect = this.#gridEl.getBoundingClientRect();
      const rA = elA.getBoundingClientRect();
      const rB = elB.getBoundingClientRect();

      /* SVG covers the gap between the two tiles */
      let svgX, svgY, svgW, svgH, points;
      if (axis === 'h') {
        svgX = rA.right - gridRect.left;
        svgY = rA.top - gridRect.top + rA.height * 0.2;
        svgW = rB.left - rA.right;
        svgH = rA.height * 0.6;
        points = AnimationManager.#zigzag(0, svgH / 2, svgW, svgH / 2, 5, svgH * 0.3);
      } else {
        svgX = rA.left - gridRect.left + rA.width * 0.2;
        svgY = rA.bottom - gridRect.top;
        svgW = rA.width * 0.6;
        svgH = rB.top - rA.bottom;
        points = AnimationManager.#zigzag(svgW / 2, 0, svgW / 2, svgH, 5, svgW * 0.3);
      }

      svg.style.left = `${svgX}px`;
      svg.style.top = `${svgY}px`;
      svg.style.width = `${Math.max(svgW, 1)}px`;
      svg.style.height = `${Math.max(svgH, 1)}px`;
      svg.setAttribute('viewBox', `0 0 ${Math.max(svgW, 1)} ${Math.max(svgH, 1)}`);
      line.setAttribute('points', points);

      /* Pulse opacity */
      const t = (Date.now() % 1600) / 1600;
      const opacity = 0.35 + 0.55 * Math.abs(Math.sin(Math.PI * t));
      svg.style.opacity = String(opacity);
    };

    if (this.#arcRaf === null) this.#startArcLoop();
  }

  /**
   * Generate a zigzag polyline points string between two endpoints.
   * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
   * @param {number} steps - number of zigzag segments
   * @param {number} jitter - max perpendicular displacement
   * @returns {string}
   */
  /**
   * Apply the correct pull keyframe to a tile, skipping if opposing dirs cancel out.
   * @param {HTMLElement} el
   * @param {string} id
   * @param {'right'|'left'|'down'|'up'} dir
   * @param {Map<string, Set<string>>} pullDirs - shared tracker
   */
  static #applyPull(el, id, dir, pullDirs) {
    if (!pullDirs.has(id)) pullDirs.set(id, new Set());
    const dirs = pullDirs.get(id);
    dirs.add(dir);

    const OPPOSITE = { right: 'left', left: 'right', down: 'up', up: 'down' };
    if (dirs.has(OPPOSITE[dir])) {
      /* Opposing pulls cancel — remove animation entirely */
      el.style.animation = '';
      return;
    }

    /* Pick the dominant direction (first non-cancelled one) */
    const active = [...dirs].find((d) => !dirs.has(OPPOSITE[d]));
    if (active) el.style.animation = `fm-pull-${active} 2s ease-in-out infinite`;
  }

  static #zigzag(x1, y1, x2, y2, steps, jitter) {
    const pts = [[x1, y1]];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const bx = x1 + (x2 - x1) * t;
      const by = y1 + (y2 - y1) * t;
      /* Perpendicular displacement — random each frame for flicker */
      const perp = (Math.random() - 0.5) * 2 * jitter;
      const dx = -(y2 - y1);
      const dy = x2 - x1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      pts.push([bx + (dx / len) * perp, by + (dy / len) * perp]);
    }
    pts.push([x2, y2]);
    return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  }

  /**
   * Start the shared rAF loop that updates all active arc elements.
   * Capped at 30 FPS to avoid forcing a getBoundingClientRect layout sync
   * every single frame (expensive on mobile with many fusion pairs visible).
   */
  #startArcLoop() {
    const isMobile = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const MS_PER_FRAME = 1000 / (isMobile ? 15 : 30);
    let lastTs = 0;
    const tick = (ts) => {
      if (this.#arcElements.size === 0) {
        this.#arcRaf = null;
        return;
      }
      if (ts - lastTs >= MS_PER_FRAME) {
        lastTs = ts;
        for (const svg of this.#arcElements.values()) svg._update?.();
      }
      this.#arcRaf = requestAnimationFrame(tick);
    };
    this.#arcRaf = requestAnimationFrame(tick);
  }

  /**
   * Remove consumed tile DOM elements that have finished their fade animation.
   * Called after the MERGE_DURATION await in GridManager.executeMove and at
   * the start of snapToFinalState so orphans can never persist across moves.
   */
  clearConsumedElements() {
    for (const el of this.#consumedElements) {
      if (el.isConnected) el.remove();
    }
    this.#consumedElements.clear();
  }

  /**
   * Remove all tile DOM elements and clear the tracking map.
   */
  clearAllTileElements() {
    for (const el of this.#pendingFireballs) {
      if (el.isConnected) el.remove();
    }
    this.#pendingFireballs.clear();
    for (const el of this.#pendingLightningScenes) {
      if (el.isConnected) el.remove();
    }
    this.#pendingLightningScenes.clear();
    this.clearConsumedElements();
    for (const el of this.#tileElements.values()) {
      el.remove();
    }
    this.#tileElements.clear();
  }

  // ─── Merge Particle System ───────────────────────

  /**
   * Burst particles at each merge target cell center.
   * @param {{ tile: import('../entities/tile.js').Tile }[]} merges
   * @param {(row: number, col: number) => { x: number, y: number }} cellPositionFn
   * @param {number} tileSize Width/height of a single tile in px
   */
  spawnMergeParticles(merges, cellPositionFn, tileSize) {
    for (const { tile } of merges) {
      const { x, y } = cellPositionFn(tile.row, tile.col);
      const cx = x + tileSize / 2;
      const cy = y + tileSize / 2;
      const count = 14;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 0.4 + Math.random() * 2.5;
        this.#mergeParticles.push({
          x: cx + (Math.random() - 0.5) * tileSize * 0.8,
          y: cy + (Math.random() - 0.5) * tileSize * 0.8,
          vx: Math.cos(angle) * spd * (Math.random() < 0.5 ? 0.3 : 1),
          vy: Math.sin(angle) * spd * (Math.random() < 0.5 ? 0.3 : 1),
          tx: cx,
          ty: cy,
          r: 1.5 + Math.random() * 2.8,
          life: 0.7 + Math.random() * 0.3,
          decay: 0.008 + Math.random() * 0.014,
          rgb: i < count / 2 ? '250,204,21' : '200,160,255',
        });
      }
    }
  }

  // ─── Lightning Animation ─────────────────────────

  /**
   * Play lightning strike animations for 1–3 column strikes.
   * Creates bolt + sparks + ring above each target cell, applies the
   * static-noise hit animation to the tile element (if one exists).
   * Strikes are staggered by `strikeDelay` ms.
   *
   * @param {{ col: number, row: number, tile: import('../entities/tile.js').Tile | null }[]} strikes
   * @param {(row: number, col: number) => { x: number, y: number }} cellPosFn
   * @param {number} tileSize
   * @param {number} animDuration  Duration of each strike animation (ms)
   * @param {number} strikeDelay   Delay between consecutive strikes (ms)
   */
  playLightningAnimation(strikes, cellPosFn, tileSize, animDuration, strikeDelay) {
    if (!this.#gridEl) return;

    const SCENE_W = 130;
    const SCENE_H = 100; // px of bolt descent above the tile

    for (let i = 0; i < strikes.length; i++) {
      const strike = strikes[i];
      const delay = i * strikeDelay;

      setTimeout(() => {
        if (!this.#gridEl) return;

        const pos = cellPosFn(strike.row, strike.col);
        const sceneX = pos.x + tileSize / 2 - SCENE_W / 2;
        const sceneY = pos.y - SCENE_H;

        const scene = document.createElement('div');
        scene.className = 'fm-lightning-scene';
        scene.style.left = `${sceneX}px`;
        scene.style.top = `${sceneY}px`;
        scene.style.width = `${SCENE_W}px`;
        scene.style.height = `${SCENE_H}px`;

        scene.innerHTML = [
          '<div class="fm-lb fm-zz"></div>',
          '<div class="fm-sw fm-sw-a"><div class="fm-si fm-zz"></div></div>',
          '<div class="fm-sw fm-sw-b"><div class="fm-si fm-zz"></div></div>',
          '<div class="fm-sw fm-sw-c"><div class="fm-si fm-zz"></div></div>',
          '<div class="fm-sw fm-sw-d"><div class="fm-si fm-zz"></div></div>',
          '<div class="fm-sw fm-sw-e"><div class="fm-si fm-zz"></div></div>',
          '<div class="fm-sw fm-sw-f"><div class="fm-si fm-zz"></div></div>',
          '<div class="fm-sw fm-sw-g"><div class="fm-si fm-zz"></div></div>',
          '<div class="fm-lr"></div>',
        ].join('');

        this.#gridEl.appendChild(scene);
        this.#pendingLightningScenes.add(scene);

        // Apply hit animation to the tile element if it still exists
        if (strike.tile) {
          const tileEl = this.#tileElements.get(strike.tile.id);
          if (tileEl) {
            tileEl.classList.remove('fm-tile--spawn', 'fm-tile--merge', 'fm-tile--consumed');
            tileEl.classList.add('fm-tile--lightning');
          }
        }

        // Auto-remove the scene once the animation ends
        setTimeout(() => {
          if (scene.isConnected) scene.remove();
          this.#pendingLightningScenes.delete(scene);
        }, animDuration + 50);
      }, delay);
    }
  }

  // ─── Fire Animation ─────────────────────────────

  /**
   * Play the bomb explosion for the emitter tile and all its destroyed neighbors.
   *
   * A shockwave ring + cross arms are spawned at the emitter center.
   * All destroyed tiles receive the `fm-tile--bomb` destruction animation.
   *
   * @param {import('../entities/tile.js').Tile} targetTile  The bomb emitter (also destroyed)
   * @param {import('../entities/tile.js').Tile[]} destroyedTiles  All tiles being destroyed (incl. target)
   * @param {(row: number, col: number) => { x: number, y: number }} cellPosFn
   * @param {number} tileSize  Width/height of a tile in px
   */
  playBombAnimation(targetTile, destroyedTiles, cellPosFn, tileSize) {
    if (!this.#gridEl || !targetTile) return;

    const pos = cellPosFn(targetTile.row, targetTile.col);

    // Scene anchor: center of the emitter tile
    const sceneX = pos.x + tileSize / 2;
    const sceneY = pos.y + tileSize / 2;

    const ringSize = Math.round(tileSize * 1.05);
    const coreSize = Math.round(tileSize * 0.65);
    // Arms cover the 4 neighbors' distance
    const armW = Math.round(tileSize * 2.8); // horizontal arm width
    const armH = Math.round(tileSize * 0.45); // arm height (narrow)
    const armHW = Math.round(tileSize * 0.45); // vertical arm width
    const armHH = Math.round(tileSize * 2.8); // vertical arm height

    const scene = document.createElement('div');
    scene.className = 'fm-bomb-scene';
    scene.style.left = `${sceneX}px`;
    scene.style.top = `${sceneY}px`;

    scene.innerHTML = [
      // Shockwave rings
      `<div class="fm-br" style="width:${ringSize}px;height:${ringSize}px;"></div>`,
      `<div class="fm-br2" style="width:${ringSize}px;height:${ringSize}px;"></div>`,
      // Core flash
      `<div class="fm-bc" style="width:${coreSize}px;height:${coreSize}px;"></div>`,
      // Cross arms
      `<div class="fm-ba-h" style="width:${armW}px;height:${armH}px;"></div>`,
      `<div class="fm-ba-v" style="width:${armHW}px;height:${armHH}px;"></div>`,
    ].join('');

    this.#gridEl.appendChild(scene);
    this.#pendingBombScenes.add(scene);

    // Apply destruction animation to every tile being destroyed (including emitter)
    for (const tile of destroyedTiles) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      el.classList.remove('fm-tile--spawn', 'fm-tile--merge', 'fm-tile--consumed');
      el.classList.add('fm-tile--bomb');
    }

    // Auto-remove scene after animation ends
    setTimeout(() => {
      if (scene.isConnected) scene.remove();
      this.#pendingBombScenes.delete(scene);
    }, ANIM.BOMB_DURATION + 50);
  }

  /**
   * Play the nuclear full-screen blast and per-tile fly-out animation.
   *
   * A fixed overlay is appended to document.body with cross arms, core, and rings.
   * Each tile receives the `fm-tile--nuclear` animation with radial fly-out vars.
   *
   * @param {import('../entities/tile.js').Tile[]} destroyedTiles
   */
  playNuclearAnimation(destroyedTiles) {
    // Full-screen blast overlay appended to document.body
    const blast = document.createElement('div');
    blast.className = 'fm-nuclear-blast';
    blast.innerHTML = [
      '<div class="fm-nuc-flash"></div>',
      '<div class="fm-nuc-arm-h"></div>',
      '<div class="fm-nuc-arm-v"></div>',
      '<div class="fm-nuc-core"></div>',
      '<div class="fm-nuc-ring-inner"></div>',
      '<div class="fm-nuc-ring-outer"></div>',
    ].join('');
    document.body.appendChild(blast);
    this.#pendingNuclearElements.add(blast);

    const CENTER = (GRID_SIZE - 1) / 2; // 1.5 for a 4×4 grid

    for (const tile of destroyedTiles) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;

      const dx = tile.col - CENTER;
      const dy = tile.row - CENTER;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const spin = ((Math.random() - 0.5) * 520).toFixed(1);
      // Inner tiles fly first (small dist = small delay), outer tiles slightly later
      const delay = (dist * 0.08).toFixed(3);

      el.style.setProperty('--nuc-dx', (dx / dist).toFixed(4));
      el.style.setProperty('--nuc-dy', (dy / dist).toFixed(4));
      el.style.setProperty('--nuc-spin', `${spin}deg`);
      el.style.setProperty('--nuc-delay', `${delay}s`);

      el.classList.remove('fm-tile--spawn', 'fm-tile--merge', 'fm-tile--consumed');
      el.classList.add('fm-tile--nuclear');
    }

    // Auto-remove blast overlay after animation ends
    setTimeout(() => {
      if (blast.isConnected) blast.remove();
      this.#pendingNuclearElements.delete(blast);
    }, ANIM.NUCLEAR_DURATION + 100);
  }

  // ─── Fire Animation (existing) ───────────────────

  /**
   * Launch the FUSEAU fireball(s) for a fire power and apply staggered ZAP
   * destruction animation to each affected tile element.
   *
   * Fireballs are tracked in `#pendingFireballs` and cleaned up by
   * `snapToFinalState` if a new move interrupts the animation.
   * ZAP-ed tiles are orphans in the grid (already removed by executeEffect),
   * so `snapToFinalState` will remove their DOM elements as well.
   *
   * @param {string} powerType  One of POWER_TYPES.FIRE_H / FIRE_V / FIRE_X
   * @param {import('../entities/tile.js').Tile} targetTile  The surviving target tile
   * @param {import('../entities/tile.js').Tile[]} destroyedTiles  Tiles destroyed by the power
   * @param {(row: number, col: number) => { x: number, y: number }} cellPosFn
   * @param {number} tileSize  Width/height of a single tile in px
   */
  playFireAnimation(powerType, targetTile, destroyedTiles, cellPosFn, tileSize) {
    if (!this.#gridEl || !targetTile) return;

    const targetPos = cellPosFn(targetTile.row, targetTile.col);
    const gridW = this.#gridEl.offsetWidth;
    const zapDur = ANIM.FIRE_ZAP_DURATION;

    // Constant speed derived from reference duration over one grid width.
    // All fireballs travel at this px/ms rate regardless of total distance.
    const speed = gridW / ANIM.FIRE_BALL_DURATION;

    const isH = powerType === POWER_TYPES.FIRE_H || powerType === POWER_TYPES.FIRE_X;
    const isV = powerType === POWER_TYPES.FIRE_V || powerType === POWER_TYPES.FIRE_X;

    // Launch fireballs — each travels to the screen edge at constant speed
    if (isH) {
      this.#launchFireball('right', targetPos, tileSize, speed);
      this.#launchFireball('left', targetPos, tileSize, speed);
    }
    if (isV) {
      this.#launchFireball('down', targetPos, tileSize, speed);
      this.#launchFireball('up', targetPos, tileSize, speed);
    }

    // Apply staggered ZAP: delay = distance-from-start / speed
    const targetCenterX = targetPos.x + tileSize / 2;
    const targetCenterY = targetPos.y + tileSize / 2;

    for (const tile of destroyedTiles) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;

      const tilePos = cellPosFn(tile.row, tile.col);
      const tileCenterX = tilePos.x + tileSize / 2;
      const tileCenterY = tilePos.y + tileSize / 2;

      let delay = 0;

      if (isH && tile.row === targetTile.row) {
        const goingRight = tileCenterX > targetCenterX;
        const startEdge = goingRight ? targetPos.x + tileSize : targetPos.x;
        const tileDist = Math.abs(tileCenterX - startEdge);
        delay = tileDist / speed;
      } else if (isV && tile.col === targetTile.col) {
        const goingDown = tileCenterY > targetCenterY;
        const startEdge = goingDown ? targetPos.y + tileSize : targetPos.y;
        const tileDist = Math.abs(tileCenterY - startEdge);
        delay = tileDist / speed;
      }

      el.style.setProperty('--fm-zap-dur', `${zapDur}ms`);
      el.style.setProperty('--fm-zap-delay', `${Math.round(delay)}ms`);
      el.classList.remove('fm-tile--spawn', 'fm-tile--merge', 'fm-tile--consumed');
      el.classList.add('fm-tile--zap');
    }
  }

  // ─── Teleport Animation ─────────────────────────

  /**
   * Animate a cross-arc swap between two tiles (Teleport power effect).
   *
   * Must be called AFTER `power-manager.executeEffect` has already swapped the
   * tiles in the data model (tileA/tileB carry their NEW row/col), but BEFORE
   * `syncTileDom` snaps the DOM — the DOM elements must still sit at their
   * pre-swap CSS positions (left/top) when this method is called.
   *
   * Both tiles travel simultaneous curved arcs that cross at the midpoint
   * (the same "Cross" animation from preview-swap.html):
   *  - tileA arcs to the "left" of the straight line
   *  - tileB arcs to the "right" → paths visually cross in the centre
   *
   * Returns a Promise that resolves once the animation has finished and the
   * DOM left/top values have been committed to the new positions.
   *
   * @param {import('../entities/tile.js').Tile} tileA  Post-swap tile (was at oldA)
   * @param {import('../entities/tile.js').Tile} tileB  Post-swap tile (was at oldB)
   * @param {{ row: number, col: number }} oldA  Pre-swap logical position of tileA
   * @param {{ row: number, col: number }} oldB  Pre-swap logical position of tileB
   * @param {(row: number, col: number) => { x: number, y: number }} cellPosFn
   * @param {number} duration  Animation duration in ms
   * @returns {Promise<void>}
   */
  playTeleportAnimation(tileA, tileB, oldA, oldB, cellPosFn, duration) {
    return new Promise((resolve) => {
      const elA = this.#tileElements.get(tileA.id);
      const elB = this.#tileElements.get(tileB.id);
      if (!elA || !elB) {
        resolve();
        return;
      }

      // Pixel positions (top-left corner of tile)
      const posOldA = cellPosFn(oldA.row, oldA.col);
      const posOldB = cellPosFn(oldB.row, oldB.col);
      const posNewA = cellPosFn(tileA.row, tileA.col); // same as posOldB
      const posNewB = cellPosFn(tileB.row, tileB.col); // same as posOldA

      // Delta for tileA: old → new
      const dx = posNewA.x - posOldA.x;
      const dy = posNewA.y - posOldA.y;
      const len = Math.hypot(dx, dy) || 1;

      // Perpendicular arc offset — larger for distant tiles
      const h = Math.max(55, len * 0.42);
      const pX = (-dy / len) * h;
      const pY = (dx / len) * h;

      elA.style.zIndex = '20';
      elB.style.zIndex = '10';

      // Disable CSS left/top transition while WAAPI drives the motion
      elA.style.transition = 'none';
      elB.style.transition = 'none';

      // ── Key trick: pre-commit left/top to the FINAL positions right now.
      // The tiles will visually appear at their OLD positions via the transform
      // starting offset, and animate transform → 0 to reach the new positions.
      // This means NO fill:'forwards' is needed and NO cancel() is required —
      // when the animation ends transform becomes '' and left/top are correct.
      elA.style.left = `${posNewA.x}px`;
      elA.style.top = `${posNewA.y}px`;
      elB.style.left = `${posNewB.x}px`;
      elB.style.top = `${posNewB.y}px`;

      // tileA transform keyframes: start at -(dx,dy) so its visual = posNewA-(dx,dy) = posOldA
      // midpoint arc: (-dx/2+pX, -dy/2+pY)  →  end: (0,0) = posNewA ✓
      const animA = elA.animate(
        [
          { transform: `translate(${-dx}px, ${-dy}px)` },
          { transform: `translate(${-dx / 2 + pX}px, ${-dy / 2 + pY}px)` },
          { transform: 'translate(0px, 0px)' },
        ],
        { duration, easing: 'cubic-bezier(0.4,0,0.6,1)', fill: 'none' },
      );

      // tileB transform keyframes: start at (dx,dy) so its visual = posNewB+(dx,dy) = posOldB
      // midpoint arc: (dx/2-pX, dy/2-pY)  →  end: (0,0) = posNewB ✓
      elB.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx / 2 - pX}px, ${dy / 2 - pY}px)` },
          { transform: 'translate(0px, 0px)' },
        ],
        { duration, easing: 'cubic-bezier(0.4,0,0.6,1)', fill: 'none' },
      );

      animA.onfinish = () => {
        // transform is already '' (fill:'none'), left/top already at new positions
        elA.style.zIndex = '';
        elB.style.zIndex = '';
        elA.style.transition = '';
        elB.style.transition = '';
        resolve();
      };
    });
  }

  /**
   * Create and animate a single fireball element flying in the given direction.
   * The ball starts at the border of the target tile and travels at constant
   * speed (`speed` px/ms) until it exits the viewport.
   * Duration is computed from the actual travel distance so the ball always
   * reaches the screen edge smoothly.
   *
   * @param {'right'|'left'|'down'|'up'} dir
   * @param {{ x: number, y: number }} targetPos  Top-left corner of target tile
   * @param {number} tileSize
   * @param {number} speed  Travel speed in px/ms
   */
  #launchFireball(dir, targetPos, tileSize, speed) {
    const el = document.createElement('div');
    el.className = `fm-fireball fm-fireball--${dir}`;
    this.#pendingFireballs.add(el);

    // Grid rect in viewport coordinates — used to convert screen edges to
    // grid-local coordinates (all CSS left/top are relative to the grid).
    const rect = this.#gridEl.getBoundingClientRect();

    // Fireball element is 12×28px; center offsets: cx = left+6, cy = top+14.
    let startLeft, startTop, endLeft, endTop;

    switch (dir) {
      case 'right':
        startLeft = targetPos.x + tileSize - 6;
        startTop = targetPos.y + tileSize / 2 - 14;
        endLeft = window.innerWidth - rect.left + 40;
        endTop = startTop;
        break;
      case 'left':
        startLeft = targetPos.x - 6;
        startTop = targetPos.y + tileSize / 2 - 14;
        endLeft = -(rect.left + 40);
        endTop = startTop;
        break;
      case 'down':
        startLeft = targetPos.x + tileSize / 2 - 6;
        startTop = targetPos.y + tileSize - 14;
        endLeft = startLeft;
        endTop = window.innerHeight - rect.top + 40;
        break;
      case 'up':
        startLeft = targetPos.x + tileSize / 2 - 6;
        startTop = targetPos.y - 14;
        endLeft = startLeft;
        endTop = -(rect.top + 40);
        break;
      default:
        return;
    }

    const dist = Math.hypot(endLeft - startLeft, endTop - startTop);
    const duration = Math.round(dist / speed);

    // Rotation angle matching the CSS class, kept constant throughout the flight
    // so the transition only animates the translation, never the rotation.
    const rotDeg = { right: -90, left: 90, up: 180, down: 0 }[dir] ?? 0;

    el.style.left = `${startLeft}px`;
    el.style.top = `${startTop}px`;
    el.style.willChange = 'transform';
    // Set initial transform inline (same structure as final) so the browser
    // has an identical function list to interpolate from.
    el.style.transform = `translateX(0px) translateY(0px) rotate(${rotDeg}deg)`;

    this.#gridEl.appendChild(el);

    // Force reflow so the browser registers the start state before animating
    void el.offsetWidth;

    el.style.transition = `transform ${duration}ms linear`;

    const dx = endLeft - startLeft;
    const dy = endTop - startTop;
    el.style.transform = `translateX(${dx}px) translateY(${dy}px) rotate(${rotDeg}deg)`;

    // Self-remove after the transition ends
    setTimeout(() => {
      if (el.isConnected) el.remove();
      this.#pendingFireballs.delete(el);
    }, duration + 50);
  }

  /**
   * Start the `requestAnimationFrame` particle draw loop.
   * Safe to call multiple times — only starts if not already running.
   */
  startParticleLoop() {
    if (this.#mergeRaf !== null) return;
    const draw = () => {
      this.#mergeRaf = requestAnimationFrame(draw);
      const ctx = this.#mergeCtx;
      const cvs = this.#mergeCanvas;
      if (!ctx || !cvs) return;

      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const particles = this.#mergeParticles;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy) + 0.001;
        const force = Math.min(0.24, 5.0 / (dist + 3));
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0 || dist < 4) {
          particles.splice(i, 1);
          continue;
        }
        const a = Math.min(p.life, 1);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
        g.addColorStop(0, `rgba(${p.rgb},${a})`);
        g.addColorStop(1, `rgba(${p.rgb},0)`);
        ctx.beginPath();
        ctx.fillStyle = g;
        ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    this.#mergeRaf = requestAnimationFrame(draw);
  }

  /**
   * Stop the particle loop and clear all in-flight particles.
   */
  stopParticleLoop() {
    if (this.#mergeRaf !== null) {
      cancelAnimationFrame(this.#mergeRaf);
      this.#mergeRaf = null;
    }
    this.#mergeParticles.length = 0;
  }
}
