/**
 * budget.ts — Budget state, debt tokens, income sources, and expense entries.
 *
 * Budget Points (BP) are the single currency of the game.
 * Income from planet taxes and corp taxes; expenses from contracts, missions, and investments.
 *
 * TODO (Story 5.1): tax.ts implements planet and corp tax formulas.
 * TODO (Story 5.2): budget.store.ts manages the budget state.
 * TODO (Story 12.2): income-phase.ts and expense-phase.ts wire into turn resolution.
 */

import type { BPAmount, ColonyId, CorpId, ContractId, MissionId, TurnNumber } from './common'

// ─── Income Sources ───────────────────────────────────────────────────────────

/** A single itemized income entry, shown in the budget breakdown UI. */
export type IncomeSourceType =
  | 'planet_tax'   // Tax from a colony's population
  | 'corp_tax'     // Tax from a corporation's prosperity level

export interface IncomeSource {
  type: IncomeSourceType
  sourceId: ColonyId | CorpId
  sourceName: string
  amount: BPAmount
}

// ─── Expense Entries ──────────────────────────────────────────────────────────

/** A single itemized expense entry, shown in the budget breakdown UI. */
export type ExpenseSourceType =
  | 'contract'         // BP/turn cost of an active contract
  | 'mission'          // BP/turn cost of an active mission
  | 'direct_invest'    // One-time 3 BP direct infrastructure investment
  | 'debt_clearance'   // 1 BP per debt token cleared per turn

export interface ExpenseEntry {
  type: ExpenseSourceType
  sourceId: ContractId | MissionId | ColonyId | 'debt'
  sourceName: string
  amount: BPAmount
}

// ─── Budget State ─────────────────────────────────────────────────────────────

/**
 * Complete budget state for the current turn.
 * Recalculated at the start of each turn (income phase → expense phase).
 *
 * Debt system (from Specs.md § 2):
 * - Deficit at end of turn → floor(deficit / 3) debt tokens (min 1)
 * - Max 10 debt tokens
 * - Each turn: 1 token cleared automatically, costing 1 BP
 * - Stability malus: floor(debtTokens / 2) per colony
 */
export interface BudgetState {
  /** Current BP balance available for player actions. */
  currentBP: BPAmount

  /** Itemized income sources for the current turn. */
  incomeSources: IncomeSource[]

  /** Itemized expense entries for the current turn. */
  expenseEntries: ExpenseEntry[]

  /** Total income this turn (sum of incomeSources). */
  totalIncome: BPAmount

  /** Total expenses this turn (sum of expenseEntries). */
  totalExpenses: BPAmount

  /** Net BP per turn (income - expenses). Negative = deficit. */
  netBP: BPAmount

  /** Current debt token count (0-10). Each represents economic damage from deficit spending. */
  debtTokens: number

  /** Stability penalty applied to all colonies from debt: floor(debtTokens / 2). */
  stabilityMalus: number

  /** Turn this budget state was calculated. */
  calculatedTurn: TurnNumber
}

// ─── Budget History Entry ─────────────────────────────────────────────────────

/**
 * A historical snapshot of the budget for a past turn.
 * Used for trend display and audit history.
 */
export interface BudgetHistoryEntry {
  turn: TurnNumber
  totalIncome: BPAmount
  totalExpenses: BPAmount
  netBP: BPAmount
  debtTokensAtEndOfTurn: number
}
