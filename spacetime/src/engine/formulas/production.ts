/**
 * production.ts — Resource production and consumption calculation formulas.
 *
 * Covers extraction output, manufacturing output, population consumption,
 * industrial input requirements, and infrastructure cap logic.
 *
 * All functions are pure: typed inputs → typed outputs, no side effects.
 * See Specs.md § 6 Infrastructure and § 7 Trade & Resources for formula sources.
 * See Data.md § 7 Infrastructure Domains for domain definitions.
 *
 * TODO (Story 8.2): These primitives are assembled into a full colony resource
 * flow calculation in colony-sim.ts (production section).
 * TODO (Story 10.1): calculateInfraCap() will be superseded by the version in
 * attributes.ts that also folds in empire bonuses and local modifiers (planet features).
 */

import { InfraDomain, RichnessLevel } from '../../types/common'
import { RICHNESS_CAPS } from '../../data/planet-deposits'

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Calculates the raw output of an extraction domain (Mining, Deep Mining,
 * Gas Extraction, Agricultural) for a given infrastructure level.
 *
 * Formula: infraLevel × richnessModifier
 *
 * `richnessModifier` is the resolved output multiplier for this domain on this
 * colony — defaults to 1.0 and is increased by planet features such as
 * "Metallic Core" (+0.5 Mining output) or "High Gravity" (+0.5 Deep Mining output).
 * It is resolved via resolveModifiers() on the corresponding production target
 * (e.g. 'miningOutput') before being passed here.
 *
 * @param infraLevel  Total infrastructure levels in the extraction domain.
 * @param richnessModifier  Output multiplier from resolved colony modifiers (default 1.0).
 * @returns Production units per turn (integer — caller must floor if needed).
 */
export function calculateExtraction(infraLevel: number, richnessModifier: number): number {
  return infraLevel * richnessModifier
}

/**
 * Returns the infrastructure cap for an extraction domain, derived from
 * the richness of the planet's best matching deposit.
 *
 * Richness levels map to caps: Poor=5, Moderate=10, Rich=15, Exceptional=20.
 * Additional cap bonuses from planet features (e.g. "Mineral Veins" +5 max Mining)
 * are added on top by the caller via the modifier system.
 *
 * @param richness  The richness level of the best relevant deposit on the planet.
 * @returns The base infrastructure cap for this extraction domain.
 */
export function calculateExtractionCap(richness: RichnessLevel): number {
  return RICHNESS_CAPS[richness]
}

// ─── Manufacturing ────────────────────────────────────────────────────────────

/**
 * Calculates the output of a manufacturing domain (Low Industry, Heavy Industry,
 * High-Tech Industry, Space Industry) for a given infrastructure level.
 *
 * Formula:
 * - All inputs available: infraLevel (1 unit per level)
 * - Any input in shortage: floor(infraLevel / 2)
 *
 * The halving applies when any required input resource is not fully available.
 * The caller is responsible for determining whether inputs are in shortage
 * (e.g., after market resolution) and passing the correct `hasInputs` flag.
 *
 * @param infraLevel  Total infrastructure levels in the manufacturing domain.
 * @param hasInputs   True if all required input resources are fully available.
 * @returns Production units per turn.
 */
export function calculateManufacturing(infraLevel: number, hasInputs: boolean): number {
  if (hasInputs) {
    return infraLevel
  }
  return Math.floor(infraLevel / 2)
}

/**
 * Returns the amount of a single input resource consumed per turn by a
 * manufacturing domain. Each infrastructure level consumes exactly 1 unit
 * of each required input type.
 *
 * For example, Heavy Industry at level 3 consumes 3 Common Materials AND
 * 3 Rare Materials per turn (this function returns 3 in both cases).
 *
 * @param infraLevel  Total infrastructure levels in the manufacturing domain.
 * @returns Units of each required input consumed per turn.
 */
export function calculateIndustrialInput(infraLevel: number): number {
  return infraLevel
}

// ─── Population Consumption ───────────────────────────────────────────────────

/**
 * Calculates how much Food a colony consumes per turn based on population level.
 *
 * Formula: popLevel × 2
 * (See Specs.md § 7 Consumption by Population)
 *
 * Note: Data.md § 7 lists Food at population_level — the spec formula takes
 * precedence here. This will be reconciled during playtesting balance pass.
 *
 * @param popLevel  Current colony population level (1-10).
 * @returns Food units consumed per turn.
 */
export function calculateFoodConsumption(popLevel: number): number {
  return popLevel * 2
}

/**
 * Calculates how much Consumer Goods a colony consumes per turn.
 *
 * Formula: popLevel × 1
 * (See Specs.md § 7 Consumption by Population)
 *
 * @param popLevel  Current colony population level (1-10).
 * @returns Consumer Goods units consumed per turn.
 */
export function calculateConsumerGoodsConsumption(popLevel: number): number {
  return popLevel
}

/**
 * Calculates how much Transport Capacity a colony consumes per turn.
 * Transport Capacity is consumed locally — it is not traded on the sector market.
 *
 * Formula: popLevel
 * (See Specs.md § 7 Consumption by Population)
 *
 * @param popLevel  Current colony population level (1-10).
 * @returns Transport Capacity units consumed per turn.
 */
export function calculateTCConsumption(popLevel: number): number {
  return popLevel
}

// ─── Infrastructure Caps ──────────────────────────────────────────────────────

/**
 * Calculates the base infrastructure cap for a domain, based on population level.
 *
 * Rules:
 * - Civilian: uncapped (returns Infinity)
 * - Extraction domains (Mining, DeepMining, GasExtraction, Agricultural): capped
 *   by deposit richness — use calculateExtractionCap() for those instead.
 *   This function still returns popLevel × 2 for them as a fallback baseline;
 *   the actual cap used in-game is the minimum of the two.
 * - All other domains: popLevel × 2
 *
 * TODO (Story 10.1): The authoritative version in attributes.ts adds empire-wide
 * infraCap bonuses and resolves local modifiers from planet features (e.g.,
 * "Mineral Veins" adds +5 to max Mining). Use this simpler version until then.
 *
 * @param popLevel  Current colony population level (1-10).
 * @param domain    The infrastructure domain to calculate the cap for.
 * @returns The infrastructure level cap, or Infinity for the Civilian domain.
 */
export function calculateInfraCap(popLevel: number, domain: InfraDomain): number {
  if (domain === InfraDomain.Civilian) {
    return Infinity
  }
  return popLevel * 2
}
