// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SWIPE_THRESHOLD } from '../../src/configs/constants.js';

/* ------------------------------------------------------------------ */
/*  Helpers — simulate the Phaser.Scene keyboard API + touch events   */
/* ------------------------------------------------------------------ */

function createMockScene() {
  const keydownHandlers = [];
  return {
    input: {
      keyboard: {
        on(event, handler, ctx) {
          keydownHandlers.push({ handler, ctx });
        },
        off(event, handler, ctx) {
          const idx = keydownHandlers.findIndex((h) => h.handler === handler && h.ctx === ctx);
          if (idx !== -1) keydownHandlers.splice(idx, 1);
        },
        /** Fire a synthetic keydown on all registered handlers. */
        _fire(code) {
          const event = { code, preventDefault: vi.fn() };
          for (const { handler, ctx } of keydownHandlers) handler.call(ctx, event);
          return event;
        },
      },
    },
  };
}

/** Build a minimal TouchEvent-like object dispatched on window. */
function fireTouchEvent(type, touches, changedTouches, target) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  ev.touches = touches ?? [];
  ev.changedTouches = changedTouches ?? touches ?? [];
  if (target) {
    Object.defineProperty(ev, 'target', { value: target, writable: false });
  }
  window.dispatchEvent(ev);
  return ev;
}

/** Shorthand: a single-finger touch object. */
function touch(id, clientX, clientY) {
  return { identifier: id, clientX, clientY };
}

/** Simulate a complete swipe gesture (start → move → end). */
function simulateSwipe(id, startX, startY, endX, endY, target) {
  fireTouchEvent(
    'touchstart',
    [touch(id, startX, startY)],
    [touch(id, startX, startY)],
    target ?? document.body,
  );
  fireTouchEvent('touchmove', [touch(id, endX, endY)], [touch(id, endX, endY)]);
  fireTouchEvent('touchend', [], [touch(id, endX, endY)]);
}

/** Simulate start + move (no end). */
function simulateSwipeNoEnd(id, startX, startY, endX, endY, target) {
  fireTouchEvent(
    'touchstart',
    [touch(id, startX, startY)],
    [touch(id, startX, startY)],
    target ?? document.body,
  );
  fireTouchEvent('touchmove', [touch(id, endX, endY)], [touch(id, endX, endY)]);
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                         */
/* ------------------------------------------------------------------ */

let InputManager;
let scene;
let onDirection;
let onMenu;
let isBlocked;
let manager;

beforeEach(async () => {
  // Dynamic import to avoid module-level side-effects between tests.
  const mod = await import('../../src/managers/input-manager.js');
  InputManager = mod.InputManager;

  scene = createMockScene();
  onDirection = vi.fn();
  onMenu = vi.fn();
  isBlocked = vi.fn(() => false);

  manager = new InputManager(scene, { onDirection, onMenu, isBlocked });
  manager.bind();

  return () => manager.shutdown();
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Keyboard                                                          */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Keyboard input', () => {
  it('fires direction for arrow keys', () => {
    scene.input.keyboard._fire('ArrowUp');
    expect(onDirection).toHaveBeenCalledWith('up');

    scene.input.keyboard._fire('ArrowDown');
    expect(onDirection).toHaveBeenCalledWith('down');

    scene.input.keyboard._fire('ArrowLeft');
    expect(onDirection).toHaveBeenCalledWith('left');

    scene.input.keyboard._fire('ArrowRight');
    expect(onDirection).toHaveBeenCalledWith('right');
  });

  it('fires direction for WASD keys', () => {
    scene.input.keyboard._fire('KeyW');
    expect(onDirection).toHaveBeenCalledWith('up');

    scene.input.keyboard._fire('KeyS');
    expect(onDirection).toHaveBeenCalledWith('down');

    scene.input.keyboard._fire('KeyA');
    expect(onDirection).toHaveBeenCalledWith('left');

    scene.input.keyboard._fire('KeyD');
    expect(onDirection).toHaveBeenCalledWith('right');
  });

  it('fires onMenu for Escape', () => {
    scene.input.keyboard._fire('Escape');
    expect(onMenu).toHaveBeenCalled();
    expect(onDirection).not.toHaveBeenCalled();
  });

  it('does not fire when blocked', () => {
    isBlocked.mockReturnValue(true);
    scene.input.keyboard._fire('ArrowUp');
    expect(onDirection).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys', () => {
    scene.input.keyboard._fire('Space');
    expect(onDirection).not.toHaveBeenCalled();
    expect(onMenu).not.toHaveBeenCalled();
  });

  it('calls preventDefault on direction keys', () => {
    const ev = scene.input.keyboard._fire('ArrowRight');
    expect(ev.preventDefault).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Swipe — detect-on-move                                            */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Swipe detection — detect-on-move', () => {
  const T = SWIPE_THRESHOLD;

  it('fires direction on touchmove when threshold is crossed (right)', () => {
    simulateSwipeNoEnd(1, 100, 200, 100 + T, 200);
    expect(onDirection).toHaveBeenCalledWith('right');
    expect(onDirection).toHaveBeenCalledTimes(1);
  });

  it('fires direction on touchmove when threshold is crossed (left)', () => {
    simulateSwipeNoEnd(1, 100, 200, 100 - T, 200);
    expect(onDirection).toHaveBeenCalledWith('left');
  });

  it('fires direction on touchmove when threshold is crossed (down)', () => {
    simulateSwipeNoEnd(1, 100, 200, 100, 200 + T);
    expect(onDirection).toHaveBeenCalledWith('down');
  });

  it('fires direction on touchmove when threshold is crossed (up)', () => {
    simulateSwipeNoEnd(1, 100, 200, 100, 200 - T);
    expect(onDirection).toHaveBeenCalledWith('up');
  });

  it('does not fire when displacement is below threshold', () => {
    simulateSwipeNoEnd(1, 100, 200, 100 + T - 1, 200);
    expect(onDirection).not.toHaveBeenCalled();
  });

  it('picks dominant axis when both axes have displacement', () => {
    // dx = T+5, dy = 5 → horizontal dominant → right
    simulateSwipeNoEnd(1, 100, 200, 100 + T + 5, 205);
    expect(onDirection).toHaveBeenCalledWith('right');
  });

  it('picks vertical when dy > dx', () => {
    // dx = 5, dy = T+5 → vertical dominant → down
    simulateSwipeNoEnd(1, 100, 200, 105, 200 + T + 5);
    expect(onDirection).toHaveBeenCalledWith('down');
  });

  it('picks horizontal when dx == dy (>= favors horizontal)', () => {
    // Equal displacement — absDx >= absDy → horizontal
    simulateSwipeNoEnd(1, 100, 200, 100 + T, 200 + T);
    expect(onDirection).toHaveBeenCalledWith('right');
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  One direction per gesture                                          */
/* ═══════════════════════════════════════════════════════════════════ */

describe('One direction per gesture', () => {
  const T = SWIPE_THRESHOLD;

  it('fires only once per gesture even with multiple touchmove events', () => {
    fireTouchEvent('touchstart', [touch(1, 100, 200)], [touch(1, 100, 200)], document.body);
    // First move crosses threshold
    fireTouchEvent('touchmove', [touch(1, 100 + T, 200)], [touch(1, 100 + T, 200)]);
    // Second move goes further
    fireTouchEvent('touchmove', [touch(1, 100 + T * 2, 200)], [touch(1, 100 + T * 2, 200)]);
    // Third move
    fireTouchEvent('touchmove', [touch(1, 100 + T * 3, 200)], [touch(1, 100 + T * 3, 200)]);

    expect(onDirection).toHaveBeenCalledTimes(1);
    expect(onDirection).toHaveBeenCalledWith('right');
  });

  it('allows a new direction after a full gesture cycle (end + new start)', () => {
    // First swipe: right
    simulateSwipe(1, 100, 200, 100 + T, 200);
    expect(onDirection).toHaveBeenCalledWith('right');

    // Second swipe: down (new gesture)
    simulateSwipe(2, 100, 200, 100, 200 + T);
    expect(onDirection).toHaveBeenCalledWith('down');
    expect(onDirection).toHaveBeenCalledTimes(2);
  });

  it('allows rapid successive legitimate swipes with no cooldown', () => {
    // Three swipes in quick succession — all should fire.
    simulateSwipe(1, 100, 200, 100 + T, 200);
    simulateSwipe(2, 100, 200, 100, 200 + T);
    simulateSwipe(3, 100, 200, 100 - T, 200);

    expect(onDirection).toHaveBeenCalledTimes(3);
    expect(onDirection).toHaveBeenNthCalledWith(1, 'right');
    expect(onDirection).toHaveBeenNthCalledWith(2, 'down');
    expect(onDirection).toHaveBeenNthCalledWith(3, 'left');
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Ghost event protection                                             */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Ghost event protection', () => {
  const T = SWIPE_THRESHOLD;

  it('ghost cycle with zero displacement does not fire', () => {
    // Real swipe
    simulateSwipe(1, 100, 200, 100 + T + 10, 200);
    expect(onDirection).toHaveBeenCalledTimes(1);

    // Ghost cycle: start/move/end at the same point (the lift position)
    const liftX = 100 + T + 10;
    const liftY = 200;
    fireTouchEvent('touchstart', [touch(2, liftX, liftY)], [touch(2, liftX, liftY)], document.body);
    fireTouchEvent('touchmove', [touch(2, liftX, liftY)], [touch(2, liftX, liftY)]);
    fireTouchEvent('touchend', [], [touch(2, liftX, liftY)]);

    // Still only 1 call — ghost was silenced
    expect(onDirection).toHaveBeenCalledTimes(1);
  });

  it('ghost cycle with near-zero displacement does not fire', () => {
    simulateSwipe(1, 100, 200, 100 + T + 10, 200);
    expect(onDirection).toHaveBeenCalledTimes(1);

    // Ghost with tiny jitter (< threshold)
    fireTouchEvent('touchstart', [touch(2, 140, 200)], [touch(2, 140, 200)], document.body);
    fireTouchEvent('touchmove', [touch(2, 142, 201)], [touch(2, 142, 201)]);
    fireTouchEvent('touchend', [], [touch(2, 142, 201)]);

    expect(onDirection).toHaveBeenCalledTimes(1);
  });

  it('ghost touchend without prior touchstart does not fire', () => {
    // Orphan touchend with no matching touchstart
    fireTouchEvent('touchend', [], [touch(99, 200, 200)]);
    expect(onDirection).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Touchend fallback (throttled touchmove edge case)                  */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Touchend fallback for flick gestures', () => {
  const T = SWIPE_THRESHOLD;

  it('fires on touchend if touchmove never crossed the threshold', () => {
    // touchstart at origin
    fireTouchEvent('touchstart', [touch(1, 100, 200)], [touch(1, 100, 200)], document.body);
    // touchmove reports small displacement (browser throttled)
    fireTouchEvent('touchmove', [touch(1, 105, 200)], [touch(1, 105, 200)]);
    // touchend reports full displacement (finger actually moved far)
    fireTouchEvent('touchend', [], [touch(1, 100 + T + 10, 200)]);

    expect(onDirection).toHaveBeenCalledWith('right');
    expect(onDirection).toHaveBeenCalledTimes(1);
  });

  it('does not double-fire on touchend if touchmove already fired', () => {
    fireTouchEvent('touchstart', [touch(1, 100, 200)], [touch(1, 100, 200)], document.body);
    // touchmove crosses threshold → fires
    fireTouchEvent('touchmove', [touch(1, 100 + T, 200)], [touch(1, 100 + T, 200)]);
    expect(onDirection).toHaveBeenCalledTimes(1);

    // touchend — should NOT fire again
    fireTouchEvent('touchend', [], [touch(1, 100 + T + 20, 200)]);
    expect(onDirection).toHaveBeenCalledTimes(1);
  });

  it('touchend fallback respects isBlocked', () => {
    fireTouchEvent('touchstart', [touch(1, 100, 200)], [touch(1, 100, 200)], document.body);
    // No touchmove crosses threshold
    isBlocked.mockReturnValue(true);
    fireTouchEvent('touchend', [], [touch(1, 100 + T + 10, 200)]);
    expect(onDirection).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Blocked state                                                      */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Blocked state (modals, game over)', () => {
  const T = SWIPE_THRESHOLD;

  it('does not fire direction when blocked', () => {
    isBlocked.mockReturnValue(true);
    simulateSwipe(1, 100, 200, 100 + T + 10, 200);
    expect(onDirection).not.toHaveBeenCalled();
  });

  it('consumes the gesture even when blocked (no re-fire on continued move)', () => {
    isBlocked.mockReturnValue(true);

    fireTouchEvent('touchstart', [touch(1, 100, 200)], [touch(1, 100, 200)], document.body);
    // Crosses threshold while blocked — consumed but not fired
    fireTouchEvent('touchmove', [touch(1, 100 + T, 200)], [touch(1, 100 + T, 200)]);
    expect(onDirection).not.toHaveBeenCalled();

    // Unblock mid-gesture
    isBlocked.mockReturnValue(false);

    // Further movement should NOT fire (gesture already consumed)
    fireTouchEvent('touchmove', [touch(1, 100 + T * 2, 200)], [touch(1, 100 + T * 2, 200)]);
    expect(onDirection).not.toHaveBeenCalled();
  });

  it('fires on the NEXT gesture after unblocking', () => {
    isBlocked.mockReturnValue(true);
    simulateSwipe(1, 100, 200, 100 + T + 10, 200);
    expect(onDirection).not.toHaveBeenCalled();

    isBlocked.mockReturnValue(false);
    simulateSwipe(2, 100, 200, 100, 200 + T + 10);
    expect(onDirection).toHaveBeenCalledWith('down');
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Interactive UI filtering                                           */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Interactive UI filtering', () => {
  const T = SWIPE_THRESHOLD;

  it('ignores swipes that start on a button', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    simulateSwipe(1, 100, 200, 100 + T + 10, 200, btn);
    expect(onDirection).not.toHaveBeenCalled();

    document.body.removeChild(btn);
  });

  it('ignores swipes that start inside .fm-modal-overlay', () => {
    const overlay = document.createElement('div');
    overlay.className = 'fm-modal-overlay';
    const child = document.createElement('span');
    overlay.appendChild(child);
    document.body.appendChild(overlay);

    simulateSwipe(1, 100, 200, 100 + T + 10, 200, child);
    expect(onDirection).not.toHaveBeenCalled();

    document.body.removeChild(overlay);
  });

  it('ignores swipes that start on .fm-btn', () => {
    const btn = document.createElement('div');
    btn.className = 'fm-btn';
    document.body.appendChild(btn);

    simulateSwipe(1, 100, 200, 100 + T + 10, 200, btn);
    expect(onDirection).not.toHaveBeenCalled();

    document.body.removeChild(btn);
  });

  it('accepts swipes on non-interactive elements', () => {
    const div = document.createElement('div');
    div.className = 'game-board';
    document.body.appendChild(div);

    simulateSwipe(1, 100, 200, 100 + T + 10, 200, div);
    expect(onDirection).toHaveBeenCalledWith('right');

    document.body.removeChild(div);
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Multi-touch                                                        */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Multi-touch handling', () => {
  const T = SWIPE_THRESHOLD;

  it('invalidates gesture when a second finger touches', () => {
    // Start with one finger
    fireTouchEvent('touchstart', [touch(1, 100, 200)], [touch(1, 100, 200)], document.body);

    // Second finger arrives — two touches now
    fireTouchEvent(
      'touchstart',
      [touch(1, 100, 200), touch(2, 300, 300)],
      [touch(2, 300, 300)],
      document.body,
    );

    // Move first finger past threshold
    fireTouchEvent('touchmove', [touch(1, 100 + T + 10, 200)], [touch(1, 100 + T + 10, 200)]);

    // Should not fire — gesture was invalidated
    expect(onDirection).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Touch cancel                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Touch cancel', () => {
  const T = SWIPE_THRESHOLD;

  it('resets gesture state on touchcancel', () => {
    fireTouchEvent('touchstart', [touch(1, 100, 200)], [touch(1, 100, 200)], document.body);

    // Cancel before threshold crossed
    fireTouchEvent('touchcancel', [], [touch(1, 105, 200)]);

    // Subsequent touchmove should not fire (no active gesture)
    fireTouchEvent('touchmove', [touch(1, 100 + T + 10, 200)], [touch(1, 100 + T + 10, 200)]);
    expect(onDirection).not.toHaveBeenCalled();
  });

  it('allows new gesture after cancel', () => {
    fireTouchEvent('touchstart', [touch(1, 100, 200)], [touch(1, 100, 200)], document.body);
    fireTouchEvent('touchcancel', [], [touch(1, 100, 200)]);

    // New gesture should work
    simulateSwipe(2, 100, 200, 100 + T + 10, 200);
    expect(onDirection).toHaveBeenCalledWith('right');
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Shutdown                                                           */
/* ═══════════════════════════════════════════════════════════════════ */

describe('Shutdown', () => {
  const T = SWIPE_THRESHOLD;

  it('removes all listeners after shutdown', () => {
    manager.shutdown();

    simulateSwipe(1, 100, 200, 100 + T + 10, 200);
    expect(onDirection).not.toHaveBeenCalled();

    scene.input.keyboard._fire('ArrowUp');
    expect(onDirection).not.toHaveBeenCalled();
  });
});
