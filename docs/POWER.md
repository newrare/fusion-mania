# Power System — Fusion Mania

## Overview

Powers are special abilities that interact with the game grid during **Free Mode** (and later **Battle Mode**). Each power has an icon (SVG pastille), a unique effect, and activates when its carrier tile merges.

## Power List

### Destructive Powers (danger)

| Power         | Icon SVG      | Effect                                                                                                      |
|---------------|---------------|-------------------------------------------------------------------------------------------------------------|
| **Fire -**    | `s-fire-h`    | Destroys all tiles in the same **row** as the target tile (target survives).                                |
| **Fire \|**   | `s-fire-v`    | Destroys all tiles in the same **column** as the target tile (target survives).                             |
| **Fire +**    | `s-fire-x`    | Destroys all tiles in the same **row and column** as the target tile (target survives).                     |
| **Bomb**      | `s-bomb`      | Destroys **only** the target tile.                                                                          |
| **Lightning** | `s-lightning` | Strikes **1 to 3 random columns**: destroys the top tile of each struck column                              |
|               |               | (empty columns are struck but nothing is destroyed). Multiple strikes play with a short delay between them. |
| **Nuclear**   | `s-nuclear`   | Destroys **all tiles** on the grid, including the target tile.                                              |

### Status Powers (warning)

| Power         | Icon SVG     | Duration | Effect                                                                              |
|---------------|--------------|----------|-------------------------------------------------------------------------------------|
| **Blind**     | `s-blind`    | 5 moves  | All tiles on the grid become mysterious (hidden value/color). New tiles are normal. |
| **Expel → ←** | `s-exp-r`    | 5 moves  | Target tile ignores left/right borders — slides out of grid if the path is clear, then is destroyed. Blocked by other tiles. |
| **Expel ↓ ↑** | `s-exp-d`    | 5 moves  | Target tile ignores top/bottom borders — slides out of grid if the path is clear, then is destroyed. Blocked by other tiles. |
| **Teleport**  | `s-teleport` | -        | Swaps the target tile's position with a random other tile.                          |

### Passive Powers (info)

| Power      | Icon SVG   | Duration | Effect                                                                     |
|------------|------------|----------|----------------------------------------------------------------------------|
| **Ice**    | `s-ice`    | 4 moves  | Freezes the target tile — it cannot move but can be merged.                |
| **Wind ↑** | `s-wind-u` | 3 moves  | Blocks **downward** movement for all tiles. Player can still swipe down.   |
| **Wind ↓** | `s-wind-d` | 3 moves  | Blocks **upward** movement for all tiles. Player can still swipe up.       |
| **Wind ←** | `s-wind-l` | 3 moves  | Blocks **rightward** movement for all tiles. Player can still swipe right. |
| **Wind →** | `s-wind-r` | 3 moves  | Blocks **leftward** movement for all tiles. Player can still swipe left.   |

### Special Powers

| Power   | Icon SVG | Effect                                             |
|---------|----------|----------------------------------------------------|
| **Ads** | `s-ads`  | Launches a fullscreen ad modal for a set duration. |

## Power Activation Flow

```
1. Every 2 moves → randomly pick a power from the selected pool
2. Assign the power to a random tile that has no power yet
3. The powered tile displays a flip-card animation (front = tile, back = power icon)
4. Player makes a move:
   a. If a powered tile merges during the move, its power activates
   b. If both merging tiles have the SAME power → activate once
   c. If both merging tiles have DIFFERENT powers → show choice modal
   d. The merged (surviving) tile becomes the power's target
   e. Multiple fusions with powers execute in sequence
5. Decrement turn counters for active tile states (ice, blind, expel, wind)
```

## Edge Indicators

The 4 grid edges show color-coded `!` indicators predicting what would happen:

- **`danger`** (red): Destructive powers would trigger (fire, bomb, nuclear, lightning)
- **`warning`** (amber): Disruptive powers would trigger (teleport, expel, blind)
- **`info`** (blue): Passive powers would trigger (wind, ice)

Priority: **danger > warning > info**. If multiple powers would trigger in the same direction, the highest severity color is shown.

Indicators only appear if a powered tile would actually merge in that direction.

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
- **Expel-v** (`ghost-v`) tiles bypass top and bottom grid borders: on an up/down move they slide off the grid and are destroyed — unless another tile blocks their path first.
- **Expel-h** (`ghost-h`) tiles bypass left and right grid borders: on a left/right move they slide off the grid and are destroyed — unless another tile blocks their path first.
- An expelled tile can still merge normally with an equal tile it reaches before the border.
- Blind tiles display as gray with `?` instead of their value.

## Powered Tile Visual

A tile carrying a power uses a flip-card animation (see `docs/preview-powers.html`):

- **Front face**: Normal tile (value + color) with a small power hint at the bottom (icon + name)
- **Back face**: Full-color face based on power category (danger=red, warning=amber, info=blue) with large power icon

The flip animation pauses during player moves and resumes after.

## CSS Classes

### Edge Indicators

```
.fm-edge-power          — Positioned at grid edges (top/bottom/left/right)
.fm-power-dot.tiny      — Small circle with color
.fm-edge-warn           — "!" text inside the dot
```

### Powered Tile (flip card)

```
.fm-tile-powered        — Enables perspective on the tile
.fm-flip-card           — The rotating card container
.fm-flip-front          — Front face (normal tile)
.fm-flip-back           — Back face (power face)
.fm-pw-danger           — Red back face (destructive)
.fm-pw-warning          — Amber back face (disruptive)
.fm-pw-info             — Blue back face (passive)
.fm-pwr-hint            — Small icon + name on front face
.fm-back-ico            — Large icon on back face
.fm-bval                — Value reminder on back face
```

### Tile States

```
.fm-state-active       — Targeted tile (sun rays + gold glow)
.fm-state-freeze       — Frozen tile (ice shimmer + snowflakes)
.fm-state-ghost-v      — Vertical expel tile: top/bottom edge ghost fade via CSS mask
.fm-state-ghost-h      — Horizontal expel tile: left/right edge ghost fade via CSS mask
.fm-state-blind        — Blind tile (hidden value, grey)
.fm-state-wind         — Base wind state (overflow visible)
.fm-state-wind-up      — Wind blocking down
.fm-state-wind-down    — Wind blocking up
.fm-state-wind-left    — Wind blocking right
.fm-state-wind-right   — Wind blocking left
.fm-state-danger       — Danger tile (lava glow, pre-destruction)
```

### Expel Icon Construction

Both expel SVG symbols are built by superimposing two copies of `power-expulsion.svg` (a single down-pointing arrow):

- **`s-exp-d`** (vertical ↕): one arrow at 0° (down) + one rotated 180° around center (up), creating a ↕ bidirectional indicator.
- **`s-exp-r`** (horizontal ↔): one arrow rotated -90° (right) + one rotated +90° (left), creating a ↔ bidirectional indicator.
