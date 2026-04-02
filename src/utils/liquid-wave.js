/**
 * Canvas-based liquid wave renderer for HP bars.
 * Draws animated sine-wave surface with gradient fill and bubbles
 * inside a container element. The `level` property (0–1) controls
 * how high the liquid appears.
 *
 * Inspired by the Liquid Wave preview (docs/preview-wave.html).
 */

const WAVE_LAYERS = 2;
const BUBBLE_COUNT = 5;
const FPS_LIMIT = 40;
const MS_PER_FRAME = 1000 / FPS_LIMIT;

/* ── Shared RAF loop for all active instances ───────────── */

/** @type {Set<LiquidWave>} */
const activeInstances = new Set();
let rafId = 0;
let lastFrameTs = 0;

function loop(ts) {
  rafId = requestAnimationFrame(loop);
  const dt = ts - lastFrameTs;
  if (dt < MS_PER_FRAME) return;
  lastFrameTs = ts - (dt % MS_PER_FRAME);
  for (const inst of activeInstances) inst._tick(dt);
}

function ensureLoop() {
  if (rafId === 0) {
    rafId = requestAnimationFrame(loop);
  }
}

function maybeStopLoop() {
  if (activeInstances.size === 0 && rafId !== 0) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

/* ── Colour presets by HP category ──────────────────────── */

const COLOR_PRESETS = {
  info:    { c1: { r: 80, g: 160, b: 255 }, c2: { r: 30, g: 80, b: 180 } },
  warning: { c1: { r: 255, g: 180, b: 60 },  c2: { r: 200, g: 120, b: 0 } },
  danger:  { c1: { r: 255, g: 60, b: 60 },  c2: { r: 200, g: 20, b: 20 } },
};

export class LiquidWave {
  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {HTMLElement} */
  #container;

  #w = 0;
  #h = 0;
  #t = Math.random() * Math.PI * 2;
  #speed = 0.008;
  #level = 1; // 0 = empty, 1 = full
  #targetLevel = 1;

  #c1 = COLOR_PRESETS.info.c1;
  #c2 = COLOR_PRESETS.info.c2;
  #alpha = 0.55;

  /** @type {{amp: number, freq: number, phase: number, speed: number, alpha: number}[]} */
  #waves;
  /** @type {{x: number, y: number, r: number, vy: number}[]} */
  #bubbles;

  #resizeObserver;
  #destroyed = false;

  /**
   * @param {HTMLElement} container — the element to fill with the liquid canvas
   * @param {{ category?: string, alpha?: number, width?: number, height?: number }} [opts]
   */
  constructor(container, opts = {}) {
    this.#container = container;
    this.#alpha = opts.alpha ?? 0.55;

    // Create canvas
    this.#canvas = document.createElement('canvas');
    this.#canvas.className = 'fm-liquid-canvas';
    this.#ctx = this.#canvas.getContext('2d');
    container.appendChild(this.#canvas);

    // Set initial colours
    this.setCategory(opts.category ?? 'info');

    // Wave layers
    this.#waves = Array.from({ length: WAVE_LAYERS }, (_, i) => ({
      amp: 4 + Math.random() * 5,
      freq: 0.025 + Math.random() * 0.015,
      phase: Math.random() * Math.PI * 2,
      speed: (i === 0 ? 1 : -0.7) * (0.8 + Math.random() * 0.5),
      alpha: i === 0 ? 0.90 : 0.50,
    }));

    // Bubbles
    this.#bubbles = Array.from({ length: BUBBLE_COUNT }, () => this.#newBubble(true));

    // If explicit dimensions provided (element may not be visible yet), apply directly
    if (opts.width > 0 && opts.height > 0) {
      this.#applySize(opts.width, opts.height);
    } else {
      this.#resize();
    }

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(container);

    // Join the shared RAF loop
    activeInstances.add(this);
    ensureLoop();
  }

  /* ── Public API ───────────────────────────────────────── */

  /** Set the fill level (0 = empty, 1 = full). Lerps smoothly. */
  set level(v) {
    this.#targetLevel = Math.max(0, Math.min(1, v));
  }

  get level() {
    return this.#targetLevel;
  }

  /** Instantly snap to a level (no interpolation). */
  snapLevel(v) {
    this.#level = Math.max(0, Math.min(1, v));
    this.#targetLevel = this.#level;
  }

  /** Update colour preset by HP category. */
  setCategory(cat) {
    const preset = COLOR_PRESETS[cat] ?? COLOR_PRESETS.info;
    this.#c1 = preset.c1;
    this.#c2 = preset.c2;
  }

  /** Tear down canvas, observer, and RAF membership. */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    activeInstances.delete(this);
    maybeStopLoop();
    this.#resizeObserver.disconnect();
    this.#canvas.remove();
  }

  /* ── Internal ─────────────────────────────────────────── */

  /** @private called by the shared RAF loop */
  _tick(dt) {
    // Lerp level
    const diff = this.#targetLevel - this.#level;
    if (Math.abs(diff) > 0.001) {
      this.#level += diff * 0.06;
    } else {
      this.#level = this.#targetLevel;
    }

    this.#t += this.#speed * dt;
    this.#draw();
  }

  #resize() {
    /* offsetWidth/offsetHeight are synchronous and work even for absolute elements
       without a composited frame. */
    const w = this.#container.offsetWidth;
    const h = this.#container.offsetHeight;
    if (w === 0 || h === 0) return; // not yet laid out
    this.#applySize(w, h);
  }

  #applySize(w, h) {
    if (w === this.#w && h === this.#h) return;
    const dpr = window.devicePixelRatio || 1;
    this.#w = w;
    this.#h = h;
    this.#canvas.width = w * dpr;
    this.#canvas.height = h * dpr;
    this.#canvas.style.width = w + 'px';
    this.#canvas.style.height = h + 'px';
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  #newBubble(init = false) {
    return {
      x: 5 + Math.random() * Math.max(1, this.#w - 10),
      y: init ? (this.#h * 0.5 + Math.random() * this.#h * 0.5) : this.#h + 5,
      r: 1 + Math.random() * 3,
      vy: 0.2 + Math.random() * 0.5,
    };
  }

  #surfaceY(x, waveIndex) {
    const w = this.#waves[waveIndex];
    const baseY = this.#h * (1 - this.#level);
    return baseY + Math.sin(x * w.freq + this.#t * w.speed + w.phase) * w.amp;
  }

  #draw() {
    const ctx = this.#ctx;
    const W = this.#w;
    const H = this.#h;
    const c1 = this.#c1;
    const c2 = this.#c2;
    const baseAlpha = this.#alpha;
    if (W === 0 || H === 0) return;
    ctx.clearRect(0, 0, W, H);

    if (this.#level <= 0.001) return; // nothing to draw

    // Draw wave layers back-to-front
    for (let wi = WAVE_LAYERS - 1; wi >= 0; wi--) {
      const w = this.#waves[wi];

      ctx.beginPath();
      ctx.moveTo(0, this.#surfaceY(0, wi));
      for (let x = 1; x <= W; x++) {
        ctx.lineTo(x, this.#surfaceY(x, wi));
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();

      const surfMid = this.#surfaceY(W / 2, wi);
      const g = ctx.createLinearGradient(0, surfMid, 0, H);
      const a = w.alpha * baseAlpha;
      g.addColorStop(0, `rgba(${c1.r},${c1.g},${c1.b},${a.toFixed(2)})`);
      g.addColorStop(1, `rgba(${c2.r},${c2.g},${c2.b},${(a * 0.7).toFixed(2)})`);
      ctx.fillStyle = g;
      ctx.fill();

      // Surface highlight line
      ctx.beginPath();
      ctx.moveTo(0, this.#surfaceY(0, wi));
      for (let x = 1; x <= W; x++) {
        ctx.lineTo(x, this.#surfaceY(x, wi));
      }
      ctx.strokeStyle = `rgba(255,255,255,${(0.25 * w.alpha * baseAlpha).toFixed(2)})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Bubbles
    for (const b of this.#bubbles) {
      const maxY = this.#surfaceY(b.x, 0);
      b.y -= b.vy;

      if (b.y < maxY - b.r) {
        Object.assign(b, this.#newBubble());
        continue;
      }

      const dist = Math.max(0, (H - b.y) / H);
      const opacity = Math.min(dist * 3, 0.45);

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${opacity.toFixed(2)})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${(opacity * 0.7).toFixed(2)})`;
      ctx.fill();
    }
  }
}
