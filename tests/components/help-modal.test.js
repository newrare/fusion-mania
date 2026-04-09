// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
};
vi.stubGlobal('localStorage', localStorageMock);

const { HelpModal } = await import('../../src/components/help-modal.js');

/* ── Minimal Phaser scene stub ──────────────────────────── */

function createMockScene() {
  const domNodes = [];
  return {
    add: {
      dom: () => ({
        createFromHTML: (html) => {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = html;
          document.body.appendChild(wrapper);
          const node = wrapper;
          const obj = {
            node,
            setOrigin: vi.fn(),
            setDepth: vi.fn(),
            destroy: () => {
              wrapper.remove();
              domNodes.splice(domNodes.indexOf(obj), 1);
            },
          };
          domNodes.push(obj);
          return obj;
        },
      }),
    },
    input: {
      keyboard: {
        on: vi.fn(),
        off: vi.fn(),
      },
    },
    _domNodes: domNodes,
  };
}

describe('HelpModal', () => {
  /** @type {ReturnType<typeof createMockScene>} */
  let scene;

  /** @type {Function} */
  let onClose;

  /** @type {HelpModal} */
  let modal;

  beforeEach(() => {
    document.body.innerHTML = '';
    scene = createMockScene();
    onClose = vi.fn();
    modal = new HelpModal(scene, { onClose });
  });

  // ─── CONSTRUCTION ─────────────────────────────────

  it('creates a modal overlay in the DOM', () => {
    const overlay = document.querySelector('#fm-help-overlay');
    expect(overlay).not.toBeNull();
  });

  it('shows the modal title', () => {
    const title = document.querySelector('.fm-modal-title');
    expect(title).not.toBeNull();
    expect(title.textContent).toBe('Help');
  });

  it('renders index with all 6 categories', () => {
    const items = document.querySelectorAll('[data-category]');
    expect(items.length).toBe(6);
  });

  it('renders categories in correct order', () => {
    const items = [...document.querySelectorAll('[data-category]')];
    const keys = items.map((el) => el.dataset.category);
    expect(keys).toEqual(['modes', 'fusion', 'powers', 'predictions', 'enemies', 'hp']);
  });

  it('has a close button', () => {
    const btn = document.querySelector('[data-action="close"]');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Close');
  });

  it('has a back button initially hidden', () => {
    const btn = document.querySelector('[data-action="back"]');
    expect(btn).not.toBeNull();
    expect(btn.style.display).toBe('none');
  });

  it('sets depth to 130', () => {
    // The setDepth call on the dom element
    const domObj = scene._domNodes[0];
    expect(domObj.setDepth).toHaveBeenCalledWith(130);
  });

  it('registers keyboard nav handler', () => {
    expect(scene.input.keyboard.on).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  // ─── NAVIGATION ───────────────────────────────────

  it('clicking a category shows detail view', () => {
    const modesCat = document.querySelector('[data-category="modes"]');
    modesCat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    // Index should be replaced by detail
    const detail = document.querySelector('.fm-help-detail');
    expect(detail).not.toBeNull();
    // Index items should be gone
    const indexItems = document.querySelectorAll('[data-category]');
    expect(indexItems.length).toBe(0);
  });

  it('clicking a category shows back button', () => {
    const cat = document.querySelector('[data-category="fusion"]');
    cat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const backBtn = document.querySelector('[data-action="back"]');
    expect(backBtn.style.display).not.toBe('none');
  });

  it('clicking back returns to index', () => {
    const cat = document.querySelector('[data-category="fusion"]');
    cat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const backBtn = document.querySelector('[data-action="back"]');
    backBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const items = document.querySelectorAll('[data-category]');
    expect(items.length).toBe(6);
  });

  it('clicking back hides the back button', () => {
    const cat = document.querySelector('[data-category="modes"]');
    cat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const backBtn = document.querySelector('[data-action="back"]');
    backBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(backBtn.style.display).toBe('none');
  });

  it('clicking close calls onClose', () => {
    const closeBtn = document.querySelector('[data-action="close"]');
    closeBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ─── CATEGORY: MODES ─────────────────────────────

  it('modes category shows 3 mode cards', () => {
    document
      .querySelector('[data-category="modes"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const cards = document.querySelectorAll('.fm-help-card');
    expect(cards.length).toBe(3);
  });

  // ─── CATEGORY: FUSION ────────────────────────────

  it('fusion category shows tile examples', () => {
    document
      .querySelector('[data-category="fusion"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const tiles = document.querySelectorAll('.fm-help-tile');
    expect(tiles.length).toBeGreaterThanOrEqual(4);
  });

  it('fusion category shows fusion example rows', () => {
    document
      .querySelector('[data-category="fusion"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const examples = document.querySelectorAll('.fm-help-fusion-example');
    expect(examples.length).toBe(2);
  });

  // ─── CATEGORY: POWERS ────────────────────────────

  it('powers category shows 3 power groups', () => {
    document
      .querySelector('[data-category="powers"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const groups = document.querySelectorAll('.fm-help-power-group');
    expect(groups.length).toBe(3);
  });

  it('powers category shows all power items with icons', () => {
    document
      .querySelector('[data-category="powers"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const items = document.querySelectorAll('.fm-help-power-item');
    // 6 danger + 4 warning + 5 info = 15 (without ads counted in categories)
    expect(items.length).toBeGreaterThanOrEqual(15);
  });

  it('each power item has a name and description', () => {
    document
      .querySelector('[data-category="powers"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const items = document.querySelectorAll('.fm-help-power-item');
    for (const item of items) {
      expect(item.querySelector('.fm-help-power-name')).not.toBeNull();
      expect(item.querySelector('.fm-help-power-desc')).not.toBeNull();
    }
  });

  it('each power item has an SVG icon', () => {
    document
      .querySelector('[data-category="powers"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const items = document.querySelectorAll('.fm-help-power-item');
    for (const item of items) {
      expect(item.querySelector('svg')).not.toBeNull();
    }
  });

  // ─── CATEGORY: PREDICTIONS ───────────────────────

  it('predictions category shows 3 indicator examples', () => {
    document
      .querySelector('[data-category="predictions"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const rows = document.querySelectorAll('.fm-help-prediction-row');
    expect(rows.length).toBe(3);
  });

  it('predictions shows danger/warning/info dots using real power-dot classes', () => {
    document
      .querySelector('[data-category="predictions"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(document.querySelector('.fm-power-dot.danger')).not.toBeNull();
    expect(document.querySelector('.fm-power-dot.warning')).not.toBeNull();
    expect(document.querySelector('.fm-power-dot.info')).not.toBeNull();
  });

  // ─── CATEGORY: ENEMIES ───────────────────────────

  it('enemies category shows level badges', () => {
    document
      .querySelector('[data-category="enemies"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const badges = document.querySelectorAll('.fm-help-enemy-badge');
    expect(badges.length).toBe(11); // 2..2048
  });

  it('enemies category shows level progression', () => {
    document
      .querySelector('[data-category="enemies"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const badges = [...document.querySelectorAll('.fm-help-enemy-badge')];
    const values = badges.map((b) => parseInt(b.textContent, 10));
    expect(values).toEqual([2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]);
  });

  // ─── CATEGORY: HP ────────────────────────────────

  it('hp category shows 3 demo HP tiles', () => {
    document
      .querySelector('[data-category="hp"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const tiles = document.querySelectorAll('.fm-help-hp-tile-wrap');
    expect(tiles.length).toBe(3);
  });

  it('hp category shows ok/warn/crit liquid fill colors', () => {
    document
      .querySelector('[data-category="hp"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(document.querySelector('.fm-help-hp-liquid--ok')).not.toBeNull();
    expect(document.querySelector('.fm-help-hp-liquid--warn')).not.toBeNull();
    expect(document.querySelector('.fm-help-hp-liquid--crit')).not.toBeNull();
  });

  // ─── SWITCHING CATEGORIES ────────────────────────

  it('navigating between categories replaces content', () => {
    document
      .querySelector('[data-category="modes"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(document.querySelectorAll('.fm-help-card').length).toBe(3);

    // Go back
    document
      .querySelector('[data-action="back"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    // Switch to hp
    document
      .querySelector('[data-category="hp"]')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(document.querySelectorAll('.fm-help-hp-tile-wrap').length).toBe(3);
    expect(document.querySelectorAll('.fm-help-card').length).toBeLessThan(3);
  });

  // ─── DESTROY ──────────────────────────────────────

  it('destroy removes DOM and keyboard nav', () => {
    modal.destroy();
    expect(document.querySelector('#fm-help-overlay')).toBeNull();
    expect(scene.input.keyboard.off).toHaveBeenCalled();
  });

  it('destroy is safe to call twice', () => {
    modal.destroy();
    expect(() => modal.destroy()).not.toThrow();
  });
});
