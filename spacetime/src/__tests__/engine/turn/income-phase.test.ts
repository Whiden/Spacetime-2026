/**
 * income-phase.test.ts — Unit tests for the income phase (Story 12.2).
 *
 * Acceptance criteria verified:
 * - Sums all planet taxes + corp taxes, returns itemized income
 * - Returns typed result object with per-source breakdowns
 * - Multiple income sources (multiple colonies + multiple corps)
 * - Zero income scenario (no taxable colonies or corps)
 * - Colony below pop 5 → no planet tax
 * - Corp at level 1-2 → no corp tax (startup exemption)
 * - Low-habitability colony → habitability cost reduces planet tax
 * - Income is credited to currentBP
 * - Budget state updated with totalIncome and incomeSources
 * - No events emitted (income phase is silent)
 */

import { describe, it, expect } from 'vitest'
import { resolveIncomePhase } from '../../../engine/turn/income-phase'
import type { GameState } from '../../../types/game'
import type { BudgetState } from '../../../types/budget'
import type { Colony } from '../../../types/colony'
import type { Corporation, CorpInfrastructureHoldings } from '../../../types/corporation'
import type { Planet } from '../../../types/planet'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { Sector, Galaxy } from '../../../types/sector'
import type { SectorMarketState } from '../../../types/trade'
import type {
  ColonyId,
  CorpId,
  PlanetId,
  SectorId,
  TurnNumber,
  BPAmount,
} from '../../../types/common'
import {
  InfraDomain,
  ResourceType,
  CorpType,
  ColonyType,
  PlanetType,
  PlanetSize,
  PlanetStatus,
  SectorDensity,
} from '../../../types/common'
import { createEmptyEmpireBonuses } from '../../../types/empire'

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const SECTOR_ID = 'sec_inc001' as SectorId
const PLANET_ID = 'pln_inc001' as PlanetId
const COLONY_ID = 'col_inc001' as ColonyId
const CORP_ID   = 'corp_inc01' as CorpId

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInfraState(domain: InfraDomain, publicLevels = 0): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: Infinity,
  }
}

function makeInfra(
  overrides: Partial<Record<InfraDomain, number>> = {},
): ColonyInfrastructure {
  const result = {} as ColonyInfrastructure
  for (const domain of Object.values(InfraDomain)) {
    result[domain] = makeInfraState(domain, overrides[domain] ?? 0)
  }
  return result
}

function makeColony(
  id: ColonyId = COLONY_ID,
  popLevel = 7,
  habitability = 8,
): Colony {
  return {
    id,
    planetId: PLANET_ID,
    sectorId: SECTOR_ID,
    name: `Colony ${id}`,
    type: ColonyType.FrontierColony,
    populationLevel: popLevel,
    attributes: {
      habitability,
      accessibility: 5,
      dynamism: 5,
      qualityOfLife: 8,
      stability: 8,
      growth: 0,
    },
    infrastructure: makeInfra({ [InfraDomain.Civilian]: 4 }),
    corporationsPresent: [],
    modifiers: [],
    foundedTurn: 1 as TurnNumber,
  }
}

function makePlanet(id: PlanetId = PLANET_ID): Planet {
  return {
    id,
    name: 'Test Planet',
    sectorId: SECTOR_ID,
    type: PlanetType.Continental,
    size: PlanetSize.Large,
    status: PlanetStatus.Colonized,
    baseHabitability: 8,
    deposits: [],
    features: [],
    featureModifiers: [],
    orbitScanTurn: 1,
    groundSurveyTurn: 1,
  }
}

function makeCorp(id: CorpId = CORP_ID, level = 3): Corporation {
  return {
    id,
    name: `Corp ${id}`,
    type: CorpType.Science,
    level,
    capital: 0,
    traits: [],
    homePlanetId: PLANET_ID,
    planetsPresent: [],
    assets: {
      infrastructureByColony: new Map<ColonyId, CorpInfrastructureHoldings>(),
      schematics: [],
      patents: [],
    },
    activeContractIds: [],
    foundedTurn: 1 as TurnNumber,
  }
}

function makeSector(id: SectorId = SECTOR_ID): Sector {
  return {
    id,
    name: 'Test Sector',
    density: SectorDensity.Moderate,
    explorationPercent: 10,
    threatModifier: 1.0,
    firstEnteredTurn: 1 as TurnNumber,
  }
}

function makeGalaxy(sectorId: SectorId = SECTOR_ID): Galaxy {
  const sectors = new Map<SectorId, Sector>()
  sectors.set(sectorId, makeSector(sectorId))
  const adjacency = new Map<SectorId, SectorId[]>()
  adjacency.set(sectorId, [])
  return { sectors, adjacency, startingSectorId: sectorId }
}

function makeZeroResourceRecord(): Record<ResourceType, number> {
  return Object.values(ResourceType).reduce(
    (acc, r) => ({ ...acc, [r]: 0 }),
    {} as Record<ResourceType, number>,
  )
}

function makeSectorMarket(sectorId: SectorId = SECTOR_ID): SectorMarketState {
  return {
    sectorId,
    totalProduction: makeZeroResourceRecord(),
    totalConsumption: makeZeroResourceRecord(),
    netSurplus: makeZeroResourceRecord(),
    inboundFlows: [],
    outboundFlows: [],
  }
}

function makeMinimalBudget(currentBP = 10): BudgetState {
  return {
    currentBP: currentBP as BPAmount,
    incomeSources: [],
    expenseEntries: [],
    totalIncome: 0 as BPAmount,
    totalExpenses: 0 as BPAmount,
    netBP: currentBP as BPAmount,
    debtTokens: 0,
    stabilityMalus: 0,
    calculatedTurn: 1 as TurnNumber,
  }
}

/** Build a minimal but valid GameState for income-phase testing. */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const coloniesMap = new Map<string, Colony>()
  coloniesMap.set(COLONY_ID, makeColony())

  const planetsMap = new Map<string, Planet>()
  planetsMap.set(PLANET_ID, makePlanet())

  const sectorMarkets = new Map<string, SectorMarketState>()
  sectorMarkets.set(SECTOR_ID, makeSectorMarket())

  return {
    turn: 1 as TurnNumber,
    phase: 'player_action',
    currentBP: 10 as BPAmount,
    debtTokens: 0,
    budget: makeMinimalBudget(),
    empireBonuses: createEmptyEmpireBonuses(),
    galaxy: makeGalaxy(),
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
    sectorMarkets,
    tradeRoutes: [],
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveIncomePhase', () => {

  // ── Zero income scenario ──────────────────────────────────────────────────

  describe('zero income scenario', () => {
    it('returns empty incomeSources when no colonies and no corps', () => {
      const state = makeState({
        colonies: new Map(),
        corporations: new Map(),
      })
      const { updatedState } = resolveIncomePhase(state)
      expect(updatedState.budget.incomeSources).toHaveLength(0)
    })

    it('does not change currentBP when there is no income', () => {
      const state = makeState({
        colonies: new Map(),
        corporations: new Map(),
        currentBP: 5 as BPAmount,
      })
      const { updatedState } = resolveIncomePhase(state)
      expect(updatedState.currentBP).toBe(5)
    })

    it('sets totalIncome to 0 when there are no taxable sources', () => {
      const state = makeState({
        colonies: new Map(),
        corporations: new Map(),
      })
      const { updatedState } = resolveIncomePhase(state)
      expect(updatedState.budget.totalIncome).toBe(0)
    })

    it('emits no events (income phase is silent)', () => {
      const state = makeState({
        colonies: new Map(),
        corporations: new Map(),
      })
      const { events } = resolveIncomePhase(state)
      expect(events).toHaveLength(0)
    })
  })

  // ── Planet tax ────────────────────────────────────────────────────────────

  describe('planet tax', () => {
    it('generates a planet_tax income source for a colony with pop >= 5', () => {
      // pop 7, hab 8 → hab_cost = max(0, 10-8) × max(1, floor(7/3)) = 2 × 2 = 4
      // planet_tax = max(0, floor(49/4) - 4) = max(0, 12 - 4) = 8
      const colonies = new Map<string, Colony>()
      colonies.set(COLONY_ID, makeColony(COLONY_ID, 7, 8))
      const state = makeState({ colonies })

      const { updatedState } = resolveIncomePhase(state)
      const planetTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'planet_tax',
      )
      expect(planetTaxEntries).toHaveLength(1)
      expect(planetTaxEntries[0].amount).toBe(8)
    })

    it('does not generate a planet_tax entry for pop < 5', () => {
      const colonies = new Map<string, Colony>()
      colonies.set(COLONY_ID, makeColony(COLONY_ID, 4, 8))
      const state = makeState({ colonies })

      const { updatedState } = resolveIncomePhase(state)
      const planetTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'planet_tax',
      )
      expect(planetTaxEntries).toHaveLength(0)
    })

    it('low habitability increases hab_cost and reduces planet tax', () => {
      // pop 6, hab 2 → hab_cost = max(0, 10-2) × max(1, floor(6/3)) = 8 × 2 = 16
      // planet_tax = max(0, floor(36/4) - 16) = max(0, 9 - 16) = 0
      const colonies = new Map<string, Colony>()
      colonies.set(COLONY_ID, makeColony(COLONY_ID, 6, 2))
      const state = makeState({ colonies })

      const { updatedState } = resolveIncomePhase(state)
      const planetTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'planet_tax',
      )
      // Returns 0 tax, so no entry is added
      expect(planetTaxEntries).toHaveLength(0)
    })

    it('high habitability (10) results in zero hab_cost', () => {
      // pop 5, hab 10 → hab_cost = max(0, 10-10) × ... = 0
      // planet_tax = max(0, floor(25/4) - 0) = 6
      const colonies = new Map<string, Colony>()
      colonies.set(COLONY_ID, makeColony(COLONY_ID, 5, 10))
      const state = makeState({ colonies })

      const { updatedState } = resolveIncomePhase(state)
      const planetTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'planet_tax',
      )
      expect(planetTaxEntries).toHaveLength(1)
      expect(planetTaxEntries[0].amount).toBe(6)
    })

    it('uses the colony name for sourceName attribution', () => {
      const colony = makeColony(COLONY_ID, 7, 8)
      colony.name = 'Terra Nova'
      const colonies = new Map<string, Colony>()
      colonies.set(COLONY_ID, colony)
      const state = makeState({ colonies })

      const { updatedState } = resolveIncomePhase(state)
      const entry = updatedState.budget.incomeSources.find(s => s.type === 'planet_tax')
      expect(entry?.sourceName).toBe('Terra Nova')
      expect(entry?.sourceId).toBe(COLONY_ID)
    })
  })

  // ── Corp tax ──────────────────────────────────────────────────────────────

  describe('corp tax', () => {
    it('generates a corp_tax income source for a corp at level 3+', () => {
      // level 3 → floor(9/5) = 1
      const corps = new Map<string, Corporation>()
      corps.set(CORP_ID, makeCorp(CORP_ID, 3))
      const state = makeState({
        colonies: new Map(),
        corporations: corps,
      })

      const { updatedState } = resolveIncomePhase(state)
      const corpTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'corp_tax',
      )
      expect(corpTaxEntries).toHaveLength(1)
      expect(corpTaxEntries[0].amount).toBe(1)
    })

    it('does not generate a corp_tax entry for level 1 corp (startup exemption)', () => {
      // level 1 → floor(1/5) = 0
      const corps = new Map<string, Corporation>()
      corps.set(CORP_ID, makeCorp(CORP_ID, 1))
      const state = makeState({
        colonies: new Map(),
        corporations: corps,
      })

      const { updatedState } = resolveIncomePhase(state)
      const corpTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'corp_tax',
      )
      expect(corpTaxEntries).toHaveLength(0)
    })

    it('does not generate a corp_tax entry for level 2 corp (startup exemption)', () => {
      // level 2 → floor(4/5) = 0
      const corps = new Map<string, Corporation>()
      corps.set(CORP_ID, makeCorp(CORP_ID, 2))
      const state = makeState({
        colonies: new Map(),
        corporations: corps,
      })

      const { updatedState } = resolveIncomePhase(state)
      const corpTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'corp_tax',
      )
      expect(corpTaxEntries).toHaveLength(0)
    })

    it('level 5 corp pays correct tax amount', () => {
      // level 5 → floor(25/5) = 5
      const corps = new Map<string, Corporation>()
      corps.set(CORP_ID, makeCorp(CORP_ID, 5))
      const state = makeState({
        colonies: new Map(),
        corporations: corps,
      })

      const { updatedState } = resolveIncomePhase(state)
      const entry = updatedState.budget.incomeSources.find(s => s.type === 'corp_tax')
      expect(entry?.amount).toBe(5)
    })

    it('level 10 corp pays correct tax amount', () => {
      // level 10 → floor(100/5) = 20
      const corps = new Map<string, Corporation>()
      corps.set(CORP_ID, makeCorp(CORP_ID, 10))
      const state = makeState({
        colonies: new Map(),
        corporations: corps,
      })

      const { updatedState } = resolveIncomePhase(state)
      const entry = updatedState.budget.incomeSources.find(s => s.type === 'corp_tax')
      expect(entry?.amount).toBe(20)
    })

    it('uses the corp name for sourceName attribution', () => {
      const corp = makeCorp(CORP_ID, 4)
      corp.name = 'Helion Industries'
      const corps = new Map<string, Corporation>()
      corps.set(CORP_ID, corp)
      const state = makeState({
        colonies: new Map(),
        corporations: corps,
      })

      const { updatedState } = resolveIncomePhase(state)
      const entry = updatedState.budget.incomeSources.find(s => s.type === 'corp_tax')
      expect(entry?.sourceName).toBe('Helion Industries')
      expect(entry?.sourceId).toBe(CORP_ID)
    })
  })

  // ── Multiple income sources ───────────────────────────────────────────────

  describe('multiple income sources', () => {
    it('aggregates planet taxes from multiple colonies', () => {
      const col1Id = 'col_inc001' as ColonyId
      const col2Id = 'col_inc002' as ColonyId
      const colonies = new Map<string, Colony>()
      // Colony 1: pop 7, hab 8 → tax 8
      colonies.set(col1Id, makeColony(col1Id, 7, 8))
      // Colony 2: pop 5, hab 10 → tax 6
      colonies.set(col2Id, makeColony(col2Id, 5, 10))

      const state = makeState({ colonies })
      const { updatedState } = resolveIncomePhase(state)

      const planetTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'planet_tax',
      )
      expect(planetTaxEntries).toHaveLength(2)

      const totalFromPlanetTax = planetTaxEntries.reduce((sum, e) => sum + e.amount, 0)
      expect(totalFromPlanetTax).toBe(14) // 8 + 6
    })

    it('aggregates corp taxes from multiple corporations', () => {
      const corp1Id = 'corp_inc01' as CorpId
      const corp2Id = 'corp_inc02' as CorpId
      const corps = new Map<string, Corporation>()
      // Corp 1: level 3 → floor(9/5) = 1
      corps.set(corp1Id, makeCorp(corp1Id, 3))
      // Corp 2: level 5 → floor(25/5) = 5
      corps.set(corp2Id, makeCorp(corp2Id, 5))

      const state = makeState({ colonies: new Map(), corporations: corps })
      const { updatedState } = resolveIncomePhase(state)

      const corpTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'corp_tax',
      )
      expect(corpTaxEntries).toHaveLength(2)

      const totalFromCorpTax = corpTaxEntries.reduce((sum, e) => sum + e.amount, 0)
      expect(totalFromCorpTax).toBe(6) // 1 + 5
    })

    it('combines planet taxes and corp taxes into a single incomeSources array', () => {
      const colonies = new Map<string, Colony>()
      // Colony: pop 7, hab 8 → tax 8
      colonies.set(COLONY_ID, makeColony(COLONY_ID, 7, 8))

      const corps = new Map<string, Corporation>()
      // Corp: level 5 → tax 5
      corps.set(CORP_ID, makeCorp(CORP_ID, 5))

      const state = makeState({ colonies, corporations: corps })
      const { updatedState } = resolveIncomePhase(state)

      expect(updatedState.budget.incomeSources).toHaveLength(2)
      expect(updatedState.budget.incomeSources.some(s => s.type === 'planet_tax')).toBe(true)
      expect(updatedState.budget.incomeSources.some(s => s.type === 'corp_tax')).toBe(true)
    })

    it('calculates totalIncome as sum of all income sources', () => {
      const colonies = new Map<string, Colony>()
      // Colony: pop 7, hab 8 → tax 8
      colonies.set(COLONY_ID, makeColony(COLONY_ID, 7, 8))

      const corps = new Map<string, Corporation>()
      // Corp: level 5 → tax 5
      corps.set(CORP_ID, makeCorp(CORP_ID, 5))

      const state = makeState({ colonies, corporations: corps })
      const { updatedState } = resolveIncomePhase(state)

      expect(updatedState.budget.totalIncome).toBe(13) // 8 + 5
    })

    it('mixes taxable and non-taxable sources correctly', () => {
      const col1Id = 'col_inc001' as ColonyId
      const col2Id = 'col_inc002' as ColonyId
      const corp1Id = 'corp_inc01' as CorpId
      const corp2Id = 'corp_inc02' as CorpId

      const colonies = new Map<string, Colony>()
      // Taxable: pop 7, hab 8 → tax 8
      colonies.set(col1Id, makeColony(col1Id, 7, 8))
      // Non-taxable: pop 3 → no tax (below threshold)
      colonies.set(col2Id, makeColony(col2Id, 3, 8))

      const corps = new Map<string, Corporation>()
      // Taxable: level 4 → floor(16/5) = 3
      corps.set(corp1Id, makeCorp(corp1Id, 4))
      // Non-taxable: level 2 → startup exemption
      corps.set(corp2Id, makeCorp(corp2Id, 2))

      const state = makeState({ colonies, corporations: corps })
      const { updatedState } = resolveIncomePhase(state)

      // Only 1 planet_tax and 1 corp_tax should appear
      const planetTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'planet_tax',
      )
      const corpTaxEntries = updatedState.budget.incomeSources.filter(
        s => s.type === 'corp_tax',
      )
      expect(planetTaxEntries).toHaveLength(1)
      expect(corpTaxEntries).toHaveLength(1)
      expect(updatedState.budget.totalIncome).toBe(11) // 8 + 3
    })
  })

  // ── BP balance update ─────────────────────────────────────────────────────

  describe('BP balance update', () => {
    it('credits totalIncome to currentBP', () => {
      // Colony: pop 7, hab 8 → tax 8
      const colonies = new Map<string, Colony>()
      colonies.set(COLONY_ID, makeColony(COLONY_ID, 7, 8))

      const state = makeState({ colonies, currentBP: 10 as BPAmount })
      const { updatedState } = resolveIncomePhase(state)

      expect(updatedState.currentBP).toBe(18) // 10 + 8
    })

    it('does not change BP when there is no income', () => {
      const state = makeState({
        colonies: new Map(),
        corporations: new Map(),
        currentBP: 7 as BPAmount,
      })
      const { updatedState } = resolveIncomePhase(state)
      expect(updatedState.currentBP).toBe(7)
    })

    it('preserves existing BP when adding income', () => {
      const corps = new Map<string, Corporation>()
      // Corp: level 5 → tax 5
      corps.set(CORP_ID, makeCorp(CORP_ID, 5))

      const state = makeState({
        colonies: new Map(),
        corporations: corps,
        currentBP: 3 as BPAmount,
      })
      const { updatedState } = resolveIncomePhase(state)
      expect(updatedState.currentBP).toBe(8) // 3 + 5
    })
  })

  // ── Budget state update ───────────────────────────────────────────────────

  describe('budget state update', () => {
    it('updates budget.totalIncome with the correct total', () => {
      const colonies = new Map<string, Colony>()
      // Colony: pop 7, hab 8 → tax 8
      colonies.set(COLONY_ID, makeColony(COLONY_ID, 7, 8))
      const state = makeState({ colonies })

      const { updatedState } = resolveIncomePhase(state)
      expect(updatedState.budget.totalIncome).toBe(8)
    })

    it('preserves existing expenseEntries on budget (does not clear them)', () => {
      // The income phase should not touch expenseEntries — that is the expense phase's job
      const state = makeState({ colonies: new Map() })
      const { updatedState } = resolveIncomePhase(state)
      // expenseEntries starts empty; income phase must not populate it
      expect(updatedState.budget.expenseEntries).toHaveLength(0)
    })

    it('stamps budget.calculatedTurn with the current turn', () => {
      const state = makeState({ turn: 5 as TurnNumber })
      const { updatedState } = resolveIncomePhase(state)
      expect(updatedState.budget.calculatedTurn).toBe(5)
    })
  })

})
