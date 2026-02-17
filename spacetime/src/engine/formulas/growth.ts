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
 * TODO (Story 10.2): Colony growth formulas added here.
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
