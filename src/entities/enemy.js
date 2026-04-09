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
  'Fractalx',
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
  'Rhomboid',
  'Permutix',
  'Combinax',
  'Problix',
  'Statistx',
  'Medianor',
  'Deviatox',
  'Correlax',
  'Regressx',
  'Infinix',
  'Epsilox',
  'Deltaflx',
  'Sigmazor',
  'Pirator',
  'Eulerox',
  'Gaussix',
  'Riemanx',
  'Hilbertx',
  'Cantorus',
  'Fermatix',
  'Symetrix',
  'Barycenx',
  'Radianix',
  'Diametx',
  'Circufex',
  'Quotix',
  'Remaindx',
  'Modulix',
  'Congruex',
  'Bisectx',
  'Tangenox',
  'Parabolx',
  'Hyperbox',
  'Ellipsox',
  'Secantx',
  'Cosecax',
  'Cotagenx',
  'Arcsinix',
  'Lemmax',
  'Corollix',
  'Postulax',
  'Topologx',
  'Morphix',
  'Isometx',
  'Affinix',
  'Scalarix',
  'Tensorix',
  'Eigenvax',
  'Determnx',
  'Compleux',
  'Imaginax',
  'Rationix',
  'Irratix',
  'Transcex',
  'Absolutx',
  'Summator',
  'Productx',
  'Seriesix',
  'Convergx',
  'Divergix',
  'Limitus',
  'Continux',
  'Differix',
  'Laplacix',
  'Fouriex',
  'Newtonix',
  'Leibnizx',
  'Bourbakx',
  'Mandelx',
  'Tesserix',
  'Quaternx',
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

  /** @type {string[]} Powers available to this enemy for contamination */
  availablePowers;

  /**
   * @param {number} level — Enemy level (2, 4, 8, …, 2048)
   * @param {string} [name] — Override name (random if omitted)
   */
  constructor(level, name) {
    this.level = level;
    this.name = name ?? ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
    this.availablePowers = BATTLE.LEVEL_POWERS[level] ?? [];

    const maxHp = Math.ceil(Math.log2(level)) * BATTLE.HP_PER_LEVEL;
    this.life = new GridLife(maxHp);
  }

  /** @returns {boolean} */
  get isDead() {
    return this.life.isDead;
  }

  /** @returns {boolean} Is this a boss (level 2048)? */
  get isBoss() {
    return this.level === 2048;
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
   * Pick a random power from the enemy's repertoire.
   * @returns {string | null}
   */
  pickRandomPower() {
    if (this.availablePowers.length === 0) return null;
    return this.availablePowers[Math.floor(Math.random() * this.availablePowers.length)];
  }

  /** @returns {object} */
  serialize() {
    return {
      name: this.name,
      level: this.level,
      life: this.life.serialize(),
    };
  }

  /**
   * Restore enemy from serialized data.
   * @param {object} data
   * @returns {Enemy}
   */
  static restore(data) {
    const enemy = new Enemy(data.level, data.name);
    enemy.life.restore(data.life);
    return enemy;
  }
}
