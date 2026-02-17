/**
 * modifiers.ts — Modifier resolution functions.
 *
 * Provides the core modifier system used by colony attribute formulas and ship
 * stat generation. Modifiers are local per-entity adjustments (planet features,
 * schematics, shortage maluses). Empire-wide bonuses bypass this system entirely.
 *
 * Resolution order (from Structure.md):
 *   1. Filter modifiers by target string
 *   2. Filter out modifiers whose conditions are not met
 *   3. Sum all additive modifiers: adjusted = base + Σ(add values)
 *   4. Apply multiplicative modifiers sequentially: final = adjusted × m1 × m2 × ...
 *   5. Clamp to valid range if min/max provided
 *
 * No Vue or Pinia imports. Pure TypeScript.
 */

import type { Modifier, ModifierBreakdownEntry } from '../../types/modifier'

// ─── Condition Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluates whether a modifier's condition is currently met.
 * The conditionContext provides attribute values for the relevant scope.
 *
 * @param condition - The condition to evaluate
 * @param conditionContext - Key-value map of attribute names to current values
 * @returns true if the condition is met (or if no condition exists)
 */
function isConditionMet(
  modifier: Modifier,
  conditionContext: Record<string, number>,
): boolean {
  const condition = modifier.condition
  if (!condition) return true

  const contextValue = conditionContext[condition.attribute]
  if (contextValue === undefined) return false

  if (condition.comparison === 'lte') return contextValue <= condition.value
  if (condition.comparison === 'gte') return contextValue >= condition.value

  return false
}

// ─── resolveModifiers ─────────────────────────────────────────────────────────

/**
 * Resolves all modifiers targeting a specific stat, applies them to a base value,
 * and returns the final adjusted value.
 *
 * @param baseValue - The starting value before modifiers
 * @param target - The stat key to filter modifiers by (e.g., 'habitability', 'speed')
 * @param modifiers - All modifiers on the entity
 * @param clampMin - Optional minimum clamp (applied after all modifiers)
 * @param clampMax - Optional maximum clamp (applied after all modifiers)
 * @param conditionContext - Optional attribute values for evaluating modifier conditions
 * @returns The final value after applying all applicable modifiers and clamping
 *
 * @example
 * // Base habitability 8, Temperate Climate +1, Harsh Radiation -2
 * resolveModifiers(8, 'habitability', colony.modifiers, 0, 10)
 * // → (8 + 1 - 2) = 7
 */
export function resolveModifiers(
  baseValue: number,
  target: string,
  modifiers: Modifier[],
  clampMin?: number,
  clampMax?: number,
  conditionContext: Record<string, number> = {},
): number {
  const applicable = modifiers.filter(
    (m) => m.target === target && isConditionMet(m, conditionContext),
  )

  // Step 1: Apply all additive modifiers
  const additiveSum = applicable
    .filter((m) => m.operation === 'add')
    .reduce((sum, m) => sum + m.value, 0)

  let adjusted = baseValue + additiveSum

  // Step 2: Apply multiplicative modifiers sequentially
  const multiplicative = applicable.filter((m) => m.operation === 'multiply')
  for (const mod of multiplicative) {
    adjusted = adjusted * mod.value
  }

  // Step 3: Clamp to valid range
  if (clampMin !== undefined) adjusted = Math.max(clampMin, adjusted)
  if (clampMax !== undefined) adjusted = Math.min(clampMax, adjusted)

  return adjusted
}

// ─── getModifierBreakdown ─────────────────────────────────────────────────────

/**
 * Returns a breakdown of all applicable modifiers for a given stat,
 * formatted for UI tooltip display.
 *
 * @param target - The stat key to filter modifiers by
 * @param modifiers - All modifiers on the entity
 * @param conditionContext - Optional attribute values for evaluating modifier conditions
 * @returns Array of breakdown entries, one per applicable modifier
 *
 * @example
 * // Returns:
 * // [
 * //   { source: 'Temperate Climate', operation: 'add', value: 1 },
 * //   { source: 'Harsh Radiation', operation: 'add', value: -2 },
 * // ]
 */
export function getModifierBreakdown(
  target: string,
  modifiers: Modifier[],
  conditionContext: Record<string, number> = {},
): ModifierBreakdownEntry[] {
  return modifiers
    .filter((m) => m.target === target && isConditionMet(m, conditionContext))
    .map((m) => ({
      source: m.sourceName,
      operation: m.operation,
      value: m.value,
    }))
}

// ─── filterByTarget ───────────────────────────────────────────────────────────

/**
 * Returns only the modifiers that target a specific stat.
 * Useful when you need to inspect modifiers without applying them.
 *
 * @param target - The stat key to filter by
 * @param modifiers - All modifiers on the entity
 * @returns Filtered array of modifiers
 */
export function filterByTarget(target: string, modifiers: Modifier[]): Modifier[] {
  return modifiers.filter((m) => m.target === target)
}
