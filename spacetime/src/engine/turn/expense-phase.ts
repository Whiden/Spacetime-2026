/**
 * expense-phase.ts — Expense calculation during turn resolution.
 *
 * Runs as phase #3 of turn resolution (after income-phase, before contract-phase).
 *
 * Responsibilities:
 *   1. Sum all active contract BP/turn costs.
 *   2. Sum all active mission BP/turn costs.
 *   3. Deduct total expenses from currentBP.
 *   4. Handle deficit → new debt tokens if net is negative.
 *   5. Return itemised expense entries on the budget state.
 *
 * Note: Debt token clearance (1 BP) is already deducted directly by debt-phase
 * before this phase runs. It does not appear as an expense entry here.
 *
 * Formulas (Specs.md § 2):
 *   debt_tokens_gained = floor(deficit / 3), minimum 1 if any deficit
 *   max debt tokens: 10
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 12.2): Expand with dedicated unit tests and full itemised
 *   expense breakdowns. Also add direct_invest expense type for player
 *   infrastructure purchases made during the player-action phase.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { ExpenseEntry } from '../../types/budget'
import type { ContractId, MissionId } from '../../types/common'
import { ContractStatus } from '../../types/common'

const MAX_DEBT_TOKENS = 10

// ─── Expense Phase ────────────────────────────────────────────────────────────

/**
 * resolveExpensePhase — Phase #3: calculate and apply all expenses.
 *
 * Deducts active contract costs and mission costs from BP.
 * If the turn ends in deficit, creates new debt tokens (capped at 10).
 */
export function resolveExpensePhase(state: GameState): PhaseResult {
  const expenseEntries: ExpenseEntry[] = []

  // ── Active contract costs ────────────────────────────────────────────────────
  for (const [, contract] of state.contracts) {
    if (contract.status !== ContractStatus.Active) continue
    // Trade routes (sentinel 9999) and regular contracts both count here
    expenseEntries.push({
      type: 'contract',
      sourceId: contract.id as ContractId,
      sourceName: `Contract (${contract.type})`,
      amount: contract.bpPerTurn,
    })
  }

  // ── Active mission costs ─────────────────────────────────────────────────────
  for (const [, mission] of state.missions) {
    if (mission.completedTurn !== null) continue
    expenseEntries.push({
      type: 'mission',
      sourceId: mission.id as MissionId,
      sourceName: `Mission (${mission.type})`,
      amount: mission.bpPerTurn,
    })
  }

  const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0)
  const newBP = state.currentBP - totalExpenses

  // ── Deficit → new debt tokens ────────────────────────────────────────────────
  let newDebtTokens = state.debtTokens
  if (newBP < 0) {
    const deficit = Math.abs(newBP)
    const tokensGained = Math.max(1, Math.floor(deficit / 3))
    newDebtTokens = Math.min(MAX_DEBT_TOKENS, newDebtTokens + tokensGained)
  }

  const updatedState: GameState = {
    ...state,
    currentBP: newBP,
    debtTokens: newDebtTokens,
    budget: {
      ...state.budget,
      currentBP: newBP,
      expenseEntries,
      totalExpenses,
      netBP: (state.budget.totalIncome ?? 0) - totalExpenses,
      debtTokens: newDebtTokens,
      stabilityMalus: Math.floor(newDebtTokens / 2),
      calculatedTurn: state.turn,
    },
  }

  return { updatedState, events: [] }
}
