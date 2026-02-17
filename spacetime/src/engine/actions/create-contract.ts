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
import { ContractType, ContractStatus } from '../../types/common'
import type { Contract, ContractTarget, ColonizationParams, ShipCommissionParams } from '../../types/contract'
import type { Corporation } from '../../types/corporation'
import type { Colony } from '../../types/colony'
import type { Planet } from '../../types/planet'
import type { Sector } from '../../types/sector'
import { PlanetStatus } from '../../types/common'
import { CONTRACT_TYPE_DEFINITIONS, calculateExplorationDuration } from '../../data/contracts'
import { COLONY_TYPE_DEFINITIONS } from '../../data/colony-types'
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
  | 'INSUFFICIENT_BP'               // Player doesn't have enough BP for first turn
  | 'INVALID_PLANET_STATUS'         // Colonization target must be Accepted or GroundSurveyed
  | 'SECTORS_NOT_ADJACENT'          // Trade route sectors must be adjacent
  | 'CORP_NOT_FOUND'                // Corp ID not in provided corps map
  | 'TARGET_NOT_FOUND'              // Target entity not found
  | 'MISSING_COLONY_TYPE'           // Colonization requires colonyType param
  | 'MISSING_SHIP_PARAMS'           // Ship commission requires role + sizeVariant

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
  currentBP: BPAmount
  /** All available sectors, keyed by ID — used for existence checks. */
  sectors: Map<string, Sector>
  /**
   * Adjacency map from Galaxy: sectorId → array of adjacent sector IDs.
   * Used for trade route adjacency validation.
   */
  sectorAdjacency: Map<string, string[]>
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
      if (!params.colonies.has(target.colonyId)) return 'TARGET_NOT_FOUND'
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
 * Ship commission cost will be by ship size (deferred to Story 15.2).
 */
function calculateBpPerTurn(params: CreateContractParams): BPAmount {
  switch (params.type) {
    case ContractType.Colonization:
      if (params.colonizationParams) {
        const colonyDef = COLONY_TYPE_DEFINITIONS[params.colonizationParams.colonyType]
        return colonyDef.bpPerTurn as BPAmount
      }
      break

    case ContractType.ShipCommission:
      // TODO (Story 15.2): Ship commission cost calculated from role + size variant.
      // For now, use base definition cost as placeholder.
      return CONTRACT_TYPE_DEFINITIONS[params.type].baseBpPerTurn as BPAmount
  }

  return CONTRACT_TYPE_DEFINITIONS[params.type].baseBpPerTurn as BPAmount
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
      // TODO (Story 15.2): Ship build time calculated from role base + size variant.
      // For now, use base definition as placeholder.
      return CONTRACT_TYPE_DEFINITIONS[params.type].baseDurationTurns as number
  }

  const base = CONTRACT_TYPE_DEFINITIONS[params.type].baseDurationTurns
  if (typeof base === 'number') return base
  return 3 // Fallback for any 'by_type' entries not handled above
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
  const bpPerTurn = calculateBpPerTurn(params)
  const duration = calculateDuration(params, corp)

  // 5. Validate player has sufficient BP for at least the first turn
  if (params.currentBP < bpPerTurn) {
    return {
      success: false,
      error: 'INSUFFICIENT_BP',
      message: `Insufficient BP: need ${bpPerTurn} BP/turn but only have ${params.currentBP} BP.`,
    }
  }

  // 6. Build the Contract object
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
