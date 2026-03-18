/**
 * Clamp a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate a random integer between min (inclusive) and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm.
 * @template T
 * @param {T[]} array
 * @returns {T[]}
 */
export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Pick a value from a weighted list.
 * @param {any[]} values
 * @param {number[]} weights - Must sum to ~1.0
 * @returns {any}
 */
export function weightedPick(values, weights) {
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < values.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return values[i];
  }
  return values[values.length - 1];
}
