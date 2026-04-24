// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';

/* ── Stub localStorage before module import ─────────────── */
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

const { optionsManager } = await import('../../src/managers/options-manager.js');
const { STORAGE_KEYS, DEFAULT_OPTIONS } = await import('../../src/configs/constants.js');

describe('OptionsManager', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.clearAllMocks();
    // Reset to defaults for every test
    for (const [key, value] of Object.entries(DEFAULT_OPTIONS)) {
      optionsManager.set(key, value);
    }
    vi.clearAllMocks();
  });

  it('exposes defaults for music and sound (true) and animSkip (false)', () => {
    expect(optionsManager.musicEnabled).toBe(true);
    expect(optionsManager.soundEnabled).toBe(true);
    expect(optionsManager.animSkipEnabled).toBe(false);
  });

  it('set() persists changes to localStorage under STORAGE_KEYS.OPTIONS', () => {
    optionsManager.set('animSkip', true);
    expect(optionsManager.animSkipEnabled).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.OPTIONS,
      expect.stringContaining('"animSkip":true'),
    );
  });

  it('persists music and sound under the same key', () => {
    optionsManager.set('music', false);
    optionsManager.set('sound', false);
    const raw = store[STORAGE_KEYS.OPTIONS];
    expect(raw).toContain('"music":false');
    expect(raw).toContain('"sound":false');
  });

  it('round-trips animSkip through localStorage', () => {
    optionsManager.set('animSkip', true);
    optionsManager.set('animSkip', false);
    expect(optionsManager.animSkipEnabled).toBe(false);
  });

  it('generic get() returns the current value for a known key', () => {
    optionsManager.set('animSkip', true);
    expect(optionsManager.get('animSkip')).toBe(true);
    expect(optionsManager.get('music')).toBe(true);
  });
});
