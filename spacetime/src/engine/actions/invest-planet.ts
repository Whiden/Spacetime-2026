/**
 * invest-planet.ts — Player direct BP investment in colony infrastructure.
 *
 * Validates the investment request (BP, cap, deposit presence) and returns
 * either an updated Colony with +1 public infrastructure level, or a
 * typed validation error.
 *
 * Cost: 3 BP per +1 public infrastructure level (player-funded).
 * The BP deduction is applied by the caller (colony.store.ts / budget.store.ts).
 *
 * Pure function: no side effects, no store access.
 *
 * TODO (Story 8.4): invest-planet.ts is wired to the "Invest" button in InfraPanel.vue.
 * TODO (Story 10.1): When calculateInfraCap() in attributes.ts runs each turn and
 *   writes back into colony.infrastructure[domain].currentCap, the cap computation
 *   here can be simplified to just read `infraState.currentCap` instead of recalculating.
 */

import type { ColonyId, BPAmount, InfraDomain } from '../../types/common'
import type { Colony } from '../../types/colony'
import type { Deposit } from '../../types/planet'
import type { InfraState } from '../../types/infrastructure'
import { getTotalLevels } from '../../types/infrastructure'
import { DEPOSIT_DEFINITIONS, RICHNESS_CAPS } from '../../data/planet-deposits'
import { EXTRACTION_DOMAINS } from '../../data/infrastructure'
import { calculateInfraCap } from '../formulas/production'

// ─── Constants ────────────────────────────────────────────────────────────────

/** BP cost for +1 public infrastructure level. See Specs.md § 6 Player Direct Investment. */
export const INVEST_COST_BP = 3 as BPAmount

/** Levels gained per investment action. Always 1 in the prototype. */
const LEVELS_GAINED = 1

// ─── Validation Error Types ───────────────────────────────────────────────────

export type InvestPlanetError =
  | 'COLONY_NOT_FOUND'       // Colony ID not in provided colonies map
  | 'INSUFFICIENT_BP'        // Player has fewer than 3 BP
  | 'AT_CAP'                 // Domain infrastructure is already at its cap
  | 'NO_MATCHING_DEPOSIT'    // Extraction domain has no matching deposit on this planet

export interface InvestPlanetSuccess {
  success: true
  /** Colony with +1 public level in the target domain. */
  updatedColony: Colony
  /** BP spent on this investment (always INVEST_COST_BP). */
  bpSpent: BPAmount
}

export interface InvestPlanetFailure {
  success: false
  error: InvestPlanetError
  message: string
}

export type InvestPlanetResult = InvestPlanetSuccess | InvestPlanetFailure

// ─── Input Parameters ─────────────────────────────────────────────────────────

export interface InvestPlanetParams {
  /** Target colony to invest in. */
  colonyId: ColonyId
  /** Infrastructure domain to invest in. */
  domain: InfraDomain
  /** Player's current BP balance. Must be >= INVEST_COST_BP. */
  currentBP: BPAmount
  /** All colonies, keyed by ID. Used to look up and validate the target colony. */
  colonies: Map<string, Colony>
  /**
   * Deposits on the target colony's planet.
   * Required for extraction domain validation.
   * Caller resolves from planet store before calling this function.
   */
  deposits: Deposit[]
}

// ─── Cap Calculation ──────────────────────────────────────────────────────────

/**
 * Computes the effective infrastructure cap for a domain on a specific colony.
 *
 * This recalculates dynamically because colony.infrastructure[domain].currentCap
 * is currently stored as Infinity everywhere (TODO Story 10.1 will write it back
 * properly each turn). Until then, the cap must be computed from live data.
 *
 * Rules (see Specs.md § 6 Infrastructure Caps):
 * - Civilian: capped at next_population_level × 2
 * - Extraction domains (Mining, DeepMining, GasExtraction, Agricultural):
 *     max richness cap among all matching deposits on the planet.
 *     Returns 0 if no deposit exists (no investment allowed).
 * - All other domains (industry, transport, science, military):
 *     popLevel × 2
 *
 * NOTE: Feature bonuses to extraction caps (e.g. "Mineral Veins" +5 max Mining)
 * are stored as modifiers on the colony and will be factored in by
 * calculateInfraCap() in attributes.ts (Story 10.1). For now, only raw richness
 * caps are used here.
 *
 * TODO (Story 10.1): Replace with resolveModifiers on 'maxMining' etc. to include
 *   planet feature bonuses to extraction caps.
 */
function computeEffectiveCap(colony: Colony, domain: InfraDomain, deposits: Deposit[]): number {
  // Extraction domains: cap from deposit richness (best available)
  if (EXTRACTION_DOMAINS.includes(domain)) {
    const matchingDeposits = deposits.filter(
      (d) => DEPOSIT_DEFINITIONS[d.type].extractedBy === domain,
    )
    if (matchingDeposits.length === 0) return 0 // no deposit → no cap → no investment
    const richnessCaps = matchingDeposits.map((d) => RICHNESS_CAPS[d.richness])
    return Math.max(...richnessCaps)
  }

  // All other domains including Civilian (capped at next_pop_level × 2 per Specs.md § 6)
  return calculateInfraCap(colony.populationLevel, domain)
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Validates and applies a +1 public infrastructure investment to a colony domain.
 *
 * Validation order:
 *   1. Colony exists in the provided map
 *   2. Player has sufficient BP (≥ INVEST_COST_BP = 3)
 *   3. For extraction domains: matching deposit exists on the planet
 *   4. Domain is below its effective cap
 *
 * On success returns an updated Colony with +1 public level on the target domain.
 * The caller (store) is responsible for deducting `bpSpent` from the budget.
 *
 * @param params - Investment parameters (colony ID, domain, BP, colonies map, deposits)
 * @returns Success with updatedColony and bpSpent, or failure with error code + message
 */
export function investPlanet(params: InvestPlanetParams): InvestPlanetResult {
  const { colonyId, domain, currentBP, colonies, deposits } = params

  // 1. Colony must exist
  const colony = colonies.get(colonyId)
  if (!colony) {
    return {
      success: false,
      error: 'COLONY_NOT_FOUND',
      message: `Colony '${colonyId}' not found.`,
    }
  }

  // 2. Player must have sufficient BP
  if (currentBP < INVEST_COST_BP) {
    return {
      success: false,
      error: 'INSUFFICIENT_BP',
      message: `Investment requires ${INVEST_COST_BP} BP. Player has ${currentBP} BP.`,
    }
  }

  // 3. Extraction domains: matching deposit must exist (before cap check, for clear error)
  if (EXTRACTION_DOMAINS.includes(domain)) {
    const hasDeposit = deposits.some(
      (d) => DEPOSIT_DEFINITIONS[d.type].extractedBy === domain,
    )
    if (!hasDeposit) {
      return {
        success: false,
        error: 'NO_MATCHING_DEPOSIT',
        message: `No deposit for '${domain}' domain on this planet. Cannot invest in extraction without a resource deposit.`,
      }
    }
  }

  // 4. Domain must not be at cap
  const infraState = colony.infrastructure[domain]
  const totalLevels = getTotalLevels(infraState)
  const effectiveCap = computeEffectiveCap(colony, domain, deposits)

  if (totalLevels >= effectiveCap) {
    return {
      success: false,
      error: 'AT_CAP',
      message: `'${domain}' infrastructure is at its cap (${effectiveCap}). Cannot invest further.`,
    }
  }

  // ── Apply +1 public level ──────────────────────────────────────────────────

  const updatedInfraState: InfraState = {
    ...infraState,
    ownership: {
      ...infraState.ownership,
      publicLevels: infraState.ownership.publicLevels + LEVELS_GAINED,
    },
  }

  const updatedColony: Colony = {
    ...colony,
    infrastructure: {
      ...colony.infrastructure,
      [domain]: updatedInfraState,
    },
  }

  return {
    success: true,
    updatedColony,
    bpSpent: INVEST_COST_BP,
  }
}
