import { i18n } from '../managers/i18n-manager.js';
import { POWER_CATEGORIES, BATTLE } from '../configs/constants.js';
import { Power } from '../entities/power.js';
import { enableKeyboardNav } from '../utils/keyboard-nav.js';

/**
 * Help / tutorial modal — category list → detail view navigation.
 * Categories: game modes, fusion, powers, predictions, enemies, grid life.
 */
export class HelpModal {
  /** @type {Phaser.GameObjects.DOMElement | null} */
  #domElement = null;

  /** @type {Phaser.Scene} */
  #scene;

  /** @type {Function | null} */
  #onClose = null;

  /** @type {{ destroy: () => void } | null} */
  #keyNav = null;

  /** @type {Function | null} */
  #unsubI18n = null;

  /** @type {string | null} Currently displayed category key, null = index */
  #activeCategory = null;

  /** Category definitions — order matters for the index list */
  static CATEGORIES = ['modes', 'fusion', 'powers', 'predictions', 'enemies', 'hp'];

  /** Category icons (Unicode for simplicity — no extra SVG needed) */
  static CATEGORY_ICONS = {
    modes: '\u{1F3AE}',
    fusion: '\u{1F501}',
    powers: '\u{26A1}',
    predictions: '\u{2757}',
    enemies: '\u{1F47E}',
    hp: '\u{2764}',
  };

  /**
   * @param {Phaser.Scene} scene
   * @param {{ onClose: () => void }} options
   */
  constructor(scene, options) {
    this.#scene = scene;
    this.#onClose = options.onClose;

    const html = `
      <div class="fm-modal-overlay" id="fm-help-overlay">
        <div class="fm-modal fm-help-modal">
          <div class="fm-modal-title">${i18n.t('help.title')}</div>
          <div class="fm-help-content" id="fm-help-content"></div>
          <div class="fm-modal-buttons">
            <button class="fm-btn fm-help-back" data-action="back" style="display:none">${i18n.t('help.back')}</button>
            <button class="fm-btn" data-action="close">${i18n.t('help.close')}</button>
          </div>
        </div>
      </div>
    `;

    this.#domElement = scene.add.dom(0, 0).createFromHTML(html);
    this.#domElement.setOrigin(0, 0);
    this.#domElement.setDepth(130);

    this.#renderIndex();

    const overlay = this.#domElement.node.querySelector('#fm-help-overlay');
    overlay?.addEventListener('pointerdown', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
      if (btn) {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'close') {
          this.#onClose?.();
        } else if (action === 'back') {
          this.#showIndex();
        }
        return;
      }
      const cat = /** @type {HTMLElement} */ (e.target).closest('[data-category]');
      if (cat) {
        e.stopPropagation();
        this.#showCategory(cat.dataset.category);
      }
    });

    this.#keyNav = enableKeyboardNav(overlay, scene.input.keyboard, {
      onEscape: () => {
        if (this.#activeCategory) {
          this.#showIndex();
        } else {
          this.#onClose?.();
        }
      },
    });

    this.#unsubI18n = i18n.onChange(() => {
      if (this.#activeCategory) {
        this.#renderCategory(this.#activeCategory);
      } else {
        this.#renderIndex();
      }
      this.#refreshButtons();
    });
  }

  // ─── INDEX VIEW ──────────────────────────────────

  #showIndex() {
    this.#activeCategory = null;
    this.#renderIndex();
    this.#setBackVisible(false);
  }

  #renderIndex() {
    const content = this.#domElement?.node.querySelector('#fm-help-content');
    if (!content) return;

    const items = HelpModal.CATEGORIES.map((cat) => {
      const icon = HelpModal.CATEGORY_ICONS[cat];
      const label = i18n.t(`help.cat_${cat}`);
      return `<button class="fm-help-cat-item fm-clickable" data-category="${cat}">
        <span class="fm-help-cat-icon">${icon}</span>
        <span class="fm-help-cat-label">${label}</span>
        <span class="fm-help-cat-arrow">\u203A</span>
      </button>`;
    }).join('');

    content.innerHTML = `<div class="fm-help-index">${items}</div>`;
  }

  // ─── CATEGORY DETAIL VIEW ───────────────────────

  /** @param {string} category */
  #showCategory(category) {
    this.#activeCategory = category;
    this.#renderCategory(category);
    this.#setBackVisible(true);
  }

  /** @param {string} category */
  #renderCategory(category) {
    const content = this.#domElement?.node.querySelector('#fm-help-content');
    if (!content) return;

    const renderers = {
      modes: () => this.#renderModes(),
      fusion: () => this.#renderFusion(),
      powers: () => this.#renderPowers(),
      predictions: () => this.#renderPredictions(),
      enemies: () => this.#renderEnemies(),
      hp: () => this.#renderHp(),
    };

    const title = i18n.t(`help.cat_${category}`);
    const body = (renderers[category] ?? (() => ''))();

    content.innerHTML = `
      <div class="fm-help-detail">
        <div class="fm-help-detail-title">${HelpModal.CATEGORY_ICONS[category]} ${title}</div>
        <div class="fm-help-detail-body">${body}</div>
      </div>
    `;
  }

  // ─── RENDERERS ──────────────────────────────────

  #renderModes() {
    const modes = ['classic', 'free', 'battle'];
    const icons = { classic: '\u{1F3B2}', free: '\u{2728}', battle: '\u{2694}\u{FE0F}' };
    return `
      <p class="fm-help-p">${i18n.t('help.modes_intro')}</p>
      ${modes
        .map(
          (m) => `
        <div class="fm-help-card fm-help-card--${m}">
          <div class="fm-help-card-header">
            <span class="fm-help-card-icon">${icons[m]}</span>
            <span class="fm-help-card-title">${i18n.t(`help.mode_${m}_title`)}</span>
          </div>
          <p class="fm-help-p">${i18n.t(`help.mode_${m}_desc`)}</p>
        </div>
      `,
        )
        .join('')}
    `;
  }

  #renderFusion() {
    return `
      <p class="fm-help-p">${i18n.t('help.fusion_desc')}</p>
      <div class="fm-help-fusion-example">
        <div class="fm-help-tile fm-t2">2</div>
        <span class="fm-help-op">+</span>
        <div class="fm-help-tile fm-t2">2</div>
        <span class="fm-help-op">=</span>
        <div class="fm-help-tile fm-t4">4</div>
      </div>
      <div class="fm-help-fusion-example">
        <div class="fm-help-tile fm-t16">16</div>
        <span class="fm-help-op">+</span>
        <div class="fm-help-tile fm-t16">16</div>
        <span class="fm-help-op">=</span>
        <div class="fm-help-tile fm-t32">32</div>
      </div>
      <p class="fm-help-p fm-help-tip">${i18n.t('help.fusion_score')}</p>
      <p class="fm-help-p fm-help-tip">${i18n.t('help.fusion_combo')}</p>
    `;
  }

  #renderPowers() {
    const catOrder = [
      { key: 'danger', label: i18n.t('help.powers_cat_danger') },
      { key: 'warning', label: i18n.t('help.powers_cat_warning') },
      { key: 'info', label: i18n.t('help.powers_cat_info') },
    ];

    let powersHtml = `
      <p class="fm-help-p">${i18n.t('help.powers_intro')}</p>
      <div class="fm-help-card">
        <p class="fm-help-p fm-help-tip">${i18n.t('help.powers_appear')}</p>
        <p class="fm-help-p fm-help-tip">${i18n.t('help.powers_activate')}</p>
        <p class="fm-help-p fm-help-tip">${i18n.t('help.powers_conflict')}</p>
      </div>
    `;

    for (const { key, label } of catOrder) {
      const powers = POWER_CATEGORIES[key] ?? [];
      const items = powers
        .map((type) => {
          const svgId = Power.svgId(type);
          if (!svgId) return '';
          const name = i18n.t(Power.nameKey(type));
          const descKey = `help.power_${type.replace(/-/g, '_')}_desc`;
          const desc = i18n.t(descKey);
          return `
          <div class="fm-help-power-item">
            <div class="fm-power-dot ${key} tiny">
              <svg class="fm-power-icon" aria-hidden="true"><use href="#${svgId}"/></svg>
            </div>
            <div class="fm-help-power-text">
              <span class="fm-help-power-name">${name}</span>
              <span class="fm-help-power-desc">${desc}</span>
            </div>
          </div>
        `;
        })
        .join('');

      powersHtml += `
        <div class="fm-help-power-group">
          <div class="fm-help-power-group-title fm-help-power-group--${key}">${label}</div>
          ${items}
        </div>
      `;
    }

    return powersHtml;
  }

  #renderPredictions() {
    /* Use the exact same markup the game uses for edge badges:
       .fm-power-dot.tiny.{cat} > .fm-edge-warn  — CSS vars drive colors automatically. */
    const rows = [
      { cat: 'danger', key: 'help.predictions_danger' },
      { cat: 'warning', key: 'help.predictions_warning' },
      { cat: 'info', key: 'help.predictions_info' },
    ];
    const rowsHtml = rows
      .map(
        ({ cat, key }) => `
      <div class="fm-help-prediction-row">
        <div class="fm-power-dot tiny ${cat}">
          <span class="fm-edge-warn">!</span>
        </div>
        <span class="fm-help-p">${i18n.t(key)}</span>
      </div>
    `,
      )
      .join('');

    return `
      <p class="fm-help-p">${i18n.t('help.predictions_desc')}</p>
      <div class="fm-help-prediction-examples">${rowsHtml}</div>
      <p class="fm-help-p fm-help-tip">${i18n.t('help.predictions_priority')}</p>
    `;
  }

  #renderEnemies() {
    const levels = BATTLE.LEVELS;
    const levelBadges = levels
      .map((lvl) => `<div class="fm-help-enemy-badge fm-tile fm-t${lvl}">${lvl}</div>`)
      .join('');

    /* Mini enemy illustration: transparent tile with colored border (fm-t32),
       liquid HP fill at ~60% + a face image, mimicking the actual enemy tile in-game. */
    const enemyIllustration = `
      <div class="fm-help-enemy-preview">
        <div class="fm-help-enemy-tile fm-tile fm-t32">
          <div class="fm-help-enemy-liquid"></div>
          <div class="fm-help-enemy-face">
            <img src="images/faces/ok/1.png" alt="" aria-hidden="true" draggable="false">
          </div>
        </div>
        <span class="fm-help-p fm-help-tip" style="text-align:center;font-size:0.7rem">
          ${i18n.t('help.enemies_tap')}
        </span>
      </div>
    `;

    return `
      <p class="fm-help-p">${i18n.t('help.enemies_desc')}</p>
      ${enemyIllustration}
      <div class="fm-help-card">
        <p class="fm-help-p fm-help-tip">${i18n.t('help.enemies_spawn')}</p>
        <p class="fm-help-p fm-help-tip">${i18n.t('help.enemies_damage')}</p>
        <p class="fm-help-p fm-help-tip">${i18n.t('help.enemies_powers')}</p>
        <p class="fm-help-p fm-help-tip">${i18n.t('help.enemies_defeat')}</p>
      </div>
      <div class="fm-help-subsection-title">${i18n.t('help.enemies_levels')}</div>
      <div class="fm-help-enemy-levels">${levelBadges}</div>
    `;
  }

  #renderHp() {
    /* Three mini "grid tiles" with liquid fill rising from the bottom,
       matching the real .fm-grid-life-liquid visual at ok / warn / crit levels. */
    const demos = [
      { pct: 75, cls: 'ok', label: '75%' },
      { pct: 35, cls: 'warn', label: '35%' },
      { pct: 8, cls: 'crit', label: '8%' },
    ];
    const demosHtml = demos
      .map(
        ({ pct, cls, label }) => `
      <div class="fm-help-hp-tile-wrap">
        <div class="fm-help-hp-tile">
          <div class="fm-help-hp-liquid fm-help-hp-liquid--${cls}" style="height:${pct}%"></div>
        </div>
        <span class="fm-help-hp-pct">${label}</span>
      </div>
    `,
      )
      .join('');

    return `
      <p class="fm-help-p">${i18n.t('help.hp_desc')}</p>
      <div class="fm-help-hp-tiles">${demosHtml}</div>
      <div class="fm-help-card">
        <p class="fm-help-p fm-help-tip">${i18n.t('help.hp_formula')}</p>
        <p class="fm-help-p fm-help-tip">${i18n.t('help.hp_critical')}</p>
        <p class="fm-help-p fm-help-tip">${i18n.t('help.hp_gameover')}</p>
      </div>
      <p class="fm-help-p fm-help-tip">${i18n.t('help.hp_classic')}</p>
    `;
  }

  // ─── HELPERS ────────────────────────────────────

  /** @param {boolean} visible */
  #setBackVisible(visible) {
    const btn = this.#domElement?.node.querySelector('[data-action="back"]');
    if (btn) btn.style.display = visible ? '' : 'none';
  }

  #refreshButtons() {
    const node = this.#domElement?.node;
    if (!node) return;
    const title = node.querySelector('.fm-modal-title');
    if (title) title.textContent = i18n.t('help.title');
    const backBtn = node.querySelector('[data-action="back"]');
    if (backBtn) backBtn.textContent = i18n.t('help.back');
    const closeBtn = node.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.textContent = i18n.t('help.close');
  }

  destroy() {
    this.#keyNav?.destroy();
    this.#keyNav = null;
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#domElement?.destroy();
    this.#domElement = null;
  }
}
