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
3. **Each player move**: the enemy **contaminates** the grid by picking a power from its remaining stock:
   - direct powers (ice, expel-h, expel-v) apply directly on a random tile;
   - all other powers are charged on a random free grid edge.
   The matching stock counter is then decremented; when it hits 0, that
   power type is removed from the enemy's pool.
4. **When tiles merge**: damage is dealt to the enemy using the same formula as `GridLife.takeDamage`.
5. **Edge powers fire** when the player swipes in that direction (same as Free mode).

### Enemy Defeated

When the enemy's HP reaches 0:

- Tile states are cleared (ice, ghost, blind, wind).
- All edge charges held by the battle PowerManager are cleared.
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

| Property        | Description                                                                      |
|-----------------|----------------------------------------------------------------------------------|
| **Name**        | Random funny math name from a predefined list (e.g., Pythax, Numerix, Algebrox)  |
| **Level**       | 2, 4, 8, …, 2048 — determines HP, power stock, and tile border colour            |
| **HP**          | `ceil(log2(level)) × HP_PER_LEVEL` (currently `HP_PER_LEVEL = 10`)               |
| **powerStock**  | Map of `powerType → remaining casts` (initialised from `BATTLE.ENEMY_POWER_STOCK[level]`) |

### Power Stock per Level

Each enemy level ships with a predefined stock of charges, tuneable in
`BATTLE.ENEMY_POWER_STOCK`. Examples (as of writing):

| Level       | Stock (type × count)                                                  |
|-------------|-----------------------------------------------------------------------|
| 2           | ice × 3                                                               |
| 4           | wind-up × 1, wind-down × 1, wind-left × 1, wind-right × 1             |
| 8           | expel-h × 2, expel-v × 2                                              |
| 16          | blind × 3                                                             |
| 32          | fire-h × 2, fire-v × 2, ads × 1                                       |
| 64          | fire-x × 2, ads × 2                                                   |
| 128         | bomb × 3, ads × 2                                                     |
| 256–1024    | Mix of statuses, passives and destructive powers                      |
| 2048 (Boss) | All power types, including nuclear × 1                                |

Whenever the enemy casts a power, the matching counter in `powerStock` is
decremented; when a counter hits 0 the key is removed and that power type
is no longer pickable.

### Contamination

Each player move during the battle phase, the enemy picks a power from its
remaining stock (`enemy.pickRandomPower()`) and delegates its placement to
the battle PowerManager:

- **Direct** (ice, expel-h, expel-v): `PowerManager.applyDirectPower` is
  called, which places the corresponding state on a random eligible tile.
- **Edge-charged** (everything else): `PowerManager.chargeRandomFreeEdge`
  places the power on a random empty grid edge. If all 4 edges are charged,
  contamination is skipped for that turn.

Each successful cast decrements the matching stock counter via
`enemy.consumePower(type)`. Particle animations fly from the enemy only for
direct powers (edge charges just update the edge badge).

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
