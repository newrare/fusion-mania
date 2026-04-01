/**
 * Enable keyboard navigation on focusable elements within a container.
 * Arrow Up/Down cycle through items, Enter/Space activates.
 *
 * @param {HTMLElement} container - The container to scope focus within
 * @param {Phaser.Input.Keyboard.KeyboardPlugin} keyboard - Phaser keyboard plugin
 * @param {{ onEscape?: Function }} [options]
 * @returns {{ destroy: () => void }}
 */
export function enableKeyboardNav(container, keyboard, options = {}) {
  const SELECTOR = 'button:not([disabled]), [data-action], .fm-power-item, .fm-power-choice-item, .fm-ranking-tab';

  /** @returns {HTMLElement[]} */
  function getFocusable() {
    return [...container.querySelectorAll(SELECTOR)].filter(
      (el) => !el.disabled && !el.closest('[style*="display:none"], [style*="display: none"]'),
    );
  }

  function focusIndex(items, index) {
    const i = ((index % items.length) + items.length) % items.length;
    items[i]?.focus();
  }

  /** @param {KeyboardEvent} event */
  const handler = (event) => {
    const items = getFocusable();
    if (items.length === 0) return;

    const active = document.activeElement;
    const idx = items.indexOf(/** @type {HTMLElement} */ (active));

    switch (event.code) {
      case 'ArrowDown':
      case 'ArrowRight': {
        event.preventDefault?.();
        focusIndex(items, idx + 1);
        break;
      }
      case 'ArrowUp':
      case 'ArrowLeft': {
        event.preventDefault?.();
        focusIndex(items, idx <= 0 ? items.length - 1 : idx - 1);
        break;
      }
      case 'Enter':
      case 'Space': {
        if (active && items.includes(/** @type {HTMLElement} */ (active))) {
          event.preventDefault?.();
          active.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        }
        break;
      }
      case 'Escape': {
        options.onEscape?.();
        break;
      }
    }
  };

  keyboard.on('keydown', handler);

  // Auto-focus first item
  const initial = getFocusable();
  if (initial.length > 0) initial[0].focus();

  return {
    destroy() {
      keyboard.off('keydown', handler);
    },
  };
}
