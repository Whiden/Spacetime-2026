/**
 * contract-phase.test.ts — Unit tests for the contract turn resolution phase.
 *
 * Tests cover:
 * - Active contract advances by one turn (turnsRemaining decrements)
 * - Contract with 1 turn remaining completes on resolution
 * - Completed contract is not modified
 * - Trade route (sentinel 9999) is never auto-completed
 * - Completion event is generated with Positive priority and 'contract' category
 * - GroundSurvey completion advances planet status to GroundSurveyed
 * - Colonization completion creates a new colony in updatedState.colonies
 * - Colonization completion marks the planet as Colonized
 * - Multiple contracts advance independently in a single phase
 */

import { describe, it, expect } from 'vitest'
import { resolveContractPhase } from '../../../engine/turn/contract-phase'
import type { GameState } from '../../../types/game'
import type { Contract } from '../../../types/contract'
import type { Planet } from '../../../types/planet'
import {
  ContractStatus,
  ContractType,
  EventPriority,
  ColonyType,
  PlanetStatus,
  SectorDensity,
} from '../../../types/common'
import type {
  ContractId,
  CorpId,
  PlanetId,
  ColonyId,
  SectorId,
  TurnNumber,
  BPAmount,
} from '../../../types/common'
import type { Colony } from '../../../types/colony'

// ─── Test Constants ───────────────────────────────────────────────────────────

const TURN_5 = 5 as TurnNumber
const CORP_ID = 'corp_aaaaaa' as CorpId
const PLANET_ID = 'pln_aaaaaaaa' as PlanetId
const SECTOR_ID = 'sec_aaaaaaaa' as SectorId
const COLONY_ID = 'col_aaaaaaaa' as ColonyId
const CONTRACT_ID = 'ctr_aaaaaaaa' as ContractId

// ─── Test Helpers ─────────────────────────────────────────────────────────────

/** Build a minimal active contract. */
function makeContract(
  id: ContractId,
  type: ContractType,
  turnsRemaining: number,
  overrides: Partial<Contract> = {},
): Contract {
  return {
    id,
    type,
    status: ContractStatus.Active,
    target: { type: 'sector', sectorId: SECTOR_ID },
    assignedCorpId: CORP_ID,
    bpPerTurn: 2 as BPAmount,
    durationTurns: turnsRemaining,
    turnsRemaining,
    startTurn: 1 as TurnNumber,
    completedTurn: null,
    ...overrides,
  }
}

/** Build a minimal planet. */
function makePlanet(id: PlanetId, status: PlanetStatus): Planet {
  return {
    id,
    name: 'Test Planet',
    type: 'Continental' as any,
    size: 'Medium' as any,
    status,
    sectorId: SECTOR_ID,
    baseHabitability: 7,
    deposits: [],
    features: [],
    featureModifiers: [],
    orbitScanTurn: 1 as TurnNumber,
    groundSurveyTurn: null,
  }
}

/** Build a minimal colony. */
function makeColony(id: ColonyId): Colony {
  return {
    id,
    name: 'Test Colony',
    type: ColonyType.FrontierColony,
    planetId: PLANET_ID,
    sectorId: SECTOR_ID,
    populationLevel: 1,
    infrastructure: {} as any,
    attributes: {
      habitability: 5,
      accessibility: 3,
      dynamism: 3,
      qualityOfLife: 8,
      stability: 10,
      growth: 0,
    },
    corporationsPresent: [],
    modifiers: [],
    foundedTurn: TURN_5,
  }
}

/** Build a minimal GameState with the given contracts. */
function makeState(
  contracts: Map<string, Contract>,
  overrides: {
    colonies?: Map<string, Colony>
    planets?: Map<string, Planet>
  } = {},
): GameState {
  return {
    turn: TURN_5,
    phase: 'resolving',
    currentBP: 20 as BPAmount,
    debtTokens: 0,
    budget: {
      incomeSources: [],
      expenseEntries: [],
    } as any,
    empireBonuses: {} as any,
    galaxy: {
      sectors: new Map(),
      adjacency: new Map(),
      startingSectorId: SECTOR_ID,
    } as any,
    colonies: overrides.colonies ?? new Map(),
    planets: overrides.planets ?? new Map(),
    corporations: new Map(),
    contracts,
    ships: new Map(),
    missions: new Map(),
    scienceDomains: new Map(),
    discoveries: new Map(),
    schematics: new Map(),
    patents: new Map(),
    sectorMarkets: new Map(),
    tradeRoutes: [],
    events: [],
    startedAt: '2026-01-01',
    lastSavedAt: '2026-01-01',
  }
}

// ─── Advance Tests ────────────────────────────────────────────────────────────

describe('resolveContractPhase — contract advancement', () => {
  it('decrements turnsRemaining by 1 for an active contract with 3 turns left', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 3)
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState } = resolveContractPhase(state)
    const updated = updatedState.contracts.get(CONTRACT_ID)!

    expect(updated.turnsRemaining).toBe(2)
    expect(updated.status).toBe(ContractStatus.Active)
  })

  it('does not modify a completed contract', () => {
    const contract: Contract = {
      ...makeContract(CONTRACT_ID, ContractType.Exploration, 0),
      status: ContractStatus.Completed,
      completedTurn: 3 as TurnNumber,
    }
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState, events } = resolveContractPhase(state)
    const unchanged = updatedState.contracts.get(CONTRACT_ID)!

    expect(unchanged.status).toBe(ContractStatus.Completed)
    expect(unchanged.completedTurn).toBe(3)
    expect(events).toHaveLength(0)
  })

  it('does not modify a failed contract', () => {
    const contract: Contract = {
      ...makeContract(CONTRACT_ID, ContractType.Exploration, 0),
      status: ContractStatus.Failed,
    }
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState, events } = resolveContractPhase(state)
    const unchanged = updatedState.contracts.get(CONTRACT_ID)!

    expect(unchanged.status).toBe(ContractStatus.Failed)
    expect(events).toHaveLength(0)
  })

  it('never auto-completes a TradeRoute contract (sentinel 9999)', () => {
    const tradeRoute = makeContract(CONTRACT_ID, ContractType.TradeRoute, 9999)
    const state = makeState(new Map([[CONTRACT_ID, tradeRoute]]))

    const { updatedState, events } = resolveContractPhase(state)
    const unchanged = updatedState.contracts.get(CONTRACT_ID)!

    expect(unchanged.status).toBe(ContractStatus.Active)
    expect(unchanged.turnsRemaining).toBe(9999)
    expect(events).toHaveLength(0)
  })

  it('advances multiple active contracts independently', () => {
    const id1 = 'ctr_11111111' as ContractId
    const id2 = 'ctr_22222222' as ContractId
    const id3 = 'ctr_33333333' as ContractId

    const contracts = new Map<string, Contract>([
      [id1, makeContract(id1, ContractType.Exploration, 4)],
      [id2, makeContract(id2, ContractType.Exploration, 2)],
      [id3, makeContract(id3, ContractType.Exploration, 1)],
    ])
    const state = makeState(contracts)

    const { updatedState, events } = resolveContractPhase(state)

    expect(updatedState.contracts.get(id1)!.turnsRemaining).toBe(3)
    expect(updatedState.contracts.get(id1)!.status).toBe(ContractStatus.Active)

    expect(updatedState.contracts.get(id2)!.turnsRemaining).toBe(1)
    expect(updatedState.contracts.get(id2)!.status).toBe(ContractStatus.Active)

    // id3 had 1 turn left → completes
    expect(updatedState.contracts.get(id3)!.status).toBe(ContractStatus.Completed)
    expect(events).toHaveLength(1)
    expect(events[0].relatedEntityIds).toContain(id3)
  })
})

// ─── Completion Tests ─────────────────────────────────────────────────────────

describe('resolveContractPhase — contract completion', () => {
  it('marks a contract as Completed when turnsRemaining reaches 0', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 1)
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState } = resolveContractPhase(state)
    const completed = updatedState.contracts.get(CONTRACT_ID)!

    expect(completed.status).toBe(ContractStatus.Completed)
    expect(completed.turnsRemaining).toBe(0)
    expect(completed.completedTurn).toBe(TURN_5)
  })

  it('generates a Positive-priority contract event on completion', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 1)
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { events } = resolveContractPhase(state)

    expect(events).toHaveLength(1)
    const event = events[0]
    expect(event.priority).toBe(EventPriority.Positive)
    expect(event.category).toBe('contract')
    expect(event.turn).toBe(TURN_5)
    expect(event.dismissed).toBe(false)
    expect(event.id).toMatch(/^evt_/)
    expect(event.relatedEntityIds).toContain(CONTRACT_ID)
    expect(event.relatedEntityIds).toContain(CORP_ID)
  })

  it('generates one event per completing contract (not per active)', () => {
    const id1 = 'ctr_11111111' as ContractId
    const id2 = 'ctr_22222222' as ContractId

    const contracts = new Map<string, Contract>([
      [id1, makeContract(id1, ContractType.Exploration, 1)], // will complete
      [id2, makeContract(id2, ContractType.Exploration, 3)], // still active
    ])
    const state = makeState(contracts)

    const { events } = resolveContractPhase(state)

    expect(events).toHaveLength(1)
    expect(events[0].relatedEntityIds).toContain(id1)
  })

  it('does not generate events when no contracts complete', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 4)
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { events } = resolveContractPhase(state)

    expect(events).toHaveLength(0)
  })
})

// ─── GroundSurvey Completion Tests ───────────────────────────────────────────

describe('resolveContractPhase — GroundSurvey completion', () => {
  it('advances planet status from OrbitScanned to GroundSurveyed on completion', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.GroundSurvey, 1, {
      target: { type: 'planet', planetId: PLANET_ID },
    })
    const planet = makePlanet(PLANET_ID, PlanetStatus.OrbitScanned)
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { planets: new Map([[PLANET_ID, planet]]) },
    )

    const { updatedState } = resolveContractPhase(state)
    const updatedPlanet = updatedState.planets.get(PLANET_ID)!

    expect(updatedPlanet.status).toBe(PlanetStatus.GroundSurveyed)
    expect(updatedPlanet.groundSurveyTurn).toBe(TURN_5)
  })

  it('does not change planet status if planet is already past OrbitScanned', () => {
    // If a planet is somehow already Accepted, survey completion doesn't downgrade it
    const contract = makeContract(CONTRACT_ID, ContractType.GroundSurvey, 1, {
      target: { type: 'planet', planetId: PLANET_ID },
    })
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { planets: new Map([[PLANET_ID, planet]]) },
    )

    const { updatedState } = resolveContractPhase(state)
    const updatedPlanet = updatedState.planets.get(PLANET_ID)!

    // Status unchanged — only OrbitScanned gets promoted
    expect(updatedPlanet.status).toBe(PlanetStatus.Accepted)
  })
})

// ─── Colonization Completion Tests ────────────────────────────────────────────

describe('resolveContractPhase — Colonization completion', () => {
  it('creates a new colony in updatedState.colonies on completion', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Colonization, 1, {
      target: { type: 'planet', planetId: PLANET_ID },
      colonizationParams: { colonyType: ColonyType.FrontierColony },
    })
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { planets: new Map([[PLANET_ID, planet]]) },
    )

    const { updatedState } = resolveContractPhase(state)

    // A new colony should have been added
    expect(updatedState.colonies.size).toBe(1)
    const [colony] = [...updatedState.colonies.values()]
    expect(colony.id).toMatch(/^col_/)
    expect(colony.type).toBe(ColonyType.FrontierColony)
    expect(colony.planetId).toBe(PLANET_ID)
    expect(colony.foundedTurn).toBe(TURN_5)
  })

  it('marks the target planet as Colonized on completion', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Colonization, 1, {
      target: { type: 'planet', planetId: PLANET_ID },
      colonizationParams: { colonyType: ColonyType.MiningOutpost },
    })
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { planets: new Map([[PLANET_ID, planet]]) },
    )

    const { updatedState } = resolveContractPhase(state)
    const updatedPlanet = updatedState.planets.get(PLANET_ID)!

    expect(updatedPlanet.status).toBe(PlanetStatus.Colonized)
  })

  it('generates a completion event for the colonization contract', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Colonization, 1, {
      target: { type: 'planet', planetId: PLANET_ID },
      colonizationParams: { colonyType: ColonyType.FrontierColony },
    })
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { planets: new Map([[PLANET_ID, planet]]) },
    )

    const { events } = resolveContractPhase(state)

    expect(events).toHaveLength(1)
    expect(events[0].category).toBe('contract')
    expect(events[0].priority).toBe(EventPriority.Positive)
    expect(events[0].title).toContain('Colonization')
  })

  it('does not affect existing colonies in the state', () => {
    const existingColony = makeColony(COLONY_ID)
    const contract = makeContract(CONTRACT_ID, ContractType.Colonization, 1, {
      target: { type: 'planet', planetId: PLANET_ID },
      colonizationParams: { colonyType: ColonyType.FrontierColony },
    })
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      {
        colonies: new Map([[COLONY_ID, existingColony]]),
        planets: new Map([[PLANET_ID, planet]]),
      },
    )

    const { updatedState } = resolveContractPhase(state)

    // Original colony still present, one new colony added
    expect(updatedState.colonies.size).toBe(2)
    expect(updatedState.colonies.get(COLONY_ID)).toBeDefined()
  })
})

// ─── Immutability Tests ───────────────────────────────────────────────────────

describe('resolveContractPhase — immutability', () => {
  it('does not mutate the original state contracts map', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 3)
    const originalContracts = new Map([[CONTRACT_ID, contract]])
    const state = makeState(originalContracts)

    resolveContractPhase(state)

    // Original contract should still have turnsRemaining = 3
    expect(state.contracts.get(CONTRACT_ID)!.turnsRemaining).toBe(3)
  })

  it('returns a different contracts map instance from the original', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 3)
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState } = resolveContractPhase(state)

    expect(updatedState.contracts).not.toBe(state.contracts)
  })
})
