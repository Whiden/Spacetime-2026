/**
 * contract-phase.ts — Contract advancement during turn resolution.
 *
 * Pure engine function. Iterates all active contracts, decrements turnsRemaining,
 * and handles completion effects by contract type.
 *
 * Completion effects:
 * - Exploration: stub — POI generation deferred to Epic 13
 * - GroundSurvey: updates planet status to GroundSurveyed
 * - Colonization: generates a new colony via colony-generator, links corp
 * - ShipCommission: stub — ship generation deferred to Epic 15
 * - TradeRoute: ongoing (sentinel 9999) — never auto-completes
 *
 * On any contract completion, the assigned corporation receives a capital bonus:
 *   completion_bonus = floor((bp_per_turn × duration) / 5)
 * (See Specs.md § 3 Contract Completion Bonus and § 4 Contract System)
 *
 * TODO (Story 7.4): ContractWizard.vue drives createNewContract() from UI.
 * TODO (Story 13.1): resolveExplorationCompletion() generates POIs from sector scan.
 * TODO (Story 15.2): resolveShipCommissionCompletion() builds ship with stat generator.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { GameEvent } from '../../types/event'
import type { Contract } from '../../types/contract'
import type { Colony } from '../../types/colony'
import type { Planet } from '../../types/planet'
import type { Corporation } from '../../types/corporation'
import { ContractStatus, ContractType, EventPriority, PlanetStatus } from '../../types/common'
import type { TurnNumber, CorpId, PlanetId } from '../../types/common'
import { generateColony } from '../../generators/colony-generator'
import { generateEventId } from '../../utils/id'
import { calculateCompletionBonus } from '../formulas/growth'

// ─── Phase Entry Point ───────────────────────────────────────────────────────

/**
 * Advances all active contracts by one turn.
 *
 * For each active contract:
 * 1. Decrements turnsRemaining
 * 2. If turnsRemaining reaches 0, triggers completion effects, awards the
 *    completion capital bonus to the assigned corp, and generates a completion event
 *
 * TradeRoute contracts use sentinel value 9999 and are never auto-completed here.
 * They are cancelled explicitly by the player (Story 17.1).
 *
 * @param state - Full GameState at start of turn resolution
 * @returns updatedState with modified contracts/colonies/planets/corporations, and completion events
 */
export function resolveContractPhase(state: GameState): PhaseResult {
  const events: GameEvent[] = []

  // Deep-copy mutable maps we may modify
  const updatedContracts = new Map(state.contracts)
  const updatedColonies = new Map(state.colonies)
  const updatedPlanets = new Map(state.planets)
  const updatedCorporations = new Map(state.corporations)

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

      // Apply completion effects (colony creation, planet status, corp presence)
      applyCompletionEffects(completed, state, updatedColonies, updatedPlanets, updatedCorporations)

      // Award capital bonus to the assigned corporation (Specs.md § 3 & § 4)
      rewardCompletionBonus(completed, updatedCorporations)

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
      corporations: updatedCorporations,
    },
    events,
  }
}

// ─── Completion Effects ───────────────────────────────────────────────────────

/**
 * Applies the side effects of a contract completing, by contract type.
 * Mutates the provided maps in place.
 */
function applyCompletionEffects(
  contract: Contract,
  state: GameState,
  updatedColonies: Map<string, Colony>,
  updatedPlanets: Map<string, Planet>,
  updatedCorporations: Map<string, Corporation>,
): void {
  switch (contract.type) {
    case ContractType.Exploration:
      // TODO (Story 13.1): Generate POIs from sector scan data.
      break

    case ContractType.GroundSurvey:
      resolveGroundSurveyCompletion(contract, updatedPlanets)
      break

    case ContractType.Colonization:
      resolveColonizationCompletion(contract, state, updatedColonies, updatedPlanets, updatedCorporations)
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
  updatedPlanets: Map<string, Planet>,
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
 * Colonization completion: generates a new colony via colony-generator,
 * updates the target planet status to Colonized, and links the assigned
 * corporation to the new colony (corporationsPresent) and its own planetsPresent.
 */
function resolveColonizationCompletion(
  contract: Contract,
  state: GameState,
  updatedColonies: Map<string, Colony>,
  updatedPlanets: Map<string, Planet>,
  updatedCorporations: Map<string, Corporation>,
): void {
  if (contract.target.type !== 'planet') return
  if (!contract.colonizationParams) return

  const planet = updatedPlanets.get(contract.target.planetId)
  if (!planet) return

  // Generate the new colony, with the assigned corp listed as present
  const baseColony = generateColony({
    planet,
    colonyType: contract.colonizationParams.colonyType,
    foundedTurn: contract.completedTurn ?? (state.turn as TurnNumber),
  })

  const colony: Colony = {
    ...baseColony,
    corporationsPresent: [contract.assignedCorpId as CorpId],
  }

  updatedColonies.set(colony.id, colony)

  // Mark planet as Colonized
  updatedPlanets.set(planet.id, {
    ...planet,
    status: PlanetStatus.Colonized,
  })

  // Update the assigned corp's planetsPresent
  const corp = updatedCorporations.get(contract.assignedCorpId)
  if (corp && !corp.planetsPresent.includes(planet.id as PlanetId)) {
    updatedCorporations.set(corp.id, {
      ...corp,
      planetsPresent: [...corp.planetsPresent, planet.id as PlanetId],
    })
  }
}

// ─── Completion Bonus ─────────────────────────────────────────────────────────

/**
 * Awards the contract completion capital bonus to the assigned corporation.
 *
 * Formula (Specs.md § 3 & § 4):
 *   completion_bonus = floor((bp_per_turn × duration) / 5)
 *
 * @param contract - The just-completed contract
 * @param updatedCorporations - The mutable corporations map to update in place
 */
function rewardCompletionBonus(
  contract: Contract,
  updatedCorporations: Map<string, Corporation>,
): void {
  const corp = updatedCorporations.get(contract.assignedCorpId)
  if (!corp) return

  const bonus = calculateCompletionBonus(contract.bpPerTurn, contract.durationTurns)
  if (bonus <= 0) return

  updatedCorporations.set(corp.id, {
    ...corp,
    capital: corp.capital + bonus,
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
