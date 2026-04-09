import {
  POWER_TYPES,
  POWER_PLACEMENT_INTERVAL,
  POWER_DURATIONS,
  GRID_SIZE,
} from '../configs/constants.js';
import { Power } from '../entities/power.js';

/**
 * Manages the power system during Free Mode gameplay.
 * Powers are charged on individual tiles. When a powered tile merges,
 * its power triggers.
 * Pure logic — no DOM or Phaser dependency.
 */
export class PowerManager {
  /** @type {string[]} Power types the player selected before the game */
  #selectedTypes;

  /** @type {number} Moves since last power placement */
  #movesSincePlacement = 0;

  /** @type {string | null} Currently blocked wind direction */
  #windDirection = null;

  /** @type {number} Wind remaining turns */
  #windTurns = 0;

  /**
   * @param {string[]} selectedTypes — Array of POWER_TYPES values chosen by the player
   */
  constructor(selectedTypes) {
    this.#selectedTypes = [...selectedTypes];
  }

  /** @returns {string[]} */
  get selectedTypes() {
    return [...this.#selectedTypes];
  }

  /** @returns {string | null} Currently blocked direction by wind */
  get windDirection() {
    return this.#windDirection;
  }

  /** @returns {number} */
  get windTurns() {
    return this.#windTurns;
  }

  /**
   * Advance one move tick: decrement tile state counters and wind.
   * @param {import('../entities/grid.js').Grid} grid
   */
  tickMove(grid) {
    this.#movesSincePlacement++;
    this.#tickWind();
    this.#tickTileStates(grid);
  }

  /**
   * Called after each non-cancelled player move. Handles power placement on tiles.
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {import('../entities/tile.js').Tile | null} The tile that received a power, or null
   */
  onMove(grid) {
    if (this.#movesSincePlacement >= POWER_PLACEMENT_INTERVAL) {
      this.#movesSincePlacement = 0;
      return this.#tryAssignPower(grid);
    }
    return null;
  }

  /**
   * Assign a random power to a random tile without a power.
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {import('../entities/tile.js').Tile | null}
   */
  #tryAssignPower(grid) {
    if (this.#selectedTypes.length === 0) return null;

    // Only assign to tiles in normal state (no active effect like ice, blind, ghost…)
    const candidates = grid.getAllTiles().filter((t) => !t.power && !t.state);
    if (candidates.length === 0) return null;

    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    const type = this.#selectedTypes[Math.floor(Math.random() * this.#selectedTypes.length)];
    tile.power = type;
    return tile;
  }

  /**
   * Check merges for powered tiles and return trigger info.
   * Called after grid.move() with the merge results.
   *
   * @param {{ tile: import('../entities/tile.js').Tile, fromRow: number, fromCol: number, consumedId: string, consumedPower: string | null }[]} merges
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {{ powerType: string, powerTypeB?: string, tile: import('../entities/tile.js').Tile, needsChoice: boolean }[]}
   */
  checkMergeTriggers(merges, grid) {
    const triggers = [];

    for (const merge of merges) {
      const survivor = merge.tile;
      const survivorPower = survivor.power;
      const consumedPower = merge.consumedPower ?? null;

      if (!survivorPower && !consumedPower) continue;

      if (survivorPower && consumedPower) {
        if (survivorPower === consumedPower) {
          // Same power → trigger once, clear from survivor
          survivor.power = null;
          triggers.push({ powerType: survivorPower, tile: survivor, needsChoice: false });
        } else {
          // Different powers → player chooses
          survivor.power = null;
          triggers.push({
            powerType: survivorPower,
            powerTypeB: consumedPower,
            tile: survivor,
            needsChoice: true,
          });
        }
      } else {
        // Only one tile has a power
        const power = survivorPower || consumedPower;
        survivor.power = null;
        triggers.push({ powerType: power, tile: survivor, needsChoice: false });
      }
    }

    return triggers;
  }

  /**
   * Execute a power's effect on the grid.
   * @param {string} powerType
   * @param {import('../entities/grid.js').Grid} grid
   * @param {import('../entities/tile.js').Tile} target — the merged tile
   * @returns {{ destroyed: import('../entities/tile.js').Tile[], stateApplied: string | null, teleported?: object }}
   */
  executeEffect(powerType, grid, target) {
    if (!target && !Power.isGridWide(powerType)) {
      return { destroyed: [], stateApplied: null };
    }

    switch (powerType) {
      case POWER_TYPES.FIRE_H:
        return this.#executeFire(grid, target, 'horizontal');
      case POWER_TYPES.FIRE_V:
        return this.#executeFire(grid, target, 'vertical');
      case POWER_TYPES.FIRE_X:
        return this.#executeFire(grid, target, 'cross');
      case POWER_TYPES.BOMB:
        return this.#executeBomb(grid, target);
      case POWER_TYPES.ICE:
        return this.#executeIce(target);
      case POWER_TYPES.TELEPORT:
        return this.#executeTeleport(grid, target);
      case POWER_TYPES.EXPEL_H:
        return this.#executeExpel(target, 'ghost-h');
      case POWER_TYPES.EXPEL_V:
        return this.#executeExpel(target, 'ghost-v');
      case POWER_TYPES.WIND_UP:
        return this.#executeWind('down');
      case POWER_TYPES.WIND_DOWN:
        return this.#executeWind('up');
      case POWER_TYPES.WIND_LEFT:
        return this.#executeWind('right');
      case POWER_TYPES.WIND_RIGHT:
        return this.#executeWind('left');
      case POWER_TYPES.LIGHTNING:
        return this.#executeLightning(grid);
      case POWER_TYPES.NUCLEAR:
        return this.#executeNuclear(grid);
      case POWER_TYPES.BLIND:
        return this.#executeBlind(grid);
      case POWER_TYPES.ADS:
        return { destroyed: [], stateApplied: 'ads' };
      default:
        return { destroyed: [], stateApplied: null };
    }
  }

  /**
   * Predict which powers would trigger for a given direction.
   * Includes both merge-triggered powers AND expel-state tiles that would exit the grid.
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {{ powerType: string, tileId: string, tileValue: number, destroyedValues: number[], mergeSourceValue?: number, exits?: boolean }[]}
   */
  predictForDirection(direction, grid) {
    const predictions = [];

    // ── Merge-triggered powers ──────────────────────
    const iceIds = this.#getIceIds(grid);
    const simResult = grid.simulateMove(direction, {
      iceIds,
      windBlock: this.#windDirection,
    });

    if (simResult.moved && simResult.merges.length > 0) {
      const simGrid = this.#buildSimGrid(grid, simResult);

      for (const merge of simResult.merges) {
        const survivorTile = grid.getAllTiles().find((t) => t.id === merge.tileId);
        const consumedTile = grid.getAllTiles().find((t) => t.id === merge.consumedId);

        const survivorPower = survivorTile?.power ?? null;
        const consumedPower = consumedTile?.power ?? null;

        if (!survivorPower && !consumedPower) continue;

        const addPrediction = (powerType) => {
          const pred = {
            powerType,
            tileId: merge.tileId,
            tileValue: merge.value,
            // Both source tiles had value = result / 2 (2048 merge rule)
            mergeSourceValue: merge.value / 2,
            destroyedValues: this.#predictDestroyed(
              powerType,
              merge.row,
              merge.col,
              merge.tileId,
              simGrid,
            ),
          };
          if (powerType === POWER_TYPES.LIGHTNING) {
            pred.lightningRange = this.#predictLightningRange(simGrid);
          }
          if (
            powerType === POWER_TYPES.BLIND ||
            powerType === POWER_TYPES.WIND_UP ||
            powerType === POWER_TYPES.WIND_DOWN ||
            powerType === POWER_TYPES.WIND_LEFT ||
            powerType === POWER_TYPES.WIND_RIGHT
          ) {
            pred.allGridValues = this.#getAllGridValues(simGrid);
          }
          predictions.push(pred);
        };

        if (survivorPower && consumedPower && survivorPower === consumedPower) {
          addPrediction(survivorPower);
        } else if (survivorPower && consumedPower) {
          addPrediction(survivorPower);
          addPrediction(consumedPower);
        } else {
          addPrediction(survivorPower || consumedPower);
        }
      }
    }

    // ── Expel exits: tiles already in ghost state that would leave the grid ──
    for (const tile of grid.getAllTiles()) {
      const isExpelV = tile.state === 'ghost-v' && (direction === 'up' || direction === 'down');
      const isExpelH = tile.state === 'ghost-h' && (direction === 'left' || direction === 'right');
      if (!isExpelV && !isExpelH) continue;

      if (this.#isExpelPathClear(tile, direction, grid)) {
        predictions.push({
          powerType: isExpelV ? POWER_TYPES.EXPEL_V : POWER_TYPES.EXPEL_H,
          tileId: tile.id,
          tileValue: tile.value,
          destroyedValues: [tile.value],
          exits: true,
        });
      }
    }

    return predictions;
  }

  /**
   * Return true if the expel tile has a clear path to the border (no tile blocking it).
   * @param {import('../entities/tile.js').Tile} tile
   * @param {'up'|'down'|'left'|'right'} direction
   * @param {import('../entities/grid.js').Grid} grid
   */
  #isExpelPathClear(tile, direction, grid) {
    const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
    const [dr, dc] = delta[direction];
    let r = tile.row + dr;
    let c = tile.col + dc;
    while (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
      if (grid.cells[r][c]) return false;
      r += dr;
      c += dc;
    }
    return true;
  }

  /**
   * Compute the min/max range of tiles that lightning could destroy.
   *
   * Lightning picks 1–3 random columns from all GRID_SIZE columns, including empty ones.
   *
   * Min (best case for the player):
   *   - If ANY column is empty → a strike can land on it and destroy nothing → min = []
   *   - Otherwise → at least 1 tile is guaranteed destroyed → min = [lowest top-tile value]
   *
   * Max (worst case):
   *   - 3 strikes, each hitting a different non-empty column.
   *   - Returns values of the top 3 most valuable columns, sorted descending.
   *
   * @param {({ id: string, value: number } | null)[][]} simGrid
   * @returns {{ min: number[], max: number[] }}
   */
  #predictLightningRange(simGrid) {
    // Collect top tile values for non-empty columns only
    const topValues = [];
    let nonEmptyCols = 0;
    for (let c = 0; c < GRID_SIZE; c++) {
      let found = false;
      for (let r = 0; r < GRID_SIZE; r++) {
        const cell = simGrid[r]?.[c];
        if (cell) {
          topValues.push(cell.value);
          found = true;
          break;
        }
      }
      if (found) nonEmptyCols++;
    }

    if (topValues.length === 0) return { min: [], max: [] };

    // Sort descending — max = 3 highest-value top tiles
    topValues.sort((a, b) => b - a);
    const max = topValues.slice(0, 3);

    // If any column is empty a strike can miss all tiles → best case = ∅
    const hasEmptyCol = nonEmptyCols < GRID_SIZE;
    const min = hasEmptyCol ? [] : [topValues[topValues.length - 1]];

    return { min, max };
  }

  /**
   * Return all tile values present in a simulated grid, in reading order.
   * @param {({ id: string, value: number } | null)[][]} simGrid
   * @returns {number[]}
   */
  #getAllGridValues(simGrid) {
    const values = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = simGrid[r]?.[c];
        if (cell) values.push(cell.value);
      }
    }
    return values;
  }

  /**
   * Build a post-move grid snapshot from simulateMove results.
   * @param {import('../entities/grid.js').Grid} grid
   * @param {{ merges: object[], positions: Map<string, {row:number, col:number}> }} simResult
   * @returns {({ id: string, value: number } | null)[][]}
   */
  #buildSimGrid(grid, simResult) {
    const simGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    const consumedIds = new Set(simResult.merges.map((m) => m.consumedId));
    const mergedValues = new Map(simResult.merges.map((m) => [m.tileId, m.value]));

    for (const tile of grid.getAllTiles()) {
      if (consumedIds.has(tile.id)) continue;

      const pos = simResult.positions.get(tile.id);
      const row = pos ? pos.row : tile.row;
      const col = pos ? pos.col : tile.col;
      const value = mergedValues.get(tile.id) ?? tile.value;
      simGrid[row][col] = { id: tile.id, value };
    }

    return simGrid;
  }

  /**
   * Predict which tile values would be destroyed if a power activates at the given position.
   * @param {string} powerType
   * @param {number} targetRow
   * @param {number} targetCol
   * @param {string} targetId
   * @param {({ id: string, value: number } | null)[][]} simGrid
   * @returns {number[]}
   */
  #predictDestroyed(powerType, targetRow, targetCol, targetId, simGrid) {
    const destroyed = [];
    const seenIds = new Set();

    const addCell = (r, c) => {
      const cell = simGrid[r]?.[c];
      if (cell && cell.id !== targetId && !seenIds.has(cell.id)) {
        seenIds.add(cell.id);
        destroyed.push(cell.value);
      }
    };

    switch (powerType) {
      case POWER_TYPES.FIRE_H:
        for (let c = 0; c < GRID_SIZE; c++) addCell(targetRow, c);
        break;
      case POWER_TYPES.FIRE_V:
        for (let r = 0; r < GRID_SIZE; r++) addCell(r, targetCol);
        break;
      case POWER_TYPES.FIRE_X:
        for (let c = 0; c < GRID_SIZE; c++) addCell(targetRow, c);
        for (let r = 0; r < GRID_SIZE; r++) addCell(r, targetCol);
        break;
      case POWER_TYPES.BOMB: {
        // Bomb destroys the emitter tile + 4 orthogonal neighbors
        const centerCell = simGrid[targetRow]?.[targetCol];
        if (centerCell && !seenIds.has(centerCell.id)) {
          seenIds.add(centerCell.id);
          destroyed.push(centerCell.value);
        }
        const bombNeighbors = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        for (const [dr, dc] of bombNeighbors) {
          const cell = simGrid[targetRow + dr]?.[targetCol + dc];
          if (cell && !seenIds.has(cell.id)) {
            seenIds.add(cell.id);
            destroyed.push(cell.value);
          }
        }
        break;
      }
      case POWER_TYPES.NUCLEAR:
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const cell = simGrid[r][c];
            if (cell && !seenIds.has(cell.id)) {
              seenIds.add(cell.id);
              destroyed.push(cell.value);
            }
          }
        }
        break;
      case POWER_TYPES.LIGHTNING: {
        // Worst case: 3 columns struck, each loses its top tile
        let count = 0;
        for (let c = 0; c < GRID_SIZE && count < 3; c++) {
          for (let r = 0; r < GRID_SIZE; r++) {
            const cell = simGrid[r]?.[c];
            if (cell && !seenIds.has(cell.id)) {
              seenIds.add(cell.id);
              destroyed.push(cell.value);
              count++;
              break;
            }
          }
        }
        break;
      }
      default:
        // Non-destructive powers (ice, wind, expel, teleport, blind): nothing destroyed
        break;
    }

    return destroyed;
  }

  /**
   * Determine the badge color for a direction based on predicted power triggers.
   * Priority: danger > warning > info.
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {'danger' | 'warning' | 'info' | null} null if no power would trigger
   */
  getBadgeColor(direction, grid) {
    const predictions = this.predictForDirection(direction, grid);
    // Danger powers only count if they would actually destroy tiles;
    // warning/info powers always count (they apply states or reposition tiles).
    // Expel exits always count as danger regardless of their base category.
    const visible = predictions.filter((p) => {
      if (p.exits) return true;
      if (Power.category(p.powerType) === 'danger') {
        return p.destroyedValues && p.destroyedValues.length > 0;
      }
      return true;
    });
    if (visible.length === 0) return null;

    let highest = 'info';
    for (const p of visible) {
      if (p.exits) return 'danger';
      const cat = Power.category(p.powerType);
      if (cat === 'danger') return 'danger';
      if (cat === 'warning') highest = 'warning';
    }
    return highest;
  }

  /**
   * Check if any tile on the grid has a power.
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {boolean}
   */
  hasPoweredTiles(grid) {
    return grid.getAllTiles().some((t) => t.power);
  }

  /**
   * Check if any tile on the grid is in an active expel state (ghost-v or ghost-h).
   * Used to keep the info panel visible even when no power is loaded on a tile.
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {boolean}
   */
  hasActiveExpelTiles(grid) {
    return grid.getAllTiles().some((t) => t.state === 'ghost-v' || t.state === 'ghost-h');
  }

  // ─── Private: Effects ────────────────────────────

  #executeFire(grid, target, mode) {
    const destroyed = [];
    if (!target) return { destroyed, stateApplied: null };

    for (let c = 0; c < GRID_SIZE; c++) {
      if (mode === 'horizontal' || mode === 'cross') {
        const tile = grid.cells[target.row][c];
        if (tile && tile.id !== target.id) {
          destroyed.push(tile);
          grid.cells[target.row][c] = null;
        }
      }
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      if (mode === 'vertical' || mode === 'cross') {
        const tile = grid.cells[r][target.col];
        if (tile && tile.id !== target.id) {
          destroyed.push(tile);
          grid.cells[r][target.col] = null;
        }
      }
    }
    return { destroyed, stateApplied: null };
  }

  #executeBomb(grid, target) {
    if (!target) return { destroyed: [], stateApplied: null };
    const destroyed = [];
    // Destroy the 4 orthogonal neighbors first
    const neighbors = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of neighbors) {
      const r = target.row + dr;
      const c = target.col + dc;
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        const neighbor = grid.cells[r][c];
        if (neighbor) {
          destroyed.push(neighbor);
          grid.cells[r][c] = null;
        }
      }
    }
    // Destroy the emitter tile itself
    grid.cells[target.row][target.col] = null;
    destroyed.push(target);
    return { destroyed, stateApplied: null };
  }

  #executeIce(target) {
    if (!target) return { destroyed: [], stateApplied: null };
    target.applyState('ice', POWER_DURATIONS.ICE);
    return { destroyed: [], stateApplied: 'ice' };
  }

  #executeTeleport(grid, target) {
    if (!target) return { destroyed: [], stateApplied: null };
    const others = grid.getAllTiles().filter((t) => t.id !== target.id);
    if (others.length === 0) return { destroyed: [], stateApplied: null };

    const other = others[Math.floor(Math.random() * others.length)];
    const [tr, tc] = [target.row, target.col];
    const [or, oc] = [other.row, other.col];

    grid.cells[tr][tc] = other;
    grid.cells[or][oc] = target;
    target.row = or;
    target.col = oc;
    other.row = tr;
    other.col = tc;

    return {
      destroyed: [],
      stateApplied: 'teleport',
      teleported: {
        tileA: target,
        oldA: { row: tr, col: tc },
        tileB: other,
        oldB: { row: or, col: oc },
      },
    };
  }

  #executeExpel(target, ghostState) {
    if (!target) return { destroyed: [], stateApplied: null };
    target.applyState(ghostState, POWER_DURATIONS.EXPEL);
    return { destroyed: [], stateApplied: ghostState };
  }

  #executeWind(blockedDirection) {
    this.#windDirection = blockedDirection;
    this.#windTurns = POWER_DURATIONS.WIND;
    return { destroyed: [], stateApplied: `wind-${blockedDirection}` };
  }

  #executeLightning(grid) {
    const destroyed = [];

    // Pick 1–3 random columns (shuffle and take first N)
    const numStrikes = 1 + Math.floor(Math.random() * 3);
    const cols = [0, 1, 2, 3];
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    const chosenCols = cols.slice(0, numStrikes);

    const strikes = [];
    for (const col of chosenCols) {
      // Find the top tile in this column (first non-null row)
      let topTile = null;
      let strikeRow = 0;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (grid.cells[r][col]) {
          topTile = grid.cells[r][col];
          strikeRow = r;
          break;
        }
      }

      if (topTile) {
        destroyed.push(topTile);
        grid.cells[topTile.row][topTile.col] = null;
      }

      strikes.push({ col, row: strikeRow, tile: topTile });
    }

    return { destroyed, stateApplied: null, lightningStrikes: strikes };
  }

  #executeNuclear(grid) {
    const destroyed = grid.getAllTiles();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        grid.cells[r][c] = null;
      }
    }
    return { destroyed, stateApplied: null };
  }

  #executeBlind(grid) {
    for (const tile of grid.getAllTiles()) {
      tile.applyState('blind', POWER_DURATIONS.BLIND);
    }
    return { destroyed: [], stateApplied: 'blind' };
  }

  // ─── Private: Helpers ────────────────────────────

  #getIceIds(grid) {
    const ids = new Set();
    for (const tile of grid.getAllTiles()) {
      if (tile.state === 'ice') ids.add(tile.id);
    }
    return ids;
  }

  #tickWind() {
    if (this.#windTurns > 0) {
      this.#windTurns--;
      if (this.#windTurns <= 0) {
        this.#windDirection = null;
      }
    }
  }

  #tickTileStates(grid) {
    for (const tile of grid.getAllTiles()) {
      tile.tickState();
    }
  }

  /**
   * Serialize the power manager state for saving.
   * @returns {object}
   */
  serialize() {
    return {
      selectedTypes: this.#selectedTypes,
      movesSincePlacement: this.#movesSincePlacement,
      windDirection: this.#windDirection,
      windTurns: this.#windTurns,
    };
  }

  /**
   * Remove a power type from the selected pool.
   * Prevents that power from being assigned to any future tile.
   * @param {string} type — One of POWER_TYPES values
   */
  removePowerType(type) {
    this.#selectedTypes = this.#selectedTypes.filter((t) => t !== type);
  }

  /**
   * Restore the power manager state from saved data.
   * Tile powers are saved/restored as part of the grid serialization.
   * @param {object} data
   */
  restore(data) {
    this.#selectedTypes = data.selectedTypes ?? [];
    this.#movesSincePlacement = data.movesSincePlacement ?? 0;
    this.#windDirection = data.windDirection ?? null;
    this.#windTurns = data.windTurns ?? 0;
  }
}
