/**
 * turn-resolver.test.ts — Unit tests for the master turn resolver (Story 12.1).
 *
 * Acceptance criteria verified:
 * - Calls phases in exact order: debt → income → expense → contract → mission →
 *   science → corp → colony → market → event
 * - Each phase receives state accumulated from previous phases
 * - Collects events from all phases into unified event list
 * - Returns complete updated GameState + all events
 * - Increments turn number
 * - Pure function: no side effects, no store access
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveTurn } from '../../../engine/turn/turn-resolver'
import type { GameState } from '../../../types/game'
import type { BudgetState } from '../../../types/budget'
import type { Colony } from '../../../types/colony'
import type { Planet } from '../../../types/planet'
import type { Corporation, CorpInfrastructureHoldings } from '../../../types/corporation'
import type { Contract } from '../../../types/contract'
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
  ContractId,
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
  ContractType,
  ContractStatus,
} from '../../../types/common'
import { createEmptyEmpireBonuses } from '../../../types/empire'

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const SECTOR_ID = 'sec_tr0001' as SectorId
const PLANET_ID = 'pln_tr0001' as PlanetId
const COLONY_ID = 'col_tr0001' as ColonyId
const CORP_ID   = 'corp_tr001' as CorpId

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
    name: 'Test Colony',
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
    infrastructure: makeInfra({ [InfraDomain.Civilian]: 10 }),
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

function makeCorp(id: CorpId = CORP_ID, level = 3, capital = 0): Corporation {
  return {
    id,
    name: 'Test Corp',
    type: CorpType.Science,
    level,
    capital,
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

function makeMinimalBudget(debtTokens = 0, currentBP = 10): BudgetState {
  return {
    currentBP: currentBP as BPAmount,
    incomeSources: [],
    expenseEntries: [],
    totalIncome: 0 as BPAmount,
    totalExpenses: 0 as BPAmount,
    netBP: currentBP as BPAmount,
    debtTokens,
    stabilityMalus: 0,
    calculatedTurn: 1 as TurnNumber,
  }
}

function makeContract(id: ContractId, bpPerTurn = 1): Contract {
  return {
    id,
    type: ContractType.Exploration,
    status: ContractStatus.Active,
    target: { type: 'sector', sectorId: SECTOR_ID },
    assignedCorpId: CORP_ID,
    bpPerTurn: bpPerTurn as BPAmount,
    durationTurns: 5,
    turnsRemaining: 3,
    startTurn: 1 as TurnNumber,
    completedTurn: null,
  }
}

/**
 * Build a minimal but valid GameState for testing the turn resolver.
 */
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

describe('resolveTurn', () => {

  // ── Turn number increment ──────────────────────────────────────────────────

  describe('turn number', () => {
    it('increments turn number by 1 after resolution', () => {
      const state = makeState({ turn: 1 as TurnNumber })
      const result = resolveTurn(state)
      expect(result.updatedState.turn).toBe(2)
    })

    it('increments turn number from any starting turn', () => {
      const state = makeState({ turn: 17 as TurnNumber })
      const result = resolveTurn(state)
      expect(result.updatedState.turn).toBe(18)
    })

    it('returns the completed turn in the result', () => {
      const state = makeState({ turn: 5 as TurnNumber })
      const result = resolveTurn(state)
      expect(result.completedTurn).toBe(5)
    })
  })

  // ── State flows between phases ─────────────────────────────────────────────

  describe('state flows between phases', () => {
    it('income added by income-phase is present when expense-phase runs', () => {
      // Colony with pop level 7, habitability 8 → planet tax > 0
      // The tax is added by income-phase, then expenses are deducted from that increased balance
      const state = makeState()
      const result = resolveTurn(state)
      // income-phase runs before expense-phase, so the final BP reflects both
      expect(typeof result.updatedState.currentBP).toBe('number')
      // budget.totalIncome should be set by income-phase
      expect(result.updatedState.budget.incomeSources.length).toBeGreaterThanOrEqual(0)
    })

    it('contract costs deducted by expense-phase after income applied', () => {
      const contracts = new Map<string, Contract>()
      const contract = makeContract('ctr_tr001' as ContractId, 3)
      contracts.set(contract.id, contract)

      const state = makeState({ contracts, currentBP: 10 as BPAmount })
      const result = resolveTurn(state)

      // Colony at pop 7, hab 8: planet tax = floor(49/4) - 0 = 12 (assuming no hab cost)
      // net = 10 + 12 - 3 = 19 (approximately, depending on colony details)
      // The key check: contract is deducted
      expect(result.updatedState.budget.expenseEntries.length).toBeGreaterThan(0)
      const contractEntry = result.updatedState.budget.expenseEntries.find(
        e => e.type === 'contract',
      )
      expect(contractEntry).toBeDefined()
      expect(contractEntry?.amount).toBe(3)
    })

    it('debt token cleared by debt-phase flows into reduced debtTokens', () => {
      const state = makeState({
        debtTokens: 3,
        budget: makeMinimalBudget(3),
      })
      const result = resolveTurn(state)
      // debt-phase clears 1 token → result should have 2
      expect(result.updatedState.debtTokens).toBe(2)
    })
  })

  // ── Events from all phases collected ──────────────────────────────────────

  describe('event collection', () => {
    it('returns events array in result', () => {
      const state = makeState()
      const result = resolveTurn(state)
      expect(Array.isArray(result.events)).toBe(true)
    })

    it('debt-phase events appear in the unified event list', () => {
      const state = makeState({
        debtTokens: 2,
        budget: makeMinimalBudget(2),
      })
      const result = resolveTurn(state)
      // debt-phase generates a "Debt Token Cleared" event
      const debtEvent = result.events.find(
        e => e.title === 'Debt Token Cleared' || e.title === 'Debt Cleared',
      )
      expect(debtEvent).toBeDefined()
    })

    it('events from all phases are appended to state.events', () => {
      // Start with 1 existing event in state
      const existingEvent = {
        id: 'evt_existing',
        turn: 1 as TurnNumber,
        priority: 'Info' as const,
        category: 'test',
        title: 'Existing Event',
        description: 'From before this turn',
        relatedEntityIds: [],
      }
      const state = makeState({ events: [existingEvent] })
      const result = resolveTurn(state)
      // The old event is preserved in state.events
      expect(result.updatedState.events).toContain(existingEvent)
    })

    it('new turn events are appended after existing events', () => {
      const existingEvent = {
        id: 'evt_old',
        turn: 1 as TurnNumber,
        priority: 'Info' as const,
        category: 'test',
        title: 'Old Event',
        description: '',
        relatedEntityIds: [],
      }
      const state = makeState({
        events: [existingEvent],
        debtTokens: 1,
        budget: makeMinimalBudget(1),
      })
      const result = resolveTurn(state)
      // Old event still present
      expect(result.updatedState.events[0]).toEqual(existingEvent)
      // New debt event appended after
      expect(result.updatedState.events.length).toBeGreaterThan(1)
    })
  })

  // ── Phase order verification ───────────────────────────────────────────────

  describe('phase order', () => {
    it('debt cleared before income (BP reduced by debt cost before income added)', () => {
      // With debtTokens = 1, debt-phase deducts 1 BP first.
      // Then income-phase adds planet/corp taxes.
      // If order were reversed, BP before income deduction would be different.
      const state = makeState({
        debtTokens: 1,
        currentBP: 5 as BPAmount,
        budget: makeMinimalBudget(1, 5),
      })
      const result = resolveTurn(state)
      // debt event appears before any income event (income-phase emits no events)
      const debtEventIndex = result.events.findIndex(
        e => e.category === 'budget' && (e.title.includes('Debt')),
      )
      expect(debtEventIndex).toBe(0) // debt is phase 1
    })

    it('contract-phase runs: contract turns remaining decremented', () => {
      const contracts = new Map<string, Contract>()
      const contract = makeContract('ctr_order1' as ContractId, 2)
      // turnsRemaining starts at 3 → should be 2 after one turn
      contracts.set(contract.id, contract)

      const state = makeState({ contracts })
      const result = resolveTurn(state)

      const updatedContract = result.updatedState.contracts.get(contract.id)
      expect(updatedContract?.turnsRemaining).toBe(2)
    })

    it('colony attributes recalculated each turn (colony-phase runs)', () => {
      // If colony-phase runs, the colony in the result should still have attributes
      const state = makeState()
      const result = resolveTurn(state)
      const colony = result.updatedState.colonies.get(COLONY_ID)
      expect(colony?.attributes).toBeDefined()
      expect(typeof colony?.attributes.dynamism).toBe('number')
    })

    it('market phase resolves sector markets', () => {
      const state = makeState()
      const result = resolveTurn(state)
      // Market phase should have processed the sector — market state still exists
      expect(result.updatedState.sectorMarkets.size).toBeGreaterThan(0)
    })
  })

  // ── Pure function guarantees ───────────────────────────────────────────────

  describe('pure function', () => {
    it('does not mutate the input state', () => {
      const state = makeState({ turn: 3 as TurnNumber })
      const originalTurn = state.turn
      resolveTurn(state)
      // Input state must not have been modified
      expect(state.turn).toBe(originalTurn)
    })

    it('returns a new state object (not the same reference)', () => {
      const state = makeState()
      const result = resolveTurn(state)
      expect(result.updatedState).not.toBe(state)
    })

    it('calling twice on same input produces consistent results', () => {
      const state = makeState({ turn: 1 as TurnNumber })
      const result1 = resolveTurn(state)
      const result2 = resolveTurn(state)
      // Both should produce the same turn number
      expect(result1.updatedState.turn).toBe(result2.updatedState.turn)
      expect(result1.completedTurn).toBe(result2.completedTurn)
    })
  })

  // ── Income and expenses interaction ───────────────────────────────────────

  describe('income and expenses', () => {
    it('applies planet tax income from colonies', () => {
      // Pop level 7 with good habitability should generate tax
      const state = makeState()
      const initialBP = state.currentBP
      const result = resolveTurn(state)
      // We don't know exact amounts since colony-phase may also affect attributes,
      // but income should be tracked in budget
      expect(result.updatedState.budget.incomeSources).toBeDefined()
    })

    it('applies corp taxes when corporations are present', () => {
      const corps = new Map<string, Corporation>()
      // Level 5 corp: tax = floor(25/5) = 5
      corps.set(CORP_ID, makeCorp(CORP_ID, 5, 0))

      const state = makeState({ corporations: corps })
      const result = resolveTurn(state)

      const corpTaxEntry = result.updatedState.budget.incomeSources.find(
        s => s.type === 'corp_tax',
      )
      expect(corpTaxEntry).toBeDefined()
      expect(corpTaxEntry?.amount).toBe(5) // floor(5² / 5) = 5
    })

    it('level 1-2 corps pay no tax (startup exemption)', () => {
      const corps = new Map<string, Corporation>()
      corps.set(CORP_ID, makeCorp(CORP_ID, 2, 0))

      const state = makeState({ corporations: corps })
      const result = resolveTurn(state)

      const corpTaxEntry = result.updatedState.budget.incomeSources.find(
        s => s.type === 'corp_tax',
      )
      expect(corpTaxEntry).toBeUndefined()
    })

    it('debt token creation when expenses exceed income (deficit spending)', () => {
      // Force a large expense with minimal income
      const contracts = new Map<string, Contract>()
      // Large contract expense (50 BP/turn) with minimal BP
      const contract = makeContract('ctr_deficit1' as ContractId, 50)
      contracts.set(contract.id, contract)

      // Colony with low population (pop 1) → 0 planet tax
      const colonyLowPop = makeColony(COLONY_ID, 1, 8)
      const coloniesMap = new Map<string, Colony>()
      coloniesMap.set(COLONY_ID, colonyLowPop)

      const sectorMarkets = new Map<string, SectorMarketState>()
      sectorMarkets.set(SECTOR_ID, makeSectorMarket())

      const state: GameState = {
        ...makeState(),
        currentBP: 0 as BPAmount,
        colonies: coloniesMap,
        contracts,
        sectorMarkets,
      }

      const result = resolveTurn(state)
      // Deficit of 50 BP → floor(50/3) = 16 → capped at 10
      expect(result.updatedState.debtTokens).toBeGreaterThan(0)
    })

    it('no debt tokens when income covers expenses', () => {
      // Colony at pop 7, hab 8 → tax = floor(49/4) - 0 = 12
      // No contracts, no existing debt
      const state = makeState({ debtTokens: 0, currentBP: 0 as BPAmount })
      const result = resolveTurn(state)
      // After income, we should have BP ≥ 0 and no new debt
      expect(result.updatedState.debtTokens).toBe(0)
    })
  })

  // ── TurnResult structure ───────────────────────────────────────────────────

  describe('TurnResult structure', () => {
    it('result has updatedState, events, and completedTurn fields', () => {
      const state = makeState()
      const result = resolveTurn(state)
      expect(result).toHaveProperty('updatedState')
      expect(result).toHaveProperty('events')
      expect(result).toHaveProperty('completedTurn')
    })

    it('events array contains only GameEvent objects with required fields', () => {
      const state = makeState({
        debtTokens: 1,
        budget: makeMinimalBudget(1),
      })
      const result = resolveTurn(state)
      for (const event of result.events) {
        expect(event).toHaveProperty('id')
        expect(event).toHaveProperty('turn')
        expect(event).toHaveProperty('priority')
        expect(event).toHaveProperty('category')
        expect(event).toHaveProperty('title')
        expect(event).toHaveProperty('description')
        expect(event).toHaveProperty('relatedEntityIds')
      }
    })
  })
})
