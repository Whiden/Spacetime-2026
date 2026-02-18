/**
 * attributes.ts — Colony attribute calculation formulas.
 *
 * Implements all six core colony attributes as pure functions:
 * Habitability, Accessibility, Dynamism, Quality of Life, Stability, Growth.
 * Also implements calculateInfraCap() for infrastructure domain caps.
 *
 * Architecture rules:
 * - Local per-entity variation (planet features, colony type bonus, shortage maluses)
 *   goes through resolveModifiers() — modifiers are stored on the colony.
 * - Empire-wide values (debtTokens) are read directly from the caller-supplied state
 *   and never expressed as modifiers.
 * - Empire-wide bonuses from discoveries (infraCaps) are plain numbers passed in
 *   from EmpireBonuses — never resolved through the modifier system.
 *
 * All attribute results are clamped 0–10 except Growth, which is an unbounded
 * progress accumulator (transitions trigger at -1 and +10).
 *
 * Formulas source: Specs.md § 5 (Planets & Colonies).
 *
 * No Vue or Pinia imports. Pure TypeScript.
 *
 * TODO (Story 10.3): These functions are called each turn by colony-phase.ts.
 * TODO (Story 10.2): Growth accumulator ticks and population transitions live in colony-sim.ts.
 */

import type { Modifier } from '../../types/modifier'
import type { EmpireInfraCapBonuses } from '../../types/empire'
import { InfraDomain } from '../../types/common'
import { resolveModifiers } from './modifiers'

// ─── Attribute Clamp ──────────────────────────────────────────────────────────

/** All colony attributes except Growth are clamped between 0 and 10. */
const ATTR_MIN = 0
const ATTR_MAX = 10

// ─── Habitability ─────────────────────────────────────────────────────────────

/**
 * Calculate colony habitability.
 *
 * Mostly static — set by planet type base and feature modifiers.
 * Feature modifiers target 'habitability' and are stored on the colony.
 *
 * Formula (Specs.md § 5):
 *   habitability = base_from_planet_type + feature_modifiers
 *
 * @param basePlanetHab - Base habitability from the planet type (0-10).
 * @param colonyModifiers - All modifiers on the colony. Only 'habitability' targets are applied.
 * @returns Habitability value clamped 0–10.
 */
export function calculateHabitability(basePlanetHab: number, colonyModifiers: Modifier[]): number {
  return resolveModifiers(basePlanetHab, 'habitability', colonyModifiers, ATTR_MIN, ATTR_MAX)
}

// ─── Accessibility ────────────────────────────────────────────────────────────

/**
 * Calculate colony accessibility.
 *
 * Driven by transport infrastructure. Feature modifiers (e.g., Strategic Location +2,
 * Remote Location -2) are stored on the colony and applied via resolveModifiers.
 *
 * Formula (Specs.md § 5):
 *   accessibility = 3 + floor(transport_infrastructure / 2) + feature_modifiers
 *
 * @param transportInfra - Total transport infrastructure levels on the colony.
 * @param colonyModifiers - All modifiers on the colony. Only 'accessibility' targets are applied.
 * @returns Accessibility value clamped 0–10.
 */
export function calculateAccessibility(
  transportInfra: number,
  colonyModifiers: Modifier[],
): number {
  const base = 3 + Math.floor(transportInfra / 2)
  return resolveModifiers(base, 'accessibility', colonyModifiers, ATTR_MIN, ATTR_MAX)
}

// ─── Dynamism ─────────────────────────────────────────────────────────────────

/**
 * Calculate colony dynamism — economic energy.
 *
 * Driven by accessibility, population level, and corporate infrastructure activity.
 * Feature modifiers (e.g., Geothermal Activity +1, Ancient Ruins +2) are stored
 * on the colony and applied via resolveModifiers.
 *
 * Formula (Specs.md § 5):
 *   dynamism = floor((accessibility + population_level) / 2)
 *            + min(3, floor(total_corporate_infrastructure / 10))
 *            + feature_modifiers
 *
 * @param accessibility - Current colony accessibility (already calculated).
 * @param populationLevel - Current population level (1-10).
 * @param totalCorporateInfra - Sum of all corporate-owned infrastructure levels across all domains.
 * @param colonyModifiers - All modifiers on the colony. Only 'dynamism' targets are applied.
 * @returns Dynamism value clamped 0–10.
 */
export function calculateDynamism(
  accessibility: number,
  populationLevel: number,
  totalCorporateInfra: number,
  colonyModifiers: Modifier[],
): number {
  const corpBonus = Math.min(3, Math.floor(totalCorporateInfra / 10))
  const base = Math.floor((accessibility + populationLevel) / 2) + corpBonus
  return resolveModifiers(base, 'dynamism', colonyModifiers, ATTR_MIN, ATTR_MAX)
}

// ─── Quality of Life ──────────────────────────────────────────────────────────

/**
 * Calculate colony Quality of Life (QoL).
 *
 * Starts at 10 and degrades with low habitability and resource shortages.
 * Shortage maluses are stored as modifiers on the colony (sourceType 'shortage')
 * so they participate in resolveModifiers normally alongside feature modifiers.
 *
 * Formula (Specs.md § 5):
 *   qol_hab_malus     = floor(max(0, 10 - habitability) / 3)
 *   qol_shortage_malus = shortage_count  ← expressed as modifiers on colony
 *   qol               = 10 - qol_hab_malus - qol_shortage_malus + feature_modifiers
 *
 * @param habitability - Current colony habitability (already calculated, 0-10).
 * @param colonyModifiers - All modifiers on the colony (permanent features + transient shortages).
 *   Food shortage:          -2 qualityOfLife (sourceType 'shortage')
 *   ConsumerGoods shortage: -1 qualityOfLife (sourceType 'shortage')
 *   Feature bonuses:        +N qualityOfLife (sourceType 'feature')
 * @returns QoL value clamped 0–10.
 */
export function calculateQualityOfLife(
  habitability: number,
  colonyModifiers: Modifier[],
): number {
  const habMalus = Math.floor(Math.max(0, 10 - habitability) / 3)
  const base = 10 - habMalus
  return resolveModifiers(base, 'qualityOfLife', colonyModifiers, ATTR_MIN, ATTR_MAX)
}

// ─── Stability ────────────────────────────────────────────────────────────────

/**
 * Calculate colony stability.
 *
 * Reads empire debt tokens directly from the passed-in `debtTokens` value —
 * this is intentional: debt is a global state value that applies uniformly to
 * all colonies and must NOT be expressed as a per-colony modifier.
 *
 * Feature modifiers (Unstable Tectonics -1, etc.) and shortage maluses
 * are stored on the colony and applied via resolveModifiers.
 *
 * Formula (Specs.md § 5):
 *   stability_qol_malus      = max(0, 5 - qol)
 *   stability_debt_malus     = floor(empire_debt_tokens / 2)
 *   stability_shortage_malus = shortage_count  ← expressed as modifiers on colony
 *   stability_military_bonus = min(3, floor(military_infrastructure / 3))
 *   stability               = 10 - stability_qol_malus - stability_debt_malus
 *                                - stability_shortage_malus + stability_military_bonus
 *                                + feature_modifiers
 *
 * Note: shortage_count as a stability malus is not listed in the Specs formula above
 * but is referenced in the shortage effects table (Specs.md § 7). Food and Consumer
 * Goods shortages produce QoL maluses; stability degrades via qol_malus.
 * The direct stability_shortage_malus line in the formula is retained as written in Specs.
 * In practice, market-phase.ts does NOT add a separate stability modifier for shortages —
 * the QoL drop cascades into stability naturally via stability_qol_malus.
 *
 * @param qualityOfLife - Current QoL value (already calculated, 0-10).
 * @param militaryInfra - Total military infrastructure levels on the colony.
 * @param debtTokens - Current empire-wide debt token count (read directly, not a modifier).
 * @param colonyModifiers - All modifiers on the colony. Only 'stability' targets are applied.
 * @returns Stability value clamped 0–10.
 */
export function calculateStability(
  qualityOfLife: number,
  militaryInfra: number,
  debtTokens: number,
  colonyModifiers: Modifier[],
): number {
  const qolMalus = Math.max(0, 5 - qualityOfLife)
  const debtMalus = Math.floor(debtTokens / 2)
  const militaryBonus = Math.min(3, Math.floor(militaryInfra / 3))
  const base = 10 - qolMalus - debtMalus + militaryBonus
  return resolveModifiers(base, 'stability', colonyModifiers, ATTR_MIN, ATTR_MAX)
}

// ─── Growth ───────────────────────────────────────────────────────────────────

/**
 * Calculate the growth-per-turn increment for a colony.
 *
 * Growth is a progress accumulator — NOT clamped 0-10. Transitions happen at:
 *   - Growth reaches 10  → population level +1 (if civilian infra requirement met)
 *   - Growth reaches -1  → population level -1
 *
 * Feature modifiers targeting 'growth' are applied via resolveModifiers.
 *
 * Formula (Specs.md § 5):
 *   growth_hab_malus = floor(max(0, 10 - habitability) / 3)
 *   growth_per_turn  = floor((qol + stability + accessibility) / 3)
 *                    - 3
 *                    - growth_hab_malus
 *                    + feature_modifiers
 *
 * @param qualityOfLife - Current QoL value (already calculated, 0-10).
 * @param stability - Current stability value (already calculated, 0-10).
 * @param accessibility - Current accessibility value (already calculated, 0-10).
 * @param habitability - Current habitability value (already calculated, 0-10).
 * @param colonyModifiers - All modifiers on the colony. Only 'growth' targets are applied.
 * @returns Growth-per-turn delta (can be negative; not clamped).
 */
export function calculateGrowthPerTurn(
  qualityOfLife: number,
  stability: number,
  accessibility: number,
  habitability: number,
  colonyModifiers: Modifier[],
): number {
  const habMalus = Math.floor(Math.max(0, 10 - habitability) / 3)
  const base = Math.floor((qualityOfLife + stability + accessibility) / 3) - 3 - habMalus
  // Growth is not clamped — it accumulates freely and triggers transitions at -1/+10
  return resolveModifiers(base, 'growth', colonyModifiers)
}

// ─── Infrastructure Cap ───────────────────────────────────────────────────────

/**
 * Map from InfraDomain to the corresponding EmpireInfraCapBonuses key.
 * Used to look up the empire-wide bonus for a given domain.
 */
const DOMAIN_TO_EMPIRE_CAP_KEY: Partial<Record<InfraDomain, keyof EmpireInfraCapBonuses>> = {
  [InfraDomain.Mining]: 'maxMining',
  [InfraDomain.DeepMining]: 'maxDeepMining',
  [InfraDomain.GasExtraction]: 'maxGasExtraction',
  [InfraDomain.Agricultural]: 'maxAgricultural',
  [InfraDomain.Science]: 'maxScience',
  [InfraDomain.SpaceIndustry]: 'maxSpaceIndustry',
  [InfraDomain.LowIndustry]: 'maxLowIndustry',
  [InfraDomain.HeavyIndustry]: 'maxHeavyIndustry',
  [InfraDomain.HighTechIndustry]: 'maxHighTechIndustry',
}

/**
 * Calculate the infrastructure cap for a given domain on a colony.
 *
 * Applies empire-wide cap bonuses (from discoveries) and local feature modifiers
 * (e.g., Mineral Veins +5 max Mining) on top of the population-derived base.
 *
 * Formula (Specs.md § 6 & Story 10.1 acceptance criteria):
 *   base = popLevel × 2 + empireBonuses.infraCaps[domain]
 *   cap  = base + local modifier bonuses targeting 'maxDomain' (e.g., 'maxMining')
 *
 * Special cases:
 * - Civilian: Uncapped — returns Infinity.
 * - Transport, Military, Science: capped at popLevel × 2 + empire bonus (no deposit richness).
 * - Extraction/Agricultural: caller must compare this result against the deposit richness cap
 *   (from calculateExtractionCap() in production.ts) and use the minimum. This function
 *   returns the population+feature cap only — the tighter deposit cap is enforced upstream
 *   in colony-sim.ts.
 *
 * @param popLevel - Current colony population level (1-10).
 * @param domain - Infrastructure domain to calculate the cap for.
 * @param empireBonuses - Empire-wide cap bonuses from science discoveries (read directly).
 * @param colonyModifiers - All modifiers on the colony. Only modifiers targeting the
 *   domain's 'max*' key (e.g., 'maxMining') are applied.
 * @returns The computed cap (integer). Returns Infinity for Civilian domain.
 */
export function calculateInfraCap(
  popLevel: number,
  domain: InfraDomain,
  empireBonuses: EmpireInfraCapBonuses,
  colonyModifiers: Modifier[],
): number {
  // Civilian: capped at next_population_level × 2 (Specs.md § 6).
  // The civilian cap limits unchecked growth: players must invest to enable population level-ups.
  // next_pop_level = popLevel + 1 (pop level 10 is the absolute max, handled by planet size).
  if (domain === InfraDomain.Civilian) {
    const nextPopLevel = popLevel + 1
    return nextPopLevel * 2
  }

  // Derive the empire bonus for this domain (0 if the domain has no empire cap key)
  const capKey = DOMAIN_TO_EMPIRE_CAP_KEY[domain]
  const empireBonus = capKey !== undefined ? empireBonuses[capKey] : 0

  // Base cap: pop × 2 + empire discovery bonus
  const base = popLevel * 2 + empireBonus

  // Resolve local modifiers targeting e.g. 'maxMining', 'maxAgricultural', etc.
  const modifierTarget = capKey !== undefined ? capKey : `max${domain}`
  const cap = resolveModifiers(base, modifierTarget, colonyModifiers)

  // Cap is always a non-negative integer
  return Math.max(0, Math.floor(cap))
}
