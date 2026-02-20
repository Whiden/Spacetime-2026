/**
 * combat.ts — Combat formula functions.
 *
 * Story 16.2 — Combat Resolver.
 *
 * Pure functions for combat math. No side effects.
 *
 * TODO (Story 16.3 post-prototype): Full phase-by-phase combat (initiative,
 *   targeting, exchange rounds, retreat, aftermath) per Specs.md § 11.
 */

import { CaptainExperience } from '../../types/common'

// ─── Captain Combat Modifiers ─────────────────────────────────────────────────

/** Multiplier applied to Fight score based on commander's experience level. */
export const CAPTAIN_COMBAT_MODIFIER: Record<CaptainExperience, number> = {
  [CaptainExperience.Green]:   0.8,
  [CaptainExperience.Regular]: 1.0,
  [CaptainExperience.Veteran]: 1.1,
  [CaptainExperience.Elite]:   1.2,
}

// ─── Condition Loss Ranges ────────────────────────────────────────────────────

/** Condition loss per ship for the winning side: 5–20%. */
export const WIN_CONDITION_LOSS_MIN = 0.05
export const WIN_CONDITION_LOSS_MAX = 0.20

/** Condition loss per ship for the losing side: 30–60%. */
export const LOSE_CONDITION_LOSS_MIN = 0.30
export const LOSE_CONDITION_LOSS_MAX = 0.60

/** Roll variance applied to effective Fight score. */
export const COMBAT_ROLL_MIN = 0.85
export const COMBAT_ROLL_MAX = 1.15

// ─── Formulas ─────────────────────────────────────────────────────────────────

/**
 * Applies the captain experience combat modifier to a raw Fight score.
 * Returns integer-floored result.
 */
export function applyCommanderModifier(
  fightScore: number,
  experience: CaptainExperience,
): number {
  return Math.floor(fightScore * CAPTAIN_COMBAT_MODIFIER[experience])
}

/**
 * Determines combat outcome.
 * @returns true if the task force wins.
 */
export function resolveCombatRoll(
  effectiveFight: number,
  difficulty: number,
  roll: number, // uniform [0, 1)
): boolean {
  const variance = COMBAT_ROLL_MIN + roll * (COMBAT_ROLL_MAX - COMBAT_ROLL_MIN)
  return effectiveFight * variance > difficulty
}

/**
 * Samples a condition delta (as a fraction) for the winning side.
 * @returns value in [WIN_CONDITION_LOSS_MIN, WIN_CONDITION_LOSS_MAX]
 */
export function sampleWinConditionLoss(roll: number): number {
  return WIN_CONDITION_LOSS_MIN + roll * (WIN_CONDITION_LOSS_MAX - WIN_CONDITION_LOSS_MIN)
}

/**
 * Samples a condition delta (as a fraction) for the losing side.
 * @returns value in [LOSE_CONDITION_LOSS_MIN, LOSE_CONDITION_LOSS_MAX]
 */
export function sampleLoseConditionLoss(roll: number): number {
  return LOSE_CONDITION_LOSS_MIN + roll * (LOSE_CONDITION_LOSS_MAX - LOSE_CONDITION_LOSS_MIN)
}

/**
 * Applies condition damage to a ship's current condition.
 * Returns new condition clamped to [0, 100]. Integer-rounded.
 */
export function applyConditionDamage(currentCondition: number, lossFraction: number): number {
  return Math.max(0, Math.round(currentCondition - currentCondition * lossFraction))
}
