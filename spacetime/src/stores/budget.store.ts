/**
 * budget.store.ts — Pinia store for budget state.
 *
 * Manages BP balance, itemized income/expenses, and debt tokens.
 * Calls tax formulas from engine to calculate income.
 *
 * TODO (Story 5.3): Budget display composable reads from this store.
 * TODO (Story 12.2): income-phase.ts and expense-phase.ts produce income/expense data for this store.
 * TODO (Story 12.4): game.store.ts calls initialize() during game init.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BPAmount, ColonyId, CorpId, ContractId, MissionId } from '../types/common'
import type { IncomeSource, ExpenseEntry } from '../types/budget'
import { calculatePlanetTax, calculateCorpTax } from '../engine/formulas/tax'
import { useColonyStore } from './colony.store'
import { STARTING_BP, MAX_DEBT_TOKENS, DEBT_TOKEN_CLEAR_COST_BP } from '../data/start-conditions'

export const useBudgetStore = defineStore('budget', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** Current BP balance available for player actions. */
  const currentBP = ref<number>(0)

  /** Itemized income sources for the current turn. */
  const incomeSources = ref<IncomeSource[]>([])

  /** Itemized expense entries for the current turn. */
  const expenseEntries = ref<ExpenseEntry[]>([])

  /** Current debt token count (0-10). */
  const debtTokens = ref<number>(0)

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** Total income this turn (sum of all income sources). */
  const totalIncome = computed<number>(() =>
    incomeSources.value.reduce((sum, source) => sum + source.amount, 0),
  )

  /** Total expenses this turn (sum of all expense entries). */
  const totalExpenses = computed<number>(() =>
    expenseEntries.value.reduce((sum, entry) => sum + entry.amount, 0),
  )

  /** Net BP per turn (income - expenses). Negative means deficit. */
  const netBP = computed<number>(() => totalIncome.value - totalExpenses.value)

  /** Stability penalty applied to all colonies from debt: floor(debtTokens / 2). */
  const stabilityMalus = computed<number>(() => Math.floor(debtTokens.value / 2))

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Initializes the budget store with starting values.
   * Called once at game start. Sets BP to STARTING_BP (10) and calculates
   * initial income from Terra Nova.
   */
  function initialize() {
    currentBP.value = STARTING_BP
    debtTokens.value = 0
    expenseEntries.value = []
    calculateIncome()
  }

  /**
   * Recalculates all income sources from planet taxes and corporation taxes.
   * Reads colony store for planet taxes and will read corp store for corp taxes
   * once corporations exist.
   *
   * TODO (Story 6.2): corporation.store.ts provides corp data for corp tax calculation.
   */
  function calculateIncome() {
    const colonyStore = useColonyStore()
    const sources: IncomeSource[] = []

    // Planet taxes: one entry per colony
    for (const colony of colonyStore.allColonies) {
      const tax = calculatePlanetTax(colony.populationLevel, colony.attributes.habitability)
      if (tax > 0) {
        sources.push({
          type: 'planet_tax',
          sourceId: colony.id,
          sourceName: colony.name,
          amount: tax as BPAmount,
        })
      }
    }

    // Corporation taxes: one entry per corporation
    // TODO (Story 6.2): Iterate corporation store and calculate corp taxes
    // const corpStore = useCorporationStore()
    // for (const corp of corpStore.allCorporations) {
    //   const tax = calculateCorpTax(corp.level)
    //   if (tax > 0) {
    //     sources.push({
    //       type: 'corp_tax',
    //       sourceId: corp.id,
    //       sourceName: corp.name,
    //       amount: tax as BPAmount,
    //     })
    //   }
    // }

    incomeSources.value = sources
  }

  /**
   * Adds an expense entry to the current turn's expense list.
   *
   * @param type - Category of expense
   * @param sourceId - ID of the entity causing the expense
   * @param sourceName - Human-readable name for the expense
   * @param amount - BP amount for this expense
   */
  function addExpense(
    type: ExpenseEntry['type'],
    sourceId: ExpenseEntry['sourceId'],
    sourceName: string,
    amount: number,
  ) {
    expenseEntries.value.push({
      type,
      sourceId,
      sourceName,
      amount: amount as BPAmount,
    })
  }

  /**
   * Removes all expense entries (called at turn start before recalculating).
   */
  function clearExpenses() {
    expenseEntries.value = []
  }

  /**
   * Creates debt tokens from a deficit.
   * Tokens gained = floor(deficit / 3), minimum 1 if any deficit exists.
   * Total tokens capped at MAX_DEBT_TOKENS (10).
   *
   * @param deficit - The positive deficit amount (income - expenses when negative)
   */
  function applyDebt(deficit: number) {
    if (deficit <= 0) return

    const tokensGained = Math.max(1, Math.floor(deficit / 3))
    debtTokens.value = Math.min(MAX_DEBT_TOKENS, debtTokens.value + tokensGained)
  }

  /**
   * Clears one debt token, costing 1 BP.
   * Called at the start of each turn during the debt phase.
   * Does nothing if no debt tokens exist or insufficient BP.
   */
  function clearDebtToken() {
    if (debtTokens.value <= 0) return
    if (currentBP.value < DEBT_TOKEN_CLEAR_COST_BP) return

    debtTokens.value -= 1
    currentBP.value -= DEBT_TOKEN_CLEAR_COST_BP
  }

  /**
   * Directly modifies the BP balance (used by turn resolution phases).
   */
  function adjustBP(amount: number) {
    currentBP.value += amount
  }

  return {
    // State
    currentBP,
    incomeSources,
    expenseEntries,
    debtTokens,
    // Getters
    totalIncome,
    totalExpenses,
    netBP,
    stabilityMalus,
    // Actions
    initialize,
    calculateIncome,
    addExpense,
    clearExpenses,
    applyDebt,
    clearDebtToken,
    adjustBP,
  }
})
