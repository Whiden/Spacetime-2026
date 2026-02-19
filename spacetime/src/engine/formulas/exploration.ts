/**
 * exploration.ts — Exploration gain and planet discovery formulas.
 *
 * Pure functions with no Vue/Pinia imports.
 *
 * Formulas from Specs.md § 12:
 * - exploration_gain = random(5, 15)%
 * - poi_count = 2 + weighted_random(0: 40%, 1: 40%, 2: 20%)
 * - generateOrbitScan: reveals partial planet data by corp level tier
 *
 * Orbit scan quality tiers:
 *   Tier 1 (level 1-2):  planet type and size only
 *   Tier 2 (level 3-6):  + deposit types (not richness), orbit-visible features
 *   Tier 3 (level 7-10): + exact habitability
 */

import { randomInt, weightedRandom } from '../../utils/random'
import type { Planet } from '../../types/planet'
import { PlanetType, PlanetSize, DepositType } from '../../types/common'

// ─── OrbitScanResult ──────────────────────────────────────────────────────────

/**
 * Partial planet data revealed by an orbit scan.
 * What is revealed depends on the corp level tier performing the scan.
 *
 * Tier 1 (level 1-2):  type, size only.
 * Tier 2 (level 3-6):  + depositTypes (richness never revealed by orbit scan), orbit-visible features.
 * Tier 3 (level 7-10): + exact habitability.
 */
export interface OrbitScanResult {
  type: PlanetType
  size: PlanetSize
  /** Exact base habitability. Only revealed at tier 3 (corp level 7+). Null otherwise. */
  habitability: number | null
  /** Deposit types present on the planet. Richness is never revealed by orbit scan. Empty at tier 1. */
  depositTypes: DepositType[]
  /** featureIds of orbit-visible features revealed. Empty at tier 1. */
  revealedOrbitFeatureIds: string[]
}

// ─── Scan Tier Helper ─────────────────────────────────────────────────────────

/** Maps corp level (1-10) to orbit scan tier (1-3). */
function getScanTier(corpLevel: number): 1 | 2 | 3 {
  if (corpLevel <= 2) return 1
  if (corpLevel <= 6) return 2
  return 3
}

// ─── Exploration Formulas ─────────────────────────────────────────────────────

/**
 * Calculates the exploration percentage gained by completing an exploration contract.
 *
 * Formula (Specs.md § 12): exploration_gain = random(5, 15)%
 *
 * @returns Integer percentage in [5, 15]
 */
export function calculateExplorationGain(): number {
  return randomInt(5, 15)
}

/**
 * Calculates the number of planets (POIs) discovered by a completed exploration contract.
 *
 * Formula (Specs.md § 12): poi_count = 2 + weighted_random(0: 40%, 1: 40%, 2: 20%)
 *
 * Always returns 2, 3, or 4.
 *
 * @returns Integer in [2, 4]
 */
export function calculatePOICount(): number {
  return (
    2 +
    weightedRandom([
      { value: 0, weight: 40 },
      { value: 1, weight: 40 },
      { value: 2, weight: 20 },
    ])
  )
}

/**
 * Generates an orbit scan result for a discovered planet.
 *
 * The amount of data revealed depends on the corp level tier:
 * - Tier 1 (level 1-2):  type, size only
 * - Tier 2 (level 3-6):  + deposit types (not richness) + orbit-visible features
 * - Tier 3 (level 7-10): + exact habitability
 *
 * Deposit richness and ground-only features are never revealed by orbit scan;
 * those require a ground survey contract (Story 13.4).
 *
 * @param planet - The full planet data (ground truth from the generator)
 * @param corpLevel - The exploration corp's current level (1-10)
 * @returns Partial planet data visible from orbit at this scan quality
 */
export function generateOrbitScan(planet: Planet, corpLevel: number): OrbitScanResult {
  const tier = getScanTier(corpLevel)

  return {
    type: planet.type,
    size: planet.size,
    habitability: tier >= 3 ? planet.baseHabitability : null,
    depositTypes: tier >= 2 ? planet.deposits.map((d) => d.type) : [],
    revealedOrbitFeatureIds:
      tier >= 2 ? planet.features.filter((f) => f.orbitVisible).map((f) => f.featureId) : [],
  }
}
