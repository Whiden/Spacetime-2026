/**
 * create-contract.ts — Contract creation engine action.
 *
 * Validates inputs, calculates costs and duration, checks eligibility,
 * and returns a new Contract object or a validation error.
 *
 * Pure function: no side effects, no store access.
 *
 * TODO (Story 7.2): contract.store.ts calls createContract() and writes the result.
 * TODO (Story 7.3): contract-phase.ts advances turnsRemaining each turn.
 */

import type { CorpId, TurnNumber, BPAmount } from '../../types/common'
import { ContractType, ContractStatus, InfraDomain } from '../../types/common'
import type { Contract, ContractTarget, ColonizationParams, ShipCommissionParams } from '../../types/contract'
import type { Corporation } from '../../types/corporation'
import type { Colony } from '../../types/colony'
import type { Planet } from '../../types/planet'
import type { Sector } from '../../types/sector'
import { PlanetStatus } from '../../types/common'
import { CONTRACT_TYPE_DEFINITIONS, calculateExplorationDuration } from '../../data/contracts'
import { COLONY_TYPE_DEFINITIONS } from '../../data/colony-types'
import { SHIP_ROLE_DEFINITIONS, SIZE_VARIANT_MULTIPLIERS } from '../../data/ship-roles'
import { getTotalLevels } from '../../types/infrastructure'
import { generateContractId } from '../../utils/id'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum corp level to operate cross-type contracts (e.g., Industrial doing Exploration). */
const CROSS_TYPE_MIN_LEVEL = 3

/** Megacorp level — unrestricted contract eligibility. */
const MEGACORP_LEVEL = 6

// ─── Validation Result ────────────────────────────────────────────────────────

export type ContractValidationError =
  | 'INVALID_TARGET_TYPE'           // Contract type and target type don't match
  | 'CORP_NOT_ELIGIBLE'             // Corp type cannot do this contract type
  | 'INVALID_PLANET_STATUS'         // Colonization target must be Accepted or GroundSurveyed
  | 'SECTORS_NOT_ADJACENT'          // Trade route sectors must be adjacent
  | 'SECTOR_OUT_OF_RANGE'           // Exploration target is not adjacent to any colony sector
  | 'CORP_NOT_FOUND'                // Corp ID not in provided corps map
  | 'TARGET_NOT_FOUND'              // Target entity not found
  | 'MISSING_COLONY_TYPE'           // Colonization requires colonyType param
  | 'MISSING_SHIP_PARAMS'           // Ship commission requires role + sizeVariant
  | 'INSUFFICIENT_SPACE_INFRA'      // Colony lacks required space infrastructure level

export interface ContractCreationSuccess {
  success: true
  contract: Contract
}

export interface ContractCreationFailure {
  success: false
  error: ContractValidationError
  message: string
}

export type ContractCreationResult = ContractCreationSuccess | ContractCreationFailure

// ─── Input Parameters ─────────────────────────────────────────────────────────

export interface CreateContractParams {
  type: ContractType
  target: ContractTarget
  assignedCorpId: CorpId
  currentTurn: TurnNumber
  /** All available sectors, keyed by ID — used for existence checks. */
  sectors: Map<string, Sector>
  /**
   * Adjacency map from Galaxy: sectorId → array of adjacent sector IDs.
   * Used for trade route adjacency validation and exploration range checks.
   */
  sectorAdjacency: Map<string, string[]>
  /**
   * Set of sector IDs that contain at least one player colony.
   * Used to validate exploration range — can only explore sectors adjacent to a colony sector.
   */
  colonySectorIds: Set<string>
  /** All colonies, keyed by ID — used for ship commission target validation. */
  colonies: Map<string, Colony>
  /** All planets, keyed by ID — used for colonization/survey target validation. */
  planets: Map<string, Planet>
  /** All corporations, keyed by ID — used for eligibility checks. */
  corporations: Map<string, Corporation>
  /** Extra parameters for colonization contracts. */
  colonizationParams?: ColonizationParams
  /** Extra parameters for ship commission contracts. */
  shipCommissionParams?: ShipCommissionParams
}

// ─── Eligibility Check ────────────────────────────────────────────────────────

/**
 * Checks if a corporation is eligible to execute a given contract type.
 *
 * Eligibility rules:
 * - A corp is always eligible if its type matches the contract's eligible types.
 * - A level 3+ corp can take any contract (cross-type), but their type should match
 *   for "own type" bonus quality. For the prototype, we just check eligibility.
 * - A level 6+ (Megacorp) corp is always eligible for any contract.
 *
 * Note: Cross-type at level 3+ is currently allowed for all contract types
 * except those requiring a specific physical capability (e.g., only Shipbuilding
 * can build ships, only Construction can colonize). This is a design simplification
 * for the prototype — the Specs say "level 3+ for cross-type" as a general rule.
 *
 * For the prototype, cross-type eligibility at level 3+ applies to:
 * - Exploration (any corp level 3+ can run exploration)
 * - Ground Survey (any corp level 3+ can survey)
 * Trade routes (Transport only, no cross-type)
 * Colonization (Construction only — requires specialized corp, no cross-type)
 * Ship Commission (Shipbuilding only — requires specialized corp, no cross-type)
 *
 * TODO (Story 11.1): Corp AI uses a stricter version of this — own-type priority.
 */
function isCorpEligible(corp: Corporation, contractType: ContractType): boolean {
  // Megacorps can do anything
  if (corp.level >= MEGACORP_LEVEL) return true

  const definition = CONTRACT_TYPE_DEFINITIONS[contractType]
  const ownTypeEligible = definition.eligibleCorpTypes.includes(corp.type)

  if (ownTypeEligible) return true

  // Level 3+ corps can take cross-type contracts, except specialized ones
  const specializedContracts: ContractType[] = [
    ContractType.Colonization,
    ContractType.ShipCommission,
    ContractType.TradeRoute,
  ]
  if (corp.level >= CROSS_TYPE_MIN_LEVEL && !specializedContracts.includes(contractType)) {
    return true
  }

  return false
}

// ─── Target Validation ────────────────────────────────────────────────────────

/**
 * Validates that the contract target matches the expected target type for
 * the contract type, and that the target entity exists and is in the correct state.
 */
function validateTarget(
  params: CreateContractParams,
): ContractValidationError | null {
  const definition = CONTRACT_TYPE_DEFINITIONS[params.type]
  const { target } = params

  // Check target type matches contract expectation
  if (target.type !== definition.targetType) {
    return 'INVALID_TARGET_TYPE'
  }

  switch (params.type) {
    case ContractType.Exploration: {
      if (target.type !== 'sector') return 'INVALID_TARGET_TYPE'
      if (!params.sectors.has(target.sectorId)) return 'TARGET_NOT_FOUND'
      // Can only explore sectors adjacent to (or containing) a player colony.
      // Skip range check if no colonies exist yet (early game / Terra Nova not yet initialized).
      if (params.colonySectorIds.size > 0) {
        const adjacentToColony =
          params.colonySectorIds.has(target.sectorId) ||
          (params.sectorAdjacency.get(target.sectorId) ?? []).some((adj) =>
            params.colonySectorIds.has(adj),
          )
        if (!adjacentToColony) return 'SECTOR_OUT_OF_RANGE'
      }
      break
    }

    case ContractType.GroundSurvey: {
      if (target.type !== 'planet') return 'INVALID_TARGET_TYPE'
      const planet = params.planets.get(target.planetId)
      if (!planet) return 'TARGET_NOT_FOUND'
      // Ground survey requires the planet to be orbit-scanned or accepted
      if (
        planet.status !== PlanetStatus.OrbitScanned &&
        planet.status !== PlanetStatus.Accepted
      ) {
        return 'INVALID_PLANET_STATUS'
      }
      break
    }

    case ContractType.Colonization: {
      if (target.type !== 'planet') return 'INVALID_TARGET_TYPE'
      if (!params.colonizationParams) return 'MISSING_COLONY_TYPE'
      const planet = params.planets.get(target.planetId)
      if (!planet) return 'TARGET_NOT_FOUND'
      // Colonization requires an accepted planet (ground surveyed + accepted)
      if (
        planet.status !== PlanetStatus.Accepted &&
        planet.status !== PlanetStatus.GroundSurveyed
      ) {
        return 'INVALID_PLANET_STATUS'
      }
      break
    }

    case ContractType.ShipCommission: {
      if (target.type !== 'colony') return 'INVALID_TARGET_TYPE'
      if (!params.shipCommissionParams) return 'MISSING_SHIP_PARAMS'
      const colony = params.colonies.get(target.colonyId)
      if (!colony) return 'TARGET_NOT_FOUND'
      // Validate colony has sufficient space infrastructure
      // required_space_infra = base_size × size_multiplier (floored)
      const { role, sizeVariant } = params.shipCommissionParams
      const roleDef = SHIP_ROLE_DEFINITIONS[role]
      const sizeMultipliers = SIZE_VARIANT_MULTIPLIERS[sizeVariant]
      const requiredSpaceInfra = Math.floor(roleDef.baseStats.size * sizeMultipliers.sizeMultiplier)
      const spaceInfraState = colony.infrastructure[InfraDomain.SpaceIndustry]
      const actualSpaceInfra = spaceInfraState ? getTotalLevels(spaceInfraState) : 0
      if (actualSpaceInfra < requiredSpaceInfra) return 'INSUFFICIENT_SPACE_INFRA'
      break
    }

    case ContractType.TradeRoute: {
      if (target.type !== 'sector_pair') return 'INVALID_TARGET_TYPE'
      const sectorAExists = params.sectors.has(target.sectorIdA)
      const sectorBExists = params.sectors.has(target.sectorIdB)
      if (!sectorAExists || !sectorBExists) return 'TARGET_NOT_FOUND'
      // Validate adjacency via the galaxy adjacency map
      const adjacentToA = params.sectorAdjacency.get(target.sectorIdA) ?? []
      if (!adjacentToA.includes(target.sectorIdB)) return 'SECTORS_NOT_ADJACENT'
      break
    }
  }

  return null
}

// ─── Cost & Duration Calculation ─────────────────────────────────────────────

/**
 * Calculates the BP/turn cost for a contract.
 * Most contracts use the base cost from the definition.
 * Colonization uses the colony type definition.
 * Ship commission cost is derived from the role base size and size variant (Story 15.2).
 */
function calculateBpPerTurn(params: CreateContractParams, corp?: Corporation): BPAmount {
  switch (params.type) {
    case ContractType.Colonization:
      if (params.colonizationParams) {
        const colonyDef = COLONY_TYPE_DEFINITIONS[params.colonizationParams.colonyType]
        return colonyDef.bpPerTurn as BPAmount
      }
      break

    case ContractType.ShipCommission:
      if (params.shipCommissionParams) {
        return calculateShipCommissionBpPerTurn(params.shipCommissionParams, corp)
      }
      break
  }

  return CONTRACT_TYPE_DEFINITIONS[params.type].baseBpPerTurn as BPAmount
}

/**
 * Computes the deterministic bp_per_turn for a ship commission at contract-creation time.
 *
 * Uses random = 1.0 (midpoint of [0.8, 1.2]) so the displayed cost is representative.
 * The actual ship built on completion may vary due to randomness, but the BP/turn
 * cost locked at creation uses this deterministic estimate.
 *
 * Formula mirrors design-blueprint.ts:
 *   corp_modifier  = 0.7 + corpLevel × 0.06
 *   rawSize        = floor(role_base_size × corp_modifier × 1.0)  [random = 1.0]
 *   baseBpPerTurn  = max(1, floor(rawSize / 3)) [no schematic bonuses at creation]
 *   bpPerTurn      = max(1, floor(baseBpPerTurn × size_cost_multiplier))
 */
function calculateShipCommissionBpPerTurn(
  params: ShipCommissionParams,
  corp?: Corporation,
): BPAmount {
  const roleDef = SHIP_ROLE_DEFINITIONS[params.role]
  const sizeMultipliers = SIZE_VARIANT_MULTIPLIERS[params.sizeVariant]
  const corpLevel = corp?.level ?? 1
  const corpModifier = 0.7 + corpLevel * 0.06
  const rawSize = Math.floor(roleDef.baseStats.size * corpModifier)
  const baseBpPerTurn = Math.max(1, Math.floor(rawSize / 3))
  return Math.max(1, Math.floor(baseBpPerTurn * sizeMultipliers.costMultiplier)) as BPAmount
}

/**
 * Calculates the duration in turns for a contract.
 * Exploration duration scales with corp level.
 * Colonization duration is set by the colony type.
 * Trade Route is ongoing (duration = -1 sentinel for "no end").
 */
function calculateDuration(
  params: CreateContractParams,
  corp: Corporation,
): number {
  switch (params.type) {
    case ContractType.Exploration:
      return calculateExplorationDuration(corp.level)

    case ContractType.Colonization:
      if (params.colonizationParams) {
        const colonyDef = COLONY_TYPE_DEFINITIONS[params.colonizationParams.colonyType]
        return colonyDef.durationTurns
      }
      break

    case ContractType.TradeRoute:
      // Ongoing — use a large sentinel value; the contract store handles "ongoing" logic.
      // TODO (Story 17.1): Trade route contracts are ongoing until cancelled.
      return 9999

    case ContractType.ShipCommission:
      if (params.shipCommissionParams) {
        return calculateShipCommissionDuration(params.shipCommissionParams, corp)
      }
      return CONTRACT_TYPE_DEFINITIONS[params.type].baseDurationTurns as number
  }

  const base = CONTRACT_TYPE_DEFINITIONS[params.type].baseDurationTurns
  if (typeof base === 'number') return base
  return 3 // Fallback for any 'by_type' entries not handled above
}

/**
 * Computes the actual build time for a ship commission contract.
 *
 * Formula (Story 15.2):
 *   base_build_time (from blueprint, deterministic, random = 1.0):
 *     corp_modifier  = 0.7 + corpLevel × 0.06
 *     rawSize        = floor(role_base_size × corp_modifier)
 *     baseBuildTime  = max(3, floor(rawSize × 1)) + role_bonuses
 *     buildTimeTurns = max(1, floor(baseBuildTime × size_build_time_multiplier))
 *   actual_build_time = max(1, floor(buildTimeTurns × (1 - corp_level × 0.05)))
 */
function calculateShipCommissionDuration(
  params: ShipCommissionParams,
  corp: Corporation,
): number {
  const roleDef = SHIP_ROLE_DEFINITIONS[params.role]
  const sizeMultipliers = SIZE_VARIANT_MULTIPLIERS[params.sizeVariant]
  const corpLevel = corp.level
  const corpModifier = 0.7 + corpLevel * 0.06
  const rawSize = Math.floor(roleDef.baseStats.size * corpModifier)
  const roleBuildTimeBonus = roleDef.derivedStatBonuses.buildTimeTurns ?? 0
  const baseBuildTime = Math.max(3, Math.floor(rawSize)) + roleBuildTimeBonus
  const buildTimeTurns = Math.max(1, Math.floor(baseBuildTime * sizeMultipliers.buildTimeMultiplier))
  return Math.max(1, Math.floor(buildTimeTurns * (1 - corpLevel * 0.05)))
}

// ─── Main Creation Function ───────────────────────────────────────────────────

/**
 * Creates a new contract after validating all inputs.
 *
 * @param params - All data needed to validate and construct the contract
 * @returns Success with the new Contract, or failure with a validation error
 */
export function createContract(params: CreateContractParams): ContractCreationResult {
  // 1. Look up the corporation
  const corp = params.corporations.get(params.assignedCorpId)
  if (!corp) {
    return {
      success: false,
      error: 'CORP_NOT_FOUND',
      message: `Corporation "${params.assignedCorpId}" not found.`,
    }
  }

  // 2. Validate target type + entity existence + entity state
  const targetError = validateTarget(params)
  if (targetError) {
    return {
      success: false,
      error: targetError,
      message: `Target validation failed: ${targetError}`,
    }
  }

  // 3. Validate corp eligibility
  if (!isCorpEligible(corp, params.type)) {
    return {
      success: false,
      error: 'CORP_NOT_ELIGIBLE',
      message: `Corporation "${corp.name}" (${corp.type}, level ${corp.level}) is not eligible for ${params.type} contracts.`,
    }
  }

  // 4. Calculate costs and duration
  const bpPerTurn = calculateBpPerTurn(params, corp)
  const duration = calculateDuration(params, corp)

  // 5. Build the Contract object
  // Note: No BP affordability check — deficit spending is intentional per Specs.
  // Debt tokens accumulate when the empire runs a deficit at end of turn (Story 12.x).
  const contract: Contract = {
    id: generateContractId(),
    type: params.type,
    status: ContractStatus.Active,
    target: params.target,
    assignedCorpId: params.assignedCorpId,
    bpPerTurn,
    durationTurns: duration,
    turnsRemaining: duration,
    startTurn: params.currentTurn,
    completedTurn: null,
    colonizationParams: params.colonizationParams,
    shipCommissionParams: params.shipCommissionParams,
  }

  return { success: true, contract }
}
