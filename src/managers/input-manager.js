import { SWIPE_THRESHOLD, SWIPE_COOLDOWN, SWIPE_MAX_DURATION } from '../configs/constants.js';

/**
 * Handles keyboard and swipe/pointer input, translating them into direction
 * callbacks for the game grid.
 *
 * Touch listeners are registered on `window` but only act on touches that
 * start outside interactive UI (buttons, modals, scrollable containers).
 * When a touch starts on UI, the manager steps aside entirely — no
 * `preventDefault`, no swipe tracking — so native scroll, button taps, and
 * modal interactions work naturally on mobile.
 *
 * A cooldown between accepted swipes and a maximum swipe duration prevent
 * accidental rapid-fire moves and stale gestures.
 */
export class InputManager {
  /** @type {Phaser.Scene} */
  #scene;

  /** @type {number} */
  #pointerStartX = 0;

  /** @type {number} */
  #pointerStartY = 0;

  /** @type {number} Timestamp (ms) of the current touchstart */
  #pointerStartTime = 0;

  /** @type {number} Timestamp (ms) of the last accepted swipe */
  #lastSwipeTime = 0;

  /** @type {boolean} True when the current touch started on an interactive element */
  #touchOnUI = false;

  /** @type {(direction: 'up'|'down'|'left'|'right') => void} */
  #onDirection;

  /** @type {() => void} */
  #onMenu;

  /** @type {() => boolean} */
  #isBlocked;

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
  }

  /**
   * Returns true if the touch target is an interactive UI element that should
   * keep its native behaviour (buttons, modals, scrollable containers).
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

  /** @param {TouchEvent} e */
  #onTouchStart = (e) => {
    if (e.touches.length !== 1) return;

    const target = /** @type {HTMLElement} */ (e.target);

    // If the touch started on an interactive element, let the browser handle it
    // natively (buttons, modals with scroll, etc.) — no preventDefault, no tracking.
    if (this.#isInteractiveTarget(target)) {
      this.#touchOnUI = true;
      return;
    }

    this.#touchOnUI = false;
    // Prevent default within the game zone to avoid 300 ms tap delay,
    // text selection, and browser scroll during swipes.
    e.preventDefault();
    this.#pointerStartX = e.touches[0].clientX;
    this.#pointerStartY = e.touches[0].clientY;
    this.#pointerStartTime = performance.now();
  };

  /** @param {TouchEvent} e */
  #onTouchMove = (e) => {
    // Only suppress scroll/zoom when the touch is a game swipe, not on UI.
    if (!this.#touchOnUI) {
      e.preventDefault();
    }
  };

  /** @param {TouchEvent} e */
  #onTouchEnd = (e) => {
    if (this.#touchOnUI) {
      this.#touchOnUI = false;
      return;
    }

    e.preventDefault();
    if (this.#isBlocked()) return;
    if (e.changedTouches.length === 0) return;

    // Enforce cooldown between accepted moves
    const now = performance.now();
    if (now - this.#lastSwipeTime < SWIPE_COOLDOWN) return;

    // Reject swipes that took too long (finger resting then lifting)
    if (now - this.#pointerStartTime > SWIPE_MAX_DURATION) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.#pointerStartX;
    const dy = touch.clientY - this.#pointerStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

    /** @type {'up' | 'down' | 'left' | 'right'} */
    const direction = absDx > absDy ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.#lastSwipeTime = now;
    this.#onDirection(direction);
  };

  /** Cleanup listeners. */
  shutdown() {
    this.#scene.input.keyboard?.off('keydown', this.#handleKey, this);
    window.removeEventListener('touchstart', this.#onTouchStart);
    window.removeEventListener('touchmove', this.#onTouchMove);
    window.removeEventListener('touchend', this.#onTouchEnd);
  }
}
