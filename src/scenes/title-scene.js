import Phaser from 'phaser';
import { SCENE_KEYS } from '../configs/constants.js';
import { layout } from '../managers/layout-manager.js';
import { audioManager } from '../managers/audio-manager.js';
import { saveManager } from '../managers/save-manager.js';
import { addBackground } from '../utils/background.js';

export class TitleScene extends Phaser.Scene {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #titleOverlay = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #devCreditDom = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  #logoAppearTimer = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  #autoTransitionTimer = null;

  /** @type {boolean} */
  #transitioned = false;

  constructor() {
    super({ key: SCENE_KEYS.TITLE });
  }

  create() {
    // Clean up any DOM nodes left over from GameScene
    document
      .querySelectorAll(
        '.fm-dead-enemy, .fm-enemy-area, .fm-contaminate-particle, .fm-critical-overlay',
      )
      .forEach((el) => el.remove());

    layout.update(window.innerWidth, window.innerHeight);

    addBackground(this);
    layout.drawDebugSafeZone(this);

    this.#transitioned = false;

    // Logo — full-screen CSS flex overlay
    this.#titleOverlay = this.add.dom(0, 0).createFromHTML(`
        <div class="fm-title-overlay">
          <div class="fm-title-logo-wrapper" id="fm-logo-wrapper">
            <img class="fm-title-logo-img" src="/images/logo.png" alt="Fusion Mania" />
          </div>
        </div>
      `);
    this.#titleOverlay.setOrigin(0, 0);

    // Logo appears after 0.5 seconds with bounce-in, then floats continuously
    this.#logoAppearTimer = setTimeout(() => {
      const wrapper = document.getElementById('fm-logo-wrapper');
      if (!wrapper) return;
      wrapper.classList.add('fm-logo-visible');
      setTimeout(() => {
        if (wrapper.isConnected) wrapper.classList.add('fm-logo-floating');
      }, 700);
    }, 500);

    // Dev credit shown directly (replaces "tap to start")
    const { safe } = layout;
    const creditY = safe.top + safe.height * 0.75;
    this.#devCreditDom = this.add.dom(safe.cx, creditY).createFromHTML(`
        <div class="fm-title-dev-credit fm-title-dev-credit--inline">
          <img class="fm-title-dev-logo" src="/images/newrare.png" alt="Newrare" />
          <div class="fm-title-dev-info">
            <span>A Newrare Game</span>
            <span class="fm-title-version">v1.0</span>
          </div>
        </div>
      `);
    this.#devCreditDom.setOrigin(0.5, 0);

    // Unlock audio on first user interaction
    this.input.keyboard.on('keydown', this.#unlockAudio, this);
    this.input.on('pointerdown', this.#unlockAudio, this);

    // Auto-transition after 3 seconds → load latest save or new classic game
    this.#autoTransitionTimer = setTimeout(() => {
      this.#autoTransitionTimer = null;
      this.#goToGame();
    }, 3000);
  }

  #unlockAudio = () => {
    audioManager.unlock();
    this.input.keyboard.off('keydown', this.#unlockAudio, this);
    this.input.off('pointerdown', this.#unlockAudio, this);
  };

  #goToGame() {
    if (this.#transitioned) return;
    this.#transitioned = true;

    // Try loading the most recent save (auto-save or latest manual slot)
    const autoSave = saveManager.loadAutoSave();
    const slots = saveManager.getSlots().filter((s) => s != null);

    // Pick the most recent save across auto-save and manual slots
    let bestSave = null;
    if (autoSave) bestSave = autoSave;
    for (const slot of slots) {
      if (!bestSave || (slot.date ?? 0) > (bestSave.date ?? 0)) {
        bestSave = slot;
      }
    }

    if (bestSave) {
      this.scene.start(SCENE_KEYS.GRID, { mode: bestSave.mode ?? 'classic', slotData: bestSave });
      return;
    }

    // No save at all — first start. Route to tutorial if no ranking history either.
    const hasAnyRanking = ['classic', 'free', 'battle'].some(
      (m) => saveManager.getRankings(m).length > 0,
    );
    if (!hasAnyRanking) {
      this.scene.start(SCENE_KEYS.TUTORIAL);
      return;
    }

    this.scene.start(SCENE_KEYS.GRID, { mode: 'classic' });
  }

  shutdown() {
    if (this.#logoAppearTimer !== null) {
      clearTimeout(this.#logoAppearTimer);
      this.#logoAppearTimer = null;
    }
    if (this.#autoTransitionTimer !== null) {
      clearTimeout(this.#autoTransitionTimer);
      this.#autoTransitionTimer = null;
    }
    this.#devCreditDom?.destroy();
    this.#devCreditDom = null;
  }
}
