# Free Mode — Fusion Mania

## Overview

Free Mode is a variant of the classic 2048 gameplay where the player selects a set of powers before the game starts. During the game, powers are randomly assigned to tiles and activate when those tiles merge.

## Pre-Game: Power Selection

Before a Free Mode game starts, a **Power Select Modal** appears:

- Displays all available powers as selectable pastilles (dot icons).
- The player must select **at least 1** power and **at most all** powers.
- Selected powers use the `info` style; unselected use the `off` style.
- A **Start** button becomes enabled once at least one power is selected.

## Game Flow

### Power Assignment

Every **2 moves**, the game randomly selects one of the player's chosen powers and assigns it to a random tile on the grid:

- Only tiles **without a power** can receive one.
- If all tiles already carry a power, no new power is assigned.
- The powered tile displays a **flip-card animation** showing the power on its back face.

### Power Triggering

A power triggers when its carrier tile **merges** (fuses) with another tile:

- The merged (surviving) tile becomes the target for the power's effect.
- The power is consumed upon activation.

### Merge Scenarios

| Scenario | Behaviour |
|----------|-----------|
| One tile has a power, the other doesn't | Power triggers immediately |
| Both tiles have the **same** power | Power triggers **once** |
| Both tiles have **different** powers | **Choice modal** appears — player picks which power to activate |
| Multiple powered tiles merge in the same move | Powers execute **in sequence** |

### Power Choice Modal

When two tiles with different powers merge, the game pauses and displays a modal with both power icons. The player taps the power they want to activate. The other power is lost.

### Edge Indicators

The 4 grid edges display color-coded `!` indicators predicting what would happen if the player moves in that direction:

| Color     | Power Types                                       |
|-----------|---------------------------------------------------|
| `danger`  | fire, bomb, nuclear, lightning (destroys tiles)    |
| `warning` | teleport, expel, blind (disruptive effects)        |
| `info`    | wind, ice (passive effects)                        |

Priority: **danger > warning > info**. Only shown when a powered tile would actually merge.

### Info Panel

Below the grid, up to 4 lines of information are displayed (one per direction with predictions):

```
Move Up:    [Power Name] — [tile value]
Move Down:  [Power Name] — [tile value]
Move Left:  [Power Name] — [tile value]
Move Right: [Power Name] — [tile value]
```

Lines only appear if a powered tile would merge in the corresponding direction.

## Powered Tile Visual

Reference: `docs/preview-powers.html`

Tiles carrying a power use a flip-card effect:

- **Front face**: Normal tile appearance + small power hint at the bottom (icon + name)
- **Back face**: Full-color face (danger=red, warning=amber, info=blue) with large power icon and value reminder

The flip animation cycles every 8 seconds. It **pauses** when the player initiates a move and **resumes** after.

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

Note: A tile's **power** and its **state** are independent. A tile can carry a power AND have an active state (e.g. a frozen tile with a fire power).

## Game Over

Same as Classic Mode: the game ends when the grid is full and no moves are possible. Powers that destroy tiles can delay game over.

## Save System

Free Mode games are saved the same way as Classic Mode, with the additional power state (selected powers, tile powers, wind state). Rankings are stored separately under the `free` mode key.
