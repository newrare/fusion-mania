# History System — Fusion Mania

The history system records every player action and its consequences during a game session. It is accessible via a 📜 button at the bottom-left of the game HUD.

## Components

| File                              | Role                                                             |
| --------------------------------- | ---------------------------------------------------------------- |
| `src/managers/history-manager.js` | Pure data manager — records turns and entries, no DOM dependency |
| `src/components/history-modal.js` | DOM modal rendering the chronological event log                  |

## HistoryManager

A pure data class that stores an ordered list of **turns**. Each turn has a direction, move number, score delta, and a list of **entries** describing what happened.

### Turn lifecycle

```
beginTurn(move, dir, scoreBefore)
  → addFusions([...pairs])
  → addPower(type)
  → addContamination(value)
  → addEnemySpawn(name, level)
  → addEnemyDamage(name, damage)
  → addEnemyDefeated(name, level)
  → addTilesLost([...values])
  → addComboBonus(points)
finalizeTurn(scoreAfter)
```

`finalizeTurn` computes the score delta and appends a `score` entry if the score increased. Most recent turns appear first in the array.

### Entry types

| Type             | Data                        | Description                           |
| ---------------- | --------------------------- | ------------------------------------- |
| `fusion`         | `{ pairs: [[a,b], ...] }`   | Tile merges that occurred             |
| `power`          | `{ types: [string, ...] }`  | Powers activated (merged if multiple) |
| `contamination`  | `{ value }`                 | HP lost from enemy contamination      |
| `enemy_spawn`    | `{ name, level }`           | New enemy appeared                    |
| `enemy_damage`   | `{ name, damage }`          | Damage dealt to enemy                 |
| `enemy_defeated` | `{ name, level }`           | Enemy destroyed                       |
| `tiles_lost`     | `{ values: [number, ...] }` | Tiles removed from the board          |
| `combo_bonus`    | `{ points }`                | Bonus points from combo chain         |
| `score`          | `{ points }`                | Score gained this turn                |

### Limits

History is capped at `MAX_TURNS` (500). When exceeded, the oldest turns are trimmed.

### Serialization

```js
const data = historyManager.serialize(); // { turns: [...] }
historyManager.restore(data);            // restores from saved data
```

Integrates with `SaveManager` — history is included in both auto-save and manual save slots.

## HistoryModal

A DOM-based scrollable modal following the same pattern as `HelpModal`.

### Features

- Most recent events at the top, oldest at the bottom
- Direction icons: ↑ ↓ ← →
- Color-coded sub-entries: green (success), gold (bonus), red (danger)
- Power entries show SVG icons with category-based coloring (danger/warning/info)
- Fully i18n-aware (EN/FR) with live locale change support
- Keyboard navigation (arrows, enter, escape) via `enableKeyboardNav`

### CSS classes

| Class                      | Purpose                                |
| -------------------------- | -------------------------------------- |
| `.fm-history-modal`        | Modal overlay                          |
| `.fm-history-content`      | Scrollable list (max-height 60vh)      |
| `.fm-history-turn`         | Single turn block                      |
| `.fm-history-header`       | Turn header (move #, direction, score) |
| `.fm-history-sub`          | Sub-entry line                         |
| `.fm-history-sub--success` | Green (enemy defeated)                 |
| `.fm-history-sub--bonus`   | Gold (combo, score)                    |
| `.fm-history-sub--danger`  | Red (contamination, tiles lost)        |
| `.fm-history-power-icon`   | Inline SVG power icon                  |
| `.fm-history-btn`          | Bottom-left HUD button                 |

### i18n keys

All user-facing strings use `i18n.t()` with keys under the `history.*` namespace:

- `history.title`, `history.empty`
- `history.move`, `history.fusion`, `history.power`
- `history.contamination`, `history.enemy_spawn`, `history.enemy_damage`, `history.enemy_defeated`
- `history.tiles_lost`, `history.combo_bonus`, `history.score`
- `history.dir_up`, `history.dir_down`, `history.dir_left`, `history.dir_right`

## Integration in GameScene

History events are recorded in `game-scene.js`:

| Hook                  | Events recorded                                                           |
| --------------------- | ------------------------------------------------------------------------- |
| `#executeMove`        | `beginTurn`, `addFusions`, `addTilesLost` (expelled), `finalizeTurn`      |
| `#executePowerEffect` | `addPower`, `addTilesLost` (destroyed)                                    |
| `#tickBattle`         | `addEnemySpawn`, `addEnemyDamage`, `addEnemyDefeated`, `addContamination` |
| `#endCombo`           | `addComboBonus`                                                           |

## Testing

- `tests/managers/history-manager.test.js` — 22 tests covering turn lifecycle, all entry types, limits, serialization
- `tests/components/history-modal.test.js` — 15 tests covering DOM rendering, i18n, keyboard nav, cleanup
