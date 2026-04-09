import { layout } from '../managers/layout-manager.js';
import { i18n } from '../managers/i18n-manager.js';
import { OptionsModal } from './options-modal.js';
import { RankingModal } from './ranking-modal.js';
import { SaveLoadModal } from './save-load-modal.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Menu modal component — overlay with game mode buttons.
 */
export class MenuModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {OptionsModal | null} */
  #optionsModal = null;

  /** @type {RankingModal | null} */
  #rankingModal = null;

  /** @type {SaveLoadModal | null} */
  #saveLoadModal = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /** @type {Function | null} Unsubscribe from i18n changes */
  #unsubI18n = null;

  /** @type {object} Constructor options (kept to rebuild buttons on locale change) */
  #options = {};

  /**
   * @param {Phaser.Scene} scene
   * @param {{ showResume?: boolean, onResume?: Function, onClassic?: Function, onBattle?: Function, onFree?: Function, onClose?: Function, onQuit?: Function, onAdmin?: Function, onSave?: Function, onLoadGame?: (slotData: object) => void }} options
   */
  constructor(scene, options = {}) {
    this.#scene = scene;
    this.#options = options;

    let buttonsHtml = this.#buildButtonsHtml();

    const html = `
      <div class="fm-modal-overlay" id="fm-menu-overlay">
        <div class="fm-modal">
          <div class="fm-modal-title">${i18n.t('menu.title')}</div>
          <div class="fm-modal-buttons">${buttonsHtml}</div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(100);

    const overlay = this.#domElement.node.querySelector('#fm-menu-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const action = btn.dataset.action;
      switch (action) {
        case 'resume':
          options.onResume?.();
          break;
        case 'classic':
          options.onClassic?.();
          break;
        case 'battle':
          options.onBattle?.();
          break;
        case 'free':
          options.onFree?.();
          break;
        case 'ranking':
          this.#openRanking();
          break;
        case 'options':
          this.#openOptions();
          break;
        case 'save':
          options.onSave?.();
          break;
        case 'loadgame':
          this.#openSaveLoad();
          break;
        case 'close':
          options.onClose?.();
          break;
        case 'quit':
          options.onQuit?.();
          break;
        case 'admin':
          options.onAdmin?.();
          break;
        case 'exit':
          window.close();
          break;
      }
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard, {
      onEscape: () => options.onClose?.(),
    });

    this.#unsubI18n = i18n.onChange(() => this.#refresh());
  }

  /** Rebuild button labels on locale change. */
  #buildButtonsHtml() {
    const opts = this.#options;
    let html = '';
    if (opts.showResume) {
      // Game in progress: only show Resume + Save + Ranking + Options + (Quit) + (Admin)
      html += `<button class="fm-btn fm-btn--primary" data-action="resume">${i18n.t('menu.resume')}</button>`;
      if (opts.onSave) {
        html += `<button class="fm-btn" data-action="save">${i18n.t('menu.save')}</button>`;
      }
      html += `<button class="fm-btn" data-action="ranking">${i18n.t('menu.ranking')}</button>`;
      html += `<button class="fm-btn" data-action="options">${i18n.t('menu.options')}</button>`;
      if (opts.onQuit) {
        html += `<button class="fm-btn" data-action="quit">${i18n.t('menu.quit')}</button>`;
      }
    } else {
      // No game in progress: show mode selection + Load
      html += `<button class="fm-btn fm-btn--mode" data-action="battle"><span class="fm-btn-mode-icon">⚔️</span>${i18n.t('menu.battle')}</button>`;
      html += `<button class="fm-btn fm-btn--mode" data-action="free"><span class="fm-btn-mode-icon">✨</span>${i18n.t('menu.free')}</button>`;
      html += `<button class="fm-btn fm-btn--mode" data-action="classic"><span class="fm-btn-mode-icon">🎲</span>${i18n.t('menu.classic')}</button>`;
      html += `<button class="fm-btn" data-action="loadgame">${i18n.t('menu.load')}</button>`;
      html += `<button class="fm-btn" data-action="ranking">${i18n.t('menu.ranking')}</button>`;
      html += `<button class="fm-btn" data-action="options">${i18n.t('menu.options')}</button>`;
      html += `<button class="fm-btn" data-action="close">${i18n.t('menu.close')}</button>`;
      if (opts.onQuit) {
        html += `<button class="fm-btn" data-action="quit">${i18n.t('menu.quit')}</button>`;
      }
      if (import.meta.env.DEV || ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
        html += `<button class="fm-btn" data-action="exit">${i18n.t('menu.exit')}</button>`;
      }
    }
    if (import.meta.env.DEV && opts.onAdmin) {
      html += `<button class="fm-btn fm-btn--admin" data-action="admin">⚙ Admin</button>`;
    }
    return html;
  }

  #refresh() {
    const overlay = this.#domElement?.node;
    if (!overlay) return;
    const titleEl = overlay.querySelector('.fm-modal-title');
    if (titleEl) titleEl.textContent = i18n.t('menu.title');
    const buttonsEl = overlay.querySelector('.fm-modal-buttons');
    if (buttonsEl) buttonsEl.innerHTML = this.#buildButtonsHtml();
  }

  #openOptions() {
    if (this.#optionsModal) return;
    this.#optionsModal = new OptionsModal(this.#scene, {
      showResume: !!this.#options.showResume,
      onResume: () => {
        this.#optionsModal?.destroy();
        this.#optionsModal = null;
        this.#options.onResume?.();
      },
      onClose: () => {
        this.#optionsModal?.destroy();
        this.#optionsModal = null;
      },
    });
  }

  #openRanking() {
    if (this.#rankingModal) return;
    this.#rankingModal = new RankingModal(this.#scene, {
      showResume: !!this.#options.showResume,
      onResume: () => {
        this.#rankingModal?.destroy();
        this.#rankingModal = null;
        this.#options.onResume?.();
      },
      onClose: () => {
        this.#rankingModal?.destroy();
        this.#rankingModal = null;
      },
    });
  }

  #openSaveLoad() {
    if (this.#saveLoadModal) return;
    this.#saveLoadModal = new SaveLoadModal(this.#scene, {
      onLoad: (slotData) => {
        this.#saveLoadModal?.destroy();
        this.#saveLoadModal = null;
        this.#options.onLoadGame?.(slotData);
      },
      onClose: () => {
        this.#saveLoadModal?.destroy();
        this.#saveLoadModal = null;
      },
    });
  }

  destroy() {
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#optionsModal?.destroy();
    this.#optionsModal = null;
    this.#rankingModal?.destroy();
    this.#rankingModal = null;
    this.#saveLoadModal?.destroy();
    this.#saveLoadModal = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
