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
    const activeIds = new Set(allTiles.map((t) => t.id));

    // Remove orphaned (consumed / partially-animated) elements
    for (const [id, el] of this.#tileElements) {
      if (!activeIds.has(id)) {
        el.remove();
        this.#tileElements.delete(id);
      }
    }

    // Snap surviving tiles — disable transition, apply final position, clear animation classes
    for (const tile of allTiles) {
      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      el.style.transition = 'none';
      el.classList.remove('fm-tile--spawn', 'fm-tile--merge', 'fm-tile--consumed');
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
        consumedEl.addEventListener('animationend', () => consumedEl.remove(), { once: true });
        this.#tileElements.delete(consumedId);
      }

      const el = this.#tileElements.get(tile.id);
      if (!el) continue;
      el.className = `fm-tile fm-t${tile.value} fm-tile--merge`;
      const valEl = el.querySelector('.fm-val');
      if (valEl) valEl.textContent = String(tile.value);
      el.addEventListener('animationend', () => el.classList.remove('fm-tile--merge'), { once: true });
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
      el.addEventListener('animationend', () => el.classList.remove('fm-tile--spawn'), { once: true });
    }

    this.#gridEl?.appendChild(el);
    this.#tileElements.set(tile.id, el);
    return el;
  }

  /**
   * Remove all tile DOM elements and clear the tracking map.
   */
  clearAllTileElements() {
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
      const count = 28;
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
          r: 1.2 + Math.random() * 2.5,
          life: 0.7 + Math.random() * 0.3,
          decay: 0.008 + Math.random() * 0.014,
          rgb: i < count / 2 ? '250,204,21' : '200,160,255',
        });
      }
    }
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
