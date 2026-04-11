import { SWIPE_THRESHOLD } from '../configs/constants.js';

/**
 * Handles keyboard and swipe/pointer input, translating them into direction callbacks.
 * No Phaser dependency beyond the scene's input system.
 */
export class InputManager {
  /** @type {Phaser.Scene} */
  #scene;

  /** @type {number} */
  #pointerStartX = 0;

  /** @type {number} */
  #pointerStartY = 0;

  /** @type {boolean} */
  #skipNextPointerUp = false;

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

  /** Set to true to skip the next pointer-up event (e.g. after modal button tap). */
  set skipNextPointerUp(value) {
    this.#skipNextPointerUp = value;
  }

  /** Register keyboard and touch listeners. */
  bind() {
    this.#scene.input.keyboard.on('keydown', this.#handleKey, this);
    // Use native window touch events so tiles drawn as DOM elements above the
    // Phaser canvas do not swallow the events before Phaser sees them.
    // passive:false lets us call preventDefault() to block browser scroll.
    window.addEventListener('touchstart', this.#onTouchStart, { passive: false });
    window.addEventListener('touchend', this.#onTouchEnd, { passive: false });
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
    e.preventDefault();
    this.#pointerStartX = e.touches[0].clientX;
    this.#pointerStartY = e.touches[0].clientY;
  };

  /** @param {TouchEvent} e */
  #onTouchEnd = (e) => {
    e.preventDefault();
    if (this.#skipNextPointerUp) {
      this.#skipNextPointerUp = false;
      if (e.changedTouches.length > 0) {
        this.#pointerStartX = e.changedTouches[0].clientX;
        this.#pointerStartY = e.changedTouches[0].clientY;
      }
      return;
    }
    if (this.#isBlocked()) return;
    if (e.changedTouches.length === 0) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.#pointerStartX;
    const dy = touch.clientY - this.#pointerStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

    /** @type {'up' | 'down' | 'left' | 'right'} */
    const direction = absDx > absDy ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.#onDirection(direction);
  };

  /** Cleanup listeners. */
  shutdown() {
    this.#scene.input.keyboard?.off('keydown', this.#handleKey, this);
    window.removeEventListener('touchstart', this.#onTouchStart);
    window.removeEventListener('touchend', this.#onTouchEnd);
  }
}
