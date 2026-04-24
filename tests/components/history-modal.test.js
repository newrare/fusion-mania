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

const { HistoryModal } = await import('../../src/components/history-modal.js');
const { HistoryManager } = await import('../../src/managers/history-manager.js');

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
          const obj = {
            node: wrapper,
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

describe('HistoryModal', () => {
  /** @type {ReturnType<typeof createMockScene>} */
  let scene;
  /** @type {Function} */
  let onClose;
  /** @type {HistoryManager} */
  let hm;

  beforeEach(() => {
    document.body.innerHTML = '';
    scene = createMockScene();
    onClose = vi.fn();
    hm = new HistoryManager();
  });

  // ─── CONSTRUCTION ─────────────────────────────────

  it('creates a modal overlay in the DOM', () => {
    new HistoryModal(scene, { historyManager: hm, onClose });
    const overlay = document.querySelector('#fm-history-overlay');
    expect(overlay).not.toBeNull();
  });

  it('shows the modal title', () => {
    new HistoryModal(scene, { historyManager: hm, onClose });
    const title = document.querySelector('.fm-modal-title');
    expect(title).not.toBeNull();
    expect(title.textContent).toBe('History');
  });

  it('shows empty message when no history', () => {
    new HistoryModal(scene, { historyManager: hm, onClose });
    const empty = document.querySelector('.fm-history-empty');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe('No fusion yet');
  });

  // ─── TURN RENDERING ──────────────────────────────

  it('renders a simple turn with direction and move number', () => {
    hm.beginTurn(1, 'up', 0);
    hm.finalizeTurn(4);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const turns = document.querySelectorAll('.fm-history-turn');
    expect(turns).toHaveLength(1);

    const header = turns[0].querySelector('.fm-history-header');
    // Direction is rendered as SVG arrow, not a text character
    expect(header.querySelector('.fm-power-info-dir svg')).not.toBeNull();
    expect(header.textContent).toContain('1');
  });

  it('renders multiple turns with most recent first', () => {
    hm.beginTurn(1, 'left', 0);
    hm.finalizeTurn(4);
    hm.beginTurn(2, 'right', 4);
    hm.finalizeTurn(12);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const turns = document.querySelectorAll('.fm-history-turn');
    expect(turns).toHaveLength(2);

    // First displayed turn should be move 2 (most recent)
    const firstHeader = turns[0].querySelector('.fm-history-header');
    expect(firstHeader.textContent).toContain('2');
  });

  it('renders fusion sub-entries', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addFusions([
      [2, 2],
      [8, 8],
    ]);
    hm.finalizeTurn(20);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const subs = document.querySelectorAll('.fm-history-sub');
    const fusionSub = Array.from(subs).find((s) => s.textContent.includes('Fusion'));
    expect(fusionSub).toBeDefined();
    // Tile pills render as styled spans — textContent has just the numbers
    expect(fusionSub.querySelectorAll('.fm-power-info-tile').length).toBeGreaterThanOrEqual(4);
  });

  it('renders power sub-entries with SVG icons', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addPower('fire-h');
    hm.finalizeTurn(0);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const subs = document.querySelectorAll('.fm-history-sub');
    const powerSub = Array.from(subs).find((s) => s.textContent.includes('Power'));
    expect(powerSub).toBeDefined();
    // Should contain an SVG element
    const svg = powerSub?.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('renders contamination sub-entries', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addContamination(4);
    hm.finalizeTurn(0);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const subs = document.querySelectorAll('.fm-history-sub');
    const contSub = Array.from(subs).find((s) => s.textContent.includes('Contamination'));
    expect(contSub).toBeDefined();
    // Value rendered as styled pill — textContent has just the number
    expect(contSub.querySelector('.fm-power-info-tile')).not.toBeNull();
  });

  it('renders enemy spawn sub-entries', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addEnemySpawn('Algebrox', 8);
    hm.finalizeTurn(0);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const subs = document.querySelectorAll('.fm-history-sub');
    const spawnSub = Array.from(subs).find((s) => s.textContent.includes('Algebrox'));
    expect(spawnSub).toBeDefined();
    expect(spawnSub.textContent).toContain('8');
  });

  it('renders enemy defeated sub-entries with success class', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addEnemyDefeated('Boss', 2048);
    hm.finalizeTurn(0);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const subs = document.querySelectorAll('.fm-history-sub--success');
    expect(subs).toHaveLength(1);
    expect(subs[0].textContent).toContain('Boss');
  });

  it('renders tiles lost sub-entries with danger class', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addTilesLost([16, 8]);
    hm.finalizeTurn(0);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const subs = document.querySelectorAll('.fm-history-sub--danger');
    expect(subs).toHaveLength(1);
    // Values are now styled pills — textContent has just the numbers concatenated
    const pills = subs[0].querySelectorAll('.fm-power-info-tile');
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toBe('16');
    expect(pills[1].textContent).toBe('8');
  });

  it('renders combo bonus sub-entries with bonus class', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addComboBonus(240);
    hm.finalizeTurn(240);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const subs = document.querySelectorAll('.fm-history-sub--bonus');
    expect(subs).toHaveLength(1);
    expect(subs[0].textContent).toContain('+240');
  });

  it('renders score gained sub-entries', () => {
    hm.beginTurn(1, 'up', 0);
    hm.finalizeTurn(100);

    new HistoryModal(scene, { historyManager: hm, onClose });

    const subs = document.querySelectorAll('.fm-history-sub');
    const scoreSub = Array.from(subs).find((s) => s.textContent.includes('+100'));
    expect(scoreSub).toBeDefined();
  });

  // ─── CLOSE BUTTON ────────────────────────────────

  it('calls onClose when clicking outside the modal', () => {
    new HistoryModal(scene, { historyManager: hm, onClose });

    const overlay = document.querySelector('#fm-history-overlay');
    overlay.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ─── DESTROY ─────────────────────────────────────

  it('removes modal from DOM on destroy', () => {
    const modal = new HistoryModal(scene, { historyManager: hm, onClose });

    expect(document.querySelector('#fm-history-overlay')).not.toBeNull();
    modal.destroy();
    expect(document.querySelector('#fm-history-overlay')).toBeNull();
  });
});
