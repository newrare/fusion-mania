import { POWER_TYPES, POWER_DURATIONS, GRID_SIZE } from '../configs/constants.js';
import { Power } from '../entities/power.js';

/** Mapping from swipe direction to grid edge where the matching power is charged. */
const DIR_TO_SIDE = {
  up: 'top',
  down: 'bottom',
  left: 'left',
  right: 'right',
};

/** All four grid sides. */
export const POWER_SIDES = ['top', 'bottom', 'left', 'right'];

/**
 * Power system manager — edge-charging model.
 *
 * Powers are charged on the 4 grid edges (top/bottom/left/right). A swipe in
 * the corresponding direction fires the power. "Direct" powers (ice, expel)
 * are never charged on edges: they are applied immediately on a random tile.
 *
 * One tile at a time carries the `targeted` visual (sunburst) and acts as
 * source for target-based powers (fire, bomb, teleport, nuclear).
 *
 * Pure logic — no DOM or Phaser dependency.
 */
export class PowerManager {
  /** @type {string[]} Power types the player selected before the game. */
  #selectedTypes;

  /** @type {{ top: string|null, bottom: string|null, left: string|null, right: string|null }} */
  #edges = { top: null, bottom: null, left: null, right: null };

  /** @type {string | null} Tile id of the currently targeted tile, or null. */
  #targetedTileId = null;

  /** @type {number} Moves since last power placement. */
  #movesSincePlacement = 0;

  /** @type {string | null} Currently blocked wind direction. */
  #windDirection = null;

  /** @type {number} Wind remaining turns. */
  #windTurns = 0;

  /**
   * @param {string[]} selectedTypes — Array of POWER_TYPES values chosen by the player.
   */
  constructor(selectedTypes = []) {
    this.#selectedTypes = [...selectedTypes];
  }

  // ─── Getters ─────────────────────────────────────

  /** @returns {string[]} */
  get selectedTypes() {
    return [...this.#selectedTypes];
  }

  /** @returns {{ top: string|null, bottom: string|null, left: string|null, right: string|null }} */
  get edges() {
    return { ...this.#edges };
  }

  /** @returns {string | null} */
  get targetedTileId() {
    return this.#targetedTileId;
  }

  /** @returns {string | null} Currently blocked direction by wind. */
  get windDirection() {
    return this.#windDirection;
  }

  /** @returns {number} */
  get windTurns() {
    return this.#windTurns;
  }

  // ─── Lifecycle ───────────────────────────────────

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
   * Assign a new power (from the player's pool) after a valid move.
   * Edge-charged powers are placed on a random empty edge (skipped if all full).
   * Direct powers are applied immediately on a random eligible tile.
   *
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {{ kind: 'edge', side: string, type: string } | { kind: 'direct', tile: import('../entities/tile.js').Tile, type: string } | null}
   */
  onMove(grid) {
    if (this.#movesSincePlacement < 2) return null;
    this.#movesSincePlacement = 0;
    if (this.#selectedTypes.length === 0) return null;

    const type = this.#selectedTypes[Math.floor(Math.random() * this.#selectedTypes.length)];

    if (Power.isDirect(type)) {
      const tile = this.applyDirectPower(type, grid);
      return tile ? { kind: 'direct', tile, type } : null;
    }

    const side = this.#pickRandomFreeSide();
    if (!side) return null;
    this.#edges[side] = type;
    return { kind: 'edge', side, type };
  }

  // ─── Edge API ────────────────────────────────────

  /**
   * Charge a power on a specific grid side (overwrites if already occupied).
   * @param {string} side — 'top' | 'bottom' | 'left' | 'right'
   * @param {string} type — POWER_TYPES value
   * @returns {boolean} True if charged.
   */
  chargeEdge(side, type) {
    if (!POWER_SIDES.includes(side)) return false;
    this.#edges[side] = type;
    return true;
  }

  /**
   * Pick a random free edge and charge the given power. Returns the chosen
   * side, or null if every edge is already occupied.
   * @param {string} type
   * @returns {string | null}
   */
  chargeRandomFreeEdge(type) {
    const side = this.#pickRandomFreeSide();
    if (!side) return null;
    this.#edges[side] = type;
    return side;
  }

  /**
   * Consume the edge power matching the given direction (if any).
   * Called after a valid player move in direction `direction`.
   *
   * @param {'up'|'down'|'left'|'right'} direction
   * @returns {{ type: string, side: string } | null}
   */
  fireEdge(direction) {
    const side = DIR_TO_SIDE[direction];
    if (!side) return null;
    const type = this.#edges[side];
    if (!type) return null;
    this.#edges[side] = null;
    return { type, side };
  }

  // ─── Targeted tile ───────────────────────────────

  /**
   * Maintain the single `targeted` flag across all tiles so it matches the
   * current targetedTileId. Called after state changes.
   * @param {import('../entities/grid.js').Grid} grid
   */
  #syncTargetedFlag(grid) {
    for (const tile of grid.getAllTiles()) {
      tile.targeted = tile.id === this.#targetedTileId;
    }
  }

  /**
   * Ensure the targeted tile is consistent with the current edge charges:
   * - If at least one edge holds a target-based power AND no valid target
   *   exists, pick a random eligible tile (not frozen).
   * - If the current target is gone or frozen, re-pick.
   * - If no edge holds a target-based power, clear the target.
   *
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {string | null} The new targetedTileId (or null).
   */
  refreshTargetedTile(grid) {
    const needsTarget = Object.values(this.#edges).some((t) => t && Power.needsTarget(t));

    if (!needsTarget) {
      this.#targetedTileId = null;
      this.#syncTargetedFlag(grid);
      return null;
    }

    const tiles = grid.getAllTiles();
    const eligible = tiles.filter((t) => t.state !== 'ice');
    if (eligible.length === 0) {
      this.#targetedTileId = null;
      this.#syncTargetedFlag(grid);
      return null;
    }

    const current = tiles.find((t) => t.id === this.#targetedTileId);
    if (!current || current.state === 'ice') {
      const pick = eligible[Math.floor(Math.random() * eligible.length)];
      this.#targetedTileId = pick.id;
    }

    this.#syncTargetedFlag(grid);
    return this.#targetedTileId;
  }

  /**
   * Return the currently targeted tile instance, or null.
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {import('../entities/tile.js').Tile | null}
   */
  getTargetedTile(grid) {
    if (!this.#targetedTileId) return null;
    return grid.getAllTiles().find((t) => t.id === this.#targetedTileId) ?? null;
  }

  /**
   * If the currently targeted tile was the consumed (moving) tile in a merge,
   * redirect the target to the surviving merged tile so fire/bomb/nuclear
   * powers can still fire normally after the move.
   *
   * Call this BEFORE `getTargetedTile` whenever a grid move has been executed.
   *
   * @param {Array<{tile: import('../entities/tile.js').Tile, consumedId: string}>} merges
   */
  resolveTargetAfterMerge(merges) {
    if (!this.#targetedTileId || merges.length === 0) return;
    const merge = merges.find((m) => m.consumedId === this.#targetedTileId);
    if (merge) {
      this.#targetedTileId = merge.tile.id;
    }
  }

  // ─── Direct powers (ice, expel) ──────────────────

  /**
   * Apply a direct power to a random eligible tile (without any existing state).
   * Used by the game in Free mode (onMove path) where no animation is needed.
   *
   * @param {string} type — ICE | EXPEL_H | EXPEL_V
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {import('../entities/tile.js').Tile | null} The affected tile, or null.
   */
  applyDirectPower(type, grid) {
    const tile = this.pickDirectTarget(type, grid);
    if (!tile) return null;
    this.applyDirectStateToTile(type, tile);
    return tile;
  }

  /**
   * Pick a random eligible tile for a direct power without applying any state.
   * Used by BattleManager contamination so the animation can play first.
   *
   * @param {string} type — ICE | EXPEL_H | EXPEL_V
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {import('../entities/tile.js').Tile | null}
   */
  pickDirectTarget(type, grid) {
    if (!Power.isDirect(type)) return null;
    const candidates = grid.getAllTiles().filter((t) => !t.state && t.iceCooldown <= 0);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Apply a direct power state to a specific tile (no random selection).
   * Call this after the contamination animation has finished.
   *
   * @param {string} type — ICE | EXPEL_H | EXPEL_V
   * @param {import('../entities/tile.js').Tile} tile
   */
  applyDirectStateToTile(type, tile) {
    switch (type) {
      case POWER_TYPES.ICE:
        tile.applyState('ice', POWER_DURATIONS.ICE);
        break;
      case POWER_TYPES.EXPEL_H:
        tile.applyState('ghost-h', POWER_DURATIONS.EXPEL);
        break;
      case POWER_TYPES.EXPEL_V:
        tile.applyState('ghost-v', POWER_DURATIONS.EXPEL);
        break;
    }
  }

  // ─── Effect execution ────────────────────────────

  /**
   * Execute the power effect on the grid. For target-based powers, `target`
   * must be the current targeted tile.
   *
   * @param {string} powerType
   * @param {import('../entities/grid.js').Grid} grid
   * @param {import('../entities/tile.js').Tile | null} target
   * @returns {{ destroyed: import('../entities/tile.js').Tile[], stateApplied: string | null, teleported?: object, lightningStrikes?: object[] }}
   */
  executeEffect(powerType, grid, target, newTile = null) {
    switch (powerType) {
      case POWER_TYPES.FIRE_H:
        return this.#executeFire(grid, target, 'horizontal');
      case POWER_TYPES.FIRE_V:
        return this.#executeFire(grid, target, 'vertical');
      case POWER_TYPES.FIRE_X:
        return this.#executeFire(grid, target, 'cross');
      case POWER_TYPES.BOMB:
        return this.#executeBomb(grid, target);
      case POWER_TYPES.TELEPORT:
        return this.#executeTeleport(grid, target);
      case POWER_TYPES.NUCLEAR:
        return this.#executeNuclear(grid);
      case POWER_TYPES.LIGHTNING:
        return this.#executeLightning(grid);
      case POWER_TYPES.WIND_UP:
        return this.#executeWind('down');
      case POWER_TYPES.WIND_DOWN:
        return this.#executeWind('up');
      case POWER_TYPES.WIND_LEFT:
        return this.#executeWind('right');
      case POWER_TYPES.WIND_RIGHT:
        return this.#executeWind('left');
      case POWER_TYPES.BLIND:
        return this.#executeBlind(grid, newTile);
      case POWER_TYPES.ADS:
        return { destroyed: [], stateApplied: 'ads' };
      // Direct powers are normally applied via applyDirectPower, but we keep
      // these branches so executeEffect can still be called generically.
      case POWER_TYPES.ICE:
      case POWER_TYPES.EXPEL_H:
      case POWER_TYPES.EXPEL_V: {
        const tile = this.applyDirectPower(powerType, grid);
        return { destroyed: [], stateApplied: tile?.state ?? null };
      }
      default:
        return { destroyed: [], stateApplied: null };
    }
  }

  // ─── UI helpers ──────────────────────────────────

  /**
   * Return the badge color for a grid side based on its charged power AND
   * the prediction for a swipe in that direction. Destructive powers are
   * downgraded to `info` when no tile would actually be destroyed.
   * @param {'up'|'down'|'left'|'right'} direction
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {'danger'|'warning'|'info'|null}
   */
  getBadgeColor(direction, grid) {
    const side = DIR_TO_SIDE[direction];
    const type = side ? this.#edges[side] : null;
    if (!type) return null;
    if (!grid) return Power.category(type);
    const pred = this.predictForDirection(direction, grid);
    if (!pred) return Power.category(type);
    return pred.severity;
  }

  /**
   * Predict what will happen if the player swipes in `direction`, based on
   * the currently charged edge and the targeted tile's post-swipe position.
   *
   * Returns null if the edge is empty. Otherwise returns:
   * {
   *   type, severity, destroyedValues?, affectedValues?, targetValue?,
   *   lightningRange?
   * }
   *
   * @param {'up'|'down'|'left'|'right'} direction
   * @param {import('../entities/grid.js').Grid} grid
   */
  predictForDirection(direction, grid) {
    const side = DIR_TO_SIDE[direction];
    const type = side ? this.#edges[side] : null;
    if (!type) return null;

    // If wind blocks this direction, the swipe is cancelled → no firing.
    if (this.#windDirection === direction) {
      return { type, severity: 'info', cancelled: true };
    }

    const iceIds = new Set();
    for (const t of grid.getAllTiles()) if (t.state === 'ice') iceIds.add(t.id);
    const sim = grid.simulateMove(direction, { iceIds, windBlock: this.#windDirection });
    if (!sim.moved) {
      // Bump — nothing fires.
      return { type, severity: 'info', cancelled: true };
    }

    const simGrid = this.#buildSimGrid(grid, sim);
    const targetId = this.#targetedTileId;
    const pos = targetId ? sim.positions.get(targetId) : null;

    // Target was consumed by a merge → no destruction, but the effect is
    // still "charged" (and will be a no-op at fire time).
    const targetSurvived = !!pos;

    const base = { type };

    switch (type) {
      case POWER_TYPES.FIRE_H: {
        if (!targetSurvived) return { ...base, severity: 'info', destroyedValues: [] };
        const destroyed = this.#destroyedInRow(simGrid, pos.row, pos.col);
        return {
          ...base,
          severity: destroyed.length > 0 ? 'danger' : 'info',
          destroyedValues: destroyed,
        };
      }
      case POWER_TYPES.FIRE_V: {
        if (!targetSurvived) return { ...base, severity: 'info', destroyedValues: [] };
        const destroyed = this.#destroyedInCol(simGrid, pos.col, pos.row);
        return {
          ...base,
          severity: destroyed.length > 0 ? 'danger' : 'info',
          destroyedValues: destroyed,
        };
      }
      case POWER_TYPES.FIRE_X: {
        if (!targetSurvived) return { ...base, severity: 'info', destroyedValues: [] };
        const destroyed = [
          ...this.#destroyedInRow(simGrid, pos.row, pos.col),
          ...this.#destroyedInCol(simGrid, pos.col, pos.row),
        ];
        return {
          ...base,
          severity: destroyed.length > 0 ? 'danger' : 'info',
          destroyedValues: destroyed,
        };
      }
      case POWER_TYPES.BOMB: {
        if (!targetSurvived) return { ...base, severity: 'info', destroyedValues: [] };
        const destroyed = this.#destroyedInBomb(simGrid, pos.row, pos.col);
        return {
          ...base,
          severity: destroyed.length > 0 ? 'danger' : 'info',
          destroyedValues: destroyed,
        };
      }
      case POWER_TYPES.NUCLEAR: {
        const all = this.#allValues(simGrid);
        return {
          ...base,
          severity: all.length > 0 ? 'danger' : 'info',
          destroyedValues: all,
        };
      }
      case POWER_TYPES.LIGHTNING: {
        const range = this.#predictLightningRange(simGrid);
        return {
          ...base,
          severity: range.max.length > 0 ? 'danger' : 'info',
          lightningRange: range,
        };
      }
      case POWER_TYPES.TELEPORT: {
        const targetVal = targetSurvived ? simGrid[pos.row][pos.col]?.value : null;
        const otherCount = this.#allValues(simGrid).length - (targetSurvived ? 1 : 0);
        return {
          ...base,
          severity: targetSurvived && otherCount > 0 ? 'warning' : 'info',
          targetValue: targetVal ?? null,
        };
      }
      case POWER_TYPES.WIND_UP:
      case POWER_TYPES.WIND_DOWN:
      case POWER_TYPES.WIND_LEFT:
      case POWER_TYPES.WIND_RIGHT:
        return { ...base, severity: 'info', affectedValues: this.#allValues(simGrid) };
      case POWER_TYPES.BLIND:
        return { ...base, severity: 'warning', affectedValues: this.#allValues(simGrid) };
      case POWER_TYPES.ADS:
        return { ...base, severity: 'warning' };
      default:
        return { ...base, severity: Power.category(type) };
    }
  }

  /**
   * Build a post-move snapshot grid ({id, value}|null) from simulateMove results.
   * @param {import('../entities/grid.js').Grid} grid
   * @param {{ merges: object[], positions: Map<string, {row:number, col:number}> }} sim
   */
  #buildSimGrid(grid, sim) {
    const simGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    const consumedIds = new Set(sim.merges.map((m) => m.consumedId));
    const mergedValues = new Map(sim.merges.map((m) => [m.tileId, m.value]));
    for (const tile of grid.getAllTiles()) {
      if (consumedIds.has(tile.id)) continue;
      const pos = sim.positions.get(tile.id);
      const row = pos ? pos.row : tile.row;
      const col = pos ? pos.col : tile.col;
      const value = mergedValues.get(tile.id) ?? tile.value;
      simGrid[row][col] = { id: tile.id, value };
    }
    return simGrid;
  }

  #destroyedInRow(simGrid, row, keepCol) {
    const vals = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = simGrid[row]?.[c];
      if (cell && c !== keepCol) vals.push(cell.value);
    }
    return vals;
  }

  #destroyedInCol(simGrid, col, keepRow) {
    const vals = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const cell = simGrid[r]?.[col];
      if (cell && r !== keepRow) vals.push(cell.value);
    }
    return vals;
  }

  #destroyedInBomb(simGrid, row, col) {
    const vals = [];
    // Target itself destroyed by bomb
    const center = simGrid[row]?.[col];
    if (center) vals.push(center.value);
    const neighbors = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of neighbors) {
      const cell = simGrid[row + dr]?.[col + dc];
      if (cell) vals.push(cell.value);
    }
    return vals;
  }

  #allValues(simGrid) {
    const vals = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = simGrid[r]?.[c];
        if (cell) vals.push(cell.value);
      }
    }
    return vals;
  }

  /**
   * Min/max range of values lightning could destroy.
   * - Min = empty if any column is empty (strike could miss), else the lowest top value.
   * - Max = 3 highest top-of-column values.
   */
  #predictLightningRange(simGrid) {
    const topValues = [];
    let nonEmptyCols = 0;
    for (let c = 0; c < GRID_SIZE; c++) {
      for (let r = 0; r < GRID_SIZE; r++) {
        const cell = simGrid[r]?.[c];
        if (cell) {
          topValues.push(cell.value);
          nonEmptyCols++;
          break;
        }
      }
    }
    if (topValues.length === 0) return { min: [], max: [] };
    topValues.sort((a, b) => b - a);
    const max = topValues.slice(0, 3);
    const hasEmptyCol = nonEmptyCols < GRID_SIZE;
    const min = hasEmptyCol ? [] : [topValues[topValues.length - 1]];
    return { min, max };
  }

  /**
   * True if any edge carries a power.
   * @returns {boolean}
   */
  hasEdgePowers() {
    return Object.values(this.#edges).some(Boolean);
  }

  /**
   * True if any tile is in an active expel state (ghost-v or ghost-h).
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {boolean}
   */
  hasActiveExpelTiles(grid) {
    return grid.getAllTiles().some((t) => t.state === 'ghost-v' || t.state === 'ghost-h');
  }

  /**
   * Return the top-of-column tiles that lightning could hit (non-empty cols).
   * Used to render the "lightning-charge" visual preview.
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {import('../entities/tile.js').Tile[]}
   */
  lightningPotentialTargets(grid) {
    const targets = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      for (let r = 0; r < GRID_SIZE; r++) {
        const cell = grid.cells[r][c];
        if (cell) {
          targets.push(cell);
          break;
        }
      }
    }
    return targets;
  }

  // ─── Config helpers ──────────────────────────────

  /**
   * Remove a power type from the selected pool — used when ADS fires so that
   * no future power of that type will be assigned.
   * @param {string} type
   */
  removePowerType(type) {
    this.#selectedTypes = this.#selectedTypes.filter((t) => t !== type);
  }

  /**
   * Clear all edges (called e.g. when an enemy dies in Battle mode).
   */
  clearEdges() {
    for (const side of POWER_SIDES) this.#edges[side] = null;
  }

  // ─── Serialization ───────────────────────────────

  /** @returns {object} */
  serialize() {
    return {
      selectedTypes: this.#selectedTypes,
      edges: { ...this.#edges },
      targetedTileId: this.#targetedTileId,
      movesSincePlacement: this.#movesSincePlacement,
      windDirection: this.#windDirection,
      windTurns: this.#windTurns,
    };
  }

  /** @param {object} data */
  restore(data) {
    this.#selectedTypes = data.selectedTypes ?? [];
    this.#edges = { top: null, bottom: null, left: null, right: null, ...(data.edges ?? {}) };
    this.#targetedTileId = data.targetedTileId ?? null;
    this.#movesSincePlacement = data.movesSincePlacement ?? 0;
    this.#windDirection = data.windDirection ?? null;
    this.#windTurns = data.windTurns ?? 0;
  }

  // ─── Private: effects ────────────────────────────

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
    grid.cells[target.row][target.col] = null;
    destroyed.push(target);
    return { destroyed, stateApplied: null };
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

  #executeNuclear(grid) {
    const destroyed = grid.getAllTiles();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        grid.cells[r][c] = null;
      }
    }
    return { destroyed, stateApplied: null };
  }

  #executeLightning(grid) {
    const destroyed = [];
    const numStrikes = 1 + Math.floor(Math.random() * 3);
    const cols = [0, 1, 2, 3];
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    const chosenCols = cols.slice(0, numStrikes);

    const strikes = [];
    for (const col of chosenCols) {
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

  #executeWind(blockedDirection) {
    this.#windDirection = blockedDirection;
    this.#windTurns = POWER_DURATIONS.WIND;
    return { destroyed: [], stateApplied: `wind-${blockedDirection}` };
  }

  #executeBlind(grid, newTile = null) {
    const immuneTiles = [];
    for (const tile of grid.getAllTiles()) {
      if (tile.blindCooldown > 0 || tile.state === 'blind') {
        immuneTiles.push(tile);
        continue;
      }
      if (newTile && tile.id === newTile.id) continue;
      tile.applyState('blind', POWER_DURATIONS.BLIND);
    }
    return { destroyed: [], stateApplied: 'blind', immuneTiles };
  }

  // ─── Private helpers ─────────────────────────────

  #pickRandomFreeSide() {
    const free = POWER_SIDES.filter((s) => !this.#edges[s]);
    if (free.length === 0) return null;
    return free[Math.floor(Math.random() * free.length)];
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
}
