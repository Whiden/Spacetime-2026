/**
 * expense-phase.test.ts — Unit tests for the expense phase (Story 12.2).
 *
 * Acceptance criteria verified:
 * - Sums all active contract BP/turn costs, returns itemized expenses
 * - Sums all active mission BP/turn costs
 * - Returns typed result object with per-source breakdowns
 * - Multiple expense types (contracts + missions)
 * - Zero expense scenario (no active contracts or missions)
 * - Deficit → new debt tokens: floor(deficit / 3), minimum 1 if any deficit
 * - Deficit debt tokens are capped at 10
 * - Completed contracts (non-Active status) are excluded
 * - Completed missions (completedTurn not null) are excluded
 * - currentBP is decremented by total expenses
 * - Budget state updated with totalExpenses, expenseEntries, netBP, debtTokens
 * - No events emitted (expense phase is silent)
 */

import { describe, it, expect } from 'vitest'
import { resolveExpensePhase } from '../../../engine/turn/expense-phase'
import type { GameState } from '../../../types/game'
import type { BudgetState } from '../../../types/budget'
import type { Colony } from '../../../types/colony'
import type { Planet } from '../../../types/planet'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { Contract } from '../../../types/contract'
import type { Mission, TaskForce } from '../../../types/mission'
import type { Sector, Galaxy } from '../../../types/sector'
import type { SectorMarketState } from '../../../types/trade'
import type {
  ColonyId,
  CorpId,
  ContractId,
  MissionId,
  CaptainId,
  SectorId,
  PlanetId,
  ShipId,
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
  ContractType,
  ContractStatus,
  MissionType,
  MissionPhase,
} from '../../../types/common'
import { createEmptyEmpireBonuses } from '../../../types/empire'

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const SECTOR_ID  = 'sec_exp001' as SectorId
const PLANET_ID  = 'pln_exp001' as PlanetId
const COLONY_ID  = 'col_exp001' as ColonyId
const CORP_ID    = 'corp_exp01' as CorpId
const CONTRACT_ID = 'ctr_exp001' as ContractId
const MISSION_ID = 'msn_exp001' as MissionId

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

function makeColony(id: ColonyId = COLONY_ID): Colony {
  return {
    id,
    planetId: PLANET_ID,
    sectorId: SECTOR_ID,
    name: `Colony ${id}`,
    type: ColonyType.FrontierColony,
    populationLevel: 3,
    attributes: {
      habitability: 7,
      accessibility: 4,
      dynamism: 4,
      qualityOfLife: 7,
      stability: 7,
      growth: 0,
    },
    infrastructure: makeInfra({ [InfraDomain.Civilian]: 2 }),
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
    baseHabitability: 7,
    deposits: [],
    features: [],
    featureModifiers: [],
    orbitScanTurn: 1,
    groundSurveyTurn: 1,
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

function makeMinimalBudget(currentBP = 10, totalIncome = 0): BudgetState {
  return {
    currentBP: currentBP as BPAmount,
    incomeSources: [],
    expenseEntries: [],
    totalIncome: totalIncome as BPAmount,
    totalExpenses: 0 as BPAmount,
    netBP: currentBP as BPAmount,
    debtTokens: 0,
    stabilityMalus: 0,
    calculatedTurn: 1 as TurnNumber,
  }
}

/** Create an active contract with the given BP/turn cost. */
function makeContract(
  id: ContractId,
  bpPerTurn = 2,
  status: ContractStatus = ContractStatus.Active,
): Contract {
  return {
    id,
    type: ContractType.Exploration,
    status,
    target: { type: 'sector', sectorId: SECTOR_ID },
    assignedCorpId: CORP_ID,
    bpPerTurn: bpPerTurn as BPAmount,
    durationTurns: 5,
    turnsRemaining: 3,
    startTurn: 1 as TurnNumber,
    completedTurn: null,
  }
}

/** Create an active mission with the given BP/turn cost. */
function makeMission(
  id: MissionId,
  bpPerTurn = 2,
  completedTurn: TurnNumber | null = null,
): Mission {
  const taskForce: TaskForce = {
    shipIds: ['shp_001' as ShipId],
    commanderCaptainId: 'cap_001' as CaptainId,
  }
  return {
    id,
    type: MissionType.Assault,
    phase: MissionPhase.Travel,
    targetSectorId: SECTOR_ID,
    taskForce,
    bpPerTurn: bpPerTurn as BPAmount,
    travelTurnsRemaining: 2,
    executionTurnsRemaining: 0,
    returnTurnsRemaining: 0,
    startTurn: 1 as TurnNumber,
    completedTurn,
    report: null,
  }
}

/** Build a minimal GameState for expense-phase testing. */
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
    currentBP: 20 as BPAmount,
    debtTokens: 0,
    budget: makeMinimalBudget(20, 0),
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

describe('resolveExpensePhase', () => {

  // ── Zero expense scenario ─────────────────────────────────────────────────

  describe('zero expense scenario', () => {
    it('returns empty expenseEntries when no contracts or missions', () => {
      const state = makeState()
      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.budget.expenseEntries).toHaveLength(0)
    })

    it('does not change currentBP when there are no expenses', () => {
      const state = makeState({ currentBP: 15 as BPAmount })
      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.currentBP).toBe(15)
    })

    it('sets totalExpenses to 0 when there are no active contracts or missions', () => {
      const state = makeState()
      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.budget.totalExpenses).toBe(0)
    })

    it('does not create debt tokens when there are no expenses', () => {
      const state = makeState({ currentBP: 10 as BPAmount, debtTokens: 0 })
      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.debtTokens).toBe(0)
    })

    it('emits no events (expense phase is silent)', () => {
      const state = makeState()
      const { events } = resolveExpensePhase(state)
      expect(events).toHaveLength(0)
    })
  })

  // ── Contract expenses ─────────────────────────────────────────────────────

  describe('contract expenses', () => {
    it('generates a contract expense entry for each active contract', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 3))
      const state = makeState({ contracts })

      const { updatedState } = resolveExpensePhase(state)
      const contractEntries = updatedState.budget.expenseEntries.filter(
        e => e.type === 'contract',
      )
      expect(contractEntries).toHaveLength(1)
      expect(contractEntries[0].amount).toBe(3)
    })

    it('uses the contract ID for sourceId attribution', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 2))
      const state = makeState({ contracts })

      const { updatedState } = resolveExpensePhase(state)
      const entry = updatedState.budget.expenseEntries.find(e => e.type === 'contract')
      expect(entry?.sourceId).toBe(CONTRACT_ID)
    })

    it('skips completed contracts (status !== Active)', () => {
      const contracts = new Map<string, Contract>()
      // Active contract
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 3, ContractStatus.Active))
      // Completed contract — should be excluded
      const completedId = 'ctr_exp002' as ContractId
      contracts.set(completedId, makeContract(completedId, 5, ContractStatus.Completed))

      const state = makeState({ contracts })
      const { updatedState } = resolveExpensePhase(state)

      const contractEntries = updatedState.budget.expenseEntries.filter(
        e => e.type === 'contract',
      )
      // Only the active contract should appear
      expect(contractEntries).toHaveLength(1)
      expect(contractEntries[0].sourceId).toBe(CONTRACT_ID)
    })

    it('sums multiple active contracts correctly', () => {
      const contracts = new Map<string, Contract>()
      const ctr1Id = 'ctr_exp001' as ContractId
      const ctr2Id = 'ctr_exp002' as ContractId
      const ctr3Id = 'ctr_exp003' as ContractId
      contracts.set(ctr1Id, makeContract(ctr1Id, 2))
      contracts.set(ctr2Id, makeContract(ctr2Id, 4))
      contracts.set(ctr3Id, makeContract(ctr3Id, 1))

      const state = makeState({ contracts })
      const { updatedState } = resolveExpensePhase(state)

      const contractEntries = updatedState.budget.expenseEntries.filter(
        e => e.type === 'contract',
      )
      expect(contractEntries).toHaveLength(3)
      const totalContractCost = contractEntries.reduce((sum, e) => sum + e.amount, 0)
      expect(totalContractCost).toBe(7) // 2 + 4 + 1
    })
  })

  // ── Mission expenses ──────────────────────────────────────────────────────

  describe('mission expenses', () => {
    it('generates a mission expense entry for each active mission', () => {
      const missions = new Map<string, Mission>()
      missions.set(MISSION_ID, makeMission(MISSION_ID, 2))
      const state = makeState({ missions })

      const { updatedState } = resolveExpensePhase(state)
      const missionEntries = updatedState.budget.expenseEntries.filter(
        e => e.type === 'mission',
      )
      expect(missionEntries).toHaveLength(1)
      expect(missionEntries[0].amount).toBe(2)
    })

    it('uses the mission ID for sourceId attribution', () => {
      const missions = new Map<string, Mission>()
      missions.set(MISSION_ID, makeMission(MISSION_ID, 2))
      const state = makeState({ missions })

      const { updatedState } = resolveExpensePhase(state)
      const entry = updatedState.budget.expenseEntries.find(e => e.type === 'mission')
      expect(entry?.sourceId).toBe(MISSION_ID)
    })

    it('skips completed missions (completedTurn !== null)', () => {
      const missions = new Map<string, Mission>()
      // Active mission
      missions.set(MISSION_ID, makeMission(MISSION_ID, 3, null))
      // Completed mission — should be excluded
      const completedMissionId = 'msn_exp002' as MissionId
      missions.set(completedMissionId, makeMission(completedMissionId, 5, 2 as TurnNumber))

      const state = makeState({ missions })
      const { updatedState } = resolveExpensePhase(state)

      const missionEntries = updatedState.budget.expenseEntries.filter(
        e => e.type === 'mission',
      )
      // Only the active mission should appear
      expect(missionEntries).toHaveLength(1)
      expect(missionEntries[0].sourceId).toBe(MISSION_ID)
    })

    it('sums multiple active missions correctly', () => {
      const missions = new Map<string, Mission>()
      const msn1Id = 'msn_exp001' as MissionId
      const msn2Id = 'msn_exp002' as MissionId
      missions.set(msn1Id, makeMission(msn1Id, 3))
      missions.set(msn2Id, makeMission(msn2Id, 2))

      const state = makeState({ missions })
      const { updatedState } = resolveExpensePhase(state)

      const missionEntries = updatedState.budget.expenseEntries.filter(
        e => e.type === 'mission',
      )
      expect(missionEntries).toHaveLength(2)
      const totalMissionCost = missionEntries.reduce((sum, e) => sum + e.amount, 0)
      expect(totalMissionCost).toBe(5) // 3 + 2
    })
  })

  // ── Multiple expense types ────────────────────────────────────────────────

  describe('multiple expense types', () => {
    it('combines contract and mission expenses into a single expenseEntries array', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 3))

      const missions = new Map<string, Mission>()
      missions.set(MISSION_ID, makeMission(MISSION_ID, 2))

      const state = makeState({ contracts, missions })
      const { updatedState } = resolveExpensePhase(state)

      expect(updatedState.budget.expenseEntries).toHaveLength(2)
      expect(updatedState.budget.expenseEntries.some(e => e.type === 'contract')).toBe(true)
      expect(updatedState.budget.expenseEntries.some(e => e.type === 'mission')).toBe(true)
    })

    it('calculates totalExpenses as sum of contracts + missions', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 4))

      const missions = new Map<string, Mission>()
      missions.set(MISSION_ID, makeMission(MISSION_ID, 3))

      const state = makeState({ contracts, missions })
      const { updatedState } = resolveExpensePhase(state)

      expect(updatedState.budget.totalExpenses).toBe(7) // 4 + 3
    })

    it('deducts combined expenses from currentBP', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 4))

      const missions = new Map<string, Mission>()
      missions.set(MISSION_ID, makeMission(MISSION_ID, 3))

      const state = makeState({
        contracts,
        missions,
        currentBP: 20 as BPAmount,
      })
      const { updatedState } = resolveExpensePhase(state)

      expect(updatedState.currentBP).toBe(13) // 20 - 7
    })
  })

  // ── BP deduction ──────────────────────────────────────────────────────────

  describe('BP deduction', () => {
    it('deducts contract costs from currentBP', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 5))
      const state = makeState({ contracts, currentBP: 20 as BPAmount })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.currentBP).toBe(15) // 20 - 5
    })

    it('deducts mission costs from currentBP', () => {
      const missions = new Map<string, Mission>()
      missions.set(MISSION_ID, makeMission(MISSION_ID, 4))
      const state = makeState({ missions, currentBP: 20 as BPAmount })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.currentBP).toBe(16) // 20 - 4
    })

    it('allows currentBP to go negative (deficit triggers debt tokens)', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 10))
      const state = makeState({ contracts, currentBP: 5 as BPAmount })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.currentBP).toBe(-5)
    })
  })

  // ── Debt token generation ─────────────────────────────────────────────────

  describe('debt token generation on deficit', () => {
    it('creates debt tokens when expenses exceed currentBP', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 10))
      const state = makeState({
        contracts,
        currentBP: 5 as BPAmount, // 5 - 10 = -5 deficit
        debtTokens: 0,
      })

      const { updatedState } = resolveExpensePhase(state)
      // deficit = 5, tokens = floor(5/3) = 1 (minimum 1)
      expect(updatedState.debtTokens).toBe(1)
    })

    it('applies minimum of 1 debt token for any deficit', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 2))
      const state = makeState({
        contracts,
        currentBP: 1 as BPAmount, // 1 - 2 = -1 deficit
        debtTokens: 0,
      })

      const { updatedState } = resolveExpensePhase(state)
      // deficit = 1, tokens = max(1, floor(1/3)) = max(1, 0) = 1
      expect(updatedState.debtTokens).toBe(1)
    })

    it('calculates debt tokens as floor(deficit / 3)', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 16))
      const state = makeState({
        contracts,
        currentBP: 7 as BPAmount, // 7 - 16 = -9 deficit
        debtTokens: 0,
      })

      const { updatedState } = resolveExpensePhase(state)
      // deficit = 9, tokens = max(1, floor(9/3)) = max(1, 3) = 3
      expect(updatedState.debtTokens).toBe(3)
    })

    it('accumulates debt tokens with existing tokens', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 16))
      const state = makeState({
        contracts,
        currentBP: 7 as BPAmount, // deficit = 9 → 3 new tokens
        debtTokens: 2,             // already have 2
      })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.debtTokens).toBe(5) // 2 + 3
    })

    it('caps debt tokens at 10 regardless of deficit size', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 100))
      const state = makeState({
        contracts,
        currentBP: 0 as BPAmount, // deficit = 100 → floor(100/3) = 33 new tokens
        debtTokens: 0,
      })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.debtTokens).toBe(10) // capped at 10
    })

    it('does not exceed 10 tokens when already near cap', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 10))
      const state = makeState({
        contracts,
        currentBP: 0 as BPAmount, // deficit = 10 → 3 new tokens
        debtTokens: 9,             // already at 9
      })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.debtTokens).toBe(10) // 9 + 3 capped at 10
    })

    it('does not create debt tokens when BP is exactly zero after expenses', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 10))
      const state = makeState({
        contracts,
        currentBP: 10 as BPAmount, // 10 - 10 = 0, no deficit
        debtTokens: 0,
      })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.debtTokens).toBe(0)
      expect(updatedState.currentBP).toBe(0)
    })

    it('does not create debt tokens when expenses are less than BP', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 3))
      const state = makeState({
        contracts,
        currentBP: 10 as BPAmount, // 10 - 3 = 7, surplus
        debtTokens: 0,
      })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.debtTokens).toBe(0)
    })
  })

  // ── Budget state update ───────────────────────────────────────────────────

  describe('budget state update', () => {
    it('updates budget.totalExpenses correctly', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 6))
      const state = makeState({ contracts })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.budget.totalExpenses).toBe(6)
    })

    it('updates budget.currentBP to match state.currentBP', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 4))
      const state = makeState({ contracts, currentBP: 20 as BPAmount })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.budget.currentBP).toBe(16)
      expect(updatedState.currentBP).toBe(16)
    })

    it('updates budget.debtTokens to reflect new token count', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 10))
      const state = makeState({
        contracts,
        currentBP: 5 as BPAmount, // deficit = 5 → 1 token
        debtTokens: 0,
        budget: makeMinimalBudget(5, 0),
      })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.budget.debtTokens).toBe(1)
    })

    it('updates budget.stabilityMalus to floor(debtTokens / 2)', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 20))
      const state = makeState({
        contracts,
        currentBP: 0 as BPAmount, // deficit = 20 → 6 tokens
        debtTokens: 0,
      })

      const { updatedState } = resolveExpensePhase(state)
      // 6 debt tokens → stabilityMalus = floor(6/2) = 3
      expect(updatedState.budget.stabilityMalus).toBe(3)
    })

    it('updates budget.netBP as totalIncome - totalExpenses', () => {
      const contracts = new Map<string, Contract>()
      contracts.set(CONTRACT_ID, makeContract(CONTRACT_ID, 5))
      // Simulate income phase having already run (totalIncome = 10)
      const state = makeState({
        contracts,
        budget: makeMinimalBudget(20, 10), // totalIncome already set to 10
      })

      const { updatedState } = resolveExpensePhase(state)
      expect(updatedState.budget.netBP).toBe(5) // 10 - 5
    })

    it('preserves existing incomeSources on budget (does not clear them)', () => {
      // The expense phase should not touch incomeSources — that is the income phase's job
      const state = makeState()
      const stateWithIncome: GameState = {
        ...state,
        budget: {
          ...state.budget,
          incomeSources: [
            {
              type: 'planet_tax',
              sourceId: COLONY_ID,
              sourceName: 'Test Colony',
              amount: 8 as BPAmount,
            },
          ],
        },
      }
      const { updatedState } = resolveExpensePhase(stateWithIncome)
      expect(updatedState.budget.incomeSources).toHaveLength(1)
      expect(updatedState.budget.incomeSources[0].type).toBe('planet_tax')
    })
  })

})
