# Free Mode — Fusion Mania

## Overview

Free Mode is a variant of classic 2048 where the player selects a set of
powers before the game starts. During the game, powers charge periodically
on the grid edges (or apply directly on a random tile for direct-type
powers) and are consumed by swipes.

## Pre-Game: Power Selection

Before a Free Mode game starts, a **Power Select Modal** appears:

- Displays all available powers as selectable pastilles (dot icons).
- The player must select **at least 1** power and **at most all** powers.
- Selected powers use the `info` style; unselected use the `off` style.
- A **Start** button becomes enabled once at least one power is selected.

## Game Flow

### Power Assignment

Every `POWER_PLACEMENT_INTERVAL` moves, the PowerManager picks a random
type from the player's selected pool and dispatches it:

- **Edge-charged** (fire, bomb, teleport, nuclear, wind, blind, lightning,
  ads): placed on a random empty grid edge. If all 4 edges are already
  charged, the placement is skipped for this cycle.
- **Direct** (ice, expel-h, expel-v): applied immediately on a random tile
  without an active state. Ice freezes the tile (no move, no merge) for
  its duration; expel turns the tile into a ghost that can slide off the
  grid.

### Power Firing

Only the edge matching the swipe direction is consumed:

- Swipe up   → fires the top edge.
- Swipe down → fires the bottom edge.
- Swipe left → fires the left edge.
- Swipe right→ fires the right edge.

A power is **only consumed when the move was valid** (at least one tile
moved or merged). A bump-on-a-wall swipe does not discharge the edge.

### Targeted Tile

Target-based powers (fire-\*, bomb, teleport, nuclear) use the currently
**targeted tile** (the tile with `fm-state-active` — a sunburst glow).

- Only one tile is targeted at a time, regardless of how many edges are
  charged.
- The target is picked randomly among non-frozen tiles when at least one
  edge needs one.
- When the target is destroyed, freezes, or disappears, a new target is
  picked automatically.
- When no edge needs a target, the sunburst is cleared.

### Edge Indicators

The 4 grid edges display a small coloured pill with the power icon inside:

| Colour   | Power types                                      |
|----------|--------------------------------------------------|
| `danger` | fire, bomb, nuclear, lightning                   |
| `warning`| teleport, blind                                  |
| `info`   | wind                                             |

(Ice and expel are direct powers — they never show an edge badge.)

### Info Panel

Below the grid, one line per charged edge is displayed:

```
Swipe Up:    [icon] [name]  [targeted tile value]
Swipe Down:  [icon] [name]
Swipe Left:  [icon] [name]
Swipe Right: [icon] [name]
```

Ghost tiles currently on the grid also get a preview line (they exit the
grid on the next valid move in their axis).

## Tile States

A tile can only have **one active state** at a time (a new power overrides
the previous state):

| State       | Visual Class        | Description                                        |
|-------------|---------------------|----------------------------------------------------|
| normal      | *(default)*         | Standard tile with value-based colour              |
| targeted    | `fm-state-active`   | Sunburst + gold glow (power source)                |
| frozen      | `fm-state-ice`      | Cannot move, cannot merge                          |
| ghost-v     | `fm-state-ghost-v`  | Expel — bypasses top/bottom borders                |
| ghost-h     | `fm-state-ghost-h`  | Expel — bypasses left/right borders                |
| blind       | `fm-state-blind`    | Grey tile, value shown as `?`                      |
| wind-\*     | `fm-state-wind-*`   | Wind lines in the blocked direction                |
| danger      | `fm-state-danger`   | Lava glow (pre-destruction flash)                  |

## Game Over

Same as Classic Mode: the game ends when the grid is full and no moves are
possible. Powers that destroy tiles can delay game over.

## Save System

Free Mode games are saved the same way as Classic Mode, with additional
state (selected powers, edge charges, targeted tile id, tile states, wind).
Rankings are stored separately under the `free` mode key.
