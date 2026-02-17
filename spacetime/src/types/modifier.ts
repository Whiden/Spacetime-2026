/**
 * modifier.ts — Modifier and ModifierCondition type definitions.
 *
 * Modifiers are the universal mechanism for adjusting per-entity game values.
 * They are stored ON the entity they affect (colony, ship, corporation).
 *
 * Empire-wide bonuses (from discoveries) are NOT modifiers — they live in EmpireBonuses
 * in empire.ts and are read directly by formulas without going through the modifier system.
 *
 * See Structure.md § Modifier System for full rules and resolution order.
 */

import type { ModifierId } from './common'

// ─── Modifier Condition ───────────────────────────────────────────────────────

/**
 * An optional condition that must be met for a modifier to apply.
 * Example: "+1 growth on colonies with habitability ≤ 4"
 */
export interface ModifierCondition {
  /** Which attribute to evaluate (e.g., 'habitability', 'populationLevel'). */
  attribute: string
  /** Comparison operator. */
  comparison: 'lte' | 'gte'
  /** Threshold value. */
  value: number
  /** Where to look up the attribute. */
  scope: 'colony' | 'empire'
}

// ─── Modifier ─────────────────────────────────────────────────────────────────

/**
 * A single adjustment to a named stat on an entity.
 *
 * Resolution order (see Structure.md):
 *   1. Sum all additive modifiers: adjusted = base + Σ(add values)
 *   2. Apply multiplicative modifiers sequentially: final = adjusted × m1 × m2 × ...
 *   3. Clamp to valid range if applicable
 *
 * Source types:
 * - 'feature'    — planet feature (permanent once colony is founded)
 * - 'colonyType' — colony type passive bonus (permanent)
 * - 'schematic'  — ship schematic applied at build time (permanent on ship)
 * - 'shortage'   — market-phase shortage malus (transient, cleared and reapplied each turn)
 * - 'event'      — temporary event effect (duration-based)
 */
export interface Modifier {
  id: ModifierId
  /** The stat key this modifier targets (e.g., 'habitability', 'speed', 'stability'). */
  target: string
  /** 'add' for flat bonus/malus; 'multiply' for percentage scaling (e.g., 1.1 = +10%). */
  operation: 'add' | 'multiply'
  /** The numeric value. For 'add': the delta. For 'multiply': the multiplier. */
  value: number
  /**
   * What created this modifier.
   * Determines persistence: features/colonyType/schematics are permanent;
   * shortage/event are transient and recalculated each turn.
   */
  sourceType: 'feature' | 'colonyType' | 'schematic' | 'shortage' | 'event'
  /** The specific entity that created this modifier (feature ID, schematic ID, etc.). */
  sourceId: string
  /** Display name for UI tooltip attribution (e.g., "Temperate Climate", "Hydra Missile"). */
  sourceName: string
  /** Optional condition; if present, modifier only applies when condition is met. */
  condition?: ModifierCondition
}

// ─── Modifier Breakdown Entry ─────────────────────────────────────────────────

/**
 * A single line in a modifier breakdown tooltip.
 * Returned by getModifierBreakdown() in engine/formulas/modifiers.ts.
 */
export interface ModifierBreakdownEntry {
  source: string
  operation: 'add' | 'multiply'
  value: number
}
