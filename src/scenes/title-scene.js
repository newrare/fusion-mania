import Phaser from 'phaser';
import { SCENE_KEYS } from '../configs/constants.js';
import { i18n } from '../managers/i18n-manager.js';
import { layout } from '../managers/layout-manager.js';
import { MenuModal } from '../components/menu-modal.js';
import { addBackground } from '../utils/background.js';

export class TitleScene extends Phaser.Scene {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #logoElement = null;

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

    const { safe } = layout;
    const logoY   = safe.top + safe.height * 0.20;
    const promptY = safe.top + safe.height * 0.70;

    this.#logoElement = this.add
      .dom(safe.cx, logoY)
      .createFromHTML(`<img class="fm-title-logo-img" src="/images/logo.png" alt="Fusion Mania" />`);
    this.#logoElement.setOrigin(0.5);

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
