// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enableKeyboardNav } from '../../src/utils/keyboard-nav.js';

describe('enableKeyboardNav', () => {
  /** @type {HTMLElement} */
  let container;

  /** @type {{ on: Function, off: Function }} */
  let keyboard;

  /** @type {Function | null} */
  let registeredHandler;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <button data-action="a" id="btn-a">A</button>
      <button data-action="b" id="btn-b">B</button>
      <button data-action="c" id="btn-c">C</button>
    `;
    document.body.appendChild(container);
    registeredHandler = null;
    keyboard = {
      on: vi.fn((event, handler) => { registeredHandler = handler; }),
      off: vi.fn(),
    };
  });

  function fireKey(code) {
    const event = { code, preventDefault: vi.fn() };
    registeredHandler?.(event);
  }

  it('registers a keydown handler', () => {
    enableKeyboardNav(container, keyboard);
    expect(keyboard.on).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('focuses first item on init', () => {
    enableKeyboardNav(container, keyboard);
    expect(document.activeElement?.id).toBe('btn-a');
  });

  it('ArrowDown moves focus to next item', () => {
    enableKeyboardNav(container, keyboard);
    fireKey('ArrowDown');
    expect(document.activeElement?.id).toBe('btn-b');
  });

  it('ArrowUp wraps to last item from first', () => {
    enableKeyboardNav(container, keyboard);
    fireKey('ArrowUp');
    expect(document.activeElement?.id).toBe('btn-c');
  });

  it('ArrowDown wraps from last to first', () => {
    enableKeyboardNav(container, keyboard);
    fireKey('ArrowDown'); // -> B
    fireKey('ArrowDown'); // -> C
    fireKey('ArrowDown'); // -> A
    expect(document.activeElement?.id).toBe('btn-a');
  });

  it('Enter dispatches pointerdown on focused element', () => {
    enableKeyboardNav(container, keyboard);
    const btnA = container.querySelector('#btn-a');
    const spy = vi.fn();
    btnA.addEventListener('pointerdown', spy);
    fireKey('Enter');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Space dispatches pointerdown on focused element', () => {
    enableKeyboardNav(container, keyboard);
    fireKey('ArrowDown'); // focus B
    const btnB = container.querySelector('#btn-b');
    const spy = vi.fn();
    btnB.addEventListener('pointerdown', spy);
    fireKey('Space');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Escape calls onEscape callback', () => {
    const onEscape = vi.fn();
    enableKeyboardNav(container, keyboard, { onEscape });
    fireKey('Escape');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('destroy removes the keydown handler', () => {
    const nav = enableKeyboardNav(container, keyboard);
    nav.destroy();
    expect(keyboard.off).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('skips disabled buttons', () => {
    container.querySelector('#btn-b').setAttribute('disabled', '');
    enableKeyboardNav(container, keyboard);
    // First focusable is A, next should be C (skipping disabled B)
    fireKey('ArrowDown');
    expect(document.activeElement?.id).toBe('btn-c');
  });
});
