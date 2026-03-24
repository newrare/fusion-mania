# Free Mode — Fusion Mania

## Overview

Free Mode is a variant of the classic 2048 gameplay where the player selects a set of powers before the game starts. During the game, powers are randomly placed on the grid edges and interact with tiles in strategic ways.

## Pre-Game: Power Selection

Before a Free Mode game starts, a **Power Select Modal** appears:

- Displays all available powers as selectable pastilles (dot icons).
- The player must select **at least 1** power and **at most all** powers.
- Selected powers use the `info` style; unselected use the `off` style.
- A **Start** button becomes enabled once at least one power is selected.

## Game Flow

### Power Placement

Every **2 moves**, the game randomly selects one of the player's chosen powers and places it on one of the 4 grid edges (top, bottom, left, right):

- A power can only be placed on a side **with no active power**.
- The side is chosen randomly among available sides.
- If all 4 sides are occupied, no new power is placed until one triggers.
- The power is displayed as a **tiny pastille** at the center of the corresponding grid edge.

### Targeted Tile

When at least one power is present on a grid edge:

- A random tile is designated as **targeted** (sun-rays visual effect).
- Only **one tile** is targeted at a time, shared across all active powers.
- If the targeted tile is destroyed, a new one is picked randomly.
- If all powers are removed from the grid, the targeted indicator is also removed.

### Power Triggering

A power on a given side triggers when:

1. The player moves tiles **in the direction matching that side** (e.g., power on right → move right).
2. The **targeted tile merges** during that move.

When triggered, the power's effect is applied immediately after the merge animation.

### Power Badge Coloring

Each power badge on the grid edge is color-coded based on the **potential destruction** for the corresponding direction:

| Color     | Condition                                             |
|-----------|-------------------------------------------------------|
| `info`    | No tiles would be destroyed by the power if triggered |
| `warning` | Only low-value tiles (2, 4, 8, 16) would be destroyed |
| `danger`  | High-value tiles (32+) would be destroyed             |

The color is **recalculated before every move** using a dry-run simulation of the grid state after the move.

### Info Panel

Below the grid, up to 4 lines of information are displayed (one per active power):

```
Move Up:    [Power Name] — [tiles destroyed with colored values]
Move Down:  [Power Name] — [tiles destroyed with colored values]
Move Left:  [Power Name] — [tiles destroyed with colored values]
Move Right: [Power Name] — [tiles destroyed with colored values]
```

Lines only appear if a power is present on the corresponding side.

## Tile States

A tile can only have **one active state** at a time (a new power overrides the previous state):

| State       | Visual Class        | Description                          |
|-------------|---------------------|--------------------------------------|
| normal      | *(default)*         | Standard tile with value-based color |
| targeted    | `fm-state-active`   | Sun-ray spin + gold glow             |
| frozen      | `fm-state-freeze`   | Ice shimmer + snowflake decorations  |
| ghost       | `fm-state-ghost`    | 30% opacity (expel — can exit grid)  |
| blind       | `fm-state-blind`    | Grey tile, hidden value              |
| wind-*      | `fm-state-wind-*`   | Wind lines in the blocked direction  |
| danger      | `fm-state-danger`   | Lava glow (pre-destruction flash)    |

## Game Over

Same as Classic Mode: the game ends when the grid is full and no moves are possible. Powers that destroy tiles can delay game over.

## Save System

Free Mode games are saved the same way as Classic Mode, with the additional power state (selected powers, active powers, targeted tile, tile states). Rankings are stored separately under the `free` mode key.
