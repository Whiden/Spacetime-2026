/**
 * random.ts — Seeded random number generation and probability utilities.
 *
 * All functions accept an optional seed for deterministic output in tests.
 * When no seed is provided, Math.random() is used.
 *
 * No Vue or Pinia imports. Pure TypeScript.
 */

// ─── Seeded Random ────────────────────────────────────────────────────────────

/**
 * A simple mulberry32 seeded PRNG.
 * Returns a new random float in [0, 1) each call.
 * Used internally to support seeded variants of all random functions.
 *
 * @param seed - Integer seed value
 * @returns A function that returns a new random float on each call
 */
export function createSeededRandom(seed: number): () => number {
  let s = seed
  return function () {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── randomInt ────────────────────────────────────────────────────────────────

/**
 * Returns a random integer in the range [min, max] (inclusive).
 *
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param seed - Optional seed for deterministic output
 *
 * @example
 * randomInt(1, 6)      // Roll a d6
 * randomInt(5, 15, 42) // Seeded: always returns the same result for seed 42
 */
export function randomInt(min: number, max: number, seed?: number): number {
  const rand = seed !== undefined ? createSeededRandom(seed)() : Math.random()
  return Math.floor(rand * (max - min + 1)) + min
}

// ─── randomFloat ──────────────────────────────────────────────────────────────

/**
 * Returns a random float in the range [min, max).
 *
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 * @param seed - Optional seed for deterministic output
 */
export function randomFloat(min: number, max: number, seed?: number): number {
  const rand = seed !== undefined ? createSeededRandom(seed)() : Math.random()
  return rand * (max - min) + min
}

// ─── chance ───────────────────────────────────────────────────────────────────

/**
 * Returns true with the given probability percentage.
 *
 * @param percent - Probability as a percentage (0-100)
 * @param seed - Optional seed for deterministic output
 *
 * @example
 * chance(30)     // True ~30% of the time
 * chance(100)    // Always true
 * chance(0)      // Always false
 */
export function chance(percent: number, seed?: number): boolean {
  const rand = seed !== undefined ? createSeededRandom(seed)() : Math.random()
  return rand * 100 < percent
}

// ─── weightedRandom ───────────────────────────────────────────────────────────

/**
 * Selects a value from a weighted list.
 * Weights do NOT need to sum to 100 — they are relative probabilities.
 *
 * @param options - Array of { value, weight } pairs
 * @param seed - Optional seed for deterministic output
 * @returns The selected value
 *
 * @example
 * weightedRandom([
 *   { value: 0, weight: 40 },
 *   { value: 1, weight: 40 },
 *   { value: 2, weight: 20 },
 * ])
 * // Returns 0 ~40% of the time, 1 ~40%, 2 ~20%
 */
export function weightedRandom<T>(
  options: { value: T; weight: number }[],
  seed?: number,
): T {
  if (options.length === 0) {
    throw new Error('weightedRandom: options array must not be empty')
  }

  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0)
  const rand = seed !== undefined ? createSeededRandom(seed)() : Math.random()
  let threshold = rand * totalWeight

  for (const option of options) {
    threshold -= option.weight
    if (threshold <= 0) {
      return option.value
    }
  }

  // Fallback: return last element (handles floating-point edge cases)
  return options[options.length - 1]!.value
}
