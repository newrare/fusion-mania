# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server at http://localhost:3000 (Vite HMR)
npm run build        # Production build → dist/
npm run preview      # Preview the production build
npm test             # Run all unit tests once (Vitest)
npm run test:watch   # Run tests in watch mode
```

To run a single test file:
```bash
npx vitest run tests/managers/animation-manager.test.js
```

Mobile builds (after `npm run build`):
```bash
npx cap sync         # Sync web assets to native projects
npx cap open android # Open Android Studio
npx cap open ios     # Open Xcode
```

## Architecture

Fusion Mania is a 2048-style puzzle game (mobile-first, vertical orientation) built with **Phaser 3** + **Vite**. The game renders the board as **DOM elements with CSS animations**, not Phaser sprites — this is intentional and keeps the animation system fully testable in happy-dom.

### Scene flow

`BootScene` → `PreloadScene` → `TitleScene` → `GameScene`

Scenes are thin and delegate everything to managers. The main gameplay scene is `src/scenes/game-scene.js`.

### Layer separation

| Layer          | Location          | Rule                                                                |
|----------------|-------------------|---------------------------------------------------------------------|
| **Entities**   | `src/entities/`   | Pure data/logic, **zero** Phaser or DOM dependency                  |
| **Managers**   | `src/managers/`   | Singletons for cross-cutting concerns                               |
| **Components** | `src/components/` | DOM-based UI overlays (modals)                                      |
| **Scenes**     | `src/scenes/`     | Thin Phaser.Scene subclasses                                        |
| **Utils**      | `src/utils/`      | Pure functions, no side effects                                     |
| **Configs**    | `src/configs/`    | All constants live in `constants.js` — never hardcode magic numbers |

### Animation system

`AnimationManager` (`src/managers/animation-manager.js`) owns all tile animations and has **no Phaser dependency**. It uses 6 layers: CSS slide, merge bounce, consumed fade, spawn pop, canvas particles, and fusion glow. All durations are constants under the `ANIM` object in `constants.js`.

**Interruption model**: when a move arrives mid-animation, `snapToFinalState()` instantly reconciles DOM with grid state, a forced reflow commits the snap, `restoreTransitions()` re-enables CSS, and `nextGen()` increments the generation counter. Every `await` in an animation coroutine is followed by an `isCurrent(gen)` guard — stale coroutines exit silently. See `docs/ANIMATION.md` for the full API.

To add a new animation: add a keyframe to `src/styles/main.css`, add a method to `AnimationManager`, call it from `GameScene.#executeMove` with an `isCurrent` guard, and write a test.

### Power system (Free Mode)

16 power types across 3 categories — destructive (fire H/V/X, bomb, lightning, nuclear), status (blind, expel H/V, teleport), and passive (ice, wind ×4). Powers are assigned to tiles every 2 moves. When a powered tile merges, its power activates; if two tiles with different powers merge, a choice modal appears. See `docs/POWER.md` for activation flow, tile states, and CSS classes.

### Layout & responsiveness

`LayoutManager` computes all dimensions from the viewport at runtime and pushes CSS custom properties (e.g. `--fm-tile-size`, `--fm-grid-gap`) to `#game-container`. Grid width is 87% of safe width, capped at 400px. All safe-zone insets (notch, home bar) are respected.

### Save & i18n

- `SaveManager` — `localStorage` persistence for game state, per-mode rankings (top 10), and save slots (up to 10). Rankings store score, date, maxTile, moves, fusions, and (for free mode) selected powers, (for battle mode) enemies defeated. Save slots store full game state including tile powers, states, grid life, battle/power manager state.
- `SaveLoadModal` (`src/components/save-load-modal.js`) — Modal listing saved game slots with mode, date, score, and max tile. Accessible from the title menu (Load) and in-game menu (Save).
- `I18nManager` — English/French via `src/locales/`. Keys are dot-separated (`menu.play`). Never hardcode user-facing strings; always use `i18n.t('key')`.

### Ranking modal

`RankingModal` (`src/components/ranking-modal.js`) provides a full-safe-zone leaderboard with tabs for Classic, Battle, and Free modes. Free mode scores display a row of power icons showing which powers were used. Rankings are stored and managed by `SaveManager`.

### Help modal

`HelpModal` (`src/components/help-modal.js`) is an in-game help/tutorial overlay accessible via the `?` button in the HUD (between stat3 and menu). Two-level navigation: index of 6 categories → detail view with back button. Categories: game modes, fusion, powers (with SVG icons), predictions, enemies, grid life. Fully i18n-aware (EN/FR) and keyboard-navigable. 29 unit tests in `tests/components/help-modal.test.js`.

### Battle mode

`BattleManager` (`src/managers/battle-manager.js`) handles enemy spawn logic, contamination, damage, and level progression. `Enemy` (`src/entities/enemy.js`) is a pure data class with name (100 math-themed names), level, HP (via `GridLife`), and available powers. The game alternates between a classic phase (10 moves) and a battle phase (enemy active). See `docs/BATTLE.md` for the full system.

### Audio system

`AudioManager` (`src/managers/audio-manager.js`) handles background music and SFX using HTML5 Audio (no Phaser dependency). It is a singleton imported as `audioManager`. All audio file paths and volume levels are defined in the `AUDIO` constant in `constants.js`.

**Lifecycle**: `PreloadScene` calls `audioManager.preload()` to create Audio elements. `TitleScene` calls `audioManager.unlock()` on the first user gesture (browser autoplay policy). Music starts automatically after unlock if enabled.

**SFX triggers**: `playSfx(key)` for UI/game events (fusion, victory, gameOver, notification, click), `playPowerSfx(powerType)` for power activations. A global `pointerdown` delegation on `.fm-btn` / `.fm-theme-btn` provides click SFX for all buttons.

**Options**: Music and sound toggles are in `OptionsModal`. Preferences are persisted to localStorage via `STORAGE_KEYS.OPTIONS`. 16 audio-manager tests + 11 options-modal tests.

### Keyboard navigation

All modals support keyboard navigation via `enableKeyboardNav()` (`src/utils/keyboard-nav.js`). Arrow keys cycle through focusable buttons/items, Enter/Space activates, Escape closes. Focus-visible outlines are styled in `main.css`.

## Code conventions

- **JavaScript only** — no TypeScript. Use JSDoc (`@param`, `@returns`, `@typedef`) for types.
- **File names**: always kebab-case (`game-scene.js`). Exported class names stay PascalCase.
- `const` over `let`, never `var`. ES2022+ features (optional chaining, nullish coalescing, private class fields).
- Each module folder has an `index.js` barrel export.
- Tests live in `tests/` mirroring `src/`. Test files are named `<FileName>.test.js`.
- CSS comments: single-line only (`/* --- Section title --- */`), no multi-line block comments.
- All code, comments, and documentation must be in English.
