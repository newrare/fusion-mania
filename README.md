# Fusion Mania

A unique twist on the classic 2048 puzzle game with magical powers! Each tile has a special power that activates when merged with another tile of the same power. Strategic fusion gameplay combined with power activation mechanics creates an addictive and dynamic puzzle experience.

## Quick Start

```bash
npm install    # Install dependencies
npm run dev    # Start dev server (http://localhost:3000)
npm test       # Run tests
npm run build  # Production build
```

## Convention, best practices, code style and rules

See [docs/CODE-STYLE.md](docs/CODE-STYLE.md) for the full coding conventions, best practices, architecture decisions, and code style rules.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full project structure, tech stack, design decisions, and conventions.

## Layout System

See [docs/LAYOUT.md](docs/LAYOUT.md) for the full documentation on responsive layout, safe zone, CSS custom properties, and how to position elements in new scenes.

## Animation System

See [docs/ANIMATION.md](docs/ANIMATION.md) for the animation layers, interruption model (skip in-progress animations on new input), and testing guide.

## Game Modes
- **Classic Mode**: Pure 2048 gameplay with no powers or enemies.
- **Free Mode**: 2048 gameplay with random powers appearing on the grid edges ([docs/FREE.md](docs/FREE.md)).
- **Battle Mode**: 2048 gameplay with enemies.

## Current Status

### Implemented
- **Classic Mode**: Full 2048 gameplay — slide, merge, score, game over detection
- **Title Scene**: Tap/key to open menu modal
- **Grid Scene**: 4×4 grid with CSS DOM tiles matching the visual preview
- **Menu Modal**: Resume, Classic Mode, Close, Quit
- **Game Over Modal**: Final score, New Game, Menu
- **Save System**: Auto-save on menu open, rankings (top 10 per mode)
- **i18n**: English + French, persisted locale
- **Animation system**: Interruptible tile animations (slide, merge bounce, spawn pop, merge particles) via `AnimationController` — independent of Phaser, fully unit-tested
- **85+ unit tests**: Grid logic, Tile, math utils, SaveManager, I18nManager, AnimationController

### Not Yet Implemented
- Battle Mode
- Enemy system
- Audio (music & SFX)
- Asset loading (backgrounds, fonts, spritesheets)
- Capacitor mobile builds
- Options modal (music/sound toggles)
- Ranking modal

## 🎮 Game Features

- **Classic 2048 Mechanics**: Familiar sliding and merging gameplay
- **Magical Power System**: Many powers that trigger strategic effects
- **Classic Mode**: Pure puzzle gameplay without powers or enemies
- **Battle Mode**: Battle against enemies that spawn powers on the grid
- **Free Mode**: Like the battle mode but with customizable power selection
- **Color-Coded Tiles**: Beautiful kawaii color palette
- **Multi-language Support**: Available in French and English
- **Score Tracking**: High score system and ranking
- **🎯 Touch Support**: Full touch/mouse support for PC and mobile (Android/iOS)
  - Swipe to move tiles
  - All buttons work with touch and mouse

## ThemeManager (global constants)
- **Default Font**: `assets/others/font_super_crawler.ttf` applied globally to all UI controls
- **Global Colors**: Centralized color palette accessible throughout the game

## Save System

All player progress (game stats, counter move, tile position and value) is managed by a **SaveManager** that persists to `localStorage`. Entities remain pure static data classes with no player state.


## Menu System (modal)

1. **Menu Modal**:
   -> Auto-saves game state when opened
   - Resume (only if game saved or party in progress)
   - Classic Mode
   - Battle Mode
   - Free Mode
   - Ranking
   - Options
   - Close Menu
   - Quit Game (with confirmation)

2. **Option Modal**:
   - Music toggle (checkbox)
   - Sound toggle (checkbox)
   - Reset ranking (with confirmation)
   - Close options

3. **Ranking Modal**:
   - Score table display: top 10 scores (3 tabs: Classic, Battle, Free)
   - Close ranking

4. **Game Over Modal**:
   - Shows final score
   - Victory/Defeat animation based on score
   - Start New Game
   - Return to Menu

5. **Help Modal** (in-game `?` button):
   - Game Modes: objective of Classic, Free, and Battle
   - Tile Fusion: how merging works with visual examples
   - Powers: full list with icons, activation flow, effects per category
   - Predictions: colored "!" edge indicators explained
   - Enemies: spawn conditions, level progression, contamination
   - Grid Life: HP system, damage formula, critical threshold

## 🎯 Game Mechanics

### Core Gameplay
- **Grid System**: 4x4 grid (similar to 2048)
- **Tile Spawning**: New tiles appear after each move (similar to 2048)
- **Movement**: Swipe in 4 directions to slide all tiles
- **Fusion**: Tiles with same number merge when colliding
- **Score**: Each fusion increases the score (same system as 2048)
- **Move Counter**: Tracks total number of moves made
- **Game Over**: Triggered when the grid is completely full

### 👾 Enemy System (battle mode)

The game features an enemy system that adds combat mechanics to the puzzle gameplay.

### 🔥 Power System

See [docs/POWER.md](docs/POWER.md) for the full documentation on available powers, activation flow, tile states, and game over conditions in Free Mode.

### Controls

#### PC (Desktop)
- **Move Tiles**: Arrow keys or WASD
- **Pause**: ESC or SPACE key
- **Language**: Toggle in options menu

#### Mobile (Android/iOS)
- **Move Tiles**: Swipe in any direction
- **Pause**: Tap the PAUSE button
- **Buttons**: Tap any button to activate

> **Note**: Mouse and touch work identically - the same code handles both!


## 🌍 Localization

The game supports multiple languages:
- 🇺🇸 English
- 🇫🇷 French

Language can be switched dynamically through the options menu.

## 📊 Technical Details

- **Animation**: Tween nodes for smooth tile movements
- **Input**: Unified swipe/keyboard/touch input system
- **Platform**: PC (Windows, Linux, Mac), Mobile (Android, iOS)

### 📱 Mobile Support

Full touch support implemented:
- **Touch Input**: `emulate_mouse_from_touch` enabled in project settings
- **Test Mode**: `emulate_touch_from_mouse` for PC testing
- **Smart Sounds**: Adaptive audio feedback based on platform detection
- **Swipe Detection**: Smooth gesture recognition for tile movement

## 📄 License

This project is licensed under the MIT License.
