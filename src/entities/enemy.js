import { BATTLE } from '../configs/constants.js';
import { GridLife } from './grid-life.js';

/**
 * 100 funny math-related enemy names (single word each).
 */
export const ENEMY_NAMES = [
  'Pythax',
  'Numerix',
  'Divisor',
  'Algebrox',
  'Tangix',
  'Fibonax',
  'Sinusor',
  'Cosinox',
  'Derivox',
  'Integrix',
  'Factorus',
  'Primatus',
  'Logarix',
  'Exponix',
  'Vectorix',
  'Matrixor',
  'Fractalus',
  'Polynox',
  'Asymptox',
  'Hypotex',
  'Calculix',
  'Equatix',
  'Theorix',
  'Axiomix',
  'Geometx',
  'Parallox',
  'Trapezix',
  'Octarix',
  'Dodecax',
  'Permutix',
  'Combinax',
  'Problix',
  'Medianor',
  'Deviatox',
  'Correlax',
  'Infinix',
  'Epsilox',
  'Sigmazor',
  'Pirator',
  'Gaussix',
  'Cantorus',
  'Fermatix',
  'Symetrix',
  'Radianix',
  'Quotix',
  'Modulix',
  'Tangenox',
  'Hyperbox',
  'Cosecax',
  'Arcsinix',
  'Lemmax',
  'Corollix',
  'Postulax',
  'Morphix',
  'Isometx',
  'Affinix',
  'Scalarix',
  'Tensorix',
  'Compleux',
  'Imaginax',
  'Rationix',
  'Irratix',
  'Summator',
  'Divergix',
  'Limitus',
  'Continux',
  'Differix',
  'Laplacix',
  'Fouriex',
  'Newtonix',
  'Tesserix',
];

/**
 * Pure data class representing a battle enemy.
 * No Phaser or DOM dependency.
 */
export class Enemy {
  /** @type {string} Enemy name (randomly chosen) */
  name;

  /** @type {number} Enemy level (matches tile values: 2, 4, 8, … 2048) */
  level;

  /** @type {GridLife} Enemy HP system */
  life;

  /**
   * Remaining cast count per power type. Decremented each time the enemy
   * casts the power; removed entirely once it reaches 0.
   * @type {Record<string, number>}
   */
  powerStock;

  /** @type {number} Total power charges at spawn time (used for HP-pacing gate). */
  totalInitialCharges;

  /** @type {number} Charges consumed since spawn (used for HP-pacing gate). */
  usedCharges = 0;

  /** @type {string} Enemy profile key (from BATTLE.ENEMY_PROFILES) */
  profile;

  /** @type {boolean} Whether this enemy is the boss of its level sequence */
  boss = false;

  /**
   * @param {number} level — Enemy level (2, 4, 8, …, 2048); determines HP
   * @param {string} profile — Profile key from BATTLE.ENEMY_PROFILES; determines power stock
   * @param {string} [name] — Override name (random if omitted)
   */
  constructor(level, profile, name) {
    this.level = level;
    this.profile = profile ?? 'overlord';
    this.name = name ?? ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
    this.powerStock = { ...(BATTLE.ENEMY_PROFILES[this.profile] ?? {}) };
    this.totalInitialCharges = Object.values(this.powerStock).reduce((a, b) => a + b, 0);

    const maxHp = Math.ceil(Math.log2(level)) * BATTLE.HP_PER_LEVEL;
    this.life = new GridLife(maxHp);
  }

  /** @returns {string[]} Power types with at least one charge remaining. */
  get availablePowers() {
    return Object.keys(this.powerStock).filter((t) => this.powerStock[t] > 0);
  }

  /** @returns {boolean} True if the enemy has at least one power left. */
  hasAnyStock() {
    return this.availablePowers.length > 0;
  }

  /** @returns {boolean} */
  get isDead() {
    return this.life.isDead;
  }

  /** @returns {boolean} Is this a boss? */
  get isBoss() {
    return this.boss || this.level === 2048;
  }

  /**
   * Apply damage from player merges.
   * @param {number[]} mergedValues — Values of the tiles produced by merges
   * @returns {number} Damage dealt
   */
  takeDamage(mergedValues) {
    return this.life.takeDamage(mergedValues);
  }

  /**
   * Pick a random power from the enemy's remaining stock.
   * @returns {string | null}
   */
  pickRandomPower() {
    const available = this.availablePowers;
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  /**
   * Decrement a power charge after casting. The key is removed once it hits 0.
   * @param {string} type
   * @returns {boolean} True if consumed, false if no charge was available.
   */
  consumePower(type) {
    const count = this.powerStock[type] ?? 0;
    if (count <= 0) return false;
    this.powerStock[type] = count - 1;
    if (this.powerStock[type] <= 0) delete this.powerStock[type];
    this.usedCharges++;
    return true;
  }

  /** @returns {object} */
  serialize() {
    return {
      name: this.name,
      level: this.level,
      profile: this.profile,
      life: this.life.serialize(),
      powerStock: { ...this.powerStock },
      boss: this.boss,
      totalInitialCharges: this.totalInitialCharges,
      usedCharges: this.usedCharges,
    };
  }

  /**
   * Restore enemy from serialized data.
   * @param {object} data
   * @returns {Enemy}
   */
  static restore(data) {
    const enemy = new Enemy(data.level, data.profile ?? 'overlord', data.name);
    enemy.life.restore(data.life);
    if (data.powerStock) enemy.powerStock = { ...data.powerStock };
    enemy.boss = data.boss ?? false;
    enemy.totalInitialCharges =
      data.totalInitialCharges ??
      Object.values(BATTLE.ENEMY_PROFILES[data.profile] ?? {}).reduce((a, b) => a + b, 0);
    enemy.usedCharges = data.usedCharges ?? 0;
    return enemy;
  }
}
