/**
 * Enable keyboard navigation on focusable elements within a container.
 * Arrow Up/Down cycle through items, Enter/Space activates.
 * Mouse pointer movement clears keyboard focus so hover animations work
 * normally; arrow keys re-enable keyboard focus.
 *
 * @param {HTMLElement} container - The container to scope focus within
 * @param {Phaser.Input.Keyboard.KeyboardPlugin} keyboard - Phaser keyboard plugin
 * @param {{ onEscape?: Function, gridColumns?: number }} [options]
 * @returns {{ destroy: () => void }}
 */
export function enableKeyboardNav(container, keyboard, options = {}) {
  const SELECTOR =
    'button:not([disabled]), [data-action], .fm-power-item, .fm-ranking-tab';
  const { gridColumns } = options;

  /** Whether the last input was the mouse (suppresses auto-focus). */
  let usingMouse = false;

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

  /** Blur keyboard-focused item so CSS :hover works unobstructed. */
  const onPointerMove = () => {
    if (usingMouse) return;
    usingMouse = true;
    const items = getFocusable();
    const active = document.activeElement;
    if (active && items.includes(/** @type {HTMLElement} */ (active))) {
      active.blur();
    }
  };
  container.addEventListener('pointermove', onPointerMove, { passive: true });

  /** @param {KeyboardEvent} event */
  const handler = (event) => {
    const items = getFocusable();
    if (items.length === 0) return;

    const active = document.activeElement;
    const idx = items.indexOf(/** @type {HTMLElement} */ (active));

    switch (event.code) {
      case 'ArrowDown': {
        event.preventDefault?.();
        usingMouse = false;
        const isGridItemDown = gridColumns && active?.classList?.contains('fm-power-item');
        if (isGridItemDown) {
          const powerItems = items.filter((i) => i.classList.contains('fm-power-item'));
          const pidx = powerItems.indexOf(/** @type {HTMLElement} */ (active));
          const next = pidx + gridColumns;
          if (next < powerItems.length) {
            powerItems[next].focus();
          } else {
            // Last row of power grid — move on to the next focusable item (e.g. Start/Cancel buttons)
            focusIndex(items, idx + 1);
          }
        } else {
          focusIndex(items, idx + 1);
        }
        break;
      }
      case 'ArrowRight': {
        event.preventDefault?.();
        usingMouse = false;
        focusIndex(items, idx + 1);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault?.();
        usingMouse = false;
        const isGridItemUp = gridColumns && active?.classList?.contains('fm-power-item');
        if (isGridItemUp) {
          const powerItems = items.filter((i) => i.classList.contains('fm-power-item'));
          const pidx = powerItems.indexOf(/** @type {HTMLElement} */ (active));
          const prev = pidx - gridColumns;
          if (prev >= 0) {
            powerItems[prev].focus();
          } else {
            // First row of power grid — move back to the preceding focusable item
            focusIndex(items, idx <= 0 ? items.length - 1 : idx - 1);
          }
        } else {
          focusIndex(items, idx <= 0 ? items.length - 1 : idx - 1);
        }
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault?.();
        usingMouse = false;
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
      container.removeEventListener('pointermove', onPointerMove);
    },
  };
}
