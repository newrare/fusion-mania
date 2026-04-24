# Power System — Fusion Mania

## Overview

Powers are special abilities used in **Free Mode** and **Battle Mode**. Unlike
classic 2048, each power alters the grid when it fires. Two charging models
coexist:

- **Edge-charged** powers sit on one of the four grid edges (top/bottom/left/
  right). A swipe in that direction consumes the edge and fires the power.
- **Direct** powers (ice, expel-h, expel-v) are never charged on an edge: the
  game (Free) or the enemy (Battle) applies them directly to a random tile.

A single tile on the grid carries the **targeted** visual (sunburst
`fm-state-active`). That tile is the source for target-based powers (fire,
bomb, teleport, nuclear). Even if all four edges are charged, there is only
ever one targeted tile.

## Power List

### Destructive (danger, edge-charged)

| Power         | Icon         | Target tile? | Effect                                                                                   |
|---------------|--------------|:------------:|------------------------------------------------------------------------------------------|
| **Fire -**    | `s-fire-h`   | yes          | Destroys all tiles in the targeted row (target survives).                                |
| **Fire \|**   | `s-fire-v`   | yes          | Destroys all tiles in the targeted column (target survives).                             |
| **Fire +**    | `s-fire-x`   | yes          | Destroys all tiles in the targeted row and column (target survives).                     |
| **Bomb**      | `s-bomb`     | yes          | Destroys the targeted tile and its 4 orthogonal neighbours.                              |
| **Nuclear**   | `s-nuclear`  | yes          | Destroys every tile on the grid.                                                         |
| **Lightning** | `s-lightning`| no (special) | Strikes 1–3 random columns: destroys the top tile of each struck column.                 |

While **lightning** is charged on an edge, potential victims (top of each
non-empty column) receive the `fm-tile--lightning-charge` pulse as a preview.

### Status (warning, edge-charged)

| Power        | Icon         | Target tile? | Effect                                                              |
|--------------|--------------|:------------:|---------------------------------------------------------------------|
| **Teleport** | `s-teleport` | yes          | Swaps the targeted tile with a random other tile.                   |
| **Blind**    | `s-blind`    | no (global)  | All tiles become mysterious (hidden value/colour) for BLIND moves.  |

### Status (warning, direct)

| Power         | Icon       | Effect                                                                                        |
|---------------|------------|-----------------------------------------------------------------------------------------------|
| **Expel ↔**   | `s-exp-r`  | Applied on a random tile — ignores left/right borders and slides out of the grid if the path is clear. |
| **Expel ↕**   | `s-exp-d`  | Applied on a random tile — ignores top/bottom borders and slides out of the grid if the path is clear. |

### Passive (info)

| Power      | Icon       | Charging | Effect                                                                       |
|------------|------------|----------|------------------------------------------------------------------------------|
| **Ice**    | `s-ice`    | direct   | Applied on a random tile. The frozen tile cannot move and cannot fuse.       |
| **Wind ↑** | `s-wind-u` | edge     | Blocks downward movement for all tiles for WIND moves.                       |
| **Wind ↓** | `s-wind-d` | edge     | Blocks upward movement for WIND moves.                                       |
| **Wind ←** | `s-wind-l` | edge     | Blocks rightward movement for WIND moves.                                    |
| **Wind →** | `s-wind-r` | edge     | Blocks leftward movement for WIND moves.                                     |

### Special

| Power   | Icon    | Effect                                             |
|---------|---------|----------------------------------------------------|
| **Ads** | `s-ads` | Launches a fullscreen ad modal for a set duration. |

## Activation Flow

### Free Mode

```
1. Every POWER_PLACEMENT_INTERVAL moves, the PowerManager picks a random
   power type from the player's selected pool:
   - direct type  → applied immediately on a random eligible tile
   - edge-charged → placed on a random empty grid edge (skipped if all 4
                    edges are already charged)
2. The PowerManager refreshes the targeted tile:
   - if any charged edge holds a target-based power AND no valid target
     exists, a random non-frozen tile is chosen;
   - otherwise the target is cleared.
3. When the player swipes in a direction that would move at least one tile,
   the move executes THEN the matching edge fires its power (if any).
4. Effects apply, animations play, the targeted tile is re-chosen if needed.
```

### Battle Mode

```
1. During the classic phase, no powers are active.
2. When an enemy spawns, it carries a stock of charges per power type
   (BATTLE.ENEMY_POWER_STOCK[level]).
3. Each player move, the enemy picks a power type from its remaining stock:
   - direct type  → applied directly on a random tile
   - edge-charged → placed on a random empty grid edge
   Stock is decremented. If the stock is empty, nothing happens.
4. Player swipes fire the matching edge (if any) as in Free mode.
5. On enemy death, all edges and tile states are cleared.
```

## Edge Indicator

Each charged edge displays a small colour-coded pill containing the power
icon:

- **`danger`** (red): destructive powers (fire, bomb, lightning, nuclear).
- **`warning`** (amber): teleport, blind.
- **`info`** (blue): wind.

(Direct powers — ice, expel — have no edge indicator because they are never
charged.)

## Targeted Tile

One single `.fm-state-active` sunburst tile is maintained by
`PowerManager.refreshTargetedTile(grid)`:

- The target is (re)chosen whenever no valid target exists and at least one
  edge holds a target-based power.
- Frozen tiles are never eligible.
- The target is cleared when no edge needs one (e.g. only wind/blind on the
  edges).

## Tile State Rules

- A tile can only have **one state** at a time.
- A new effect **replaces** any existing state on the tile.
- States with a duration (ice, blind, expel-v, expel-h) decrement each player
  move.
- **Ice** tiles cannot move **and** cannot fuse, until the state expires.
- **Expel-v** (`ghost-v`) tiles bypass top/bottom borders; **Expel-h**
  (`ghost-h`) tiles bypass left/right borders. On a valid move in that axis
  they slide off the grid and are destroyed, unless another tile blocks the
  path.
- **Blind** tiles display `?` instead of their value.

## SVG Icons

All power icons are inline SVG `<symbol>` elements embedded in the game DOM.
Referenced by `<use href="#s-[name]"/>`.

## CSS Classes

### Edge indicators

```
.fm-edge-power            — Positioned at grid edges (top/bottom/left/right)
.fm-power-dot.tiny        — Small coloured circle hosting the icon
.fm-edge-power-ico        — Power icon inside the edge badge
.fm-edge-warn             — Legacy "!" text (unused for charged edges)
```

### Tile states

```
.fm-state-active       — Targeted tile (sun rays + gold glow)
.fm-state-ice          — Frozen tile (ice shimmer + snowflakes) — blocks move AND merge
.fm-state-ghost-v      — Vertical expel tile: top/bottom edge fade
.fm-state-ghost-h      — Horizontal expel tile: left/right edge fade
.fm-state-blind        — Blind tile (hidden value, grey)
.fm-state-wind         — Base wind state
.fm-state-wind-up|down|left|right — Direction-specific wind overlay
.fm-state-danger       — Pre-destruction lava glow
.fm-tile--lightning-charge — Pulsing highlight on potential lightning victims
```

### Expel icon construction

Both expel SVG symbols are derived from `power-expel.svg` (a double-headed
horizontal arrow, viewBox 0 0 24 24):

- **`s-exp-r`** (horizontal ↔): paths from `power-expel.svg` as-is.
- **`s-exp-d`** (vertical ↕): same paths wrapped in `rotate(90 12 12)`.
