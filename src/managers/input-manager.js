import { SWIPE_THRESHOLD } from '../configs/constants.js';

/**
 * Handles keyboard and touch input for the game grid.
 *
 * Touch listeners live on `window`. Touches on interactive UI (buttons,
 * modals) are ignored so native behaviour (scroll, tap) works naturally.
 *
 * ## Swipe detection — detect-on-move architecture
 *
 * Direction fires during `touchmove` as soon as the finger has moved
 * ≥ `SWIPE_THRESHOLD` px from the start position. The gesture is then
 * **consumed** (`#fired = true`) and no further direction can fire until
 * a new `touchstart` begins.
 *
 * This replaces the previous touchend + time-lock approach and solves
 * the Android WebView / Capacitor ghost-event problem structurally:
 *
 * - Ghost touchstart/touchmove/touchend cycles report near-zero
 *   displacement from their synthetic start position → they never
 *   cross `SWIPE_THRESHOLD` → no false trigger.
 * - One-direction-per-gesture (flag-based, not time-based) means
 *   fast successive **legitimate** swipes work with zero artificial
 *   delay — the player can skip animations freely.
 * - Firing on move instead of end gives perceptibly faster response.
 */
export class InputManager {
  /** @type {Phaser.Scene} */
  #scene;

  /** @type {(direction: 'up'|'down'|'left'|'right') => void} */
  #onDirection;

  /** @type {() => void} */
  #onMenu;

  /** @type {() => boolean} */
  #isBlocked;

  // ── Gesture state ──────────────────────────────────────────────

  /** Touch identifier of the finger being tracked, or null. */
  #touchId = null;

  /** @type {number} */
  #startX = 0;

  /** @type {number} */
  #startY = 0;

  /**
   * True once a direction was emitted (or suppressed because the game
   * was blocked) for the current gesture. Prevents any further emission
   * until the finger lifts and a new touchstart begins.
   */
  #fired = false;

  /** True when the gesture began on an interactive UI element. */
  #touchOnUI = false;

  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   onDirection: (direction: 'up'|'down'|'left'|'right') => void,
   *   onMenu: () => void,
   *   isBlocked: () => boolean,
   * }} callbacks
   */
  constructor(scene, { onDirection, onMenu, isBlocked }) {
    this.#scene = scene;
    this.#onDirection = onDirection;
    this.#onMenu = onMenu;
    this.#isBlocked = isBlocked;
  }

  /** Register keyboard and touch listeners. */
  bind() {
    this.#scene.input.keyboard.on('keydown', this.#handleKey, this);
    window.addEventListener('touchstart', this.#onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.#onTouchMove, { passive: false });
    window.addEventListener('touchend', this.#onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this.#onTouchCancel, { passive: true });
  }

  /**
   * Returns true when the touch target is interactive UI that should keep
   * native behaviour (buttons, modals, scrollable containers).
   * @param {HTMLElement} el
   * @returns {boolean}
   */
  #isInteractiveTarget(el) {
    return !!el.closest(
      'button, a, .fm-btn, .fm-modal-overlay, .fm-menu-btn, .fm-mode-badge, ' +
        '.fm-clickable, .fm-enemy-area, [data-action]',
    );
  }

  /** @param {Phaser.Input.Keyboard.Key} event */
  #handleKey = (event) => {
    if (this.#isBlocked()) return;

    /** @type {'up' | 'down' | 'left' | 'right' | null} */
    let direction = null;
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        direction = 'up';
        break;
      case 'ArrowDown':
      case 'KeyS':
        direction = 'down';
        break;
      case 'ArrowLeft':
      case 'KeyA':
        direction = 'left';
        break;
      case 'ArrowRight':
      case 'KeyD':
        direction = 'right';
        break;
      case 'Escape':
        this.#onMenu();
        return;
    }
    if (direction) {
      event.preventDefault?.();
      this.#onDirection(direction);
    }
  };

  // ── Touch handlers ─────────────────────────────────────────────

  /** @param {TouchEvent} e */
  #onTouchStart = (e) => {
    // Multi-touch: invalidate current gesture entirely.
    if (e.touches.length !== 1) {
      this.#touchId = null;
      return;
    }

    const target = /** @type {HTMLElement} */ (e.target);
    if (this.#isInteractiveTarget(target)) {
      this.#touchOnUI = true;
      return;
    }

    this.#touchOnUI = false;
    this.#touchId = e.touches[0].identifier;
    this.#startX = e.touches[0].clientX;
    this.#startY = e.touches[0].clientY;
    this.#fired = false;
    e.preventDefault();
  };

  /** @param {TouchEvent} e */
  #onTouchMove = (e) => {
    if (this.#touchOnUI || this.#touchId === null || this.#fired) return;
    e.preventDefault();

    const touch = [...e.changedTouches].find((t) => t.identifier === this.#touchId);
    if (!touch) return;

    const dx = touch.clientX - this.#startX;
    const dy = touch.clientY - this.#startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Not enough displacement yet.
    if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

    // Gesture consumed — one direction per touch, regardless of blocked state.
    this.#fired = true;

    if (this.#isBlocked()) return;

    /** @type {'up' | 'down' | 'left' | 'right'} */
    const direction = absDx >= absDy ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';

    this.#onDirection(direction);
  };

  /** @param {TouchEvent} e */
  #onTouchEnd = (e) => {
    if (this.#touchOnUI) {
      this.#touchOnUI = false;
      return;
    }
    if (this.#touchId === null) return;

    const touch = [...e.changedTouches].find((t) => t.identifier === this.#touchId);
    if (!touch) return;

    // If the gesture never crossed the threshold during move, attempt
    // a final check at lift-off so that very short flick gestures still
    // register. This covers the edge case where touchmove events are
    // throttled by the browser and the finger lifts before a move event
    // reports the full displacement.
    if (!this.#fired) {
      const dx = touch.clientX - this.#startX;
      const dy = touch.clientY - this.#startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) >= SWIPE_THRESHOLD && !this.#isBlocked()) {
        /** @type {'up' | 'down' | 'left' | 'right'} */
        const direction = absDx >= absDy ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        this.#onDirection(direction);
      }

      this.#fired = true;
    }

    this.#touchId = null;
    e.preventDefault();
  };

  /**
   * Browser cancelled the touch (notification, gesture conflict).
   * @param {TouchEvent} e
   */
  #onTouchCancel = (e) => {
    if (this.#touchOnUI) {
      this.#touchOnUI = false;
      return;
    }
    if (this.#touchId !== null) {
      const cancelled = [...e.changedTouches].find((t) => t.identifier === this.#touchId);
      if (cancelled) {
        this.#touchId = null;
        this.#fired = false;
      }
    }
  };

  /** Cleanup listeners. */
  shutdown() {
    this.#scene.input.keyboard?.off('keydown', this.#handleKey, this);
    window.removeEventListener('touchstart', this.#onTouchStart);
    window.removeEventListener('touchmove', this.#onTouchMove);
    window.removeEventListener('touchend', this.#onTouchEnd);
    window.removeEventListener('touchcancel', this.#onTouchCancel);
  }
}
