import { STORAGE_KEYS, DEFAULT_OPTIONS, AUDIO } from '../configs/constants.js';

/**
 * AudioManager — manages background music and sound effects using HTML5 Audio.
 * Persists user preferences (music/sound toggles) in localStorage.
 * Singleton: import { audioManager } from './audio-manager.js'.
 */
class AudioManager {
  #options = { ...DEFAULT_OPTIONS };

  /** @type {HTMLAudioElement | null} */
  #music = null;

  /** @type {boolean} Music element is ready to play */
  #musicReady = false;

  /** @type {Map<string, HTMLAudioElement>} Preloaded SFX pool */
  #sfxPool = new Map();

  /** @type {boolean} True once the user has interacted (autoplay policy gate) */
  #unlocked = false;

  constructor() {
    this.#loadOptions();
  }

  // ─── Options persistence ───────────────────────────

  /** @returns {boolean} */
  get musicEnabled() {
    return this.#options.music;
  }

  /** @returns {boolean} */
  get soundEnabled() {
    return this.#options.sound;
  }

  /** @param {boolean} value */
  setMusic(value) {
    this.#options.music = value;
    this.#saveOptions();
    if (value) {
      this.#resumeMusic();
    } else {
      this.#pauseMusic();
    }
  }

  /** @param {boolean} value */
  setSound(value) {
    this.#options.sound = value;
    this.#saveOptions();
  }

  #loadOptions() {
    const raw = localStorage.getItem(STORAGE_KEYS.OPTIONS);
    if (raw) {
      try {
        Object.assign(this.#options, JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
  }

  #saveOptions() {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify(this.#options));
  }

  // ─── Preloading ────────────────────────────────────

  /**
   * Preload all audio assets. Call once during scene preload.
   * Uses HTML5 Audio — independent of Phaser's sound system.
   */
  preload() {
    // Music
    this.#music = new Audio(AUDIO.MUSIC);
    this.#music.loop = true;
    this.#music.volume = AUDIO.MUSIC_VOLUME;
    this.#music.preload = 'auto';
    this.#music.addEventListener(
      'canplaythrough',
      () => {
        this.#musicReady = true;
      },
      { once: true },
    );

    // Pause/resume music when the app goes to background or screen turns off
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.#pauseMusic();
      } else if (this.#options.music) {
        this.#resumeMusic();
      }
    });

    // SFX
    for (const [key, path] of Object.entries(AUDIO.SFX)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = AUDIO.SFX_VOLUME * (AUDIO.SFX_VOLUMES[key] ?? 1.0);
      this.#sfxPool.set(key, audio);
    }
    for (const [key, path] of Object.entries(AUDIO.POWER_SFX)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = AUDIO.SFX_VOLUME * (AUDIO.POWER_SFX_VOLUMES[key] ?? 1.0);
      this.#sfxPool.set(`power:${key}`, audio);
    }
  }

  // ─── Autoplay unlock ──────────────────────────────

  /**
   * Call on the first user interaction (tap/key) to unlock autoplay.
   * Browsers block audio playback until a user gesture has occurred.
   */
  unlock() {
    if (this.#unlocked) return;
    this.#unlocked = true;
    if (this.#options.music) {
      this.#resumeMusic();
    }

    // Global click SFX on all buttons and interactive elements via event delegation.
    // Capture phase (true) ensures stopPropagation() in modals doesn't block this listener.
    // fm-clickable is a sentinel class for non-button interactive elements (tabs, rows, items).
    const INTERACTIVE = '.fm-btn, .fm-theme-btn, .fm-clickable';
    document.addEventListener(
      'pointerdown',
      (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest(INTERACTIVE);
        if (btn) this.playSfx('click');
      },
      true,
    );

    // Global hover SFX — fires once per new interactive element entered
    let lastHovered = null;
    document.addEventListener('pointerover', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest(INTERACTIVE);
      if (btn && btn !== lastHovered) {
        lastHovered = btn;
        this.playSfx('hover');
      }
    });
    document.addEventListener('pointerout', (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest(INTERACTIVE) !== lastHovered) return;
      // Only reset if the pointer is leaving the interactive element entirely,
      // not just moving to a child element within it.
      const dest = e.relatedTarget
        ? /** @type {HTMLElement} */ (e.relatedTarget).closest(INTERACTIVE)
        : null;
      if (dest !== lastHovered) lastHovered = null;
    });
  }

  // ─── Music ─────────────────────────────────────────

  #resumeMusic() {
    if (!this.#music || !this.#unlocked) return;
    this.#music.play().catch(() => {
      /* blocked by browser policy — ignore */
    });
  }

  #pauseMusic() {
    if (!this.#music) return;
    this.#music.pause();
  }

  /** Stop music and reset to beginning. */
  stopMusic() {
    if (!this.#music) return;
    this.#music.pause();
    this.#music.currentTime = 0;
  }

  // ─── SFX ───────────────────────────────────────────

  /**
   * Play a sound effect by key (AUDIO.SFX keys, e.g. 'fusion', 'click').
   * @param {string} key
   */
  playSfx(key) {
    if (!this.#options.sound || !this.#unlocked) return;
    const audio = this.#sfxPool.get(key);
    if (!audio) return;
    // Clone to allow overlapping playback
    const clone = /** @type {HTMLAudioElement} */ (audio.cloneNode());
    clone.volume = AUDIO.SFX_VOLUME;
    clone.play().catch(() => {
      /* ignore */
    });
  }

  /**
   * Play the SFX for a power activation (tile merges with a powered tile).
   * Expel powers play the "-in" variant; all wind variants share one SFX.
   * Lightning is NOT played here — it must be triggered per-strike via playSfx.
   * @param {string} powerType — POWER_TYPES value
   */
  playPowerSfx(powerType) {
    let key;
    if (powerType === 'expel-h') {
      key = 'power:expel-h-in';
    } else if (powerType === 'expel-v') {
      key = 'power:expel-v-in';
    } else if (powerType.startsWith('wind-')) {
      key = 'power:wind';
    } else {
      key = `power:${powerType}`;
    }
    this.playSfx(key);
  }
}

export const audioManager = new AudioManager();
