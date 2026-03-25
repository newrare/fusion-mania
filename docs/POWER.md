# Power System — Fusion Mania

## Overview

Powers are special abilities that interact with the game grid during **Free Mode** (and later **Battle Mode**). Each power has an icon (SVG pastille), a unique effect, and specific activation conditions.

## Power List

### Destructive Powers

| Power         | Icon SVG      | Effect                                                                                     |
|---------------|---------------|--------------------------------------------------------------------------------------------|
| **Fire -**    | `s-fire-h`    | Destroys all tiles in the same **row** as the targeted tile (targeted survives).           |
| **Fire \|**   | `s-fire-v`    | Destroys all tiles in the same **column** as the targeted tile (targeted survives).        |
| **Fire +**    | `s-fire-x`    | Destroys all tiles in the same **row and column** as the targeted tile (targeted survives).|
| **Bomb**      | `s-bomb`      | Destroys **only** the targeted tile.                                                       |
| **Lightning** | `s-lightning` | Destroys **3 tiles**: the targeted tile + 2 random top-of-column tiles (can be empty).     |
| **Nuclear**   | `s-nuclear`   | Destroys **all tiles** on the grid, including the targeted tile.                           |

### Status Powers

| Power         | Icon SVG  | Duration | Effect                                                                              |
|---------------|-----------|----------|-------------------------------------------------------------------------------------|
| **Ice**       | `s-ice`   | 4 moves  | Freezes the targeted tile — it cannot move but can be merged.                       |
| **Blind**     | `s-blind` | 5 moves  | All tiles on the grid become mysterious (hidden value/color). New tiles are normal. |
| **Expel → ←** | `s-exp-r` | 5 moves  | Targeted tile ignores left/right borders — can exit the grid and be destroyed.      |
| **Expel ↓ ↑** | `s-exp-d` | 5 moves  | Targeted tile ignores top/bottom borders — can exit the grid and be destroyed.      |

### Movement Powers

| Power        | Icon SVG   | Duration | Effect                                                                     |
|--------------|------------|----------|----------------------------------------------------------------------------|
| **Wind ↑**   | `s-wind-u` | 2 moves  | Blocks **downward** movement for all tiles. Player can still swipe down.   |
| **Wind ↓**   | `s-wind-d` | 2 moves  | Blocks **upward** movement for all tiles. Player can still swipe up.       |
| **Wind ←**   | `s-wind-l` | 2 moves  | Blocks **rightward** movement for all tiles. Player can still swipe right. |
| **Wind →**   | `s-wind-r` | 2 moves  | Blocks **leftward** movement for all tiles. Player can still swipe left.   |

### Special Powers

| Power        | Icon SVG     | Effect                                                       |
|--------------|--------------|--------------------------------------------------------------|
| **Teleport** | `s-teleport` | Swaps the targeted tile's position with a random other tile. |
| **Ads**      | `s-ads`      | Launches a fullscreen ad modal for a set duration.           |

## Power Activation Flow

```
1. Every 2 moves → randomly pick a power from the selected pool
2. Randomly choose an available grid edge (top/bottom/left/right)
3. Place the power badge (tiny pastille) at the center of that edge
4. If no targeted tile exists, pick one randomly
5. Player makes a move:
   a. Check if move direction matches any power's side
   b. Simulate the move to check if the targeted tile merges
   c. If yes → trigger the power's effect
   d. Remove the power from the edge
   e. If targeted tile was destroyed and powers remain → pick new targeted tile
6. Decrement turn counters for active tile states (ice, blind, expel, wind)
```

## Power Badge Colors

The badge on the grid edge is dynamically colored:

- **`info`** (blue): Power trigger would destroy **no tiles**
- **`warning`** (amber): Power trigger would destroy only **low-value tiles** (2, 4, 8, 16)
- **`danger`** (red): Power trigger would destroy **high-value tiles** (32+)

Colors are recalculated before each player move using a grid state simulation.

## SVG Icons

All power icons are inline SVG `<symbol>` elements embedded in the game DOM. Referenced by `<use href="#s-[name]"/>`. See `docs/preview-power.html` for the full icon set.

### Symbol IDs

| Power       | Symbol ID    |
|-------------|--------------|
| Fire -      | `s-fire-h`   |
| Fire \|     | `s-fire-v`   |
| Fire +      | `s-fire-x`   |
| Bomb        | `s-bomb`     |
| Ice         | `s-ice`      |
| Teleport    | `s-teleport` |
| Expel → ←   | `s-exp-r`    |
| Expel ↓ ↑   | `s-exp-d`    |
| Wind ↑      | `s-wind-u`   |
| Wind ↓      | `s-wind-d`   |
| Wind ←      | `s-wind-l`   |
| Wind →      | `s-wind-r`   |
| Lightning   | `s-lightning`|
| Nuclear     | `s-nuclear`  |
| Blind       | `s-blind`    |
| Ads         | `s-ads`      |

## Tile State Rules

- A tile can only have **one state** at a time.
- A new power effect **replaces** any existing state on the tile.
- States with durations (ice, blind, expel, wind) decrement each player move.
- When a state expires (turns reach 0), the tile returns to normal.
- Frozen tiles cannot move but can be destroyed by other powers.
- Ghost (expel) tiles can exit the grid — if they do, they are destroyed and the power ends.
- Blind tiles display as gray with `?` instead of their value.

## CSS Classes

### Power Badge (pastille)

```
.fm-power-dot          — Base circle container
.fm-power-dot.tiny     — Small version for grid edges
.fm-power-dot.info     — Blue (no destruction)
.fm-power-dot.warning  — Amber (low-value destruction)
.fm-power-dot.danger   — Red (high-value destruction)
.fm-power-dot.off      — Greyed out (unselected / inactive)
```

### Tile States

```
.fm-state-active       — Targeted tile (sun rays + gold glow)
.fm-state-freeze       — Frozen tile (ice shimmer + snowflakes)
.fm-state-ghost        — Ghost tile (30% opacity, expel)
.fm-state-blind        — Blind tile (hidden value, grey)
.fm-state-wind         — Base wind state (overflow visible)
.fm-state-wind-up      — Wind blocking down
.fm-state-wind-down    — Wind blocking up
.fm-state-wind-left    — Wind blocking right
.fm-state-wind-right   — Wind blocking left
.fm-state-danger       — Danger tile (lava glow, pre-destruction)
```
