import Phaser from 'phaser';
import { SCENE_KEYS, GRID_SIZE, POWER_TYPES, ANIM } from '../configs/constants.js';
import { layout } from '../managers/layout-manager.js';
import { i18n } from '../managers/i18n-manager.js';
import { audioManager } from '../managers/audio-manager.js';
import { addBackground } from '../utils/background.js';
import { GridManager } from '../managers/grid-manager.js';
import { InputManager } from '../managers/input-manager.js';
import { Tile } from '../entities/tile.js';
import { TileRenderer } from '../components/tile-renderer.js';

/**
 * Scripted "Level 0" tutorial scene.
 *
 * Each step places a deterministic board state and either waits for the player
 * to fulfil a condition via the real move pipeline, or runs a scripted handler
 * that calls the game's actual animation primitives (fire, contamination…).
 * Tile auto-spawn is disabled throughout so the board never drifts from the
 * step's setup.
 *
 * Step kinds:
 *   - 'interactive': let executeMove run; advance when condition(result) passes
 *   - 'scripted':    intercept the swipe, run a custom scenario (fire, enemy)
 *   - 'message':     banner-only (final "Play!" step) — no grid action
 */
export class TutorialScene extends Phaser.Scene {
  /** @type {GridManager | null} */
  #gridManager = null;

  /** @type {InputManager | null} */
  #inputManager = null;

  /** Phaser.GameObjects.DOMElement wrapper for the top banner. */
  #banner = null;

  /** Phaser.GameObjects.DOMElement wrapper for the skip button layer. */
  #skipDom = null;

  /** Phaser.GameObjects.DOMElement wrapper for the floating enemy. */
  #enemyDom = null;

  /** Phaser.GameObjects.DOMElement wrapper for the final "Play" button. */
  #playDom = null;

  /** Fake enemy HP (tutorial scenario only — not tied to BattleManager). */
  #enemyHp = 2;

  /** True once the enemy step has played its contamination effect. */
  #enemyContaminated = false;

  /** @type {number} */
  #step = 0;

  /** @type {boolean} */
  #advancing = false;

  /** @type {Function | null} */
  #unsubI18n = null;

  /** @type {((e: KeyboardEvent) => void) | null} */
  #keyHandler = null;

  /** @type {((e: PointerEvent) => void) | null} Global tap-to-start handler for the final step. */
  #tipsTapHandler = null;

  /** @type {((e: KeyboardEvent) => void) | null} Global key-to-start handler for the final step. */
  #tipsKeyHandler = null;

  /** Tracks which directions the player has validated on the swipe step. */
  #swipedDirs = new Set();

  /** @type {(() => void) | null} Pointerdown handler waiting for aftermath dismissal. */
  #aftermathTapHandler = null;

  /** @type {((e: KeyboardEvent) => void) | null} Keydown handler waiting for aftermath dismissal. */
  #aftermathKeyHandler = null;

  /**
   * @type {Array<{
   *   id: string,
   *   type: 'interactive' | 'scripted' | 'message',
   *   setup?: { r: number, c: number, v: number, state?: string, stateTurns?: number, targeted?: boolean }[],
   *   condition?: (result: any, grid: any) => boolean,
   * }>}
   */
  static STEPS = [
    {
      id: 'swipe',
      type: 'interactive',
      setup: [{ r: 1, c: 1, v: 2 }],
      // condition handled inline in #handleDirection (requires all 4 directions)
    },
    {
      id: 'fusion',
      type: 'interactive',
      setup: [
        { r: 1, c: 0, v: 2 },
        { r: 1, c: 3, v: 2 },
      ],
      condition: (res) => res.merges.length > 0,
    },
    {
      id: 'ice',
      type: 'interactive',
      setup: [
        { r: 1, c: 0, v: 2, state: 'ice', stateTurns: 6 },
        { r: 1, c: 2, v: 4 },
      ],
      condition: (res) => res.moved,
    },
    {
      id: 'fire_v',
      type: 'scripted',
      // Column 1 has a free cell so the swipe actually moves a tile
      // before fire-V triggers (mirrors real-game behavior).
      setup: [
        { r: 0, c: 1, v: 2 },
        { r: 2, c: 1, v: 4, targeted: true },
        { r: 3, c: 1, v: 8 },
      ],
    },
    {
      id: 'enemy',
      type: 'scripted',
      // Corner-symmetric setup — every direction produces two merges,
      // so the player can't land in a dead-end no matter how they swipe.
      setup: [
        { r: 1, c: 0, v: 2 },
        { r: 1, c: 3, v: 2 },
        { r: 2, c: 0, v: 2 },
        { r: 2, c: 3, v: 2 },
      ],
    },
    {
      id: 'tips',
      type: 'message',
    },
  ];

  constructor() {
    super({ key: SCENE_KEYS.TUTORIAL });
  }

  create() {
    layout.update(window.innerWidth, window.innerHeight);
    addBackground(this);

    if (this.game?.domContainer) {
      this.game.domContainer.style.zIndex = '5';
    }

    this.#gridManager = new GridManager();
    this.#gridManager.createContainer(this);
    // Tutorial is deterministic — disable random spawning entirely.
    this.#gridManager.grid.spawnTile = () => null;

    this.#createBanner();
    this.#createSkipButton();

    this.#inputManager = new InputManager(this, {
      onDirection: (dir) => this.#handleDirection(dir),
      onMenu: () => this.#finish(),
      isBlocked: () => this.#advancing || !!this.#gridManager?.animating,
    });
    this.#inputManager.bind();

    this.#keyHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.#finish();
      }
    };
    window.addEventListener('keydown', this.#keyHandler);

    this.#unsubI18n = i18n.onChange(() => this.#refreshTexts());

    this.events.on('shutdown', () => this.shutdown());

    this.#step = 0;
    this.#renderStep();

    const unlock = () => {
      audioManager.unlock();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
  }

  // ─── Step orchestration ────────────────────────────

  #currentStep() {
    return TutorialScene.STEPS[this.#step] ?? null;
  }

  #renderStep() {
    const step = this.#currentStep();
    if (!step) {
      this.#finish();
      return;
    }
    this.#removeEnemy();
    this.#removeEdgeIndicators();

    this.#hidePlayButton();
    this.#removeTipsTapHandler();

    const extraEl = this.#banner?.node.querySelector('#fm-tuto-banner-extra');
    if (extraEl) extraEl.innerHTML = '';

    if (step.type === 'message') {
      this.#clearBoard();
      this.#setBanner(i18n.t(`tuto.step_${step.id}_title`), i18n.t(`tuto.step_${step.id}_hint`));
      this.#setSkipBtnVisible(false);
      this.#installTipsTapHandler();
      this.#showPlayButton();
      if (extraEl) {
        extraEl.innerHTML = `
          <div class="fm-tuto-help-preview">
            <span class="fm-mode-badge fm-tuto-help-badge" aria-hidden="true">?</span>
            <span class="fm-tuto-help-label">${i18n.t('menu.help')}</span>
          </div>
          <p class="fm-tuto-banner-sub">${i18n.t('tuto.step_tips_sub')}</p>
        `;
      }
    } else if (step.type === 'scripted' && step.id === 'enemy') {
      this.#setupBoard(step.setup ?? []);
      this.#spawnEnemy();
      this.#setBanner(i18n.t(`tuto.step_${step.id}_title`), i18n.t(`tuto.step_${step.id}_hint`));
    } else if (step.type === 'scripted' && step.id === 'fire_v') {
      this.#setupBoard(step.setup ?? []);
      this.#spawnEdgeIndicators(['top', 'bottom'], POWER_TYPES.FIRE_V, 'danger');
      this.#setBanner(i18n.t(`tuto.step_${step.id}_title`), i18n.t(`tuto.step_${step.id}_hint`));
    } else {
      this.#setupBoard(step.setup ?? []);
      this.#setBanner(i18n.t(`tuto.step_${step.id}_title`), i18n.t(`tuto.step_${step.id}_hint`));
      if (step.id === 'swipe') {
        this.#swipedDirs.clear();
        this.#updateSwipeDirsDisplay();
      }
    }
    this.#updateDots();
  }

  // ─── Edge indicators (fire-V step) ─────────────────

  /**
   * @param {('top'|'bottom'|'left'|'right')[]} sides
   * @param {string} powerType
   * @param {'danger'|'warning'|'info'} category
   */
  #spawnEdgeIndicators(sides, powerType, category) {
    this.#removeEdgeIndicators();
    const gridEl = this.#gridManager?.gridEl;
    if (!gridEl) return;
    const svgId = `s-${powerType}`;
    for (const side of sides) {
      const badge = document.createElement('div');
      badge.className = `fm-edge-power ${side} fm-tuto-edge-indicator`;
      badge.innerHTML = `
        <div class="fm-power-dot ${category} tiny">
          <svg class="fm-power-icon" aria-hidden="true"><use href="#${svgId}"/></svg>
        </div>
      `;
      gridEl.appendChild(badge);
    }
  }

  #removeEdgeIndicators() {
    const gridEl = this.#gridManager?.gridEl;
    if (!gridEl) return;
    for (const el of gridEl.querySelectorAll('.fm-tuto-edge-indicator')) {
      el.remove();
    }
  }

  async #handleDirection(dir) {
    const step = this.#currentStep();
    if (!step) return;
    if (step.type === 'interactive') {
      const waitFn = (ms) => new Promise((resolve) => this.time.delayedCall(ms, resolve));
      const result = await this.#gridManager.executeMove(dir, waitFn);
      // executeMove leaves animating=true after a success — reset so the next swipe isn't blocked.
      if (this.#gridManager) this.#gridManager.animating = false;
      if (!result || !result.moved) return;
      if (step.id === 'swipe') {
        this.#swipedDirs.add(dir);
        this.#updateSwipeDirsDisplay();
        if (this.#swipedDirs.size >= 4) await this.#advance();
        return;
      }
      if (step.condition?.(result, this.#gridManager.grid)) {
        await this.#advance();
      }
    } else if (step.type === 'scripted') {
      if (step.id === 'fire_v') await this.#scriptFireV(dir);
      else if (step.id === 'enemy') await this.#scriptEnemy(dir);
    }
  }

  /** Renders the 4 directional arrow indicators inside the banner extra div. */
  #updateSwipeDirsDisplay() {
    const extraEl = this.#banner?.node.querySelector('#fm-tuto-banner-extra');
    if (!extraEl) return;
    const dirs = [
      { key: 'up', arrow: '↑' },
      { key: 'down', arrow: '↓' },
      { key: 'left', arrow: '←' },
      { key: 'right', arrow: '→' },
    ];
    extraEl.innerHTML = `<div class="fm-tuto-dir-arrows">${dirs
      .map(
        ({ key, arrow }) =>
          `<span class="fm-tuto-dir-arrow${this.#swipedDirs.has(key) ? ' fm-tuto-dir-arrow--done' : ''}">${arrow}</span>`,
      )
      .join('')}</div>`;
  }

  async #advance() {
    if (this.#advancing) return;
    this.#advancing = true;

    // Hold the success-flash state for ~1 s so the player has time to
    // register what just happened before the next step's board loads in.
    const bannerEl = this.#banner?.node.querySelector('.fm-tuto-banner');
    bannerEl?.classList.add('fm-tuto-banner--success');
    await new Promise((resolve) => this.time.delayedCall(1000, resolve));
    bannerEl?.classList.remove('fm-tuto-banner--success');

    this.#step++;
    if (this.#step >= TutorialScene.STEPS.length) {
      this.#finish();
      return;
    }
    this.#renderStep();
    this.#advancing = false;
  }

  // ─── Scripted step handlers ────────────────────────

  /**
   * Fire-V demo: horizontal swipes are rejected with a hint; vertical swipes
   * run the real move (so the tile slides first) then trigger the fire-V
   * animation on whatever targeted tile remains in column 1.
   * @param {'up'|'down'|'left'|'right'} dir
   */
  async #scriptFireV(dir) {
    if (this.#advancing) return;
    if (dir !== 'up' && dir !== 'down') {
      this.#flashBannerWrongDirection(i18n.t('tuto.step_fire_v_wrong'));
      return;
    }
    this.#advancing = true;

    // 1) Let the real move pipeline run — tiles actually slide.
    const waitFn = (ms) => new Promise((resolve) => this.time.delayedCall(ms, resolve));
    await this.#gridManager.executeMove(dir, waitFn);
    if (this.#gridManager) this.#gridManager.animating = false;

    // 2) Locate target tile + victims in column 1 after the slide.
    const grid = this.#gridManager.grid;
    const columnTiles = [0, 1, 2, 3].map((r) => grid.cells[r][1]).filter(Boolean);
    const target = columnTiles.find((t) => t.targeted) ?? columnTiles[0];
    const victims = columnTiles.filter((t) => t !== target);

    if (!target || victims.length === 0) {
      this.#advancing = false;
      await this.#advance();
      return;
    }

    // 3) Clear the sunburst halo right before the power fires (visual fidelity).
    target.targeted = false;
    const targetEl = this.#gridManager.tileElements.get(target.id);
    if (targetEl) TileRenderer.applyState(targetEl, target);

    // 4) Remove edge indicators — they're "consumed" by activation.
    this.#removeEdgeIndicators();

    // 5) Play the fire-V animation.
    this.#gridManager.playFireAnimation(POWER_TYPES.FIRE_V, target, victims);
    await new Promise((resolve) =>
      this.time.delayedCall(ANIM.FIRE_BALL_DURATION + ANIM.FIRE_ZAP_DURATION + 80, resolve),
    );

    // 6) Clean up destroyed tiles from grid + DOM.
    for (const v of victims) grid.cells[v.row][v.col] = null;
    this.#gridManager.removeTiles(victims);

    // 7) Grid-hurt flash to echo HP damage feedback.
    this.#flashGridHurt();
    await new Promise((resolve) => this.time.delayedCall(250, resolve));

    // 8) Show HP/Game Over aftermath message — wait for player tap or key press.
    this.#setBanner(
      i18n.t('tuto.step_fire_v_aftermath_title'),
      i18n.t('tuto.step_fire_v_aftermath_hint'),
    );
    await this.#waitForAftermath();

    this.#advancing = false;
    await this.#advance();
  }

  /**
   * Enemy demo: a merging swipe sends attack particles at the enemy (with
   * floating damage popup + brightness flash), then the enemy retaliates
   * by contaminating a surviving tile (purple particles → ice state).
   * @param {'up'|'down'|'left'|'right'} dir
   */
  async #scriptEnemy(dir) {
    if (this.#advancing) return;
    const waitFn = (ms) => new Promise((resolve) => this.time.delayedCall(ms, resolve));
    const result = await this.#gridManager.executeMove(dir, waitFn);
    if (this.#gridManager) this.#gridManager.animating = false;
    if (!result || !result.moved) return;

    if (result.merges.length > 0) {
      this.#advancing = true;

      // 1) Gold particles fly from each merged tile to the enemy tile.
      await this.#playAttackParticles(result.merges);

      // 2) On arrival: damage popup, HP bar update, hurt flash.
      const damage = result.merges.length;
      this.#enemyHp = Math.max(0, this.#enemyHp - damage);
      this.#showEnemyDamage(damage);
      this.#playEnemyHit();
      await new Promise((resolve) => this.time.delayedCall(300, resolve));

      // 3) Enemy retaliates: purple particles → ice state on a surviving tile.
      if (!this.#enemyContaminated) {
        this.#enemyContaminated = true;
        await this.#contaminateRandomTile();
      }

      this.#advancing = false;
      await this.#advance();
    }
  }

  /**
   * Waits for a tap (pointerdown) or any non-Escape key before resolving.
   * Used after the fire-V aftermath banner so the player can read it.
   */
  async #waitForAftermath() {
    return new Promise((resolve) => {
      const complete = () => {
        this.#removeAftermathHandlers();
        resolve();
      };
      const tap = () => complete();
      const key = (e) => {
        if (e.key === 'Escape') return;
        complete();
      };
      this.#aftermathTapHandler = tap;
      this.#aftermathKeyHandler = key;
      // Small delay so the swipe that triggered fire-V doesn't immediately resolve.
      this.time.delayedCall(150, () => {
        if (this.#aftermathTapHandler === tap) {
          window.addEventListener('pointerdown', tap, { capture: true });
          window.addEventListener('keydown', key, { capture: true });
        }
      });
    });
  }

  #removeAftermathHandlers() {
    if (this.#aftermathTapHandler) {
      window.removeEventListener('pointerdown', this.#aftermathTapHandler, { capture: true });
      this.#aftermathTapHandler = null;
    }
    if (this.#aftermathKeyHandler) {
      window.removeEventListener('keydown', this.#aftermathKeyHandler, { capture: true });
      this.#aftermathKeyHandler = null;
    }
  }

  /**
   * Contaminate a surviving tile: purple particles from the enemy converge
   * on the tile, then ice state is applied with a shadow-pulse on impact.
   */
  async #contaminateRandomTile() {
    const tiles = this.#gridManager.grid.getAllTiles().filter((t) => t.state !== 'ice');
    if (tiles.length === 0) return;
    const tile = tiles[0];
    const el = this.#gridManager.tileElements.get(tile.id);
    if (!el) return;

    // Particles from enemy → tile
    await this.#playContaminationTo(el);

    // On arrival: freeze the tile + dark shadow pulse (same class as battle mode).
    tile.state = 'ice';
    tile.stateTurns = 6;
    TileRenderer.applyState(el, tile);
    el.classList.add('fm-tile-hit-contaminate');
    el.addEventListener('animationend', () => el.classList.remove('fm-tile-hit-contaminate'), {
      once: true,
    });
    await new Promise((resolve) => this.time.delayedCall(500, resolve));
  }

  // ─── Canvas particle helpers (ported from GameScene battle mode) ──

  /**
   * Gold Bézier particles from each merged tile to the enemy.
   * @param {{ tile: import('../entities/tile.js').Tile }[]} merges
   */
  async #playAttackParticles(merges) {
    const enemyTileEl = this.#enemyDom?.node.querySelector('.fm-tuto-enemy-tile');
    if (!enemyTileEl || !merges.length) return;
    const enemyRect = enemyTileEl.getBoundingClientRect();
    const ex = enemyRect.left + enemyRect.width / 2;
    const ey = enemyRect.top + enemyRect.height / 2;

    const DURATION = 560;
    const COUNT = 4;
    const particles = [];
    for (const merge of merges) {
      const tileEl = this.#gridManager.tileElements.get(merge.tile?.id);
      if (!tileEl) continue;
      const rect = tileEl.getBoundingClientRect();
      const sx = rect.left + rect.width / 2;
      const sy = rect.top + rect.height / 2;
      for (let i = 0; i < COUNT; i++) {
        const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const burstDist = 55 + Math.random() * 55;
        particles.push({
          p0: { x: sx + (Math.random() - 0.5) * 6, y: sy + (Math.random() - 0.5) * 6 },
          p1: { x: sx + Math.cos(angle) * burstDist, y: sy + Math.sin(angle) * burstDist },
          p2: { x: ex + (Math.random() - 0.5) * 4, y: ey + (Math.random() - 0.5) * 4 },
          size: 3 + Math.random() * 2,
          delay: Math.random() * 0.1,
        });
      }
    }
    if (!particles.length) return;
    await this.#runParticleLoop(particles, DURATION, 'attack');
  }

  /**
   * Purple Bézier particles from the enemy onto the target element.
   * @param {HTMLElement} targetEl
   */
  async #playContaminationTo(targetEl) {
    const enemyTileEl = this.#enemyDom?.node.querySelector('.fm-tuto-enemy-tile');
    if (!enemyTileEl) return;
    const enemyRect = enemyTileEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const sx = enemyRect.left + enemyRect.width / 2;
    const sy = enemyRect.top + enemyRect.height / 2;
    const ex = targetRect.left + targetRect.width / 2;
    const ey = targetRect.top + targetRect.height / 2;

    const DURATION = 550;
    const COUNT = 4;
    const particles = [];
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const burstDist = 45 + Math.random() * 45;
      particles.push({
        p0: { x: sx + (Math.random() - 0.5) * 6, y: sy + (Math.random() - 0.5) * 6 },
        p1: { x: sx + Math.cos(angle) * burstDist, y: sy + Math.sin(angle) * burstDist },
        p2: { x: ex + (Math.random() - 0.5) * 4, y: ey + (Math.random() - 0.5) * 4 },
        size: 2.5 + Math.random() * 2,
        delay: Math.random() * 0.12,
      });
    }
    await this.#runParticleLoop(particles, DURATION, 'contaminate');
  }

  /**
   * Shared canvas-particle rAF loop. Paints fire-and-forget; awaits the
   * nominal duration via scene.time so tests with a stubbed delayedCall
   * resolve immediately.
   * @param {Array<any>} particles
   * @param {number} duration
   * @param {'attack'|'contaminate'} kind
   */
  async #runParticleLoop(particles, duration, kind) {
    const cvs = document.createElement('canvas');
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
    cvs.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1000;';
    cvs.classList.add('fm-tuto-particle-canvas');
    document.body.appendChild(cvs);
    const ctx = cvs.getContext('2d');

    const bezier = (p0, p1, p2, t) => ({
      x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x,
      y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y,
    });

    const palette =
      kind === 'attack'
        ? { trail: '255,200,30', glow: '255,180,0,0.18', body: '#ffb800', core: '#fff' }
        : { trail: '130,0,210', glow: '70,0,150,0.2', body: '#5500bb', core: '#bb88ff' };

    const startTime =
      typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const frame = (now) => {
      if (!cvs.isConnected || !ctx) return;
      const globalT = Math.min((now - startTime) / duration, 1);
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      for (const p of particles) {
        const t = Math.min(Math.max((globalT - p.delay) / (1 - p.delay), 0), 1);
        if (t <= 0) continue;
        const pos = bezier(p.p0, p.p1, p.p2, t);
        for (let i = 1; i <= 12; i++) {
          const progress = i / 12;
          const tA = Math.max(0, t - 0.2 * (1 - (i - 1) / 12));
          const tB = Math.max(0, t - 0.2 * (1 - i / 12));
          const a = bezier(p.p0, p.p1, p.p2, tA);
          const b = bezier(p.p0, p.p1, p.p2, tB);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${palette.trail},${progress * 0.6})`;
          ctx.lineWidth = p.size * progress * 0.85;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${palette.glow})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = palette.body;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = palette.core;
        ctx.fill();
      }
      if (globalT < 1 && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(frame);
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);

    await new Promise((resolve) => this.time.delayedCall(duration, resolve));
    cvs.remove();
  }

  /**
   * Floating red "-damage" popup — reuses the battle-mode CSS, but attached
   * to document.body with a fixed position so it outlives the enemy element
   * when the step advances.
   */
  #showEnemyDamage(damage) {
    const enemyTileEl = this.#enemyDom?.node.querySelector('.fm-tuto-enemy-tile');
    if (!enemyTileEl) return;
    const rect = enemyTileEl.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'fm-enemy-damage fm-tuto-damage-float';
    popup.textContent = `-${damage}`;
    popup.style.left = `${rect.left - 34}px`;
    popup.style.top = `${rect.top + rect.height * 0.3}px`;
    document.body.appendChild(popup);
    popup.addEventListener('animationend', () => popup.remove(), { once: true });
  }

  // ─── Board setup / teardown ────────────────────────

  /** @param {{ r: number, c: number, v: number, state?: string, stateTurns?: number, targeted?: boolean }[]} setup */
  #setupBoard(setup) {
    this.#clearBoard();
    const grid = this.#gridManager.grid;
    for (const cfg of setup) {
      const tile = new Tile(cfg.v, cfg.r, cfg.c);
      if (cfg.state) {
        tile.state = cfg.state;
        tile.stateTurns = cfg.stateTurns ?? 6;
      }
      if (cfg.targeted) tile.targeted = true;
      grid.cells[cfg.r][cfg.c] = tile;
    }
    this.#gridManager.renderAllTiles();
    // renderAllTiles creates bare tile elements — apply state/targeted visuals.
    for (const tile of grid.getAllTiles()) {
      const el = this.#gridManager.tileElements.get(tile.id);
      if (el) TileRenderer.applyState(el, tile);
    }
  }

  #clearBoard() {
    const grid = this.#gridManager.grid;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        grid.cells[r][c] = null;
      }
    }
    for (const el of this.#gridManager.tileElements.values()) el.remove();
    this.#gridManager.tileElements.clear();
  }

  // ─── Enemy (tutorial-only scripted visual) ─────────

  #spawnEnemy() {
    this.#enemyHp = 2;
    this.#enemyContaminated = false;
    const html = `
      <div class="fm-tuto-layer">
        <div class="fm-tuto-enemy" id="fm-tuto-enemy">
          <div class="fm-tuto-enemy-tile fm-tile fm-t32">
            <div class="fm-help-enemy-liquid"></div>
            <div class="fm-help-enemy-face">
              <img src="images/faces/ok/1.png" alt="" aria-hidden="true" draggable="false">
            </div>
          </div>
          <div class="fm-tuto-enemy-hp" id="fm-tuto-enemy-hp">HP ${this.#enemyHp}/2</div>
        </div>
      </div>
    `;
    const dom = this.add.dom(0, 0).createFromHTML(html);
    dom.setOrigin(0, 0);
    dom.setDepth(205);
    this.#enemyDom = dom;
  }

  #removeEnemy() {
    this.#enemyDom?.destroy();
    this.#enemyDom = null;
  }

  #playEnemyHit() {
    const root = this.#enemyDom?.node;
    if (!root) return;
    const tile = root.querySelector('.fm-tuto-enemy-tile');
    const hp = root.querySelector('#fm-tuto-enemy-hp');
    if (tile) {
      // Combine the tutorial shake + the real-game brightness wash.
      tile.classList.remove('fm-enemy--hurt');
      void tile.offsetWidth;
      tile.classList.add('fm-tuto-enemy-hit', 'fm-enemy--hurt');
      this.time.delayedCall(400, () =>
        tile.classList.remove('fm-tuto-enemy-hit', 'fm-enemy--hurt'),
      );
    }
    if (hp) hp.textContent = `HP ${this.#enemyHp}/2`;
  }

  // ─── Banner ────────────────────────────────────────

  #createBanner() {
    const html = `
      <div class="fm-tuto-layer">
        <div class="fm-tuto-banner">
          <div class="fm-tuto-banner-title" id="fm-tuto-banner-title"></div>
          <div class="fm-tuto-banner-hint" id="fm-tuto-banner-hint"></div>
          <div class="fm-tuto-banner-extra" id="fm-tuto-banner-extra"></div>
          <div class="fm-tuto-banner-dots" id="fm-tuto-banner-dots"></div>
        </div>
      </div>
    `;
    const dom = this.add.dom(0, 0).createFromHTML(html);
    dom.setOrigin(0, 0);
    dom.setDepth(210);
    this.#banner = dom;
  }

  /**
   * @param {string} title
   * @param {string} hint
   */
  #setBanner(title, hint) {
    const titleEl = this.#banner?.node.querySelector('#fm-tuto-banner-title');
    const hintEl = this.#banner?.node.querySelector('#fm-tuto-banner-hint');
    if (titleEl) titleEl.textContent = title;
    if (hintEl) hintEl.innerHTML = hint;
    const bannerEl = this.#banner?.node.querySelector('.fm-tuto-banner');
    if (bannerEl) {
      bannerEl.classList.remove('fm-tuto-banner--enter', 'fm-tuto-banner--wrong');
      void bannerEl.offsetWidth;
      bannerEl.classList.add('fm-tuto-banner--enter');
    }
  }

  // ─── Final "Play" button (shown only on the tips step) ──

  #showPlayButton() {
    if (this.#playDom) return;
    const html = `
      <div class="fm-tuto-layer fm-tuto-layer--play">
        <button class="fm-btn fm-btn--primary fm-tuto-play-btn fm-clickable" data-action="play">
          ${i18n.t('tuto.play')}
        </button>
      </div>
    `;
    const dom = this.add.dom(0, 0).createFromHTML(html);
    dom.setOrigin(0, 0);
    dom.setDepth(225);
    this.#playDom = dom;
    const btn = dom.node.querySelector('[data-action="play"]');
    btn?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.#finish();
    });
  }

  #hidePlayButton() {
    this.#playDom?.destroy();
    this.#playDom = null;
  }

  /** @param {string} msg */
  #flashBannerWrongDirection(msg) {
    const hint = this.#banner?.node.querySelector('#fm-tuto-banner-hint');
    const banner = this.#banner?.node.querySelector('.fm-tuto-banner');
    if (hint) {
      const step = this.#currentStep();
      const original = step ? i18n.t(`tuto.step_${step.id}_hint`) : '';
      hint.textContent = msg;
      banner?.classList.add('fm-tuto-banner--wrong');
      this.time.delayedCall(1100, () => {
        if (this.#banner?.node.querySelector('#fm-tuto-banner-hint') === hint) {
          hint.textContent = original;
          banner?.classList.remove('fm-tuto-banner--wrong');
        }
      });
    }
  }

  /** Short red flash around the grid to signal damage (fire step). */
  #flashGridHurt() {
    const gridEl = this.#gridManager?.gridEl;
    if (!gridEl) return;
    gridEl.classList.add('fm-tuto-grid-hurt');
    this.time.delayedCall(400, () => gridEl.classList.remove('fm-tuto-grid-hurt'));
  }

  #updateDots() {
    const dotsEl = this.#banner?.node.querySelector('#fm-tuto-banner-dots');
    if (!dotsEl) return;
    dotsEl.innerHTML = TutorialScene.STEPS.map((_, i) => {
      const cls = i < this.#step ? 'done' : i === this.#step ? 'active' : 'pending';
      return `<span class="fm-tuto-dot fm-tuto-dot--${cls}"></span>`;
    }).join('');
  }

  // ─── Skip button ───────────────────────────────────

  #createSkipButton() {
    const html = `<button class="fm-btn fm-btn--small fm-tuto-skip-btn fm-clickable" data-action="skip">${i18n.t('tuto.skip')}</button>`;
    const gridBottom = layout.grid.y + layout.grid.totalWidth / 2;
    const y = gridBottom + 20;
    const dom = this.add.dom(layout.safe.cx, y).createFromHTML(html);
    dom.setOrigin(0.5, 0);
    dom.setDepth(220);
    this.#skipDom = dom;
    const btn = dom.node.querySelector('[data-action="skip"]');
    btn?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.#finish({ mode: 'battle', battleLevel: 0 });
    });
  }

  /** @param {boolean} visible */
  #setSkipBtnVisible(visible) {
    const btn = this.#skipDom?.node.querySelector('[data-action="skip"]');
    if (btn) btn.style.display = visible ? '' : 'none';
  }

  /** On the final tips step, any pointerdown or key press starts a fresh battle-mode run. */
  #installTipsTapHandler() {
    if (this.#tipsTapHandler || this.#tipsKeyHandler) return;
    const tap = (e) => {
      if (this.#advancing) return;
      e.stopPropagation();
      this.#finish({ mode: 'battle', battleLevel: 0 });
    };
    const key = (e) => {
      if (this.#advancing) return;
      e.stopPropagation();
      e.preventDefault();
      this.#finish({ mode: 'battle', battleLevel: 0 });
    };
    this.#tipsTapHandler = tap;
    this.#tipsKeyHandler = key;
    // Defer one frame so the pointerdown/keydown that advanced into this step doesn't immediately fire it.
    this.time.delayedCall(0, () => {
      if (this.#tipsTapHandler === tap) {
        window.addEventListener('pointerdown', tap, { capture: true });
      }
      if (this.#tipsKeyHandler === key) {
        window.addEventListener('keydown', key, { capture: true });
      }
    });
  }

  #removeTipsTapHandler() {
    if (this.#tipsTapHandler) {
      window.removeEventListener('pointerdown', this.#tipsTapHandler, { capture: true });
      this.#tipsTapHandler = null;
    }
    if (this.#tipsKeyHandler) {
      window.removeEventListener('keydown', this.#tipsKeyHandler, { capture: true });
      this.#tipsKeyHandler = null;
    }
  }

  // ─── Locale live-refresh ───────────────────────────

  #refreshTexts() {
    const step = this.#currentStep();
    if (!step) return;
    const skipBtn = this.#skipDom?.node.querySelector('[data-action="skip"]');
    if (skipBtn) skipBtn.textContent = i18n.t('tuto.skip');
    const titleEl = this.#banner?.node.querySelector('#fm-tuto-banner-title');
    const hintEl = this.#banner?.node.querySelector('#fm-tuto-banner-hint');
    if (titleEl) titleEl.textContent = i18n.t(`tuto.step_${step.id}_title`);
    if (hintEl) hintEl.innerHTML = i18n.t(`tuto.step_${step.id}_hint`);
    if (step.id === 'tips') {
      const subEl = this.#banner?.node.querySelector('.fm-tuto-banner-sub');
      if (subEl) subEl.innerHTML = i18n.t('tuto.step_tips_sub');
      const labelEl = this.#banner?.node.querySelector('.fm-tuto-help-label');
      if (labelEl) labelEl.textContent = i18n.t('menu.help');
    }
    const playBtn = this.#playDom?.node.querySelector('[data-action="play"]');
    if (playBtn) playBtn.textContent = i18n.t('tuto.play');
  }

  // ─── Teardown ──────────────────────────────────────

  /** @param {{ mode?: string, battleLevel?: number }} [data] */
  #finish(data = { mode: 'classic' }) {
    this.#removeTipsTapHandler();
    this.scene.start(SCENE_KEYS.GRID, data);
  }

  shutdown() {
    if (this.#keyHandler) {
      window.removeEventListener('keydown', this.#keyHandler);
      this.#keyHandler = null;
    }
    this.#removeTipsTapHandler();
    this.#removeAftermathHandlers();
    this.#inputManager?.shutdown();
    this.#inputManager = null;
    this.#unsubI18n?.();
    this.#unsubI18n = null;
    this.#banner?.destroy();
    this.#banner = null;
    this.#skipDom?.destroy();
    this.#skipDom = null;
    this.#hidePlayButton();
    this.#removeEnemy();
    this.#removeEdgeIndicators();
    document
      .querySelectorAll('.fm-tuto-particle-canvas, .fm-tuto-damage-float')
      .forEach((el) => el.remove());
    this.#gridManager = null;
  }
}
