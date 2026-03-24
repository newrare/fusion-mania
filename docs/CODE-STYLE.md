# Copilot Instructions - Fusion Mania

## Project Overview
Fusion Mania is a **mobile game** (vertical-only) built with **Phaser 3** and native web technologies.
It is bundled with **Vite**, tested with **Vitest**, and compiled to iOS/Android via **Capacitor**.

## Language & Style
- All code, comments and documentation must be written in **English**.
- In CSS files (same in HTML with CSS or `<style>` tags), section titles and comments must be written in English on a **single line** (e.g. `/* --- Section title --- */`). No multi-line block comments.
- Use **ES modules** (`import`/`export`) exclusively — no CommonJS (`require`).
- Use **modern JavaScript** (ES2022+): optional chaining, nullish coalescing, private class fields, etc.
- **No TypeScript** — use plain `.js` files only. Use **JSDoc** (`@param`, `@returns`, `@type`, `@typedef`) to document types.
- Prefer `const` over `let`. Never use `var`.
- Use **PascalCase** for classes and components (e.g., `Button`, `GameScene`).
- Use **camelCase** for variables, functions, and methods.
- Use **UPPER_SNAKE_CASE** for constants (e.g., `TILE_SIZE`, `MAX_HEALTH`).
- Use **kebab-case** for **all** file names without exception (e.g., `game-config.js`, `card-visual.js`, `state-manager.js`, `deck-scene.js`).
  - The exported class name stays PascalCase; only the file name is kebab-case.

## Architecture Rules
- Follow the folder structure defined in `docs/ARCHITECTURE.md`.
- **Scenes** go in `src/scenes/` — one class per file, extending `Phaser.Scene`.
- **UI Components** go in `src/components/` — reusable UI elements (buttons, modals, titles…).
- **Entities** go in `src/entities/` — game objects like units, cards, tiles.
- **Managers** go in `src/managers/` — singletons handling cross-cutting concerns (audio, state, input).
- **Utilities** go in `src/utils/` — pure helper functions with no side effects.
- **Configs** go in `src/configs/` — game configuration, constants, and settings.
- **Locales** go in `src/locales/` — one file per language (`en.js`, `fr.js`). Keys are dot-separated (e.g. `menu.play`).
- **Assets** go in `public/assets/` with sub-folders: `images/`, `audio/music/`, `audio/sfx/`, `spritesheets/`.
- Load assets in `PreloadScene` using root-relative paths: `this.load.image('key', 'assets/images/file.png')`.
- Keep `index.js` barrel files in each module folder to simplify imports.

## Coding Best Practices
- Keep files short and focused: one class or one responsibility per file.
- Prefer composition over inheritance (except for Phaser.Scene and Phaser.GameObjects).
- Extract reusable logic into `src/utils/` or `src/managers/`.
- Never hardcode magic numbers — define them in `src/configs/constants.js`.
- Never hardcode user-facing strings — use translation keys via `i18n.t('key')`.
- All public methods on classes should have a JSDoc comment with `@param` and `@returns`.
- Keep Phaser scene lifecycle methods (`init`, `preload`, `create`, `update`) clean: delegate to helpers.

## Testing
- Tests live in `tests/` mirroring the `src/` structure.
- Name test files `<FileName>.test.js`.
- Write unit tests for utils, managers, and entity logic.
- Use Vitest (`describe`, `it`, `expect`).
- Aim for testable code: inject dependencies, avoid global state, keep pure functions pure.

## Mobile & Performance
- The game runs in **vertical orientation only**
- Optimize assets: compress images, use texture atlases for sprites.
- Avoid memory leaks: clean up event listeners and timers in `shutdown()` / `destroy()`.
- Use Phaser's object pooling for frequently created/destroyed objects.
- Test on real mobile devices regularly via Capacitor.

## Capacitor (iOS / Android)
- Platform folders (`android/`, `ios/`) are generated — do not manually edit them unless necessary.
- Use `npx cap sync` after changing web assets or plugins.
- Keep native-specific config in `capacitor.config.js`.
