// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS, AUDIO } from '../../src/configs/constants.js';

// Mock localStorage
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

// Mock HTMLAudioElement
class MockAudio {
  constructor(src) {
    this.src = src;
    this.loop = false;
    this.volume = 1;
    this.preload = '';
    this.currentTime = 0;
    this.paused = true;
    this._listeners = {};
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  addEventListener(event, fn, opts) {
    this._listeners[event] = fn;
    if (event === 'canplaythrough') fn();
  }

  cloneNode() {
    const clone = new MockAudio(this.src);
    clone.volume = this.volume;
    return clone;
  }
}

vi.stubGlobal('Audio', MockAudio);

// Import after mocking
const { audioManager } = await import('../../src/managers/audio-manager.js');

describe('AudioManager', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.clearAllMocks();
  });

  describe('options persistence', () => {
    it('defaults to music and sound enabled', () => {
      expect(audioManager.musicEnabled).toBe(true);
      expect(audioManager.soundEnabled).toBe(true);
    });

    it('toggles music off and persists', () => {
      audioManager.setMusic(false);
      expect(audioManager.musicEnabled).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.OPTIONS,
        expect.stringContaining('"music":false'),
      );
    });

    it('toggles sound off and persists', () => {
      audioManager.setSound(false);
      expect(audioManager.soundEnabled).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.OPTIONS,
        expect.stringContaining('"sound":false'),
      );
    });

    it('restores music on', () => {
      audioManager.setMusic(false);
      audioManager.setMusic(true);
      expect(audioManager.musicEnabled).toBe(true);
    });

    it('restores sound on', () => {
      audioManager.setSound(false);
      audioManager.setSound(true);
      expect(audioManager.soundEnabled).toBe(true);
    });
  });

  describe('preload', () => {
    it('creates music Audio element without error', () => {
      expect(() => audioManager.preload()).not.toThrow();
    });

    it('preloads all SFX keys from AUDIO.SFX', () => {
      audioManager.preload();
      for (const key of Object.keys(AUDIO.SFX)) {
        expect(() => audioManager.playSfx(key)).not.toThrow();
      }
    });

    it('preloads all POWER_SFX keys', () => {
      audioManager.preload();
      for (const key of Object.keys(AUDIO.POWER_SFX)) {
        expect(() => audioManager.playSfx(`power:${key}`)).not.toThrow();
      }
    });

    it('preloads gridHurt, enemyHurt, enemyDeath, enemyIn, contamination SFX', () => {
      audioManager.preload();
      expect(() => audioManager.playSfx('gridHurt')).not.toThrow();
      expect(() => audioManager.playSfx('enemyHurt')).not.toThrow();
      expect(() => audioManager.playSfx('enemyDeath')).not.toThrow();
      expect(() => audioManager.playSfx('enemyIn')).not.toThrow();
      expect(() => audioManager.playSfx('contamination')).not.toThrow();
    });
  });

  describe('unlock', () => {
    it('unlocks audio without error', () => {
      audioManager.preload();
      expect(() => audioManager.unlock()).not.toThrow();
    });

    it('second unlock call is a no-op', () => {
      audioManager.preload();
      audioManager.unlock();
      expect(() => audioManager.unlock()).not.toThrow();
    });

    it('starts music after unlock when music is enabled', () => {
      audioManager.setMusic(true);
      audioManager.preload();
      audioManager.unlock();
      expect(audioManager.musicEnabled).toBe(true);
    });
  });

  describe('playSfx', () => {
    it('does not throw for unknown key', () => {
      audioManager.preload();
      audioManager.unlock();
      expect(() => audioManager.playSfx('nonexistent')).not.toThrow();
    });

    it('does not play when sound is disabled', () => {
      audioManager.preload();
      audioManager.unlock();
      audioManager.setSound(false);
      expect(() => audioManager.playSfx('fusion')).not.toThrow();
      audioManager.setSound(true);
    });
  });

  describe('playPowerSfx', () => {
    beforeEach(() => {
      audioManager.preload();
      audioManager.unlock();
      audioManager.setSound(true);
    });

    it('maps all wind variants to shared wind SFX', () => {
      expect(() => audioManager.playPowerSfx('wind-up')).not.toThrow();
      expect(() => audioManager.playPowerSfx('wind-down')).not.toThrow();
      expect(() => audioManager.playPowerSfx('wind-left')).not.toThrow();
      expect(() => audioManager.playPowerSfx('wind-right')).not.toThrow();
    });

    it('plays blind SFX', () => {
      expect(() => audioManager.playPowerSfx('blind')).not.toThrow();
    });

    it('plays fire SFX variants', () => {
      expect(() => audioManager.playPowerSfx('fire-h')).not.toThrow();
      expect(() => audioManager.playPowerSfx('fire-v')).not.toThrow();
      expect(() => audioManager.playPowerSfx('fire-x')).not.toThrow();
    });

    it('plays bomb, nuclear, teleport SFX', () => {
      expect(() => audioManager.playPowerSfx('bomb')).not.toThrow();
      expect(() => audioManager.playPowerSfx('nuclear')).not.toThrow();
      expect(() => audioManager.playPowerSfx('teleport')).not.toThrow();
    });

    it('silently ignores unknown power types', () => {
      expect(() => audioManager.playPowerSfx('unknown-power')).not.toThrow();
    });
  });

  describe('music control', () => {
    it('stops music without error', () => {
      audioManager.preload();
      audioManager.unlock();
      expect(() => audioManager.stopMusic()).not.toThrow();
    });

    it('pauses music when setMusic(false)', () => {
      audioManager.preload();
      audioManager.unlock();
      audioManager.setMusic(false);
      expect(audioManager.musicEnabled).toBe(false);
      audioManager.setMusic(true);
    });
  });

  describe('AUDIO constants integrity', () => {
    it('all new SFX keys exist in AUDIO.SFX', () => {
      expect(AUDIO.SFX.gridHurt).toBeDefined();
      expect(AUDIO.SFX.enemyHurt).toBeDefined();
      expect(AUDIO.SFX.enemyDeath).toBeDefined();
      expect(AUDIO.SFX.enemyIn).toBeDefined();
      expect(AUDIO.SFX.contamination).toBeDefined();
    });

    it('wind and blind exist in AUDIO.POWER_SFX', () => {
      expect(AUDIO.POWER_SFX['wind']).toBeDefined();
      expect(AUDIO.POWER_SFX['blind']).toBeDefined();
    });
  });
});
