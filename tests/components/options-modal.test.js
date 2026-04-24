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

/* ── Stub Audio ──────────────────────────────────────────── */
class MockAudio {
  constructor() {
    this.loop = false;
    this.volume = 1;
    this.preload = '';
    this.currentTime = 0;
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
  addEventListener() {}
  cloneNode() {
    return new MockAudio();
  }
}
vi.stubGlobal('Audio', MockAudio);

const { OptionsModal } = await import('../../src/components/options-modal.js');
const { audioManager } = await import('../../src/managers/audio-manager.js');
const { optionsManager } = await import('../../src/managers/options-manager.js');

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

/** Simulate a pointerdown on an element */
function click(el) {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
}

describe('OptionsModal', () => {
  /** @type {ReturnType<typeof createMockScene>} */
  let scene;
  let onClose;
  let modal;

  beforeEach(() => {
    document.body.innerHTML = '';
    for (const k of Object.keys(store)) delete store[k];
    vi.clearAllMocks();
    audioManager.setMusic(true);
    audioManager.setSound(true);
    optionsManager.set('animSkip', false);
    scene = createMockScene();
    onClose = vi.fn();
    modal = new OptionsModal(scene, { onClose });
  });

  // ─── CONSTRUCTION ─────────────────────────────────

  it('creates a modal overlay in the DOM', () => {
    const overlay = document.querySelector('#fm-options-overlay');
    expect(overlay).not.toBeNull();
  });

  it('shows the modal title', () => {
    const title = document.querySelector('.fm-modal-title');
    expect(title?.textContent).toBe('Options');
  });

  it('renders music toggle row', () => {
    const label = document.querySelector('#fm-music-label');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('ON');
  });

  it('renders sound toggle row', () => {
    const label = document.querySelector('#fm-sound-label');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('ON');
  });

  it('has 5 option rows (music, sound, theme, language, anim-skip)', () => {
    const rows = document.querySelectorAll('.fm-option-row');
    expect(rows.length).toBe(5);
  });

  it('renders anim-skip toggle row defaulting to OFF', () => {
    const label = document.querySelector('#fm-anim-skip-label');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('OFF');
  });

  // ─── MUSIC TOGGLE ─────────────────────────────────

  it('toggles music off on click', () => {
    const btn = document.querySelector('[data-action="music"]');
    click(btn);
    expect(audioManager.musicEnabled).toBe(false);
    expect(btn.textContent).toBe('OFF');
  });

  it('toggles music back on', () => {
    const btn = document.querySelector('[data-action="music"]');
    click(btn); // OFF
    click(btn); // ON
    expect(audioManager.musicEnabled).toBe(true);
    expect(btn.textContent).toBe('ON');
  });

  // ─── SOUND TOGGLE ─────────────────────────────────

  it('toggles sound off on click', () => {
    const btn = document.querySelector('[data-action="sound"]');
    click(btn);
    expect(audioManager.soundEnabled).toBe(false);
    expect(btn.textContent).toBe('OFF');
  });

  it('toggles sound back on', () => {
    const btn = document.querySelector('[data-action="sound"]');
    click(btn); // OFF
    click(btn); // ON
    expect(audioManager.soundEnabled).toBe(true);
    expect(btn.textContent).toBe('ON');
  });

  // ─── ANIM-SKIP TOGGLE ─────────────────────────────

  it('toggles anim-skip on on click', () => {
    const btn = document.querySelector('[data-action="anim-skip"]');
    click(btn);
    expect(optionsManager.animSkipEnabled).toBe(true);
    expect(btn.textContent).toBe('ON');
  });

  it('toggles anim-skip back off', () => {
    const btn = document.querySelector('[data-action="anim-skip"]');
    click(btn); // ON
    click(btn); // OFF
    expect(optionsManager.animSkipEnabled).toBe(false);
    expect(btn.textContent).toBe('OFF');
  });

  // ─── CLOSE ────────────────────────────────────────

  it('calls onClose when clicking outside the modal', () => {
    const overlay = document.querySelector('#fm-options-overlay');
    overlay.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });

  // ─── DESTROY ──────────────────────────────────────

  it('removes the overlay from DOM on destroy', () => {
    modal.destroy();
    expect(document.querySelector('#fm-options-overlay')).toBeNull();
  });
});
