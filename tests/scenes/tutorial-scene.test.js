// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* ── Stub localStorage before any module import ─────────── */
const store = {};
const localStorageMock = {
  getItem: vi.fn((key) => store[key] ?? null),
  setItem: vi.fn((key, value) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) delete store[k];
  }),
};
vi.stubGlobal('localStorage', localStorageMock);

/* ── Stub Phaser to avoid canvas init in happy-dom ─────────── */
vi.mock('phaser', () => {
  class Scene {
    constructor(config) {
      this.sys = { config };
    }
  }
  return { default: { Scene } };
});

vi.mock('../../src/utils/background.js', () => ({
  addBackground: vi.fn(),
}));

vi.mock('../../src/managers/audio-manager.js', () => ({
  audioManager: { unlock: vi.fn() },
}));

/* InputManager stub — tests call onDirection directly. */
const inputHandles = { onDirection: null, onMenu: null, isBlocked: null };
vi.mock('../../src/managers/input-manager.js', () => ({
  InputManager: vi.fn().mockImplementation((_scene, callbacks) => {
    inputHandles.onDirection = callbacks.onDirection;
    inputHandles.onMenu = callbacks.onMenu;
    inputHandles.isBlocked = callbacks.isBlocked;
    return { bind: vi.fn(), shutdown: vi.fn() };
  }),
}));

/* GridManager stub — scriptable per test. */
const gridState = {
  executeResult: { moved: true, merges: [] },
  playFireAnimation: vi.fn(),
  removeTiles: vi.fn(),
};
vi.mock('../../src/managers/grid-manager.js', () => ({
  GridManager: vi.fn().mockImplementation(() => {
    const cells = Array.from({ length: 4 }, () => Array(4).fill(null));
    const grid = {
      cells,
      spawnTile: () => null,
      getAllTiles: () => cells.flat().filter(Boolean),
    };
    const tileElements = new Map();
    const gridEl = document.createElement('div');
    gridEl.className = 'fm-grid-mock';
    document.body.appendChild(gridEl);
    return {
      grid,
      tileElements,
      gridEl,
      animating: false,
      createContainer: vi.fn(),
      renderAllTiles: vi.fn(),
      executeMove: vi.fn(async () => gridState.executeResult),
      playFireAnimation: (...args) => gridState.playFireAnimation(...args),
      removeTiles: (...args) => gridState.removeTiles(...args),
    };
  }),
}));

vi.mock('../../src/components/tile-renderer.js', () => ({
  TileRenderer: { applyState: vi.fn() },
}));

const { TutorialScene } = await import('../../src/scenes/tutorial-scene.js');
const { SCENE_KEYS } = await import('../../src/configs/constants.js');
const { i18n } = await import('../../src/managers/i18n-manager.js');

function attachStubs(scene) {
  const sceneStart = vi.fn();
  scene.add = {
    dom: () => ({
      createFromHTML: (html) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
        return {
          node: wrapper,
          setOrigin: vi.fn(),
          setDepth: vi.fn(),
          destroy: () => wrapper.remove(),
        };
      },
    }),
  };
  scene.scene = { start: sceneStart };
  scene.time = {
    delayedCall: (_ms, cb) => cb(),
  };
  scene.events = { on: vi.fn() };
  scene.game = { domContainer: { style: {} } };
  return { sceneStart };
}

async function advanceStepWith(dirResult, dir = 'right') {
  gridState.executeResult = dirResult;
  await inputHandles.onDirection(dir);
  await new Promise((r) => setTimeout(r, 0));
}

/** Sends 4 distinct directional swipes to satisfy the new swipe step requirement. */
async function advanceSwipeStep() {
  for (const dir of ['up', 'down', 'left', 'right']) {
    await advanceStepWith({ moved: true, merges: [] }, dir);
  }
}

/**
 * Fires the fire-V direction (down), lets async ops settle, then dismisses the
 * aftermath banner with a pointerdown. Returns after the script fully completes.
 */
async function fireVAndDismiss() {
  const p = inputHandles.onDirection('down');
  await new Promise((r) => setTimeout(r, 0)); // let fire animation + aftermath show
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0)); // let advance happen
  await p;
}

describe('TutorialScene (scripted level-0)', () => {
  /** @type {TutorialScene} */
  let scene;
  /** @type {ReturnType<typeof attachStubs>} */
  let stubs;

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorageMock.clear();
    i18n.setLocale('en');
    gridState.executeResult = { moved: true, merges: [] };
    gridState.playFireAnimation.mockClear();
    gridState.removeTiles.mockClear();
    scene = new TutorialScene();
    stubs = attachStubs(scene);
    scene.create();
  });

  afterEach(() => scene.shutdown());

  it('declares the TUTORIAL scene key', () => {
    expect(SCENE_KEYS.TUTORIAL).toBe('TutorialScene');
  });

  it('renders the first step banner (swipe)', () => {
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_swipe_title'),
    );
    expect(document.querySelector('.fm-tuto-banner-hint').innerHTML).toBe(
      i18n.t('tuto.step_swipe_hint'),
    );
  });

  it('renders 6 progress dots with the first active', () => {
    const dots = document.querySelectorAll('.fm-tuto-dot');
    expect(dots.length).toBe(6);
    expect(dots[0].classList.contains('fm-tuto-dot--active')).toBe(true);
  });

  it('advances to fusion after swiping all 4 directions', async () => {
    await advanceSwipeStep();
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_fusion_title'),
    );
  });

  it('does not advance when the move is blocked', async () => {
    await advanceStepWith({ moved: false, merges: [] });
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_swipe_title'),
    );
  });

  it('requires a merge to pass the fusion step', async () => {
    await advanceSwipeStep();
    await advanceStepWith({ moved: true, merges: [] });
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_fusion_title'),
    );
    await advanceStepWith({ moved: true, merges: [{}] });
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_ice_title'),
    );
  });

  it('ice step advances on any move', async () => {
    await advanceSwipeStep();
    await advanceStepWith({ moved: true, merges: [{}] });
    // Now on ice step
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_ice_title'),
    );
    await advanceStepWith({ moved: true, merges: [] });
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_fire_v_title'),
    );
  });

  it('fire-V step shows top/bottom edge indicators', async () => {
    await advanceSwipeStep();
    await advanceStepWith({ moved: true, merges: [{}] });
    await advanceStepWith({ moved: true, merges: [] });
    // Now on fire_v
    const edges = document.querySelectorAll('.fm-tuto-edge-indicator');
    expect(edges.length).toBe(2);
    const sides = [...edges].map((e) => (e.classList.contains('top') ? 'top' : 'bottom')).sort();
    expect(sides).toEqual(['bottom', 'top']);
  });

  it('fire-V step rejects horizontal swipes and keeps the board', async () => {
    // Walk to fire_v
    await advanceSwipeStep();
    await advanceStepWith({ moved: true, merges: [{}] });
    await advanceStepWith({ moved: true, merges: [] });
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_fire_v_title'),
    );

    // Horizontal swipe — should NOT trigger fire and NOT advance
    await inputHandles.onDirection('left');
    await new Promise((r) => setTimeout(r, 0));
    expect(gridState.playFireAnimation).not.toHaveBeenCalled();
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_fire_v_title'),
    );
    // (The wrong-direction hint flashes briefly then restores — not asserted here
    // because the test's delayedCall stub fires synchronously.)
  });

  it('fire-V step fires on a vertical swipe, shows aftermath, then advances on tap', async () => {
    await advanceSwipeStep();
    await advanceStepWith({ moved: true, merges: [{}] });
    await advanceStepWith({ moved: true, merges: [] });
    // Start fire_v — don't await since it blocks on the aftermath dismissal
    const firePromise = inputHandles.onDirection('down');
    await new Promise((r) => setTimeout(r, 0)); // let fire animation run
    expect(gridState.playFireAnimation).toHaveBeenCalled();
    expect(gridState.removeTiles).toHaveBeenCalled();
    // Aftermath banner is now showing
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_fire_v_aftermath_title'),
    );
    // Tap to advance past aftermath
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    await firePromise;
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_enemy_title'),
    );
  });

  it('enemy step plays attack particles + damage popup on merge', async () => {
    // Walk to enemy step
    await advanceSwipeStep();
    await advanceStepWith({ moved: true, merges: [{}] });
    await advanceStepWith({ moved: true, merges: [] });
    await fireVAndDismiss();

    // Swipe that produces merges — use a concrete tile object so the
    // attack-particles loop can find it.
    gridState.executeResult = {
      moved: true,
      merges: [{ tile: { id: 'fake-tile-1' } }, { tile: { id: 'fake-tile-2' } }],
    };
    await inputHandles.onDirection('left');
    await new Promise((r) => setTimeout(r, 0));
    // A damage popup should have been created (with a `-2` label).
    const popup = document.querySelector('.fm-enemy-damage');
    expect(popup).not.toBeNull();
    expect(popup?.textContent).toBe('-2');
  });

  it('enemy step advances only after a merging swipe and shows the enemy', async () => {
    await advanceSwipeStep();
    await advanceStepWith({ moved: true, merges: [{}] });
    await advanceStepWith({ moved: true, merges: [] });
    await fireVAndDismiss();

    // Now on enemy step
    expect(document.querySelector('.fm-tuto-enemy')).not.toBeNull();

    // Non-merging swipe should not advance
    await advanceStepWith({ moved: true, merges: [] });
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_enemy_title'),
    );

    // Merging swipe advances to tips
    await advanceStepWith({ moved: true, merges: [{}] });
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_tips_title'),
    );
  });

  async function walkToTips() {
    await advanceSwipeStep();
    await advanceStepWith({ moved: true, merges: [{}] });
    await advanceStepWith({ moved: true, merges: [] });
    await fireVAndDismiss();
    await advanceStepWith({ moved: true, merges: [{}] });
    // Let the deferred tap/key listeners attach
    await new Promise((r) => setTimeout(r, 0));
  }

  it('tips step shows play button, hides skip, and starts battle mode on any tap', async () => {
    await walkToTips();
    expect(document.querySelector('[data-action="play"]')).not.toBeNull();
    const skip = document.querySelector('[data-action="skip"]');
    expect(skip.style.display).toBe('none');

    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(stubs.sceneStart).toHaveBeenCalledWith(SCENE_KEYS.GRID, {
      mode: 'battle',
      battleLevel: 0,
    });
  });

  it('tips step starts battle mode on any keyboard key', async () => {
    await walkToTips();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(stubs.sceneStart).toHaveBeenCalledWith(SCENE_KEYS.GRID, {
      mode: 'battle',
      battleLevel: 0,
    });
  });

  it('removes the floating enemy when leaving the enemy step', async () => {
    await advanceSwipeStep();
    await advanceStepWith({ moved: true, merges: [{}] });
    await advanceStepWith({ moved: true, merges: [] });
    await fireVAndDismiss();
    expect(document.querySelector('.fm-tuto-enemy')).not.toBeNull();
    await advanceStepWith({ moved: true, merges: [{}] });
    // On tips now — enemy gone
    expect(document.querySelector('.fm-tuto-enemy')).toBeNull();
  });

  it('Skip jumps straight to battle mode level 0', () => {
    const skip = document.querySelector('.fm-tuto-skip-btn');
    skip.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(stubs.sceneStart).toHaveBeenCalledWith(SCENE_KEYS.GRID, {
      mode: 'battle',
      battleLevel: 0,
    });
  });

  it('Escape key finishes the tutorial', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(stubs.sceneStart).toHaveBeenCalledWith(SCENE_KEYS.GRID, { mode: 'classic' });
  });

  it('re-renders banner text on locale change', () => {
    i18n.setLocale('fr');
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toBe(
      i18n.t('tuto.step_swipe_title'),
    );
    expect(document.querySelector('.fm-tuto-banner-title').textContent).toMatch(/Glissez/);
    i18n.setLocale('en');
  });

  it('cleans up DOM on shutdown', () => {
    scene.shutdown();
    expect(document.querySelector('.fm-tuto-banner')).toBeNull();
    expect(document.querySelector('.fm-tuto-skip-btn')).toBeNull();
    expect(document.querySelector('.fm-tuto-enemy')).toBeNull();
  });
});
