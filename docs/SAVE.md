# Save System

## Overview

Fusion Mania supports two levels of game persistence:

1. **Auto-save** — A single quick-save slot (`fusionmania_save`) that stores minimal grid state (tile values, score, moves, mode). Used internally when opening the in-game menu or quitting to the title screen.

2. **Save slots** — Up to 10 manual save slots (`fusionmania_save_slots`) that store the **complete game state**, including tile powers, tile states, grid life, enemy data, power manager state, combo tracking, and all mode-specific data.

## Save Slot Data Structure

Each slot is a JSON object with the following shape:

| Field                | Type       | Modes       | Description                                  |
|----------------------|------------|-------------|----------------------------------------------|
| `mode`               | `string`   | All         | `'classic'` / `'battle'` / `'free'`          |
| `date`               | `number`   | All         | Unix timestamp (ms) of the save              |
| `grid`               | `object`   | All         | Full grid via `Grid.serializeFull()`         |
| `score`              | `number`   | All         | Current score                                |
| `moves`              | `number`   | All         | Total moves                                  |
| `fusions`            | `number`   | All         | Total tile fusions                           |
| `maxTile`            | `number`   | All         | Highest tile value reached                   |
| `comboScoreTotal`    | `number`   | All         | Cumulative combo bonus score                 |
| `combo`              | `number`   | All         | Current combo streak level                   |
| `comboMax`           | `number`   | All         | Max combo in current streak                  |
| `comboScoreStart`    | `number`   | All         | Score when combo started                     |
| `powersTriggered`    | `string[]` | All         | Power types triggered during the game        |
| `victoryShown`       | `boolean`  | All         | Whether 2048 victory modal was already shown |
| `selectedPowers`     | `string[]` | Free        | Power types chosen before the game           |
| `powerManager`       | `object`   | Free        | `PowerManager.serialize()` state             |
| `gridLife`           | `object`   | Free/Battle | `GridLife.serialize()` state                 |
| `battleManager`      | `object`   | Battle      | `BattleManager.serialize()` state            |
| `battlePowerManager` | `object`   | Battle      | `PowerManager.serialize()` for enemy powers  |

### Grid Full Serialization

`Grid.serializeFull()` stores tiles in a compact format:

```json
{
  "cells": [
    [{ "v": 16, "p": "fire-h", "s": "ice", "st": 2, "tg": true }, null, ...],
    ...
  ],
  "score": 1234,
  "moves": 42
}
```

- `v` — tile value (always present)
- `p` — power type (only if assigned)
- `s` / `st` — state name and remaining turns (only if active)
- `tg` — targeted flag (only if true)

## User Flow

### Saving (in-game menu)

1. Player opens the menu during a game (☰ button or Escape)
2. A **Save Game** button appears in the menu
3. Tapping it serializes the full game state and writes to the first available slot
4. A toast notification confirms the save ("Game saved!" / "Partie sauvegardée !")
5. If all 10 slots are full, a toast warns the player to delete a save first

### Loading (title screen)

1. Player taps the screen to open the title menu
2. A **Load Game** button appears alongside the mode selection
3. Tapping it opens the `SaveLoadModal` — a list of 10 slots (empty slots shown as dashes)
4. Each filled slot displays: slot number, mode, score, max tile badge, and save date
5. Player taps **Load** to restore a saved game, or **Delete** to remove a slot (with confirmation)
6. Loading a slot starts the `GameScene` with the full saved state

## SaveManager API

```js
saveManager.saveSlot(state)      // → slot index (0-9) or -1 if full
saveManager.loadSlot(idx)        // → full state object or null
saveManager.deleteSlot(idx)      // removes slot, trims trailing nulls
saveManager.getSlots()           // → array of slot objects (null = empty)
saveManager.getSlotSummaries()   // → [{ index, mode, date, score, maxTile, moves }]
saveManager.hasAvailableSlot()   // → boolean
```

## localStorage Keys

| Key                      | Purpose                       |
|--------------------------|-------------------------------|
| `fusionmania_save`       | Auto-save (single quick-save) |
| `fusionmania_save_slots` | Manual save slots (up to 10)  |
| `fusionmania_rankings`   | Per-mode leaderboards         |

## i18n Keys

All user-facing strings use `i18n.t()` with keys under the `save.*` and `menu.*` namespaces:

- `save.title`, `save.empty`, `save.close`, `save.delete`, `save.delete_confirm`
- `save.load`, `save.saved`, `save.slot_full`, `save.score`, `save.moves`
- `menu.save`, `menu.load`
