# Architecture — Fusion Mania

## Tech Stack

| Layer        | Technology                  | Purpose                                |
|--------------|-----------------------------|----------------------------------------|
| Game Engine  | **Phaser 3**                | Rendering, physics, input, audio       |
| Bundler      | **Vite**                    | Fast dev server with HMR / hot reload  |
| Testing      | **Vitest**                  | Unit tests (mirrors Vite configuration)|
| Linting      | **ESLint** + **Prettier**   | Code quality & consistent formatting   |
| Mobile Build | **Capacitor**               | Wrap web app as native iOS / Android   |
| Language     | **JavaScript (ES2022+)**    | Native web — JSDoc for type hints      |

## Folder Structure

```
fusionMania/
├── .copilot-instructions.md   # Copilot coding directives
├── .gitignore
├── .prettierrc
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
│   ├── TRANSLATE.md           # Localization guide
│   └── preview-game.html      # Visual reference for tile styles
│
├── public/                    # Static files served as-is — no build processing
│   └── assets/                # Game assets loaded by Phaser at runtime
│       ├── images/            # PNG, SVG, WebP
│       ├── spritesheets/      # Texture atlases (PNG + JSON)
│       └── audio/
│           ├── music/         # Background music (MP3, OGG)
│           └── sfx/           # Sound effects (MP3, OGG, WAV)
│
├── src/                       # Application source code
│   ├── main.js                # Entry point — creates the Phaser.Game instance
│   │
│   ├── styles/
│   │   └── main.css           # All game CSS (tiles, grid, HUD, modals)
│   │
│   ├── configs/               # Configuration & constants
│   │   ├── index.js           # Barrel export
│   │   ├── game-config.js     # Phaser GameConfig object
│   │   └── constants.js       # Shared constants (sizes, colors, scene keys…)
│   │
│   ├── scenes/                # Phaser scenes (one per screen / state)
│   │   ├── boot-scene.js      # Minimal boot, transitions to preload-scene
│   │   ├── preload-scene.js   # Asset loading with progress bar
│   │   ├── title-scene.js     # Title screen — tap/key → opens menu modal
│   │   └── grid-scene.js      # Main 2048 gameplay (DOM tiles + CSS animations)
│   │
│   ├── components/            # Reusable UI components (DOM-based)
│   │   ├── index.js           # Barrel export
│   │   ├── menu-modal.js      # Main menu overlay (resume, modes, quit)
│   │   └── game-over-modal.js # Game over overlay (score + actions)
│   │
│   ├── entities/              # Game objects — pure logic, no Phaser dependency
│   │   ├── index.js           # Barrel export
│   │   ├── tile.js            # Tile data class (value, row, col, id)
│   │   ├── grid.js            # 4×4 grid logic (move, merge, spawn, canMove)
│   │   ├── grid-life.js       # HP system (Free / Battle modes)
│   │   └── enemy.js           # Enemy data class (Battle mode)
│   │
│   ├── managers/              # Cross-cutting singletons
│   │   ├── index.js           # Barrel export
│   │   ├── animation-manager.js # Tile DOM animations + cancellation system
│   │   ├── audio-manager.js   # Music & SFX settings (persisted)
│   │   ├── battle-manager.js  # Battle mode logic (enemy spawn, contamination, damage)
│   │   ├── i18n-manager.js    # Locale switching & translation lookups
│   │   └── save-manager.js    # Persistent game state + rankings (localStorage)
│   │
│   ├── locales/               # Translation files (one per language)
│   │   ├── index.js           # Barrel export
│   │   ├── en.js              # English strings
│   │   └── fr.js              # French strings
│   │
│   └── utils/                 # Pure helper functions
│       ├── index.js           # Barrel export
│       └── math.js            # clamp, randomInt, shuffle, weightedPick
│
├── tests/                     # Unit tests (mirrors src/ structure)
│   ├── entities/
│   │   ├── tile.test.js
│   │   ├── grid.test.js
│   │   └── enemy.test.js
│   ├── managers/
│   │   ├── animation-manager.test.js
│   │   ├── battle-manager.test.js
│   │   ├── i18n-manager.test.js
│   │   └── save-manager.test.js
│   └── utils/
│       └── math.test.js
│
├── android/                   # (generated) Capacitor Android project
└── ios/                       # (generated) Capacitor iOS project
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

UI components (`MenuModal`, `GameOverModal`) are **plain JavaScript classes** — not Phaser scenes.
They receive a `scene` reference in their constructor and use Phaser's DOM element system to create
HTML overlays. This allows full CSS styling matching the tile aesthetic from `preview-game.html`.

Usage:
```js
import { MenuModal, GameOverModal } from '../components/index.js';

// In a scene's create():
const menu = new MenuModal(this, {
  showResume: true,
  onResume: () => menu.destroy(),
  onClassic: () => this.scene.restart({ mode: 'classic' }),
});

new GameOverModal(this, {
  score: 1200,
  onNewGame: () => this.scene.restart(),
  onMenu: () => this.scene.start('TitleScene'),
});
```

### Managers

Managers are **singleton-ish** classes for cross-cutting concerns:

- **AnimationManager** — manages all DOM tile animations (slides, merges, spawns, particles). Completely independent of Phaser. See [docs/ANIMATION.md](ANIMATION.md).
- **AudioManager** — wraps Phaser's sound system with volume control.
- **I18nManager** — singleton handling locale selection, translation lookups (`i18n.t('key')`), and persistence to `localStorage`. See [docs/TRANSLATE.md](TRANSLATE.md).
- **StateManager** — observable key-value store for shared game state (score, settings, player data). Supports `on(key, callback)` subscriptions.

### Entities

Game objects (units, cards, grid tiles…) live in `src/entities/`. They typically extend `Phaser.GameObjects.Sprite` or `Phaser.GameObjects.Container`, or are plain classes that compose Phaser objects.

### Utils

Pure utility functions in `src/utils/` — no side effects, no Phaser dependency.
Easy to unit test.

### Assets

Assets live in `public/assets/` and are **served directly** without any build processing.
Phaser loads them at runtime via root-relative URLs in `PreloadScene`:

```js
this.load.image('logo', 'assets/images/logo.png');
this.load.audio('bgm', 'assets/audio/music/theme.mp3');
this.load.atlas('sprites', 'assets/spritesheets/atlas.png', 'assets/spritesheets/atlas.json');
```

This approach is simpler and standard for Phaser projects: no import statements needed, paths work identically in the browser and in native builds (Capacitor copies `dist/` which includes `public/assets/`).

## Hot Reload

**Vite** provides near-instant Hot Module Replacement (HMR) during development:

```bash
npm run dev
```

The dev server starts at `http://localhost:3000`. Any change to source files triggers an automatic page reload, allowing rapid iteration.

## Mobile Builds (iOS / Android)

The project uses **Capacitor** to wrap the web build into native mobile apps.

```bash
# Build web assets
npm run build

# Sync with native projects
npx cap sync

# Open in native IDE
npx cap open android   # Opens Android Studio
npx cap open ios       # Opens Xcode
```

The game is locked to **landscape orientation** via:
- `capacitor.config.ts` → `ScreenOrientation` plugin
- `<meta name="screen-orientation" content="landscape">` in `index.html`
- Phaser `Scale.FIT` + `CENTER_BOTH` for responsive scaling to any screen size

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

See [docs/ANIMATION.md](ANIMATION.md) for the full animation system documentation, including layers, interruption model, and testing guide.
