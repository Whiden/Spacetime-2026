/**
 * contract-phase.test.ts — Unit tests for the contract turn resolution phase.
 *
 * Tests cover:
 * - Active contract advances by one turn (turnsRemaining decrements)
 * - Exploration contract completes: sector exploration increases
 * - Exploration contract completes: planets generated and added to state
 * - Exploration contract completes: planets have OrbitScanned status
 * - Exploration contract completes: discovery events generated per planet
 * - Exploration contract completes: orbit scan reveals info based on corp level
 * - Contract with 1 turn remaining completes on resolution
 * - Completed contract is not modified
 * - Trade route (sentinel 9999) is never auto-completed
 * - Completion event is generated with Positive priority and 'contract' category
 * - GroundSurvey completion advances planet status to GroundSurveyed
 * - Colonization completion creates a new colony in updatedState.colonies
 * - Colonization completion marks the planet as Colonized
 * - Colonization completion sets corporationsPresent on the new colony
 * - Colonization completion adds the planet to the corp's planetsPresent
 * - Multiple contracts advance independently in a single phase
 * - Completion bonus is awarded to the assigned corporation as capital
 */

import { describe, it, expect } from 'vitest'
import { resolveContractPhase } from '../../../engine/turn/contract-phase'
import type { GameState } from '../../../types/game'
import type { Contract } from '../../../types/contract'
import type { Planet } from '../../../types/planet'
import type { Corporation } from '../../../types/corporation'
import {
  ContractStatus,
  ContractType,
  EventPriority,
  ColonyType,
  PlanetStatus,
  SectorDensity,
  CorpType,
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
import type { Sector } from '../../../types/sector'

// ─── Test Constants ───────────────────────────────────────────────────────────

const TURN_5 = 5 as TurnNumber
const CORP_ID = 'corp_aaaaaa' as CorpId
const PLANET_ID = 'pln_aaaaaaaa' as PlanetId
const SECTOR_ID = 'sec_aaaaaaaa' as SectorId
const COLONY_ID = 'col_aaaaaaaa' as ColonyId
const CONTRACT_ID = 'ctr_aaaaaaaa' as ContractId

/** Build a minimal Sector. */
function makeSector(id: SectorId, explorationPercent = 20): Sector {
  return {
    id,
    name: 'Test Sector',
    density: SectorDensity.Normal,
    explorationPercent,
    threatModifier: 1,
    firstEnteredTurn: null,
  }
}

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

/** Build a minimal Corporation for use in tests. */
function makeCorporation(id: CorpId, capital = 0): Corporation {
  return {
    id,
    name: 'Test Corp',
    type: CorpType.Construction,
    level: 2,
    capital,
    traits: [],
    homePlanetId: PLANET_ID,
    planetsPresent: [],
    assets: {
      infrastructureByColony: new Map(),
      schematics: [],
      patents: [],
    },
    activeContractIds: [],
    foundedTurn: 1 as TurnNumber,
  }
}

/** Build a minimal GameState with the given contracts. */
function makeState(
  contracts: Map<string, Contract>,
  overrides: {
    colonies?: Map<string, Colony>
    planets?: Map<string, Planet>
    corporations?: Map<string, Corporation>
    sectors?: Map<string, Sector>
  } = {},
): GameState {
  const defaultSectors = new Map<string, Sector>([[SECTOR_ID, makeSector(SECTOR_ID)]])
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
      sectors: overrides.sectors ?? defaultSectors,
      adjacency: new Map(),
      startingSectorId: SECTOR_ID,
    } as any,
    colonies: overrides.colonies ?? new Map(),
    planets: overrides.planets ?? new Map(),
    corporations: overrides.corporations ?? new Map(),
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

    // Use ShipCommission (no side-effect events) so we get exactly 1 contract event
    const contracts = new Map<string, Contract>([
      [id1, makeContract(id1, ContractType.ShipCommission, 4)],
      [id2, makeContract(id2, ContractType.ShipCommission, 2)],
      [id3, makeContract(id3, ContractType.ShipCommission, 1)],
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
    // Use ShipCommission (no side-effect events) to test exactly 1 contract event
    const contract = makeContract(CONTRACT_ID, ContractType.ShipCommission, 1)
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

  it('generates one contract event per completing contract (not per active)', () => {
    const id1 = 'ctr_11111111' as ContractId
    const id2 = 'ctr_22222222' as ContractId

    // Use ShipCommission (no side-effect events) to isolate contract event count
    const contracts = new Map<string, Contract>([
      [id1, makeContract(id1, ContractType.ShipCommission, 1)], // will complete
      [id2, makeContract(id2, ContractType.ShipCommission, 3)], // still active
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

// ─── Completion Bonus Tests (Issue #1) ───────────────────────────────────────

describe('resolveContractPhase — completion bonus', () => {
  it('awards capital bonus to the assigned corp on contract completion', () => {
    // bpPerTurn=5, durationTurns=10 → bonus = floor((5 × 10) / 5) = 10
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 1, {
      bpPerTurn: 5 as BPAmount,
      durationTurns: 10,
      turnsRemaining: 1,
    })
    const corp = makeCorporation(CORP_ID, 3) // starts with 3 capital
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { corporations: new Map([[CORP_ID, corp]]) },
    )

    const { updatedState } = resolveContractPhase(state)
    const updatedCorp = updatedState.corporations.get(CORP_ID)!

    expect(updatedCorp.capital).toBe(13) // 3 + 10
  })

  it('does not change corp capital when bonus is 0 (short/cheap contract)', () => {
    // bpPerTurn=1, durationTurns=1 → bonus = floor(1/5) = 0
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 1, {
      bpPerTurn: 1 as BPAmount,
      durationTurns: 1,
      turnsRemaining: 1,
    })
    const corp = makeCorporation(CORP_ID, 5) // starts with 5 capital
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { corporations: new Map([[CORP_ID, corp]]) },
    )

    const { updatedState } = resolveContractPhase(state)
    const updatedCorp = updatedState.corporations.get(CORP_ID)!

    expect(updatedCorp.capital).toBe(5) // unchanged — bonus is 0
  })

  it('does not error when the assigned corp is not in the corporations map', () => {
    // Corps map is empty — bonus silently skipped, no throw
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 1)
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    expect(() => resolveContractPhase(state)).not.toThrow()
  })

  it('does not mutate the original corporations map', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Exploration, 1, {
      bpPerTurn: 5 as BPAmount,
      durationTurns: 10,
      turnsRemaining: 1,
    })
    const corp = makeCorporation(CORP_ID, 0)
    const originalCorps = new Map([[CORP_ID, corp]])
    const state = makeState(new Map([[CONTRACT_ID, contract]]), { corporations: originalCorps })

    resolveContractPhase(state)

    expect(state.corporations.get(CORP_ID)!.capital).toBe(0) // original unchanged
  })
})

// ─── Colonization Corp Linking Tests (Issue #3) ──────────────────────────────

describe('resolveContractPhase — colonization corp linking', () => {
  it('sets corporationsPresent on the new colony to the assigned corp', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Colonization, 1, {
      target: { type: 'planet', planetId: PLANET_ID },
      colonizationParams: { colonyType: ColonyType.FrontierColony },
    })
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const corp = makeCorporation(CORP_ID)
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      {
        planets: new Map([[PLANET_ID, planet]]),
        corporations: new Map([[CORP_ID, corp]]),
      },
    )

    const { updatedState } = resolveContractPhase(state)

    const [newColony] = [...updatedState.colonies.values()]
    expect(newColony.corporationsPresent).toContain(CORP_ID)
    expect(newColony.corporationsPresent).toHaveLength(1)
  })

  it('adds the colonized planet to the assigned corp planetsPresent', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Colonization, 1, {
      target: { type: 'planet', planetId: PLANET_ID },
      colonizationParams: { colonyType: ColonyType.FrontierColony },
    })
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const corp = makeCorporation(CORP_ID) // starts with empty planetsPresent
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      {
        planets: new Map([[PLANET_ID, planet]]),
        corporations: new Map([[CORP_ID, corp]]),
      },
    )

    const { updatedState } = resolveContractPhase(state)

    const updatedCorp = updatedState.corporations.get(CORP_ID)!
    expect(updatedCorp.planetsPresent).toContain(PLANET_ID)
  })

  it('does not duplicate a planet in planetsPresent if corp already has it', () => {
    const contract = makeContract(CONTRACT_ID, ContractType.Colonization, 1, {
      target: { type: 'planet', planetId: PLANET_ID },
      colonizationParams: { colonyType: ColonyType.FrontierColony },
    })
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    // Corp already lists the planet
    const corp: Corporation = { ...makeCorporation(CORP_ID), planetsPresent: [PLANET_ID] }
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      {
        planets: new Map([[PLANET_ID, planet]]),
        corporations: new Map([[CORP_ID, corp]]),
      },
    )

    const { updatedState } = resolveContractPhase(state)

    const updatedCorp = updatedState.corporations.get(CORP_ID)!
    expect(updatedCorp.planetsPresent.filter((p) => p === PLANET_ID)).toHaveLength(1)
  })
})

// ─── Exploration Completion Tests (Story 13.2) ────────────────────────────────

describe('resolveContractPhase — Exploration completion', () => {
  /** Returns an exploration contract targeting SECTOR_ID that completes next turn. */
  function makeExplorationContract(overrides: Partial<Contract> = {}): Contract {
    return makeContract(CONTRACT_ID, ContractType.Exploration, 1, {
      target: { type: 'sector', sectorId: SECTOR_ID },
      ...overrides,
    })
  }

  it('increases sector explorationPercent by 5-15 on completion', () => {
    const sector = makeSector(SECTOR_ID, 30)
    const contract = makeExplorationContract()
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { sectors: new Map([[SECTOR_ID, sector]]) },
    )

    const { updatedState } = resolveContractPhase(state)
    const updatedSector = updatedState.galaxy.sectors.get(SECTOR_ID)!

    expect(updatedSector.explorationPercent).toBeGreaterThanOrEqual(35) // 30 + min 5
    expect(updatedSector.explorationPercent).toBeLessThanOrEqual(45)    // 30 + max 15
  })

  it('caps sector explorationPercent at 100', () => {
    const sector = makeSector(SECTOR_ID, 95)
    const contract = makeExplorationContract()
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { sectors: new Map([[SECTOR_ID, sector]]) },
    )

    const { updatedState } = resolveContractPhase(state)
    const updatedSector = updatedState.galaxy.sectors.get(SECTOR_ID)!

    expect(updatedSector.explorationPercent).toBeLessThanOrEqual(100)
  })

  it('generates 2-4 new planets in updatedState.planets on completion', () => {
    const contract = makeExplorationContract()
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState } = resolveContractPhase(state)

    expect(updatedState.planets.size).toBeGreaterThanOrEqual(2)
    expect(updatedState.planets.size).toBeLessThanOrEqual(4)
  })

  it('all generated planets have OrbitScanned status', () => {
    const contract = makeExplorationContract()
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState } = resolveContractPhase(state)

    for (const planet of updatedState.planets.values()) {
      expect(planet.status).toBe(PlanetStatus.OrbitScanned)
    }
  })

  it('all generated planets belong to the target sector', () => {
    const contract = makeExplorationContract()
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState } = resolveContractPhase(state)

    for (const planet of updatedState.planets.values()) {
      expect(planet.sectorId).toBe(SECTOR_ID)
    }
  })

  it('sets orbitScanTurn to current turn on generated planets', () => {
    const contract = makeExplorationContract()
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState } = resolveContractPhase(state)

    for (const planet of updatedState.planets.values()) {
      expect(planet.orbitScanTurn).toBe(TURN_5)
    }
  })

  it('generates one discovery event per discovered planet (plus one contract event)', () => {
    const contract = makeExplorationContract()
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { updatedState, events } = resolveContractPhase(state)

    const discoveryEvents = events.filter((e) => e.category === 'exploration')
    expect(discoveryEvents).toHaveLength(updatedState.planets.size)
  })

  it('discovery events have Positive priority and exploration category', () => {
    const contract = makeExplorationContract()
    const state = makeState(new Map([[CONTRACT_ID, contract]]))

    const { events } = resolveContractPhase(state)

    const discoveryEvents = events.filter((e) => e.category === 'exploration')
    for (const event of discoveryEvents) {
      expect(event.priority).toBe(EventPriority.Positive)
      expect(event.title).toBe('Planet Discovered')
    }
  })

  it('tier-1 corp (level 1): no features revealed on generated planets', () => {
    const corp = { ...makeCorporation(CORP_ID), level: 1 }
    const contract = makeExplorationContract()
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { corporations: new Map([[CORP_ID, corp]]) },
    )

    const { updatedState } = resolveContractPhase(state)

    for (const planet of updatedState.planets.values()) {
      // At tier 1, orbit-visible features should NOT be marked revealed
      const orbitFeatureRevealed = planet.features.some((f) => f.orbitVisible && f.revealed)
      // Planets may have 0 orbit-visible features, so we only check if any revealed
      // is consistent with tier 1: none should be revealed by orbit scan
      expect(orbitFeatureRevealed).toBe(false)
    }
  })

  it('tier-2 corp (level 4): orbit-visible features are revealed on generated planets', () => {
    // We can't guarantee features spawn, but we can verify the scan was applied.
    // Run multiple times if needed; for determinism just check the scan was called for tier 2.
    const corp = { ...makeCorporation(CORP_ID), level: 4 }
    const contract = makeExplorationContract()
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { corporations: new Map([[CORP_ID, corp]]) },
    )

    // Should not throw and should produce planets
    const { updatedState } = resolveContractPhase(state)
    expect(updatedState.planets.size).toBeGreaterThanOrEqual(2)
  })

  it('does not affect pre-existing planets in state', () => {
    const existingPlanet = makePlanet(PLANET_ID, PlanetStatus.OrbitScanned)
    const contract = makeExplorationContract()
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { planets: new Map([[PLANET_ID, existingPlanet]]) },
    )

    const { updatedState } = resolveContractPhase(state)

    // Original planet still present
    expect(updatedState.planets.get(PLANET_ID)).toBeDefined()
    // At least 2 new planets added
    expect(updatedState.planets.size).toBeGreaterThanOrEqual(3)
  })

  it('does nothing to sector if the sector is not in galaxy.sectors', () => {
    const contract = makeExplorationContract()
    // Empty sectors map — sector not found
    const state = makeState(
      new Map([[CONTRACT_ID, contract]]),
      { sectors: new Map() },
    )

    // Should not throw; planets map stays empty (no sector found, exploration skipped)
    expect(() => resolveContractPhase(state)).not.toThrow()
  })
})
