# Architecture — Fusion Mania

## Tech Stack

| Layer        | Technology               | Purpose                                 |
| ------------ | ------------------------ | --------------------------------------- |
| Game Engine  | **Phaser 3**             | Scene management, input, DOM overlay    |
| Bundler      | **Vite**                 | Fast dev server with HMR / hot reload   |
| Testing      | **Vitest**               | Unit tests (mirrors Vite configuration) |
| Mobile Build | **Capacitor** (planned)  | Wrap web app as native iOS / Android    |
| Language     | **JavaScript (ES2022+)** | Native web — JSDoc for type hints       |

## Folder Structure

```
fusion-mania/
├── CLAUDE.md                  # AI assistant guidance
├── index.html                 # Entry HTML (Vite entrypoint)
├── package.json
├── vite.config.js             # Vite dev server & build config
├── vitest.config.js           # Vitest test config
├── README.md
│
├── docs/                      # Project documentation
│   ├── ARCHITECTURE.md        # ← You are here
│   ├── ANIMATION.md           # Animation system, interruption model, testing guide
│   ├── BATTLE.md              # Battle mode system, enemy progression, contamination
│   ├── CODE-STYLE.md          # Coding conventions and best practices
│   ├── FREE.md                # Free mode power system
│   ├── LAYOUT.md              # Responsive layout, safe zone, CSS properties
│   ├── POWER.md               # Full power system documentation
│   ├── HISTORY.md             # History/event log system
│   ├── SAVE.md                # Save/load system documentation
│   └── TRANSLATE.md           # Localization guide
│
├── public/                    # Static files served as-is — no build processing
│   ├── images/                # PNG (tile assets, enemy faces)
│   │   └── faces/             # Enemy face images by emotion (ok, warning, danger, death)
│   ├── others/                # Font files
│   └── sounds/                # Music (WAV) and SFX (OGG)
│
├── src/                       # Application source code
│   ├── main.js                # Entry point — creates the Phaser.Game instance
│   │
│   ├── styles/
│   │   ├── main.css           # All game CSS (tiles, grid, HUD, modals)
│   │   └── power.css          # Power-specific CSS (states, flip cards, indicators)
│   │
│   ├── configs/               # Configuration & constants
│   │   ├── game-config.js     # Phaser GameConfig object
│   │   └── constants.js       # Shared constants (sizes, durations, scene keys…)
│   │
│   ├── scenes/                # Phaser scenes (one per screen / state)
│   │   ├── boot-scene.js      # Minimal boot, transitions to preload-scene
│   │   ├── preload-scene.js   # Asset loading with progress bar
│   │   ├── title-scene.js     # Title screen — tap/key → opens menu modal
│   │   └── game-scene.js      # Main 2048 gameplay (DOM tiles + CSS animations)
│   │
│   ├── components/            # DOM-based UI overlays (modals)
│   │   ├── admin-modal.js     # Debug/admin panel (tile spawning, state testing)
│   │   ├── enemy-info-modal.js# Enemy info display during battle
│   │   ├── game-over-modal.js # Game over overlay (score + actions)
│   │   ├── help-modal.js      # In-game help/tutorial (6 categories)
│   │   ├── menu-modal.js      # Main menu overlay (resume, modes, save, quit)
│   │   ├── options-modal.js   # Options (music, sound, theme, language, reset)
│   │   ├── power-choice-modal.js  # Choose between 2 conflicting powers on merge
│   │   ├── power-select-modal.js  # Pre-game power selection (Free mode)
│   │   ├── ranking-detail-modal.js# Detailed ranking entry view
│   │   ├── ranking-modal.js   # Leaderboard with tabs (Classic, Battle, Free)
│   │   ├── history-modal.js   # Game event history/log modal
│   │   ├── save-load-modal.js # Save/Load game slots management
│   │   ├── tile-renderer.js   # Tile DOM rendering helper (value, power, state)
│   │   └── victory-modal.js   # 2048 victory celebration
│   │
│   ├── entities/              # Game objects — pure logic, no Phaser/DOM dependency
│   │   ├── tile.js            # Tile data class (value, row, col, id, power, state)
│   │   ├── grid.js            # 4×4 grid logic (move, merge, spawn, canMove, serialize)
│   │   ├── grid-life.js       # HP system (Free / Battle modes)
│   │   ├── enemy.js           # Enemy data class (name, level, HP, powers)
│   │   └── power.js           # Power data class (type, side, svgId)
│   │
│   ├── managers/              # Cross-cutting singletons
│   │   ├── animation-manager.js # Tile DOM animations + cancellation system
│   │   ├── audio-manager.js   # Music & SFX via HTML5 Audio (singleton)
│   │   ├── battle-manager.js  # Battle mode logic (enemy spawn, contamination, damage)
│   │   ├── grid-manager.js    # Grid DOM, tile rendering, animation sequencing
│   │   ├── history-manager.js # Game event history/log (pure data, no DOM)
│   │   ├── hud-manager.js     # HUD stats, combo display, card rotations, help button
│   │   ├── i18n-manager.js    # Locale switching & translation lookups (singleton)
│   │   ├── input-manager.js   # Keyboard + swipe input (detect-on-move architecture)
│   │   ├── layout-manager.js  # Responsive layout & CSS custom properties (singleton)
│   │   ├── power-manager.js   # Power assignment, activation, prediction (Free/Battle)
│   │   ├── save-manager.js    # Persistence: rankings, save slots, auto-save (singleton)
│   │   └── theme-manager.js   # Tile color theme switching (singleton)
│   │
│   ├── locales/               # Translation files (one per language)
│   │   ├── en.js              # English strings
│   │   └── fr.js              # French strings
│   │
│   └── utils/                 # Pure helper functions
│       ├── background.js      # Scene background rendering
│       ├── event-emitter.js   # Lightweight pub/sub event emitter + gameEvents singleton
│       ├── keyboard-nav.js    # Modal keyboard navigation (arrows, enter, escape)
│       ├── liquid-wave.js     # Canvas wave animation for HP bars
│       └── math.js            # clamp, randomInt, shuffle, weightedPick
│
└── tests/                     # Unit tests (mirrors src/ structure)
    ├── components/
    │   ├── help-modal.test.js
    |   ├── history-modal.test.js
    |   ├── options-modal.test.js
    │   └── tile-renderer.test.js
    ├── entities/
    │   ├── enemy.test.js
    │   ├── grid.test.js
    │   ├── power.test.js
    │   ├── tile-state.test.js
    │   └── tile.test.js
    ├── managers/
    │   ├── animation-manager.test.js
    │   ├── audio-manager.test.js
    │   ├── battle-manager.test.js
    │   ├── i18n-manager.test.js
    │   ├── input-manager.test.js
    │   ├── power-manager.test.js
    │   ├── save-manager.test.js
    │   └── history-manager.test.js
    └── utils/
        ├── keyboard-nav.test.js
        └── math.test.js
```

## Key Design Decisions

### Scenes

Each game screen is a **Phaser.Scene** subclass in `src/scenes/`. Scenes follow the Phaser lifecycle:

1. `init(data)` — receive data from the previous scene
2. `preload()` — load scene-specific assets (most loading happens in PreloadScene)
3. `create()` — build the scene's game objects
4. `update(time, delta)` — game loop tick

Scenes should stay thin: delegate complex logic to **managers** and **entities**.

### Components

UI components are **plain JavaScript classes** — not Phaser scenes.
They receive a `scene` reference in their constructor and use Phaser's DOM element system to create
HTML overlays. All modals support keyboard navigation via `enableKeyboardNav()`.

### Managers

Managers are **singleton-ish** classes for cross-cutting concerns:

- **AnimationManager** — manages all DOM tile animations (slides, merges, spawns, particles, power effects). Completely independent of Phaser. See [ANIMATION.md](ANIMATION.md).
- **AudioManager** — singleton managing background music and SFX via HTML5 Audio (no Phaser dependency). Preloads all audio in `PreloadScene`, unlocks on first user gesture in `TitleScene`. Persists music/sound toggle preferences to localStorage. SFX keys map to `AUDIO.SFX` and `AUDIO.POWER_SFX` in `constants.js`.
- **GridManager** — orchestrates the 4×4 grid DOM, tile rendering via `TileRenderer`, and animation sequencing with generation-based cancellation.
- **HistoryManager** — pure data manager recording chronological game events (fusions, powers, enemy events, score, contamination). See [HISTORY.md](HISTORY.md).
- **InputManager** — keyboard (arrows/WASD) and touch swipe handling. Uses a **detect-on-move** architecture: direction fires during `touchmove` as soon as the finger crosses `SWIPE_THRESHOLD` px, with a one-direction-per-gesture flag. No time-based cooldown — ghost events are rejected structurally (near-zero displacement). 34 unit tests.
- **I18nManager** — singleton handling locale selection, translation lookups (`i18n.t('key')`), and persistence to `localStorage`. See [TRANSLATE.md](TRANSLATE.md).
- **LayoutManager** — singleton computing responsive layout from viewport. See [LAYOUT.md](LAYOUT.md).
- **PowerManager** — handles power assignment, activation of all 16 power types, and directional prediction for edge indicators. Used in Free and Battle modes.
- **SaveManager** — singleton persisting game state to `localStorage`: auto-save, manual save slots (up to 10), and per-mode rankings (top 10). See [SAVE.md](SAVE.md).
- **BattleManager** — handles enemy spawn logic, contamination, damage, and level progression. See [BATTLE.md](BATTLE.md).
- **ThemeManager** — singleton managing tile color theme (`candy`, `chroma`) with `data-theme` CSS scoping.

### Entities

Game objects live in `src/entities/`. They are **pure data/logic classes** with zero Phaser or DOM dependency, making them easy to unit test.

### Utils

Pure utility functions in `src/utils/` — no side effects, no Phaser dependency.
Easy to unit test.

### Assets

Assets live in `public/` and are **served directly** without any build processing.
Audio is loaded via HTML5 Audio in `AudioManager`. Images are referenced via root-relative URLs.

## Hot Reload

**Vite** provides near-instant Hot Module Replacement (HMR) during development:

```bash
npm run dev
```

The dev server starts at `http://localhost:3000`. Any change to source files triggers an automatic page reload, allowing rapid iteration.

## Mobile Builds (iOS / Android)

Capacitor mobile builds are planned but not yet set up. The game is designed as **vertical orientation only** (mobile-first).

## Testing

Tests use **Vitest** and live in `tests/`, mirroring the `src/` structure.

```bash
npm test          # Run once
npm run test:watch # Watch mode
```

Focus testing on:

- `utils/` — pure functions, easy to test
- `managers/` — state logic, subscriptions, animation primitives
- `entities/` — game logic detached from rendering
- `components/` — DOM rendering in happy-dom environment

See [ANIMATION.md](ANIMATION.md) for the full animation system documentation, including layers, interruption model, and testing guide.
