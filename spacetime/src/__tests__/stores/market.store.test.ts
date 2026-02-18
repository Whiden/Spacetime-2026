/**
 * market.store.test.ts — Unit tests for the market Pinia store (Story 9.3).
 *
 * Engine-level market logic (shortages, export bonuses, modifier application,
 * event generation) is tested in market-phase.test.ts and market-resolver.test.ts.
 *
 * This file focuses on store-specific concerns:
 * - Initial state is empty.
 * - resolveMarkets delegates to engine and populates store maps.
 * - Getters return correct defaults for unknown IDs.
 * - reset() clears all state.
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

  // ── 2. resolveMarkets — smoke test (delegates to engine) ──────────────────

  describe('resolveMarkets delegation', () => {
    it('populates sectorMarkets and returns PhaseResult after resolution', () => {
      const store = useMarketStore()
      const colony = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({ [InfraDomain.Agricultural]: 5, [InfraDomain.Transport]: 5 }),
        2,
        5,
      )
      const planet = makePlanet(PLANET_A_ID, SECTOR_A_ID, [FERTILE_DEPOSIT])
      const state = makeGameState({
        sectors: [makeSector(SECTOR_A_ID, 'Alpha Sector')],
        colonies: [colony],
        planets: [planet],
      })

      const result = store.resolveMarkets(state)

      // Store state populated
      expect(store.sectorMarkets.has(SECTOR_A_ID)).toBe(true)
      const market = store.getSectorMarket(SECTOR_A_ID)!
      expect(market.sectorId).toBe(SECTOR_A_ID)
      expect(market.totalProduction).toBeDefined()
      expect(market.totalConsumption).toBeDefined()
      expect(market.netSurplus).toBeDefined()

      // PhaseResult returned
      expect(result).toHaveProperty('updatedState')
      expect(result).toHaveProperty('events')
      expect(result.updatedState.sectorMarkets).toBeInstanceOf(Map)
    })
  })

  // ── 3. Getter defaults for unknown IDs ──────────────────────────────────

  describe('getter defaults', () => {
    it('getSectorMarket returns undefined for unknown sector', () => {
      const store = useMarketStore()
      expect(store.getSectorMarket('sec_unknown' as SectorId)).toBeUndefined()
    })

    it('getColonyShortages returns empty array for unknown colony', () => {
      const store = useMarketStore()
      expect(store.getColonyShortages('col_unknown' as ColonyId)).toEqual([])
    })

    it('colonyHasShortage returns false for unknown colony', () => {
      const store = useMarketStore()
      expect(store.colonyHasShortage('col_unknown' as ColonyId)).toBe(false)
    })

    it('getColonyExportBonuses returns empty array for unknown colony', () => {
      const store = useMarketStore()
      expect(store.getColonyExportBonuses('col_unknown' as ColonyId)).toEqual([])
    })

    it('getSectorMarket returns undefined for unresolved sector after other sectors resolved', () => {
      const store = useMarketStore()
      const colony = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({ [InfraDomain.Agricultural]: 5, [InfraDomain.Transport]: 5 }),
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
      expect(store.getSectorMarket(SECTOR_B_ID)).toBeUndefined()
    })
  })

  // ── 4. reset() clears all state ───────────────────────────────────────────

  describe('reset', () => {
    it('clears sectorMarkets after resolution', () => {
      const store = useMarketStore()
      const colony = makeColony(
        COLONY_A_ID,
        PLANET_A_ID,
        SECTOR_A_ID,
        makeInfra({ [InfraDomain.Agricultural]: 5, [InfraDomain.Transport]: 5 }),
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

    it('clears colonyShortages after resolution', () => {
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

    it('clears colonyExportBonuses after resolution', () => {
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
})
