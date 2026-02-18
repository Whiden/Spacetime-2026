/**
 * growth.ts — Growth and capital formulas for corporations and colonies.
 *
 * Pure functions with no Vue/Pinia imports.
 * All values are integers (floor-based rounding).
 *
 * Corporation capital formulas from Specs.md § 3:
 * - Capital gain: random(0,1) + floor(totalOwnedInfra / 10)
 * - Completion bonus: floor((bpPerTurn × duration) / 5)
 * - Level up cost: currentLevel × 3
 * - Acquisition cost: targetLevel × 5
 * - Max infrastructure: corpLevel × 4
 *
 * Colony growth formulas from Specs.md § 5 (added Story 10.2):
 * - shouldPopLevelUp: checks growth >= 10 AND civilian infra requirement AND not at cap
 * - shouldPopLevelDown: checks growth <= -1 AND popLevel > 1
 * - calculateOrganicInfraChance: dynamism × 5 (%)
 */

import { randomInt } from '../../utils/random'
import type { CorpInfrastructureHoldings } from '../../types/corporation'

// ─── Corporation Capital Formulas ────────────────────────────────────────────

/**
 * Calculates the total owned infrastructure levels for a corporation
 * across all colonies.
 *
 * @param infrastructureByColony - Map of colony ID to infrastructure holdings
 * @returns Total infrastructure levels owned
 */
export function getTotalOwnedInfra(
  infrastructureByColony: Map<string, CorpInfrastructureHoldings>,
): number {
  let total = 0
  for (const holdings of infrastructureByColony.values()) {
    for (const levels of Object.values(holdings)) {
      total += levels
    }
  }
  return total
}

/**
 * Calculates passive capital gain for a corporation per turn.
 *
 * Formula: random(0,1) + floor(totalOwnedInfra / 10)
 *
 * @param totalOwnedInfra - Total infrastructure levels the corp owns across all colonies
 * @returns Capital gained this turn (integer, >= 0)
 */
export function calculateCapitalGain(totalOwnedInfra: number): number {
  return randomInt(0, 1) + Math.floor(totalOwnedInfra / 10)
}

/**
 * Calculates the capital bonus a corporation receives when completing a contract.
 *
 * Formula: floor((bpPerTurn × duration) / 5)
 *
 * @param contractBPPerTurn - The BP/turn cost of the completed contract
 * @param duration - The total duration of the contract in turns
 * @returns Capital bonus (integer, >= 0)
 */
export function calculateCompletionBonus(
  contractBPPerTurn: number,
  duration: number,
): number {
  return Math.floor((contractBPPerTurn * duration) / 5)
}

/**
 * Calculates the capital cost to level up a corporation.
 *
 * Formula: currentLevel × 3
 *
 * @param currentLevel - The corporation's current level (1-10)
 * @returns Capital cost to reach the next level (integer)
 */
export function calculateLevelUpCost(currentLevel: number): number {
  return currentLevel * 3
}

/**
 * Calculates the capital cost to acquire another corporation.
 *
 * Formula: targetLevel × 5
 *
 * @param targetLevel - The target corporation's current level
 * @returns Capital cost for the acquisition (integer)
 */
export function calculateAcquisitionCost(targetLevel: number): number {
  return targetLevel * 5
}

/**
 * Calculates the maximum infrastructure levels a corporation can own.
 *
 * Formula: corpLevel × 4
 *
 * @param corpLevel - The corporation's current level (1-10)
 * @returns Maximum total infrastructure levels (integer)
 */
export function calculateMaxInfra(corpLevel: number): number {
  return corpLevel * 4
}

// ─── Colony Population Growth Formulas ───────────────────────────────────────

/**
 * Checks whether a colony's population should level up this turn.
 *
 * Level-up conditions (all must be true, Specs.md § 5):
 *   1. growth >= 10 (accumulator has reached the threshold)
 *   2. populationLevel < maxPopLevel (planet size cap not reached)
 *   3. civilianInfra >= (popLevel + 1) × 2 (enough civilian infra for the next level)
 *
 * If growth >= 10 but civilian infra is insufficient, the growth accumulator stays
 * where it is — no clamping. Level-up happens as soon as infra catches up.
 *
 * @param growth - Current growth accumulator value (not clamped, can exceed 10).
 * @param popLevel - Current population level (1-10).
 * @param maxPopLevel - Maximum population level allowed by the planet size.
 * @param civilianInfra - Total civilian infrastructure levels on the colony.
 * @returns true if all conditions for a level-up are met.
 */
export function shouldPopLevelUp(
  growth: number,
  popLevel: number,
  maxPopLevel: number,
  civilianInfra: number,
): boolean {
  if (growth < 10) return false
  if (popLevel >= maxPopLevel) return false
  const nextPop = popLevel + 1
  return civilianInfra >= nextPop * 2
}

/**
 * Checks whether a colony's population should level down this turn.
 *
 * Level-down conditions (Specs.md § 5):
 *   - growth <= -1 (accumulator has gone negative)
 *   - populationLevel > 1 (population cannot fall below level 1)
 *
 * @param growth - Current growth accumulator value.
 * @param popLevel - Current population level (1-10).
 * @returns true if the level-down condition is met.
 */
export function shouldPopLevelDown(growth: number, popLevel: number): boolean {
  return growth <= -1 && popLevel > 1
}

/**
 * Calculates the percentage chance (0-100) that organic infrastructure growth
 * triggers this turn for a colony.
 *
 * Formula (Specs.md § 6):
 *   organic_growth_chance = dynamism × 5 (%)
 *
 * Examples: dynamism 0 → 0% (never), dynamism 5 → 25%, dynamism 10 → 50% (maximum).
 * Colonies need at least 1 infrastructure level for organic growth to apply;
 * the caller enforces that prerequisite.
 *
 * @param dynamism - Current colony dynamism (0-10).
 * @returns Chance as an integer percentage (0-50).
 */
export function calculateOrganicInfraChance(dynamism: number): number {
  return dynamism * 5
}
