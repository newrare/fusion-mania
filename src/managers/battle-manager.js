import { BATTLE } from '../configs/constants.js';
import { Enemy } from '../entities/enemy.js';
import { Power } from '../entities/power.js';

/**
 * Manages Battle Mode logic: enemy spawning, contamination, damage, progression.
 * Pure game logic — no Phaser or DOM dependency.
 *
 * Supports two modes:
 * - **Level mode** (new): pass a `battleLevel` index (0–29) to the constructor.
 *   The enemy sequence is read from `BATTLE.BATTLE_LEVELS[battleLevel]`.
 * - **Legacy mode**: no argument → uses the global `BATTLE.LEVELS` list (all 11 enemies).
 */
export class BattleManager {
  /** @type {Enemy | null} Current active enemy */
  #enemy = null;

  /** @type {number} Moves since last enemy was defeated (classic-phase counter) */
  #classicMoves = 0;

  /** @type {Set<number>} Enemy levels already defeated */
  #defeatedLevels = new Set();

  /** @type {{ name: string, level: number }[]} Ordered list of defeated enemies */
  #defeatedEnemies = [];

  /** @type {number} Highest tile value ever seen on the grid */
  #maxTileSeen = 0;

  /** @type {number} Index into the enemy sequence for the next enemy to spawn */
  #nextLevelIndex = 0;

  /** @type {number[]} The ordered enemy level sequence for this run */
  #levelSequence;

  /** @type {number} Battle level index (0–29), or -1 for legacy mode */
  #battleLevel;

  /**
   * @param {number} [battleLevel] — Index into BATTLE.BATTLE_LEVELS (0–29).
   *   Omit for legacy behaviour (full BATTLE.LEVELS list).
   */
  constructor(battleLevel) {
    if (battleLevel != null && BATTLE.BATTLE_LEVELS[battleLevel]) {
      this.#battleLevel = battleLevel;
      this.#levelSequence = [...BATTLE.BATTLE_LEVELS[battleLevel]];
    } else {
      this.#battleLevel = -1;
      this.#levelSequence = [...BATTLE.LEVELS];
    }
  }

  /** @returns {Enemy | null} */
  get enemy() {
    return this.#enemy;
  }

  /** @returns {boolean} True when in classic phase (no enemy) */
  get isClassicPhase() {
    return this.#enemy === null;
  }

  /** @returns {boolean} True when an enemy is active */
  get isBattlePhase() {
    return this.#enemy !== null;
  }

  /** @returns {number} */
  get classicMoves() {
    return this.#classicMoves;
  }

  /** @returns {Set<number>} */
  get defeatedLevels() {
    return new Set(this.#defeatedLevels);
  }

  /**
   * Ordered list of defeated enemies: `{ name, level }`.
   * @returns {{ name: string, level: number }[]}
   */
  get defeatedEnemies() {
    return [...this.#defeatedEnemies];
  }

  /** @returns {number} */
  get enemiesDefeated() {
    return this.#defeatedEnemies.length;
  }

  /** @returns {number} Highest defeated enemy level, or 0 if none. */
  get maxEnemyLevel() {
    return this.#defeatedLevels.size > 0 ? Math.max(...this.#defeatedLevels) : 0;
  }

  /** @returns {number} Battle level index (0–29), or -1 for legacy */
  get battleLevel() {
    return this.#battleLevel;
  }

  /** @returns {number[]} The full enemy sequence for this run (read-only copy) */
  get levelSequence() {
    return [...this.#levelSequence];
  }

  /** @returns {number} Index of the next enemy to spawn (0-based within sequence) */
  get nextLevelIndex() {
    return this.#nextLevelIndex;
  }

  /**
   * Update the max tile value seen (call after every move).
   * @param {import('../entities/grid.js').Grid} grid
   */
  updateMaxTile(grid) {
    for (const tile of grid.getAllTiles()) {
      if (tile.value > this.#maxTileSeen) {
        this.#maxTileSeen = tile.value;
      }
    }
  }

  /**
   * Called after each player move during the classic phase.
   * Increments the classic move counter and checks if an enemy should spawn.
   *
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {Enemy | null} The newly spawned enemy, or null
   */
  tickClassicPhase(grid) {
    if (this.#enemy) return null;

    this.updateMaxTile(grid);
    this.#classicMoves++;

    if (this.#classicMoves < BATTLE.CLASSIC_MOVES) return null;

    // Find the next enemy level to spawn
    const nextLevel = this.#getNextLevel();
    if (nextLevel === null) return null;

    // Check if player has achieved the required tile value
    if (this.#maxTileSeen < nextLevel) return null;

    this.#enemy = new Enemy(nextLevel);
    // Mark the last enemy in the sequence as the boss
    if (this.#nextLevelIndex === this.#levelSequence.length - 1) {
      this.#enemy.boss = true;
    }
    this.#classicMoves = 0;
    return this.#enemy;
  }

  /**
   * Enemy casts a power from its stock. Direct powers (ice, expel) are applied
   * immediately to a random tile; other powers are charged on a random free
   * grid edge via the PowerManager. Called once per player move while an
   * enemy is active.
   *
   * @param {import('../entities/grid.js').Grid} grid
   * @param {import('./power-manager.js').PowerManager} powerManager
   * @returns {{ type: string, kind: 'direct', tile: import('../entities/tile.js').Tile } | { type: string, kind: 'edge', side: string } | null}
   */
  contaminate(grid, powerManager) {
    if (!this.#enemy || !powerManager) return null;

    const type = this.#enemy.pickRandomPower();
    if (!type) return null;

    if (Power.isDirect(type)) {
      const tile = powerManager.pickDirectTarget(type, grid);
      if (!tile) return null;
      this.#enemy.consumePower(type);
      return { type, kind: 'direct', tile };
    }

    const side = powerManager.chargeRandomFreeEdge(type);
    if (!side) return null;
    this.#enemy.consumePower(type);
    return { type, kind: 'edge', side };
  }

  /**
   * Apply damage to the current enemy from player merges.
   *
   * @param {{ tile: import('../entities/tile.js').Tile }[]} merges — Merge results from grid.move()
   * @returns {{ damage: number, killed: boolean }}
   */
  applyMergeDamage(merges) {
    if (!this.#enemy || merges.length === 0) return { damage: 0, killed: false };

    const mergedValues = merges.map((m) => m.tile.value);
    const damage = this.#enemy.takeDamage(mergedValues);
    const killed = this.#enemy.isDead;

    return { damage, killed };
  }

  /**
   * Handle enemy death: mark level as defeated, clear enemy reference.
   * Call this AFTER running the death animation.
   *
   * @returns {Enemy} The dead enemy (for animation/display)
   */
  defeatEnemy() {
    const dead = this.#enemy;
    if (dead) {
      this.#defeatedLevels.add(dead.level);
      this.#defeatedEnemies.push({ name: dead.name, level: dead.level });
      this.#nextLevelIndex++;
    }
    this.#enemy = null;
    this.#classicMoves = 0;
    return dead;
  }

  /**
   * Clear enemy-induced state from grid tiles and edges (called on enemy
   * defeat). Tile states (ice, ghost, blind, wind) are wiped, and the
   * PowerManager edges are cleared so the player starts fresh next battle.
   *
   * @param {import('../entities/grid.js').Grid} grid
   * @param {import('./power-manager.js').PowerManager} [powerManager]
   */
  clearGridPowers(grid, powerManager) {
    for (const tile of grid.getAllTiles()) {
      tile.clearState();
      tile.targeted = false;
    }
    if (powerManager) powerManager.clearEdges();
  }

  /**
   * @returns {number | null} Next enemy level to spawn, or null if all defeated
   */
  #getNextLevel() {
    while (this.#nextLevelIndex < this.#levelSequence.length) {
      const level = this.#levelSequence[this.#nextLevelIndex];
      if (!this.#defeatedLevels.has(level)) return level;
      this.#nextLevelIndex++;
    }
    return null;
  }

  /**
   * Check if all enemies have been defeated (player wins).
   * @returns {boolean}
   */
  allDefeated() {
    return this.#nextLevelIndex >= this.#levelSequence.length;
  }

  /** @returns {object} */
  serialize() {
    return {
      enemy: this.#enemy?.serialize() ?? null,
      classicMoves: this.#classicMoves,
      defeatedLevels: [...this.#defeatedLevels],
      defeatedEnemies: [...this.#defeatedEnemies],
      maxTileSeen: this.#maxTileSeen,
      nextLevelIndex: this.#nextLevelIndex,
      battleLevel: this.#battleLevel,
    };
  }

  /** @param {object} data */
  restore(data) {
    this.#enemy = data.enemy ? Enemy.restore(data.enemy) : null;
    this.#classicMoves = data.classicMoves ?? 0;
    this.#defeatedLevels = new Set(data.defeatedLevels ?? []);
    this.#defeatedEnemies = data.defeatedEnemies ?? [];
    this.#maxTileSeen = data.maxTileSeen ?? 0;
    this.#nextLevelIndex = data.nextLevelIndex ?? 0;
    // Restore level sequence from saved battleLevel
    if (data.battleLevel != null && data.battleLevel >= 0 && BATTLE.BATTLE_LEVELS[data.battleLevel]) {
      this.#battleLevel = data.battleLevel;
      this.#levelSequence = [...BATTLE.BATTLE_LEVELS[data.battleLevel]];
    }
  }
}
