/**
 * debt-phase.test.ts — Unit tests for the debt phase (Story 12.3).
 *
 * Acceptance criteria verified:
 * - No tokens: state returned unchanged, no events
 * - Token present: clears 1 token, deducts 1 BP, emits event
 * - Many tokens: clears exactly 1 per call, remainder decremented
 * - BP can go negative (debt costs BP regardless of balance)
 * - budget.debtTokens and budget.stabilityMalus kept in sync
 */

import { describe, it, expect } from 'vitest'
import { resolveDebtPhase } from '../../../engine/turn/debt-phase'
import type { GameState } from '../../../types/game'
import type { BudgetState } from '../../../types/budget'
import type { SectorMarketState } from '../../../types/trade'
import type { Galaxy, Sector } from '../../../types/sector'
import type { BPAmount, SectorId, TurnNumber } from '../../../types/common'
import { ResourceType, SectorDensity } from '../../../types/common'
import { createEmptyEmpireBonuses } from '../../../types/empire'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeZeroResources(): Record<ResourceType, number> {
  return Object.values(ResourceType).reduce(
    (acc, r) => ({ ...acc, [r]: 0 }),
    {} as Record<ResourceType, number>,
  )
}

function makeGalaxy(): Galaxy {
  const sectorId = 'sec_debt01' as SectorId
  const sector: Sector = {
    id: sectorId,
    name: 'Debt Sector',
    density: SectorDensity.Moderate,
    explorationPercent: 0,
    threatModifier: 1.0,
    firstEnteredTurn: 1 as TurnNumber,
  }
  const sectors = new Map<SectorId, Sector>([[sectorId, sector]])
  const adjacency = new Map<SectorId, SectorId[]>([[sectorId, []]])
  return { sectors, adjacency, startingSectorId: sectorId }
}

function makeMinimalBudget(currentBP = 10, debtTokens = 0): BudgetState {
  return {
    currentBP: currentBP as BPAmount,
    incomeSources: [],
    expenseEntries: [],
    totalIncome: 0 as BPAmount,
    totalExpenses: 0 as BPAmount,
    netBP: currentBP as BPAmount,
    debtTokens,
    stabilityMalus: Math.floor(debtTokens / 2),
    calculatedTurn: 1 as TurnNumber,
  }
}

function makeState(debtTokens: number, currentBP = 10): GameState {
  const sectorMarkets = new Map<string, SectorMarketState>()
  return {
    turn: 1 as TurnNumber,
    phase: 'player_action',
    currentBP: currentBP as BPAmount,
    debtTokens,
    budget: makeMinimalBudget(currentBP, debtTokens),
    empireBonuses: createEmptyEmpireBonuses(),
    galaxy: makeGalaxy(),
    colonies: new Map(),
    planets: new Map(),
    corporations: new Map(),
    contracts: new Map(),
    ships: new Map(),
    missions: new Map(),
    scienceDomains: new Map(),
    discoveries: new Map(),
    schematics: new Map(),
    patents: new Map(),
    sectorMarkets,
    events: [],
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveDebtPhase', () => {
  describe('no tokens scenario', () => {
    it('returns state unchanged when debtTokens = 0', () => {
      const state = makeState(0, 10)
      const { updatedState } = resolveDebtPhase(state)
      expect(updatedState.debtTokens).toBe(0)
      expect(updatedState.currentBP).toBe(10)
    })

    it('emits no events when debtTokens = 0', () => {
      const state = makeState(0)
      const { events } = resolveDebtPhase(state)
      expect(events).toHaveLength(0)
    })

    it('returns the same state reference when debtTokens = 0', () => {
      const state = makeState(0)
      const { updatedState } = resolveDebtPhase(state)
      expect(updatedState).toBe(state)
    })
  })

  describe('token clearing', () => {
    it('clears exactly 1 token when debtTokens = 1', () => {
      const { updatedState } = resolveDebtPhase(makeState(1))
      expect(updatedState.debtTokens).toBe(0)
    })

    it('deducts 1 BP when clearing a token', () => {
      const { updatedState } = resolveDebtPhase(makeState(1, 10))
      expect(updatedState.currentBP).toBe(9)
    })

    it('emits exactly 1 event when clearing a token', () => {
      const { events } = resolveDebtPhase(makeState(1))
      expect(events).toHaveLength(1)
    })

    it('event has category "budget"', () => {
      const { events } = resolveDebtPhase(makeState(1))
      expect(events[0].category).toBe('budget')
    })

    it('event is Positive priority when last token cleared', () => {
      const { events } = resolveDebtPhase(makeState(1))
      expect(events[0].priority).toBe('Positive')
    })

    it('event is Info priority when tokens remain after clearing', () => {
      const { events } = resolveDebtPhase(makeState(3))
      expect(events[0].priority).toBe('Info')
    })
  })

  describe('many tokens scenario', () => {
    it('clears exactly 1 token when debtTokens = 5', () => {
      const { updatedState } = resolveDebtPhase(makeState(5))
      expect(updatedState.debtTokens).toBe(4)
    })

    it('clears exactly 1 token when debtTokens = 10', () => {
      const { updatedState } = resolveDebtPhase(makeState(10))
      expect(updatedState.debtTokens).toBe(9)
    })

    it('still deducts exactly 1 BP regardless of token count', () => {
      const { updatedState } = resolveDebtPhase(makeState(10, 20))
      expect(updatedState.currentBP).toBe(19)
    })
  })

  describe('BP edge cases', () => {
    it('BP can go negative (debt costs BP regardless of balance)', () => {
      const { updatedState } = resolveDebtPhase(makeState(1, 0))
      expect(updatedState.currentBP).toBe(-1)
    })

    it('BP goes from 1 to 0 when clearing 1 token', () => {
      const { updatedState } = resolveDebtPhase(makeState(1, 1))
      expect(updatedState.currentBP).toBe(0)
    })
  })

  describe('budget state sync', () => {
    it('budget.debtTokens matches state.debtTokens after clearing', () => {
      const { updatedState } = resolveDebtPhase(makeState(3))
      expect(updatedState.budget.debtTokens).toBe(updatedState.debtTokens)
    })

    it('budget.currentBP matches state.currentBP after clearing', () => {
      const { updatedState } = resolveDebtPhase(makeState(1, 10))
      expect(updatedState.budget.currentBP).toBe(updatedState.currentBP)
    })

    it('budget.stabilityMalus = floor(remainingTokens / 2)', () => {
      // 5 tokens → clear 1 → 4 remain → malus = 2
      const { updatedState } = resolveDebtPhase(makeState(5))
      expect(updatedState.budget.stabilityMalus).toBe(2)
    })

    it('budget.stabilityMalus = 0 when last token cleared', () => {
      const { updatedState } = resolveDebtPhase(makeState(1))
      expect(updatedState.budget.stabilityMalus).toBe(0)
    })

    it('budget.stabilityMalus = 0 when no tokens exist', () => {
      const { updatedState } = resolveDebtPhase(makeState(0))
      expect(updatedState.budget.stabilityMalus).toBe(0)
    })
  })

  describe('immutability', () => {
    it('does not mutate the input state', () => {
      const state = makeState(3, 10)
      resolveDebtPhase(state)
      expect(state.debtTokens).toBe(3)
      expect(state.currentBP).toBe(10)
    })
  })
})
