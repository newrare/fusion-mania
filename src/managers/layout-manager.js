import { GRID_SIZE } from '../configs/constants.js';

/** Minimum safe‑zone insets (fraction of viewport dimension) */
const MIN_SAFE_TOP = 0.05;
const MIN_SAFE_BOTTOM = 0.04;
const MIN_SAFE_SIDE = 0.03;

/** Grid occupies this fraction of safe‑area width */
const GRID_WIDTH_RATIO = 0.87;

/** Maximum grid width in px (avoids comically large grids on desktop) */
const MAX_GRID_WIDTH = 400;

/**
 * Maximum safe-zone width in px.
 * Based on the widest flagship phones available (2024-2026) in CSS px:
 * Samsung Galaxy S24 Ultra ~480 px, iPhone 16 Pro Max ~440 px.
 * On wider screens (tablet, desktop) the content column stays centered.
 */
const MAX_SAFE_WIDTH = 480;

class LayoutManager {
  /** Full viewport dimensions (= Phaser game size with Scale.RESIZE) */
  width = 0;
  height = 0;

  /**
   * Safe area — rectangle where gameplay elements should stay.
   * Accounts for device insets (notch, home bar) + minimum comfortable padding.
   */
  safe = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    cx: 0,
    cy: 0,
  };

  /** Computed grid metrics (recomputed on every resize) */
  grid = {
    tileSize: 0,
    gap: 0,
    padding: 0,
    totalWidth: 0,
    x: 0,
    y: 0,
  };

  /** @type {Set<Function>} */
  #listeners = new Set();

  /**
   * Recompute entire layout for the given viewport.
   * @param {number} w  Viewport width in CSS px
   * @param {number} h  Viewport height in CSS px
   */
  update(w, h) {
    this.width = w;
    this.height = h;

    // ─── Safe‑area insets ────────────────────────────
    // Read device insets exposed via CSS env() → custom properties
    const root = getComputedStyle(document.documentElement);
    const envTop = parseFloat(root.getPropertyValue('--sai-top')) || 0;
    const envBottom = parseFloat(root.getPropertyValue('--sai-bottom')) || 0;
    const envLeft = parseFloat(root.getPropertyValue('--sai-left')) || 0;
    const envRight = parseFloat(root.getPropertyValue('--sai-right')) || 0;

    const safeTop = Math.max(envTop, h * MIN_SAFE_TOP);
    const safeBottom = Math.max(envBottom, h * MIN_SAFE_BOTTOM);
    const safeLeft = Math.max(envLeft, w * MIN_SAFE_SIDE);
    const safeRight = Math.max(envRight, w * MIN_SAFE_SIDE);

    this.safe.top = safeTop;
    this.safe.bottom = h - safeBottom;

    // Cap the column width and center it in the viewport
    const rawSafeWidth = w - safeLeft - safeRight;
    const cappedWidth = Math.min(rawSafeWidth, MAX_SAFE_WIDTH);
    const columnLeft = (w - cappedWidth) / 2;
    const columnRight = columnLeft + cappedWidth;

    this.safe.left = columnLeft;
    this.safe.right = columnRight;
    this.safe.width = cappedWidth;
    this.safe.height = this.safe.bottom - this.safe.top;
    this.safe.cx = w / 2;
    this.safe.cy = this.safe.top + this.safe.height / 2;

    // ─── Grid metrics ────────────────────────────────
    const rawGridW = this.safe.width * GRID_WIDTH_RATIO;
    const gridW = Math.min(rawGridW, MAX_GRID_WIDTH);
    const gap = Math.round(gridW * 0.023);
    const padding = Math.round(gridW * 0.029);
    const tileSize = Math.floor((gridW - padding * 2 - gap * (GRID_SIZE - 1)) / GRID_SIZE);
    const totalWidth = tileSize * GRID_SIZE + gap * (GRID_SIZE - 1) + padding * 2;

    this.grid.tileSize = tileSize;
    this.grid.gap = gap;
    this.grid.padding = padding;
    this.grid.totalWidth = totalWidth;
    this.grid.x = this.safe.cx;
    this.grid.y = this.safe.cy;

    // ─── Push CSS custom properties ──────────────────
    const el = document.getElementById('game-container');
    if (el) {
      const baseFontSize = Math.round(tileSize * 0.3);
      el.style.setProperty('--fm-tile-size', `${tileSize}px`);
      el.style.setProperty('--fm-tile-font', `${baseFontSize}px`);
      el.style.setProperty('--fm-grid-gap', `${gap}px`);
      el.style.setProperty('--fm-grid-padding', `${padding}px`);
      el.style.setProperty('--fm-grid-width', `${totalWidth}px`);
      el.style.setProperty('--fm-safe-width', `${Math.round(this.safe.width)}px`);
    }
    // Mirror tile-size on body so DOM nodes appended outside #game-container
    // (enemy area, dead tiles) can inherit the same computed value.
    document.body.style.setProperty('--fm-tile-size', `${tileSize}px`);

    for (const cb of this.#listeners) cb();
  }

  /**
   * Draw the safe‑zone boundary as a debug overlay (DEV builds only).
   * @param {Phaser.Scene} scene
   */
  drawDebugSafeZone(scene) {
    if (!import.meta.env.DEV) return;

    const g = scene.add.graphics().setDepth(9999);

    // Dashed outline via short line segments
    g.lineStyle(2, 0x00ff00, 0.6);
    g.strokeRect(this.safe.left, this.safe.top, this.safe.width, this.safe.height);

    // Corner marks
    const m = 14;
    g.lineStyle(3, 0x00ff00, 0.9);
    const corners = [
      { x: this.safe.left, y: this.safe.top, dx: 1, dy: 1 },
      { x: this.safe.right, y: this.safe.top, dx: -1, dy: 1 },
      { x: this.safe.left, y: this.safe.bottom, dx: 1, dy: -1 },
      { x: this.safe.right, y: this.safe.bottom, dx: -1, dy: -1 },
    ];
    for (const c of corners) {
      g.lineBetween(c.x, c.y, c.x + m * c.dx, c.y);
      g.lineBetween(c.x, c.y, c.x, c.y + m * c.dy);
    }

    // Labels
    const style = {
      fontSize: '10px',
      color: '#00ff00',
      fontFamily: 'monospace',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 3, y: 1 },
    };

    scene.add.text(this.safe.left + 4, this.safe.top + 4, 'SAFE ZONE', style).setDepth(9999);

    const dim = `${Math.round(this.safe.width)} × ${Math.round(this.safe.height)}`;
    scene.add
      .text(this.safe.right - 4, this.safe.bottom - 4, dim, style)
      .setOrigin(1, 1)
      .setDepth(9999);

    const viewport = `viewport ${Math.round(this.width)} × ${Math.round(this.height)}`;
    scene.add
      .text(this.safe.right - 4, this.safe.top + 4, viewport, style)
      .setOrigin(1, 0)
      .setDepth(9999);
  }

  /**
   * Subscribe to layout changes (fired on every resize).
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this.#listeners.add(callback);
    return () => this.#listeners.delete(callback);
  }
}

export const layout = new LayoutManager();
