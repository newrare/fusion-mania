import Phaser from 'phaser';
import { SCENE_KEYS } from '../configs/constants.js';
import { i18n } from '../managers/i18n-manager.js';
import { layout } from '../managers/layout-manager.js';
import { audioManager } from '../managers/audio-manager.js';
import { MenuModal } from '../components/menu-modal.js';
import { addBackground } from '../utils/background.js';

export class TitleScene extends Phaser.Scene {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #titleOverlay = null;

  /** @type {Phaser.GameObjects.DOMElement | null} */
  #promptElement = null;

  /** @type {MenuModal | null} */
  #menuModal = null;

  constructor() {
    super({ key: SCENE_KEYS.TITLE });
  }

  create() {
    // Clean up any DOM nodes left over from GameScene (dead enemies, critical
    // overlay, etc.) — simpler than relying solely on GameScene.shutdown().
    document.querySelectorAll(
      '.fm-dead-enemy, .fm-enemy-area, .fm-contaminate-particle, .fm-critical-overlay'
    ).forEach((el) => el.remove());

    // Recalculate layout with real viewport dimensions at the moment create() runs.
    layout.update(window.innerWidth, window.innerHeight);

    addBackground(this);
    layout.drawDebugSafeZone(this);

    // Logo + dev credit — full-screen CSS flex overlay, no layout calculations needed
    this.#titleOverlay = this.add
      .dom(0, 0)
      .createFromHTML(`
        <div class="fm-title-overlay">
          <div class="fm-title-logo-wrapper">
            <img class="fm-title-logo-img" src="/images/logo.png" alt="Fusion Mania" />
          </div>
          <div class="fm-title-dev-credit">
            <img class="fm-title-dev-logo" src="/images/newrare.png" alt="Newrare" />
            <div class="fm-title-dev-info">
              <span>A Newrare Game</span>
              <span class="fm-title-version">v1.0</span>
            </div>
          </div>
        </div>
      `);
    this.#titleOverlay.setOrigin(0, 0);

    const { safe } = layout;
    const promptY = safe.top + safe.height * 0.70;

    this.#promptElement = this.add
      .dom(safe.cx, promptY)
      .createFromHTML(`<div class="fm-title-prompt">${i18n.t('title.prompt')}</div>`);
    this.#promptElement.setOrigin(0.5);

    // Any key or tap → open menu
    this.input.keyboard.on('keydown', this.#openMenu, this);
    this.input.on('pointerdown', this.#openMenu, this);
  }

  #openMenu = () => {
    // Prevent multiple modals
    if (this.#menuModal) return;

    // Unlock audio on first user interaction (browser autoplay policy)
    audioManager.unlock();

    this.input.keyboard.off('keydown', this.#openMenu, this);
    this.input.off('pointerdown', this.#openMenu, this);

    this.#menuModal = new MenuModal(this, {
      showResume: false,
      onClassic: () => {
        this.#destroyModal();
        this.scene.start(SCENE_KEYS.GRID, { mode: 'classic' });
      },
      onBattle: () => {
        this.#destroyModal();
        this.scene.start(SCENE_KEYS.GRID, { mode: 'battle' });
      },
      onFree: () => {
        this.#destroyModal();
        this.scene.start(SCENE_KEYS.GRID, { mode: 'free' });
      },
      onLoadGame: (slotData) => {
        this.#destroyModal();
        this.scene.start(SCENE_KEYS.GRID, { mode: slotData.mode, slotData });
      },
      onClose: () => {
        this.#destroyModal();
        // Re-bind input
        this.input.keyboard.on('keydown', this.#openMenu, this);
        this.input.on('pointerdown', this.#openMenu, this);
      },
    });
  };

  #destroyModal() {
    if (this.#menuModal) {
      this.#menuModal.destroy();
      this.#menuModal = null;
    }
  }

  shutdown() {
    this.#destroyModal();
  }
}
