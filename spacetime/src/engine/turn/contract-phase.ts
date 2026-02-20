/**
 * contract-phase.ts — Contract advancement during turn resolution.
 *
 * Pure engine function. Iterates all active contracts, decrements turnsRemaining,
 * and handles completion effects by contract type.
 *
 * Completion effects:
 * - Exploration: adds exploration gain to sector, generates POI planets (OrbitScanned),
 *   applies orbit scan based on corp level, generates discovery events per planet
 * - GroundSurvey: updates planet status to GroundSurveyed
 * - Colonization: generates a new colony via colony-generator, links corp
 * - ShipCommission: generates ship via designBlueprint, adds to ships map with Stationed status
 * - TradeRoute: ongoing (sentinel 9999) — never auto-completes
 *
 * On any contract completion, the assigned corporation receives a capital bonus:
 *   completion_bonus = floor((bp_per_turn × duration) / 5)
 * (See Specs.md § 3 Contract Completion Bonus and § 4 Contract System)
 *
 * TODO (Story 7.4): ContractWizard.vue drives createNewContract() from UI.
 * TODO (Story 15.3): Captain generator replaces the placeholder captain in designBlueprint.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { GameEvent } from '../../types/event'
import type { Contract } from '../../types/contract'
import type { Colony } from '../../types/colony'
import type { Planet } from '../../types/planet'
import type { Corporation } from '../../types/corporation'
import type { Ship } from '../../types/ship'
import { ContractStatus, ContractType, EventPriority, PlanetStatus, ShipStatus } from '../../types/common'
import type { TurnNumber, CorpId, PlanetId, SectorId } from '../../types/common'
import { generateColony } from '../../generators/colony-generator'
import { generatePlanet } from '../../generators/planet-generator'
import { generateEventId, generateShipId } from '../../utils/id'
import { calculateCompletionBonus } from '../formulas/growth'
import { calculateExplorationGain, calculatePOICount, generateOrbitScan } from '../formulas/exploration'
import { designBlueprint } from '../actions/design-blueprint'
import type { Sector } from '../../types/sector'

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
  const updatedSectors = new Map(state.galaxy.sectors)
  const updatedShips = new Map(state.ships)

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

      // Apply completion effects (colony creation, planet status, corp presence, ship build)
      applyCompletionEffects(completed, state, updatedColonies, updatedPlanets, updatedCorporations, updatedSectors, updatedShips, events)

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
      galaxy: {
        ...state.galaxy,
        sectors: updatedSectors,
      },
      contracts: updatedContracts,
      colonies: updatedColonies,
      planets: updatedPlanets,
      corporations: updatedCorporations,
      ships: updatedShips,
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
  updatedSectors: Map<string, Sector>,
  updatedShips: Map<string, Ship>,
  events: GameEvent[],
): void {
  switch (contract.type) {
    case ContractType.Exploration:
      resolveExplorationCompletion(contract, state, updatedPlanets, updatedSectors, events)
      break

    case ContractType.GroundSurvey:
      resolveGroundSurveyCompletion(contract, updatedPlanets)
      break

    case ContractType.Colonization:
      resolveColonizationCompletion(contract, state, updatedColonies, updatedPlanets, updatedCorporations)
      break

    case ContractType.ShipCommission:
      resolveShipCommissionCompletion(contract, state, updatedColonies, updatedCorporations, updatedShips, events)
      break

    case ContractType.TradeRoute:
      // Never reaches here — trade routes are filtered out above.
      break
  }
}

/**
 * Exploration contract completion (Story 13.2):
 * 1. Adds exploration gain (random 5-15%) to the target sector, capped at 100.
 * 2. Generates POI count (2-4) new planets in the sector with OrbitScanned status.
 * 3. Applies orbit scan reveal based on the assigned corp's level.
 * 4. Generates one discovery event per planet.
 *
 * Planets are generated fresh via generatePlanet() and added to updatedPlanets.
 */
function resolveExplorationCompletion(
  contract: Contract,
  state: GameState,
  updatedPlanets: Map<string, Planet>,
  updatedSectors: Map<string, Sector>,
  events: GameEvent[],
): void {
  if (contract.target.type !== 'sector') return

  const sectorId = contract.target.sectorId as SectorId
  const sector = updatedSectors.get(sectorId)
  if (!sector) return

  // 1. Add exploration gain, capped at 100
  const gain = calculateExplorationGain()
  const newExplorationPercent = Math.min(100, sector.explorationPercent + gain)
  updatedSectors.set(sectorId, {
    ...sector,
    explorationPercent: newExplorationPercent,
  })

  // 2. Determine assigned corp level for orbit scan quality
  const corp = state.corporations.get(contract.assignedCorpId)
  const corpLevel = corp?.level ?? 1

  // 3. Generate POI planets and add to updatedPlanets
  const poiCount = calculatePOICount()
  const usedNames = new Set<string>([...updatedPlanets.values()].map((p) => p.name))

  for (let i = 0; i < poiCount; i++) {
    const planet = generatePlanet({
      sectorId,
      usedNames,
      initialStatus: PlanetStatus.OrbitScanned,
    })

    // Apply orbit scan reveal (marks features as revealed based on corp level)
    const scanResult = generateOrbitScan(planet, corpLevel)

    // Update feature revealed flags based on scan result
    const revealedSet = new Set(scanResult.revealedOrbitFeatureIds)
    const updatedFeatures = planet.features.map((f) => ({
      ...f,
      revealed: revealedSet.has(f.featureId),
    }))

    const scannedPlanet: Planet = {
      ...planet,
      features: updatedFeatures,
      orbitScanTurn: state.turn,
    }

    updatedPlanets.set(scannedPlanet.id, scannedPlanet)

    // 4. Generate a discovery event for each planet
    events.push({
      id: generateEventId(),
      turn: state.turn,
      priority: EventPriority.Positive,
      category: 'exploration',
      title: 'Planet Discovered',
      description: `${scannedPlanet.name} (${scannedPlanet.type}, ${scannedPlanet.size}) discovered in sector ${sectorId}.`,
      relatedEntityIds: [contract.id, scannedPlanet.id, sectorId],
      dismissed: false,
    })
  }
}

/**
 * Ground survey completion (Story 13.4):
 * - Advances planet status to GroundSurveyed.
 * - Reveals all features (including ground-only ones).
 * - Reveals exact deposit richness for all deposits.
 *
 * Only applies if the target planet is at OrbitScanned status.
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
      // Reveal all features (including ground-only ones not visible from orbit)
      features: planet.features.map((f) => ({ ...f, revealed: true })),
      // Reveal exact richness for all deposits
      deposits: planet.deposits.map((d) => ({ ...d, richnessRevealed: true })),
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

/**
 * Ship commission completion (Story 15.2):
 * 1. Generates a Ship via designBlueprint using the contract's role/variant, the building
 *    corp's schematics, and empire tech bonuses.
 * 2. Sets ship status to Stationed at the colony's sector.
 * 3. Adds the ship to updatedShips.
 * 4. Emits a ship-completed event.
 */
function resolveShipCommissionCompletion(
  contract: Contract,
  state: GameState,
  updatedColonies: Map<string, Colony>,
  updatedCorporations: Map<string, Corporation>,
  updatedShips: Map<string, Ship>,
  events: GameEvent[],
): void {
  if (contract.target.type !== 'colony') return
  if (!contract.shipCommissionParams) return

  const colony = updatedColonies.get(contract.target.colonyId)
  if (!colony) return

  const corp = updatedCorporations.get(contract.assignedCorpId)
  if (!corp) return

  const { role, sizeVariant } = contract.shipCommissionParams
  const corpSchematics = corp.assets.schematics

  const ship = designBlueprint({
    shipId: generateShipId(),
    shipName: `${corp.name} Vessel`,
    role,
    sizeVariant,
    buildingCorp: corp,
    empireBonuses: state.empireBonuses,
    corpSchematics,
    homeSectorId: colony.sectorId,
    builtTurn: contract.completedTurn ?? (state.turn as TurnNumber),
  })

  // Station the completed ship at the colony's sector
  const stationedShip: Ship = {
    ...ship,
    status: ShipStatus.Stationed,
  }

  updatedShips.set(stationedShip.id, stationedShip)

  events.push({
    id: generateEventId(),
    turn: state.turn,
    priority: EventPriority.Positive,
    category: 'fleet',
    title: 'Ship Construction Complete',
    description: `A new ${role} vessel has been commissioned and is now stationed at ${colony.name}.`,
    relatedEntityIds: [contract.id, stationedShip.id, colony.sectorId],
    dismissed: false,
  })
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
