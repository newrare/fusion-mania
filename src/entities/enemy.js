import { BATTLE } from '../configs/constants.js';
import { GridLife } from './grid-life.js';

/**
 * 100 funny math-related enemy names (single word each).
 */
export const ENEMY_NAMES = [
  'Pythagorus', 'Numerator', 'Divisorus', 'Algebrox', 'Tangentus',
  'Fibonaccius', 'Sinusoïd', 'Cosinator', 'Derivator', 'Integralus',
  'Factorus', 'Primatus', 'Logarix', 'Exponentus', 'Vectorix',
  'Matrixor', 'Fractalus', 'Polynomius', 'Asymptotus', 'Hypotenox',
  'Calculix', 'Equationus', 'Theoremix', 'Axiomatus', 'Geometrix',
  'Parallelox', 'Trapezix', 'Octahedrus', 'Dodecagor', 'Rhomboid',
  'Permutix', 'Combinax', 'Probabilix', 'Statistix', 'Medianor',
  'Deviatorus', 'Correlax', 'Regressionus', 'Infinitus', 'Epsilonus',
  'Deltaflux', 'Sigmazor', 'Pirator', 'Eulerian', 'Gaussimus',
  'Riemannus', 'Hilbertus', 'Cantorus', 'Fermatix', 'Symmetrix',
  'Barycentrus', 'Radianus', 'Diametrix', 'Circumfex', 'Quotientus',
  'Remaindix', 'Modulix', 'Congruex', 'Bisectrix', 'Tangentoid',
  'Parabolix', 'Hyperbolus', 'Ellipsoid', 'Secantus', 'Cosecantix',
  'Cotagentus', 'Arcsinus', 'Lemmax', 'Corollarix', 'Postulax',
  'Topologix', 'Morphismus', 'Isometrix', 'Affinitus', 'Scalarius',
  'Tensorix', 'Eigenvalux', 'Determinix', 'Complexus', 'Imaginarix',
  'Rationnix', 'Irrationix', 'Transcendix', 'Absolutix', 'Summator',
  'Productus', 'Seriesix', 'Convergix', 'Divergix', 'Limitus',
  'Continux', 'Differix', 'Laplacian', 'Fouriex', 'Newtonian',
  'Leibnizor', 'Bourbakix', 'Mandelbrix', 'Tesseractus', 'Quaternix',
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
