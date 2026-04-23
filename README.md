# Fusion Mania

A unique twist on the classic 2048 puzzle game with magical powers! Each tile has a special power that activates when merged with another tile of the same power. Strategic fusion gameplay combined with power activation mechanics creates an addictive and dynamic puzzle experience.

## Quick Start

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:3000)
npm test           # Run tests (700+ unit tests)
npm run build      # Production build → dist/
npm run format     # Format code with Prettier
npm run build && npx cap sync && cd android && ./gradlew assembleDebug && cd .. # Construct APK for Android version (Dev)
```

## Documentation

| Document                                     | Description                                         |
|----------------------------------------------|-----------------------------------------------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Project structure, tech stack, design decisions     |
| [docs/CODE-STYLE.md](docs/CODE-STYLE.md)     | Coding conventions, best practices, rules           |
| [docs/ANIMATION.md](docs/ANIMATION.md)       | Animation layers, interruption model, testing       |
| [docs/LAYOUT.md](docs/LAYOUT.md)             | Responsive layout, safe zone, CSS custom properties |
| [docs/POWER.md](docs/POWER.md)               | Powers, activation flow, tile states                |
| [docs/BATTLE.md](docs/BATTLE.md)             | Enemy system, contamination, level progression      |
| [docs/FREE.md](docs/FREE.md)                 | Free mode, power selection, grid life               |
| [docs/SAVE.md](docs/SAVE.md)                 | Save system, rankings, save slots                   |
| [docs/TRANSLATE.md](docs/TRANSLATE.md)       | Internationalization (EN/FR)                        |

## Game Modes

- **Classic Mode**: Pure 2048 gameplay — no powers, no enemies.
- **Free Mode**: 2048 with player-chosen powers and a grid life system ([docs/FREE.md](docs/FREE.md)).
- **Battle Mode**: 2048 with enemies that spawn, contaminate tiles, and level up ([docs/BATTLE.md](docs/BATTLE.md)).

## Tech Stack

- **Phaser 3** — game engine (scene management, DOM overlay, Matter.js physics)
- **Vite** — dev server with HMR, production bundler
- **Vitest + happy-dom** — unit testing (617+ tests)
- **Prettier** — code formatting
- **JavaScript ES2022+** — no TypeScript, JSDoc for types

## Architecture Overview

```
src/
  scenes/       Thin Phaser.Scene subclasses (Boot → Preload → Title → Game)
  entities/     Pure data/logic — zero Phaser/DOM dependency
  managers/     Singletons for cross-cutting concerns (grid, animation, audio…)
  components/   DOM-based UI overlays (modals)
  configs/      All constants (never hardcode magic numbers)
  utils/        Pure functions, no side effects
  locales/      EN/FR translation files
  styles/       CSS (main + power animations)
```

## Controls

| Platform | Move Tiles        | Pause           | Language     |
|----------|-------------------|-----------------|--------------|
| Desktop  | Arrow keys / WASD | ESC or SPACE    | Options menu |
| Mobile   | Swipe gesture     | Menu button     | Options menu |

## Localization

- English and French, switchable at runtime via the options menu.
- All user-facing strings use i18n keys — see [docs/TRANSLATE.md](docs/TRANSLATE.md).

## License

This project is licensed under the MIT License.
