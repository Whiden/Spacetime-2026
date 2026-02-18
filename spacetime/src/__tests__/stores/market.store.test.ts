/**
 * market.store.test.ts — Unit tests for the market Pinia store (Story 9.3).
 *
 * Acceptance criteria tested:
 * - Store holds per-sector market state (production, consumption, surpluses, deficits).
 * - Store holds per-colony shortage flags after market resolution.
 * - Action: resolveMarkets(gameState) runs market phase and updates store state.
 * - Getter: getSectorMarket(sectorId) returns the sector's market state.
 * - Getter: getColonyShortages(colonyId) returns shortages for a colony.
 *
 * Test scenarios:
 * 1. Initial state — store is empty on creation.
 * 2. resolveMarkets with no-shortage scenario — sector market populated, no shortages recorded.
 * 3. resolveMarkets with food shortage — colonyShortages populated for affected colony.
 * 4. getSectorMarket — returns correct sector state, undefined for unknown sector.
 * 5. getColonyShortages — returns shortages array, empty array for colony without shortages.
 * 6. colonyHasShortage — returns true/false correctly.
 * 7. colonyHasResourceShortage — per-resource shortage detection.
 * 8. getColonyExportBonuses — returns export bonuses for exporting colonies.
 * 9. resolveMarkets returns PhaseResult (updatedState + events).
 * 10. reset() clears all store state.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMarketStore } from '../../stores/market.store'
import type { GameState } from '../../types/game'
import type { Colony } from '../../types/colony'
import type { Planet, Deposit } from '../../types/planet'
import type { Sector, Galaxy } from '../../types/sector'
import type { InfraState, ColonyInfrastructure } from '../../types/infrastructure'
import type { BudgetState } from '../../types/budget'
import type {
  ColonyId,
  PlanetId,
  SectorId,
  TurnNumber,
  BPAmount,
} from '../../types/common'
import {
  InfraDomain,
  ResourceType,
  DepositType,
  RichnessLevel,
  ColonyType,
  PlanetType,
  PlanetSize,
  PlanetStatus,
  SectorDensity,
} from '../../types/common'
import { createEmptyEmpireBonuses } from '../../types/empire'

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const SECTOR_A_ID = 'sec_testMA' as SectorId
const SECTOR_B_ID = 'sec_testMB' as SectorId
const PLANET_A_ID = 'pln_testMA' as PlanetId
const PLANET_B_ID = 'pln_testMB' as PlanetId
const COLONY_A_ID = 'col_testMA' as ColonyId
const COLONY_B_ID = 'col_testMB' as ColonyId

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FERTILE_DEPOSIT: Deposit = {
  type: DepositType.FertileGround,
  richness: RichnessLevel.Rich,
  richnessRevealed: true,
}

function makeInfraState(domain: InfraDomain, publicLevels: number): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: Infinity,
  }
}

function makeInfra(overrides: Partial<Record<InfraDomain, number>> = {}): ColonyInfrastructure {
  const result = {} as ColonyInfrastructure
  for (const domain of Object.values(InfraDomain)) {
    result[domain] = makeInfraState(domain, overrides[domain] ?? 0)
  }
  return result
}

function makeColony(
  id: ColonyId,
  planetId: PlanetId,
  sectorId: SectorId,
  infra: ColonyInfrastructure,
  populationLevel: number,
  dynamism: number,
): Colony {
  return {
    id,
    planetId,
    sectorId,
    name: `Colony ${id}`,
    type: ColonyType.FrontierColony,
    populationLevel,
    attributes: {
      habitability: 8,
      accessibility: 5,
      dynamism,
      qualityOfLife: 8,
      stability: 8,
      growth: 0,
    },
    infrastructure: infra,
    corporationsPresent: [],
    modifiers: [],
    foundedTurn: 1 as TurnNumber,
  }
}

function makePlanet(id: PlanetId, sectorId: SectorId, deposits: Deposit[]): Planet {
  return {
    id,
    name: `Planet ${id}`,
    sectorId,
    type: PlanetType.Continental,
    size: PlanetSize.Large,
    status: PlanetStatus.Colonized,
    baseHabitability: 8,
    deposits,
    features: [],
    featureModifiers: [],
    orbitScanTurn: 1,
    groundSurveyTurn: 1,
  }
}

function makeSector(id: SectorId, name: string): Sector {
  return {
    id,
    name,
    density: SectorDensity.Moderate,
    explorationPercent: 10,
    threatModifier: 1.0,
    firstEnteredTurn: 1 as TurnNumber,
  }
}

function makeGalaxy(sectors: Sector[]): Galaxy {
  const sectorsMap = new Map<SectorId, Sector>()
  const adjacency = new Map<SectorId, SectorId[]>()
  for (const s of sectors) {
    sectorsMap.set(s.id, s)
    adjacency.set(s.id, [])
  }
  return {
    sectors: sectorsMap,
    adjacency,
    startingSectorId: sectors[0]?.id ?? SECTOR_A_ID,
  }
}

function makeMinimalBudget(): BudgetState {
  return {
    currentBP: 10 as BPAmount,
    incomeSources: [],
    expenseEntries: [],
    totalIncome: 0 as BPAmount,
    totalExpenses: 0 as BPAmount,
    netBP: 10 as BPAmount,
    debtTokens: 0,
    stabilityMalus: 0,
    calculatedTurn: 1 as TurnNumber,
  }
}

function makeGameState(overrides: {
  sectors?: Sector[]
  colonies?: Colony[]
  planets?: Planet[]
}): GameState {
  const sectors  = overrides.sectors  ?? [makeSector(SECTOR_A_ID, 'Alpha Sector')]
  const colonies = overrides.colonies ?? []
  const planets  = overrides.planets  ?? []

  const coloniesMap = new Map<string, Colony>()
  for (const c of colonies) coloniesMap.set(c.id, c)

  const planetsMap = new Map<string, Planet>()
  for (const p of planets) planetsMap.set(p.id, p)

  return {
    turn: 1 as TurnNumber,
    phase: 'player_action',
    currentBP: 10 as BPAmount,
    debtTokens: 0,
    budget: makeMinimalBudget(),
    empireBonuses: createEmptyEmpireBonuses(),
    galaxy: makeGalaxy(sectors),
    colonies: coloniesMap,
    planets: planetsMap,
    corporations: new Map(),
    contracts: new Map(),
    ships: new Map(),
    missions: new Map(),
    scienceDomains: new Map(),
    discoveries: new Map(),
    schematics: new Map(),
    patents: new Map(),
    sectorMarkets: new Map(),
    tradeRoutes: [],
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useMarketStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── 1. Initial state ──────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty sectorMarkets', () => {
      const store = useMarketStore()
      expect(store.sectorMarkets.size).toBe(0)
    })

    it('starts with empty colonyShortages', () => {
      const store = useMarketStore()
      expect(store.colonyShortages.size).toBe(0)
    })

    it('starts with empty colonyExportBonuses', () => {
      const store = useMarketStore()
      expect(store.colonyExportBonuses.size).toBe(0)
    })
  })

  // ── 2. resolveMarkets — no shortage scenario ──────────────────────────────
  //
  // Colony A: pop 2, agricultural infra 5, transport infra 5, Rich FertileGround deposit.
  // Food produced = 5 × 1.0 = 5. Food consumed = pop × 1 = 2.
  // TC produced = 5. TC consumed = pop × 1 = 2. No shortages.
  // Sector market should be populated.

  describe('resolveMarkets — no shortage scenario', () => {
    const colony = makeColony(
      COLONY_A_ID,
      PLANET_A_ID,
      SECTOR_A_ID,
      makeInfra({
        [InfraDomain.Agricultural]: 5,
        [InfraDomain.Transport]: 5,  // cover TC demand (pop 2 needs 2 TC)
      }),
      2,  // pop 2 → food demand = 4, TC demand = 2
      5,
    )
    const planet = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])

    it('populates sectorMarkets after resolution', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      store.resolveMarkets(state)
      expect(store.sectorMarkets.has(SECTOR_A_ID)).toBe(true)
    })

    it('records food production in sectorMarkets', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      store.resolveMarkets(state)
      const market = store.getSectorMarket(SECTOR_A_ID)!
      expect(market.totalProduction[ResourceType.Food]).toBeGreaterThan(0)
    })

    it('records no food shortage (food production exceeds demand)', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      store.resolveMarkets(state)
      // Food is in surplus — no food shortage recorded.
      expect(store.colonyHasResourceShortage(COLONY_A_ID, ResourceType.Food)).toBe(false)
    })

    it('colonyHasResourceShortage for Food returns false (food surplus colony)', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      store.resolveMarkets(state)
      // Food is in surplus — food shortage is false even though other shortages may exist
      expect(store.colonyHasResourceShortage(COLONY_A_ID, ResourceType.Food)).toBe(false)
    })
  })

  // ── 3. resolveMarkets — food shortage scenario ────────────────────────────
  //
  // Colony A: pop 2, no agricultural infra, no deposit.
  // Food consumed = 2, food produced = 0 → food shortage.
  // Expected: colonyShortages contains a Food entry for COLONY_A_ID.

  describe('resolveMarkets — food shortage scenario', () => {
    const colonyNoFood = makeColony(
      COLONY_A_ID,
      PLANET_A_ID,
      SECTOR_A_ID,
      makeInfra({ [InfraDomain.Agricultural]: 0 }),
      2,
      5,
    )
    const planetNoDeposits = makePlanet(PLANET_A_ID, SECTOR_A_ID, [])

    it('records food shortage in colonyShortages', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colonyNoFood],
        planets: [planetNoDeposits],
      })
      store.resolveMarkets(state)
      const shortages = store.getColonyShortages(COLONY_A_ID)
      expect(shortages.length).toBeGreaterThan(0)
      expect(shortages.some((s) => s.resource === ResourceType.Food)).toBe(true)
    })

    it('colonyHasShortage returns true for food-shortage colony', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colonyNoFood],
        planets: [planetNoDeposits],
      })
      store.resolveMarkets(state)
      expect(store.colonyHasShortage(COLONY_A_ID)).toBe(true)
    })

    it('colonyHasResourceShortage(Food) returns true', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colonyNoFood],
        planets: [planetNoDeposits],
      })
      store.resolveMarkets(state)
      expect(store.colonyHasResourceShortage(COLONY_A_ID, ResourceType.Food)).toBe(true)
    })

    it('colonyHasResourceShortage(Volatiles) returns false for unrelated resource', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colonyNoFood],
        planets: [planetNoDeposits],
      })
      store.resolveMarkets(state)
      expect(store.colonyHasResourceShortage(COLONY_A_ID, ResourceType.Volatiles)).toBe(false)
    })
  })

  // ── 4. getSectorMarket — getter behaviour ─────────────────────────────────

  describe('getSectorMarket', () => {
    it('returns undefined for an unknown sector before resolution', () => {
      const store = useMarketStore()
      expect(store.getSectorMarket('sec_unknown' as SectorId)).toBeUndefined()
    })

    it('returns market state with correct sectorId after resolution', () => {
      const store = useMarketStore()
      const colony = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({ [InfraDomain.Agricultural]: 5 }),
        2,
        5,
      )
      const planet = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      store.resolveMarkets(state)
      const market = store.getSectorMarket(SECTOR_A_ID)
      expect(market).toBeDefined()
      expect(market!.sectorId).toBe(SECTOR_A_ID)
    })

    it('returns market state with production/consumption/netSurplus fields', () => {
      const store = useMarketStore()
      const colony = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({ [InfraDomain.Agricultural]: 5 }),
        2,
        5,
      )
      const planet = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      store.resolveMarkets(state)
      const market = store.getSectorMarket(SECTOR_A_ID)!
      expect(market.totalProduction).toBeDefined()
      expect(market.totalConsumption).toBeDefined()
      expect(market.netSurplus).toBeDefined()
    })
  })

  // ── 5. getColonyShortages — getter behaviour ──────────────────────────────

  describe('getColonyShortages', () => {
    it('returns empty array for a colony with no shortages', () => {
      const store = useMarketStore()
      expect(store.getColonyShortages(COLONY_A_ID)).toEqual([])
    })

    it('returns empty array for an unknown colony ID', () => {
      const store = useMarketStore()
      expect(store.getColonyShortages('col_unknown' as ColonyId)).toEqual([])
    })
  })

  // ── 6. getColonyExportBonuses — export tracking ───────────────────────────
  //
  // Two-colony scenario: Colony A produces food surplus, Colony B has food deficit.
  // Colony A should receive an export bonus for Food after market resolution.

  describe('getColonyExportBonuses — two-colony trade', () => {
    // Colony A: agricultural surplus (producer)
    const colonyA = makeColony(
      COLONY_A_ID,
      PLANET_A_ID,
      SECTOR_A_ID,
      makeInfra({ [InfraDomain.Agricultural]: 8 }), // produces 8 food, pop 1 → needs 2, surplus 6
      1,  // pop 1
      7,  // higher dynamism → gets first pick (but surplus colony)
    )
    // Colony B: no food, food deficit (consumer)
    const colonyB = makeColony(
      COLONY_B_ID,
      PLANET_B_ID,
      SECTOR_A_ID,
      makeInfra({ [InfraDomain.Agricultural]: 0 }), // no food production
      2,  // pop 2 → food demand 4
      3,  // lower dynamism
    )
    const planetA = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])
    const planetB = makePlanet(PLANET_B_ID, SECTOR_A_ID, [])

    it('records export bonus for food-exporting colony', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
      })
      store.resolveMarkets(state)
      const bonuses = store.getColonyExportBonuses(COLONY_A_ID)
      // Colony A exported food that Colony B consumed → should have export bonus
      expect(bonuses.some((b) => b.resource === ResourceType.Food)).toBe(true)
    })

    it('export bonus targets dynamism attribute', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
      })
      store.resolveMarkets(state)
      const bonuses = store.getColonyExportBonuses(COLONY_A_ID)
      const foodBonus = bonuses.find((b) => b.resource === ResourceType.Food)
      expect(foodBonus?.attributeTarget).toBe('dynamism')
      expect(foodBonus?.bonusAmount).toBe(1)
    })

    it('non-exporting colony has no export bonuses', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
      })
      store.resolveMarkets(state)
      // Colony B has no surplus, so no export bonus
      expect(store.getColonyExportBonuses(COLONY_B_ID)).toHaveLength(0)
    })
  })

  // ── 7. resolveMarkets return value ────────────────────────────────────────

  describe('resolveMarkets return value', () => {
    it('returns a PhaseResult with updatedState', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
      })
      const result = store.resolveMarkets(state)
      expect(result).toHaveProperty('updatedState')
      expect(result).toHaveProperty('events')
    })

    it('updatedState contains sectorMarkets (even for empty sector)', () => {
      const store = useMarketStore()
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
      })
      const result = store.resolveMarkets(state)
      // Empty sector → no entry but the map exists
      expect(result.updatedState.sectorMarkets).toBeInstanceOf(Map)
    })

    it('returns shortage events for food-shortage colony', () => {
      const store = useMarketStore()
      const colony = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({ [InfraDomain.Agricultural]: 0 }),
        2,
        5,
      )
      const planet = makePlanet(PLANET_A_ID, SECTOR_A_ID, [])
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      const result = store.resolveMarkets(state)
      expect(result.events.length).toBeGreaterThan(0)
    })
  })

  // ── 8. Multiple sectors ───────────────────────────────────────────────────

  describe('multiple sectors', () => {
    it('populates market state for each sector independently', () => {
      const store = useMarketStore()
      // Colony in sector A (with food + TC production — no shortages)
      const colonyA = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({
          [InfraDomain.Agricultural]: 5,
          [InfraDomain.Transport]: 5,
        }),
        2,
        5,
      )
      // Colony in sector B (no food production → food shortage)
      const colonyB = makeColony(
        COLONY_B_ID,
        PLANET_B_ID,
        SECTOR_B_ID,
        makeInfra({ [InfraDomain.Agricultural]: 0 }),
        2,
        5,
      )
      const planetA = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])
      const planetB = makePlanet(PLANET_B_ID, SECTOR_B_ID, [])

      const state = makeGameState({
        sectors: [
          makeSector(SECTOR_A_ID, 'Alpha Sector'),
          makeSector(SECTOR_B_ID, 'Beta Sector'),
        ],
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
      })
      store.resolveMarkets(state)

      expect(store.getSectorMarket(SECTOR_A_ID)).toBeDefined()
      expect(store.getSectorMarket(SECTOR_B_ID)).toBeDefined()
    })

    it('food shortage in sector B does not give colony A a food shortage', () => {
      const store = useMarketStore()
      // Colony A: enough food AND transport infra — no shortages at all
      const colonyA = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({
          [InfraDomain.Agricultural]: 5,
          [InfraDomain.Transport]: 5,
        }),
        2,
        5,
      )
      // Colony B: no food production → food shortage
      const colonyB = makeColony(
        COLONY_B_ID,
        PLANET_B_ID,
        SECTOR_B_ID,
        makeInfra({ [InfraDomain.Agricultural]: 0 }),
        2,
        5,
      )
      const planetA = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])
      const planetB = makePlanet(PLANET_B_ID, SECTOR_B_ID, [])

      const state = makeGameState({
        sectors: [
          makeSector(SECTOR_A_ID, 'Alpha Sector'),
          makeSector(SECTOR_B_ID, 'Beta Sector'),
        ],
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
      })
      store.resolveMarkets(state)

      // Colony A in sector A has food + transport → no food shortage
      expect(store.colonyHasResourceShortage(COLONY_A_ID, ResourceType.Food)).toBe(false)
      // Colony B in sector B has no food → food shortage
      expect(store.colonyHasResourceShortage(COLONY_B_ID, ResourceType.Food)).toBe(true)
    })
  })

  // ── 9. reset() clears all state ───────────────────────────────────────────

  describe('reset', () => {
    it('clears sectorMarkets', () => {
      const store = useMarketStore()
      const colony = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({
          [InfraDomain.Agricultural]: 5,
          [InfraDomain.Transport]: 5,
        }),
        2,
        5,
      )
      const planet = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      store.resolveMarkets(state)
      expect(store.sectorMarkets.size).toBeGreaterThan(0)

      store.reset()
      expect(store.sectorMarkets.size).toBe(0)
    })

    it('clears colonyShortages', () => {
      const store = useMarketStore()
      const colony = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({ [InfraDomain.Agricultural]: 0 }),
        2,
        5,
      )
      const planet = makePlanet(PLANET_A_ID, SECTOR_A_ID, [])
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      store.resolveMarkets(state)
      expect(store.colonyShortages.size).toBeGreaterThan(0)

      store.reset()
      expect(store.colonyShortages.size).toBe(0)
    })

    it('clears colonyExportBonuses', () => {
      const store = useMarketStore()
      const colonyA = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({ [InfraDomain.Agricultural]: 8 }),
        1,
        7,
      )
      const colonyB = makeColony(
        COLONY_B_ID,
        PLANET_B_ID,
        SECTOR_A_ID,
        makeInfra({ [InfraDomain.Agricultural]: 0 }),
        2,
        3,
      )
      const planetA = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])
      const planetB = makePlanet(PLANET_B_ID, SECTOR_A_ID, [])
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
      })
      store.resolveMarkets(state)
      expect(store.colonyExportBonuses.size).toBeGreaterThan(0)

      store.reset()
      expect(store.colonyExportBonuses.size).toBe(0)
    })
  })

  // ── 10. colonyHasShortage — unknown colony returns false ──────────────────

  describe('edge cases', () => {
    it('colonyHasShortage returns false for unknown colony', () => {
      const store = useMarketStore()
      expect(store.colonyHasShortage('col_unknown' as ColonyId)).toBe(false)
    })

    it('getColonyExportBonuses returns empty array for unknown colony', () => {
      const store = useMarketStore()
      expect(store.getColonyExportBonuses('col_unknown' as ColonyId)).toEqual([])
    })

    it('getSectorMarket returns undefined for unknown sector after resolution', () => {
      const store = useMarketStore()
      const colony = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({
          [InfraDomain.Agricultural]: 5,
          [InfraDomain.Transport]: 5,
        }),
        2,
        5,
      )
      const planet = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })
      store.resolveMarkets(state)
      // Sector B was never in the galaxy, so no market entry for it
      expect(store.getSectorMarket(SECTOR_B_ID)).toBeUndefined()
    })
  })
})
