import { BATTLE } from '../configs/constants.js';
import { Enemy } from '../entities/enemy.js';

/**
 * Manages Battle Mode logic: enemy spawning, contamination, damage, progression.
 * Pure game logic — no Phaser or DOM dependency.
 */
export class BattleManager {
  /** @type {Enemy | null} Current active enemy */
  #enemy = null;

  /** @type {number} Moves since last enemy was defeated (classic-phase counter) */
  #classicMoves = 0;

  /** @type {Set<number>} Enemy levels already defeated */
  #defeatedLevels = new Set();

  /** @type {number} Highest tile value ever seen on the grid */
  #maxTileSeen = 0;

  /** @type {number} Index into BATTLE.LEVELS for the next enemy to spawn */
  #nextLevelIndex = 0;

  constructor() {}

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

  /** @returns {number} */
  get enemiesDefeated() {
    return this.#defeatedLevels.size;
  }

  /** @returns {number} Highest defeated enemy level, or 0 if none. */
  get maxEnemyLevel() {
    return this.#defeatedLevels.size > 0 ? Math.max(...this.#defeatedLevels) : 0;
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
    this.#classicMoves = 0;
    return this.#enemy;
  }

  /**
   * Enemy contaminates a random unpowered tile on the grid.
   * Called once per player move while an enemy is active.
   *
   * @param {import('../entities/grid.js').Grid} grid
   * @returns {{ tile: import('../entities/tile.js').Tile, power: string } | null}
   */
  contaminate(grid) {
    if (!this.#enemy) return null;

    const power = this.#enemy.pickRandomPower();
    if (!power) return null;

    const candidates = grid.getAllTiles().filter((t) => !t.power && !t.state);
    if (candidates.length === 0) return null;

    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    tile.power = power;
    return { tile, power };
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
      this.#nextLevelIndex++;
    }
    this.#enemy = null;
    this.#classicMoves = 0;
    return dead;
  }

  /**
   * Clear all powers from grid tiles (called when enemy is defeated).
   * @param {import('../entities/grid.js').Grid} grid
   */
  clearGridPowers(grid) {
    for (const tile of grid.getAllTiles()) {
      tile.power = null;
      tile.clearState();
    }
  }

  /**
   * @returns {number | null} Next enemy level to spawn, or null if all defeated
   */
  #getNextLevel() {
    while (this.#nextLevelIndex < BATTLE.LEVELS.length) {
      const level = BATTLE.LEVELS[this.#nextLevelIndex];
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
    return this.#nextLevelIndex >= BATTLE.LEVELS.length;
  }

  /** @returns {object} */
  serialize() {
    return {
      enemy: this.#enemy?.serialize() ?? null,
      classicMoves: this.#classicMoves,
      defeatedLevels: [...this.#defeatedLevels],
      maxTileSeen: this.#maxTileSeen,
      nextLevelIndex: this.#nextLevelIndex,
    };
  }

  /** @param {object} data */
  restore(data) {
    this.#enemy = data.enemy ? Enemy.restore(data.enemy) : null;
    this.#classicMoves = data.classicMoves ?? 0;
    this.#defeatedLevels = new Set(data.defeatedLevels ?? []);
    this.#maxTileSeen = data.maxTileSeen ?? 0;
    this.#nextLevelIndex = data.nextLevelIndex ?? 0;
  }
}
