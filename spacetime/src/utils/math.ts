/**
 * math.ts — Mathematical helper utilities.
 *
 * Pure math functions used throughout the game engine.
 * No Vue or Pinia imports.
 */

// ─── clamp ────────────────────────────────────────────────────────────────────

/**
 * Clamps a value within the range [min, max].
 *
 * @param value - The value to clamp
 * @param min - Lower bound (inclusive)
 * @param max - Upper bound (inclusive)
 * @returns value if within range, min if too low, max if too high
 *
 * @example
 * clamp(5, 0, 10)  // → 5
 * clamp(-3, 0, 10) // → 0
 * clamp(15, 0, 10) // → 10
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ─── roundDown ────────────────────────────────────────────────────────────────

/**
 * Rounds a number down to the nearest integer (floor).
 * Alias for Math.floor with a more descriptive name in game context.
 *
 * @param value - The value to round down
 *
 * @example
 * roundDown(7.9)  // → 7
 * roundDown(3.0)  // → 3
 * roundDown(-1.2) // → -2
 */
export function roundDown(value: number): number {
  return Math.floor(value)
}

// ─── scale ────────────────────────────────────────────────────────────────────

/**
 * Scales a value from one range to another via linear interpolation.
 *
 * @param value - The input value within [fromMin, fromMax]
 * @param fromMin - Lower bound of the input range
 * @param fromMax - Upper bound of the input range
 * @param toMin - Lower bound of the output range
 * @param toMax - Upper bound of the output range
 * @returns The value mapped to the output range
 *
 * @example
 * scale(5, 0, 10, 0, 100)  // → 50
 * scale(0, 0, 10, 0, 100)  // → 0
 * scale(10, 0, 10, 0, 100) // → 100
 */
export function scale(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  if (fromMax === fromMin) return toMin
  const ratio = (value - fromMin) / (fromMax - fromMin)
  return toMin + ratio * (toMax - toMin)
}
