# Battle Mode — Fusion Mania

## Overview

Battle Mode is a progression-based variant of 2048 where the player faces a series of enemies. The game alternates between a **classic phase** (pure 2048) and a **battle phase** (enemy active with powers and HP bars).

## Game Flow

### Classic Phase (10 moves)

- The grid behaves exactly like Classic mode: slide, merge, score.
- **No powers**, no HP bar, no enemy.
- After 10 moves, the next enemy spawns if the player has achieved the required max tile value.

### Battle Phase (enemy active)

When an enemy spawns:

1. **Grid HP bar** appears (same liquid overlay as Free mode).
2. **Enemy tile** appears between the HUD and grid with name label, HP bar, and level border colour.
3. **Each player move**: the enemy **contaminates** one random unpowered tile with a power from its repertoire.
4. **When tiles merge**: damage is dealt to the enemy using the same formula as `GridLife.takeDamage`.
5. **Powers from contaminated tiles** trigger on merge (same mechanics as Free mode).

### Enemy Defeated

When the enemy's HP reaches 0:

- All powers are cleared from grid tiles (reset to normal state).
- Grid HP bar is removed.
- Enemy plays a **death animation** (grayscale, falls to bottom of screen, piles up in graveyard).
- Returns to classic phase for 10 more moves.

### Game Over

- Grid HP reaches 0 **during battle**: Game Over.
- No moves possible on the grid: Game Over.

## Enemy System

### Enemy Progression

Enemies appear in level order: 2 → 4 → 8 → 16 → 32 → 64 → 128 → 256 → 512 → 1024 → 2048 (boss).

An enemy of level N spawns only if:
1. The previous enemy was defeated (or this is the first enemy).
2. 10 classic-phase moves have passed.
3. The player has achieved a tile of value ≥ N on the grid at any point.

Once an enemy is defeated, it never returns in the same game.

### Enemy Properties

| Property   | Description                                                                       |
|------------|-----------------------------------------------------------------------------------|
| **Name**   | Random funny math name from a list of 100 (e.g., Pythagorus, Numerator, Algebrox) |
| **Level**  | 2, 4, 8, …, 2048 — determines HP, powers, and tile border colour                  |
| **HP**     | `ceil(log2(level)) × HP_PER_LEVEL` (currently `HP_PER_LEVEL = 10`)                |
| **Powers** | Subset of Free mode powers based on level                                         |

### Powers by Level

| Level       | Available Powers                     |
|-------------|--------------------------------------|
| 2           | Ice                                  |
| 4           | Wind (up, down, left, right)         |
| 8           | Expel (vertical, horizontal)         |
| 16          | Blind                                |
| 32          | Fire (H, V) + Ads                    |
| 64          | Fire cross + Ads                     |
| 128         | Bomb + Ads                           |
| 256         | All except Nuclear, Bomb, Fire cross |
| 512         | All except Nuclear, Bomb             |
| 1024        | All except Nuclear                   |
| 2048 (Boss) | All powers                           |

### Contamination

Each player move during battle phase, the enemy contaminates one tile:
- Target: random tile without a power and without an active state.
- Assigns a random power from the enemy's available powers.
- Visual: particle animation flies from enemy to the target tile.

### Damage Formula

Same as `GridLife.takeDamage`:
```
damage = sum(log2(mergedValue)) × damageMultiplier × (1 + totalMerged × SCALING_FACTOR)
```

Applied to the enemy when the player merges tiles. The merged tile's new value (after doubling) is used.

## Visual Design

### Enemy Tile

- Positioned between the HUD scores and the grid (centered).
- Represented as a **transparent tile** (no value displayed) with the level's colour as border.
- Contains a liquid HP fill that changes colour: info (blue) → warning (amber) → danger (red).
- Name label above the tile.
- HP text below the tile.

### Death Animation

1. Enemy tile becomes **greyscale** with reduced opacity.
2. Name is displayed inside the tile.
3. Tile moves behind the grid (z-index).
4. Tile falls with gravity to the bottom of the screen.
5. Dead tiles accumulate in a "graveyard" at the screen bottom.
6. Dead tiles are never removed (visual pile-up effect).

## File Structure

```
src/entities/enemy.js          — Enemy data class (name, level, HP, powers)
src/managers/battle-manager.js — Battle logic (spawn, contaminate, damage, progression)
src/scenes/game-scene.js       — Rendering & animation integration
src/configs/constants.js       — BATTLE constants
src/styles/main.css            — Enemy CSS (.fm-enemy-*, .fm-dead-enemy-*, .fm-contaminate-*)
```

## Testing

```
tests/entities/enemy.test.js          — 44 tests (names, HP formula, powers, serialization)
tests/managers/battle-manager.test.js — 30 tests (phases, spawn, damage, progression, serialization)
```

Run tests:
```bash
npx vitest run tests/entities/enemy.test.js tests/managers/battle-manager.test.js
```
