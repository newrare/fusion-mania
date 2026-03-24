import { Power } from '../entities/power.js';
import {
  POWER_TYPES,
  GRID_SIDES,
  SIDE_TO_DIRECTION,
  DIRECTION_TO_SIDE,
  POWER_PLACEMENT_INTERVAL,
  POWER_DURATIONS,
  HIGH_VALUE_THRESHOLD,
  GRID_SIZE,
} from '../configs/constants.js';

/**
 * Manages the power system during Free Mode gameplay.
 * Pure logic — no DOM or Phaser dependency.
 */
export class PowerManager {
  /** @type {string[]} Power types the player selected before the game */
  #selectedTypes;

  /** @type {Map<string, Power>} Active powers on grid edges — keyed by side */
  #activePowers = new Map();

  /** @type {string | null} ID of the currently targeted tile */
  #targetedTileId = null;

  /** @type {number} Moves since last power placement */
  #movesSincePlacement = 0;

  /** @type {Map<string, string>} Wind blocks — direction → 'blocked', with remaining turns tracked via tiles */
  #windBlocks = new Map();

  /** @type {number} Wind remaining turns (global, not per-tile) */
  #windTurns = 0;

  /** @type {string | null} Currently blocked wind direction */
  #windDirection = null;

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

  /** @returns {string | null} */
  get targetedTileId() {
    return this.#targetedTileId;
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
   * Return the currently targeted tile, or null if none.
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {import('../entities/tile.js').Tile | null}
   */
  getTargetTile(grid) {
    if (!this.#targetedTileId) return null;
    return this.#findTileById(grid, this.#targetedTileId) ?? null;
  }

  /**
   * Get all active powers (on grid edges).
   * @returns {Power[]}
   */
  getActivePowers() {
    return [...this.#activePowers.values()];
  }

  /**
   * Get the power on a specific side.
   * @param {string} side
   * @returns {Power | null}
   */
  getPowerOnSide(side) {
    return this.#activePowers.get(side) ?? null;
  }

  /**
   * Get grid sides that have no active power.
   * @returns {string[]}
   */
  getAvailableSides() {
    return GRID_SIDES.filter((s) => !this.#activePowers.has(s));
  }

  /**
   * Called after each player move. Handles power placement timing.
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {Power | null} The newly placed power, or null
   */
  onMove(grid) {
    this.#movesSincePlacement++;
    this.#tickWind();
    this.#tickTileStates(grid);

    if (this.#movesSincePlacement >= POWER_PLACEMENT_INTERVAL) {
      this.#movesSincePlacement = 0;
      return this.#tryPlacePower(grid);
    }
    return null;
  }

  /**
   * Try to place a new random power on an available side.
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {Power | null}
   */
  #tryPlacePower(grid) {
    const availableSides = this.getAvailableSides();
    if (availableSides.length === 0 || this.#selectedTypes.length === 0) return null;

    const side = availableSides[Math.floor(Math.random() * availableSides.length)];
    const type = this.#selectedTypes[Math.floor(Math.random() * this.#selectedTypes.length)];

    const power = new Power(type, side);
    this.#activePowers.set(side, power);

    // Ensure a targeted tile exists
    if (!this.#targetedTileId || !this.#findTileById(grid, this.#targetedTileId)) {
      this.#pickNewTarget(grid);
    }

    return power;
  }

  /**
   * Pick a new random targeted tile from the grid.
   * @param {import('../entities/grid.js').Grid} grid
   */
  #pickNewTarget(grid) {
    const tiles = grid.getAllTiles();
    if (tiles.length === 0) {
      this.#targetedTileId = null;
      return;
    }
    // Unmark old target
    const oldTarget = tiles.find((t) => t.targeted);
    if (oldTarget) oldTarget.targeted = false;

    const chosen = tiles[Math.floor(Math.random() * tiles.length)];
    chosen.targeted = true;
    this.#targetedTileId = chosen.id;
  }

  /**
   * Ensure the targeted tile is still valid. If not, pick a new one.
   * @param {import('../entities/grid.js').Grid} grid
   */
  refreshTarget(grid) {
    if (this.#activePowers.size === 0) {
      // No active powers → clear target
      if (this.#targetedTileId) {
        const old = this.#findTileById(grid, this.#targetedTileId);
        if (old) old.targeted = false;
        this.#targetedTileId = null;
      }
      return;
    }
    // Check if current target still exists
    if (this.#targetedTileId && this.#findTileById(grid, this.#targetedTileId)) {
      return;
    }
    this.#pickNewTarget(grid);
  }

  /**
   * Check if a power should trigger for a given direction.
   * Triggers when the move in that direction produces at least one merge.
   * The power effect still emanates from the targeted tile.
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @param {{ tile: import('../entities/tile.js').Tile, fromRow: number, fromCol: number, consumedId: string }[]} merges
   * @returns {Power | null} The power that triggers, or null
   */
  checkTrigger(direction, merges) {
    const side = DIRECTION_TO_SIDE[direction];
    const power = this.#activePowers.get(side);
    if (!power) return null;

    // Trigger when any merge occurred in this direction
    if (merges.length === 0) return null;

    // Remove the power from the grid
    this.#activePowers.delete(side);
    return power;
  }

  /**
   * Execute a power's effect on the grid. Returns info about destroyed tiles.
   * @param {Power} power
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {{ destroyed: import('../entities/tile.js').Tile[], stateApplied: string | null }}
   */
  executeEffect(power, grid) {
    const target = this.#findTileById(grid, this.#targetedTileId);
    if (!target && !this.#isGridWideEffect(power.type)) {
      return { destroyed: [], stateApplied: null };
    }

    switch (power.type) {
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
   * Predict which tiles would be destroyed by a power for a given direction.
   * Used for badge coloring and info panel.
   * @param {'up' | 'down' | 'left' | 'right'} direction
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {{ powerType: string, destroyed: { id: string, value: number }[] } | null}
   */
  predictEffect(direction, grid) {
    const side = DIRECTION_TO_SIDE[direction];
    const power = this.#activePowers.get(side);
    if (!power) return null;

    const target = this.#findTileById(grid, this.#targetedTileId);
    if (!target && !this.#isGridWideEffect(power.type)) {
      return { powerType: power.type, destroyed: [] };
    }

    // Simulate the move to check if any merge occurs
    const frozenIds = this.#getFrozenIds(grid);
    const simResult = grid.simulateMove(direction, {
      frozenIds,
      windBlock: this.#windDirection,
    });

    if (simResult.merges.length === 0) {
      return { powerType: power.type, destroyed: [] };
    }

    // Predict destroyed tiles based on simulated positions
    const destroyed = this.#predictDestroyed(power.type, grid, target, simResult);
    return { powerType: power.type, destroyed };
  }

  /**
   * Determine the badge color for a power on a given side.
   * @param {string} side
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {'info' | 'warning' | 'danger'}
   */
  getBadgeColor(side, grid) {
    const direction = SIDE_TO_DIRECTION[side];
    const prediction = this.predictEffect(direction, grid);
    if (!prediction || prediction.destroyed.length === 0) return 'info';

    const hasHighValue = prediction.destroyed.some((d) => d.value >= HIGH_VALUE_THRESHOLD);
    return hasHighValue ? 'danger' : 'warning';
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
    target.applyState('frozen', POWER_DURATIONS.ICE);
    return { destroyed: [], stateApplied: 'frozen' };
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

    return { destroyed: [], stateApplied: 'teleport' };
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

    // Collect top-of-column positions (including empty)
    /** @type {{ row: number, col: number, tile: import('../entities/tile.js').Tile | null }[]} */
    const topCols = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      for (let r = 0; r < GRID_SIZE; r++) {
        topCols.push({ row: r, col: c, tile: grid.cells[r][c] });
        break;
      }
      // If column is empty push an empty slot
      if (topCols.length <= c) {
        topCols.push({ row: 0, col: c, tile: null });
      }
    }

    // Target is always hit first
    if (target) {
      destroyed.push(target);
      grid.cells[target.row][target.col] = null;
    }

    // Pick 2 more random top-of-column slots (can be empty)
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

  /**
   * @param {import('../entities/grid.js').Grid} grid
   * @param {string} id
   * @returns {import('../entities/tile.js').Tile | null}
   */
  #findTileById(grid, id) {
    if (!id) return null;
    return grid.getAllTiles().find((t) => t.id === id) ?? null;
  }

  #isGridWideEffect(type) {
    return type === POWER_TYPES.NUCLEAR || type === POWER_TYPES.BLIND || type === POWER_TYPES.ADS;
  }

  #getFrozenIds(grid) {
    const ids = new Set();
    for (const tile of grid.getAllTiles()) {
      if (tile.state === 'frozen') ids.add(tile.id);
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
   * Predict destroyed tiles for a power type based on simulated grid state.
   * @param {string} type
   * @param {import('../entities/grid.js').Grid} grid
   * @param {import('../entities/tile.js').Tile | null} target
   * @param {object} simResult
   * @returns {{ id: string, value: number }[]}
   */
  #predictDestroyed(type, grid, target, simResult) {
    const destroyed = [];
    if (!target && !this.#isGridWideEffect(type)) return destroyed;

    // Find where the target will be after the simulated move
    const targetPos = target ? (simResult.positions.get(target.id) ?? { row: target.row, col: target.col }) : null;

    // Find simulated merge that involves target — the target's value may have changed
    const targetMerge = target ? simResult.merges.find((m) => m.tileId === target.id || m.consumedId === target.id) : null;
    const targetValueAfter = targetMerge ? targetMerge.value : target?.value;

    switch (type) {
      case POWER_TYPES.FIRE_H: {
        if (!targetPos) break;
        for (const tile of grid.getAllTiles()) {
          if (tile.id === target?.id) continue;
          const pos = simResult.positions.get(tile.id) ?? { row: tile.row, col: tile.col };
          if (pos.row === targetPos.row) destroyed.push({ id: tile.id, value: tile.value });
        }
        break;
      }
      case POWER_TYPES.FIRE_V: {
        if (!targetPos) break;
        for (const tile of grid.getAllTiles()) {
          if (tile.id === target?.id) continue;
          const pos = simResult.positions.get(tile.id) ?? { row: tile.row, col: tile.col };
          if (pos.col === targetPos.col) destroyed.push({ id: tile.id, value: tile.value });
        }
        break;
      }
      case POWER_TYPES.FIRE_X: {
        if (!targetPos) break;
        for (const tile of grid.getAllTiles()) {
          if (tile.id === target?.id) continue;
          const pos = simResult.positions.get(tile.id) ?? { row: tile.row, col: tile.col };
          if (pos.row === targetPos.row || pos.col === targetPos.col) {
            destroyed.push({ id: tile.id, value: tile.value });
          }
        }
        break;
      }
      case POWER_TYPES.BOMB:
        if (target) destroyed.push({ id: target.id, value: target.value });
        break;
      case POWER_TYPES.NUCLEAR:
        for (const tile of grid.getAllTiles()) {
          destroyed.push({ id: tile.id, value: tile.value });
        }
        break;
      case POWER_TYPES.LIGHTNING: {
        if (target) destroyed.push({ id: target.id, value: target.value });
        // Can't perfectly predict random, but include the target at least
        break;
      }
      // ICE, TELEPORT, EXPEL, WIND, BLIND, ADS: no destruction
      default:
        break;
    }

    return destroyed;
  }

  /**
   * Serialize the power manager state for saving.
   * @returns {object}
   */
  serialize() {
    return {
      selectedTypes: this.#selectedTypes,
      activePowers: [...this.#activePowers.entries()].map(([side, p]) => ({
        side,
        type: p.type,
      })),
      targetedTileId: this.#targetedTileId,
      movesSincePlacement: this.#movesSincePlacement,
      windDirection: this.#windDirection,
      windTurns: this.#windTurns,
    };
  }

  /**
   * Restore the power manager state from saved data.
   * @param {object} data
   * @param {import('../entities/grid.js').Grid} grid
   */
  restore(data, grid) {
    this.#selectedTypes = data.selectedTypes ?? [];
    this.#movesSincePlacement = data.movesSincePlacement ?? 0;
    this.#windDirection = data.windDirection ?? null;
    this.#windTurns = data.windTurns ?? 0;
    this.#activePowers.clear();
    for (const { side, type } of data.activePowers ?? []) {
      this.#activePowers.set(side, new Power(type, side));
    }
    this.#targetedTileId = data.targetedTileId ?? null;
    // Re-mark the targeted tile
    const target = this.#findTileById(grid, this.#targetedTileId);
    if (target) target.targeted = true;
  }
}
