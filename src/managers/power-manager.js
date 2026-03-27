import {
  POWER_TYPES,
  POWER_PLACEMENT_INTERVAL,
  POWER_DURATIONS,
  GRID_SIZE,
  getPowerCategory,
} from '../configs/constants.js';

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

    const candidates = grid.getAllTiles().filter((t) => !t.power);
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
    if (!target && !this.#isGridWideEffect(powerType)) {
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
        return this.#executeLightning(grid, target);
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
   * Used for edge badge coloring and info panel.
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {{ powerType: string, tileId: string, tileValue: number, destroyedValues: number[] }[]}
   */
  predictForDirection(direction, grid) {
    const iceIds = this.#getIceIds(grid);
    const simResult = grid.simulateMove(direction, {
      iceIds,
      windBlock: this.#windDirection,
    });

    if (!simResult.moved || simResult.merges.length === 0) return [];

    // Build a post-move grid snapshot for destruction prediction
    const simGrid = this.#buildSimGrid(grid, simResult);

    const predictions = [];

    for (const merge of simResult.merges) {
      const survivorTile = grid.getAllTiles().find((t) => t.id === merge.tileId);
      const consumedTile = grid.getAllTiles().find((t) => t.id === merge.consumedId);

      const survivorPower = survivorTile?.power ?? null;
      const consumedPower = consumedTile?.power ?? null;

      if (!survivorPower && !consumedPower) continue;

      const addPrediction = (powerType) => {
        predictions.push({
          powerType,
          tileId: merge.tileId,
          tileValue: merge.value,
          destroyedValues: this.#predictDestroyed(
            powerType,
            merge.row,
            merge.col,
            merge.tileId,
            simGrid,
          ),
        });
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

    return predictions;
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
        // Bomb destroys the target tile itself
        const cell = simGrid[targetRow]?.[targetCol];
        if (cell) destroyed.push(cell.value);
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
        // Target is destroyed (plus 2 random top tiles — unpredictable)
        const cell = simGrid[targetRow]?.[targetCol];
        if (cell) destroyed.push(cell.value);
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
    if (predictions.length === 0) return null;

    let highest = 'info';
    for (const p of predictions) {
      const cat = getPowerCategory(p.powerType);
      if (cat === 'danger') return 'danger'; // Can't go higher
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
    grid.cells[target.row][target.col] = null;
    return { destroyed: [target], stateApplied: null };
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
        tileA: target, oldA: { row: tr, col: tc },
        tileB: other, oldB: { row: or, col: oc },
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

  #executeLightning(grid, target) {
    const destroyed = [];

    const topCols = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      for (let r = 0; r < GRID_SIZE; r++) {
        topCols.push({ row: r, col: c, tile: grid.cells[r][c] });
        break;
      }
      if (topCols.length <= c) {
        topCols.push({ row: 0, col: c, tile: null });
      }
    }

    if (target) {
      destroyed.push(target);
      grid.cells[target.row][target.col] = null;
    }

    const candidates = topCols.filter((s) => !target || s.tile?.id !== target.id);
    for (let i = 0; i < 2 && candidates.length > 0; i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      const slot = candidates.splice(idx, 1)[0];
      if (slot.tile) {
        destroyed.push(slot.tile);
        grid.cells[slot.tile.row][slot.tile.col] = null;
      }
    }

    return { destroyed, stateApplied: null };
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

  #isGridWideEffect(type) {
    return type === POWER_TYPES.NUCLEAR || type === POWER_TYPES.BLIND || type === POWER_TYPES.ADS;
  }

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
