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

  /** Register keyboard and pointer listeners. */
  bind() {
    this.#scene.input.keyboard.on('keydown', this.#handleKey, this);
    this.#scene.input.on('pointerdown', this.#onPointerDown, this);
    this.#scene.input.on('pointerup', this.#onPointerUp, this);
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

  /** @param {Phaser.Input.Pointer} pointer */
  #onPointerDown = (pointer) => {
    if (!pointer.wasTouch) return; // desktop mouse: swipe disabled, keyboard only
    this.#pointerStartX = pointer.x;
    this.#pointerStartY = pointer.y;
  };

  /** @param {Phaser.Input.Pointer} pointer */
  #onPointerUp = (pointer) => {
    if (!pointer.wasTouch) return; // desktop mouse: swipe disabled, keyboard only
    if (this.#skipNextPointerUp) {
      this.#skipNextPointerUp = false;
      this.#pointerStartX = pointer.x;
      this.#pointerStartY = pointer.y;
      return;
    }
    if (this.#isBlocked()) return;

    const dx = pointer.x - this.#pointerStartX;
    const dy = pointer.y - this.#pointerStartY;
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
    this.#scene.input?.off('pointerdown', this.#onPointerDown, this);
    this.#scene.input?.off('pointerup', this.#onPointerUp, this);
  }
}
