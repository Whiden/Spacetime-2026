/**
 * contract-phase.ts — Contract advancement during turn resolution.
 *
 * Pure engine function. Iterates all active contracts, decrements turnsRemaining,
 * and handles completion effects by contract type.
 *
 * Completion effects:
 * - Exploration: stub — POI generation deferred to Epic 13
 * - GroundSurvey: updates planet status to GroundSurveyed
 * - Colonization: generates a new colony via colony-generator
 * - ShipCommission: stub — ship generation deferred to Epic 15
 * - TradeRoute: ongoing (sentinel 9999) — never auto-completes
 *
 * TODO (Story 7.4): ContractWizard.vue drives createNewContract() from UI.
 * TODO (Story 13.1): resolveExplorationCompletion() generates POIs from sector scan.
 * TODO (Story 15.2): resolveShipCommissionCompletion() builds ship with stat generator.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { GameEvent } from '../../types/event'
import type { Contract } from '../../types/contract'
import { ContractStatus, ContractType, EventPriority, PlanetStatus } from '../../types/common'
import type { TurnNumber } from '../../types/common'
import { generateColony } from '../../generators/colony-generator'
import { generateEventId } from '../../utils/id'

// ─── Phase Entry Point ───────────────────────────────────────────────────────

/**
 * Advances all active contracts by one turn.
 *
 * For each active contract:
 * 1. Decrements turnsRemaining
 * 2. If turnsRemaining reaches 0, triggers completion effects and generates a completion event
 *
 * TradeRoute contracts use sentinel value 9999 and are never auto-completed here.
 * They are cancelled explicitly by the player (Story 17.1).
 *
 * @param state - Full GameState at start of turn resolution
 * @returns updatedState with modified contracts/colonies/planets, and completion events
 */
export function resolveContractPhase(state: GameState): PhaseResult {
  const events: GameEvent[] = []

  // Deep-copy mutable maps we may modify
  const updatedContracts = new Map(state.contracts)
  const updatedColonies = new Map(state.colonies)
  const updatedPlanets = new Map(state.planets)

  for (const [id, contract] of updatedContracts) {
    if (contract.status !== ContractStatus.Active) continue

    // Trade routes are ongoing — never auto-complete
    if (contract.type === ContractType.TradeRoute) continue

    const advanced: Contract = {
      ...contract,
      turnsRemaining: Math.max(0, contract.turnsRemaining - 1),
    }

    if (advanced.turnsRemaining === 0) {
      // Mark completed
      const completed: Contract = {
        ...advanced,
        status: ContractStatus.Completed,
        completedTurn: state.turn,
      }
      updatedContracts.set(id, completed)

      // Apply completion effects
      applyCompletionEffects(completed, state, updatedColonies, updatedPlanets)

      // Generate completion event
      events.push(buildCompletionEvent(completed, state.turn))
    } else {
      updatedContracts.set(id, advanced)
    }
  }

  return {
    updatedState: {
      ...state,
      contracts: updatedContracts,
      colonies: updatedColonies,
      planets: updatedPlanets,
    },
    events,
  }
}

// ─── Completion Effects ───────────────────────────────────────────────────────

/**
 * Applies the side effects of a contract completing, by contract type.
 * Mutates the provided updatedColonies and updatedPlanets maps in place.
 */
function applyCompletionEffects(
  contract: Contract,
  state: GameState,
  updatedColonies: Map<string, import('../../types/colony').Colony>,
  updatedPlanets: Map<string, import('../../types/planet').Planet>,
): void {
  switch (contract.type) {
    case ContractType.Exploration:
      // TODO (Story 13.1): Generate POIs from sector scan data.
      break

    case ContractType.GroundSurvey:
      resolveGroundSurveyCompletion(contract, updatedPlanets)
      break

    case ContractType.Colonization:
      resolveColonizationCompletion(contract, state, updatedColonies, updatedPlanets)
      break

    case ContractType.ShipCommission:
      // TODO (Story 15.2): Generate ship using ship stat generator with role, variant,
      // corp schematics, and empire tech bonuses.
      break

    case ContractType.TradeRoute:
      // Never reaches here — trade routes are filtered out above.
      break
  }
}

/**
 * Ground survey completion: advances planet status to GroundSurveyed.
 * Only applies if the target planet is still at OrbitScanned status.
 */
function resolveGroundSurveyCompletion(
  contract: Contract,
  updatedPlanets: Map<string, import('../../types/planet').Planet>,
): void {
  if (contract.target.type !== 'planet') return

  const planet = updatedPlanets.get(contract.target.planetId)
  if (!planet) return

  if (planet.status === PlanetStatus.OrbitScanned) {
    updatedPlanets.set(planet.id, {
      ...planet,
      status: PlanetStatus.GroundSurveyed,
      groundSurveyTurn: contract.completedTurn ?? null,
    })
  }
}

/**
 * Colonization completion: generates a new colony via colony-generator and
 * updates the target planet status to Colonized.
 */
function resolveColonizationCompletion(
  contract: Contract,
  state: GameState,
  updatedColonies: Map<string, import('../../types/colony').Colony>,
  updatedPlanets: Map<string, import('../../types/planet').Planet>,
): void {
  if (contract.target.type !== 'planet') return
  if (!contract.colonizationParams) return

  const planet = updatedPlanets.get(contract.target.planetId)
  if (!planet) return

  // Generate the new colony
  const colony = generateColony({
    planet,
    colonyType: contract.colonizationParams.colonyType,
    foundedTurn: contract.completedTurn ?? (state.turn as TurnNumber),
  })

  updatedColonies.set(colony.id, colony)

  // Mark planet as Colonized
  updatedPlanets.set(planet.id, {
    ...planet,
    status: PlanetStatus.Colonized,
  })
}

// ─── Event Builder ────────────────────────────────────────────────────────────

/** Human-readable labels for contract types used in event messages. */
const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  [ContractType.Exploration]: 'Exploration',
  [ContractType.GroundSurvey]: 'Ground Survey',
  [ContractType.Colonization]: 'Colonization',
  [ContractType.ShipCommission]: 'Ship Commission',
  [ContractType.TradeRoute]: 'Trade Route',
}

/**
 * Builds a Positive-priority completion event for a newly completed contract.
 */
function buildCompletionEvent(contract: Contract, turn: TurnNumber): GameEvent {
  const typeLabel = CONTRACT_TYPE_LABELS[contract.type as ContractType] ?? contract.type
  const targetDesc = describeTarget(contract)

  return {
    id: generateEventId(),
    turn,
    priority: EventPriority.Positive,
    category: 'contract',
    title: `${typeLabel} Contract Completed`,
    description: targetDesc
      ? `${typeLabel} contract on ${targetDesc} has been completed.`
      : `${typeLabel} contract has been completed.`,
    relatedEntityIds: [contract.id, contract.assignedCorpId],
    dismissed: false,
  }
}

/**
 * Returns a short human-readable description of the contract's target.
 */
function describeTarget(contract: Contract): string {
  switch (contract.target.type) {
    case 'sector':
      return `sector ${contract.target.sectorId}`
    case 'planet':
      return `planet ${contract.target.planetId}`
    case 'colony':
      return `colony ${contract.target.colonyId}`
    case 'sector_pair':
      return `sectors ${contract.target.sectorIdA} / ${contract.target.sectorIdB}`
    default:
      return ''
  }
}
