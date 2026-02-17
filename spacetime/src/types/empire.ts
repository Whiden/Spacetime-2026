/**
 * empire.ts — EmpireBonuses type definition.
 *
 * EmpireBonuses holds cumulative global bonuses that apply uniformly to ALL entities
 * of a given type. These come from science discoveries and are permanent once applied.
 *
 * These are NOT modifiers — they are simple cumulative values stored on the game state
 * and read directly by formulas. Using modifiers for empire-wide values would be
 * unnecessarily complex since they don't vary between entities.
 *
 * See Structure.md § Modifier System: "Empire Bonuses vs Local Modifiers" for rationale.
 *
 * TODO (Story 14.2): Discovery application increments these values.
 * TODO (Story 15.1): Ship stat generation reads empireBonuses.shipStats[stat].
 * TODO (Story 10.1): Infra cap calculation reads empireBonuses.infraCaps[domain].
 */

// ─── Ship Stat Bonuses ────────────────────────────────────────────────────────

/**
 * Cumulative tech bonuses applied to every newly built ship.
 * Added to role base stats before corp scaling and schematics.
 * Non-retroactive — existing ships keep the bonuses baked in at build time.
 */
export interface EmpireShipStatBonuses {
  size: number
  speed: number
  firepower: number
  armor: number
  sensors: number
  evasion: number
}

// ─── Infrastructure Cap Bonuses ───────────────────────────────────────────────

/**
 * Cumulative bonuses to infrastructure domain caps across the entire empire.
 * Added to the base cap formula (pop_level × 2) before local modifiers.
 */
export interface EmpireInfraCapBonuses {
  maxMining: number
  maxDeepMining: number
  maxGasExtraction: number
  maxAgricultural: number
  maxScience: number
  maxSpaceIndustry: number
  maxLowIndustry: number
  maxHeavyIndustry: number
  maxHighTechIndustry: number
}

// ─── EmpireBonuses ────────────────────────────────────────────────────────────

/**
 * All empire-wide cumulative bonuses. Stored on GameState and updated when discoveries
 * are made. Initializes with all zeros.
 */
export interface EmpireBonuses {
  shipStats: EmpireShipStatBonuses
  infraCaps: EmpireInfraCapBonuses
}

/**
 * Returns a fresh EmpireBonuses object with all values set to zero.
 * Used at game initialization.
 */
export function createEmptyEmpireBonuses(): EmpireBonuses {
  return {
    shipStats: {
      size: 0,
      speed: 0,
      firepower: 0,
      armor: 0,
      sensors: 0,
      evasion: 0,
    },
    infraCaps: {
      maxMining: 0,
      maxDeepMining: 0,
      maxGasExtraction: 0,
      maxAgricultural: 0,
      maxScience: 0,
      maxSpaceIndustry: 0,
      maxLowIndustry: 0,
      maxHeavyIndustry: 0,
      maxHighTechIndustry: 0,
    },
  }
}
