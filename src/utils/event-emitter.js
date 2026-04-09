/**
 * Lightweight pub/sub event emitter for cross-module communication.
 *
 * @example
 * import { gameEvents } from '../utils/event-emitter.js';
 * gameEvents.on('score:changed', (score) => console.log(score));
 * gameEvents.emit('score:changed', 42);
 */
export class EventEmitter {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();

  /**
   * Register a listener for an event.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Register a one-time listener that auto-removes after first call.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    wrapper._original = callback;
    return this.on(event, wrapper);
  }

  /**
   * Remove a specific listener, or all listeners for an event.
   * @param {string} event
   * @param {Function} [callback] — if omitted, removes all listeners for the event
   */
  off(event, callback) {
    if (!callback) {
      this.#listeners.delete(event);
      return;
    }
    const set = this.#listeners.get(event);
    if (!set) return;
    set.delete(callback);
    // Also remove `once` wrappers whose _original matches
    for (const fn of set) {
      if (fn._original === callback) {
        set.delete(fn);
      }
    }
    if (set.size === 0) this.#listeners.delete(event);
  }

  /**
   * Emit an event, calling all registered listeners with the provided arguments.
   * @param {string} event
   * @param {...*} args
   */
  emit(event, ...args) {
    const set = this.#listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      fn(...args);
    }
  }

  /** Remove all listeners for all events. */
  clear() {
    this.#listeners.clear();
  }
}

/** Global singleton for game-wide events. */
export const gameEvents = new EventEmitter();
