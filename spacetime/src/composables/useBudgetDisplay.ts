/**
 * useBudgetDisplay.ts — Composable for formatted budget data in the UI.
 *
 * Reads from the budget store and provides computed display values
 * for the header bar and dashboard budget breakdown.
 *
 * TODO (Story 12.5): Wire turn number from game store.
 */

import { computed } from 'vue'
import { useBudgetStore } from '../stores/budget.store'

/**
 * Color class for the net BP indicator.
 * Green = positive, yellow = near zero (0-2), red = deficit.
 */
export type BPColorClass = 'text-emerald-400' | 'text-yellow-400' | 'text-red-400'

export function useBudgetDisplay() {
  const budgetStore = useBudgetStore()

  // ─── Header display values ──────────────────────────────────────────────────

  /** Current BP balance. */
  const currentBP = computed(() => budgetStore.currentBP)

  /** Total income per turn. */
  const income = computed(() => budgetStore.totalIncome)

  /** Total expenses per turn. */
  const expenses = computed(() => budgetStore.totalExpenses)

  /** Net BP per turn (income - expenses). */
  const net = computed(() => budgetStore.netBP)

  /** Formatted income string with "+" prefix. */
  const incomeDisplay = computed(() => `+${budgetStore.totalIncome}`)

  /** Formatted expenses string with "-" prefix. */
  const expensesDisplay = computed(() => `-${budgetStore.totalExpenses}`)

  /** Formatted net string with sign. */
  const netDisplay = computed(() => {
    const n = budgetStore.netBP
    if (n > 0) return `+${n}`
    return `${n}`
  })

  /** Color class for current BP based on net value. */
  const bpColorClass = computed<BPColorClass>(() => {
    const n = budgetStore.netBP
    if (n < 0) return 'text-red-400'
    if (n <= 2) return 'text-yellow-400'
    return 'text-emerald-400'
  })

  /** Color class for the net display. */
  const netColorClass = computed<BPColorClass>(() => {
    const n = budgetStore.netBP
    if (n < 0) return 'text-red-400'
    if (n <= 0) return 'text-yellow-400'
    return 'text-emerald-400'
  })

  // ─── Dashboard breakdown values ─────────────────────────────────────────────

  /** Itemized income sources for display. */
  const incomeSources = computed(() => budgetStore.incomeSources)

  /** Itemized expense entries for display. */
  const expenseEntries = computed(() => budgetStore.expenseEntries)

  /** Current debt token count. */
  const debtTokens = computed(() => budgetStore.debtTokens)

  /** Stability malus from debt tokens. */
  const stabilityMalus = computed(() => budgetStore.stabilityMalus)

  /** Whether debt tokens are present (for conditional UI display). */
  const hasDebt = computed(() => budgetStore.debtTokens > 0)

  return {
    // Header
    currentBP,
    income,
    expenses,
    net,
    incomeDisplay,
    expensesDisplay,
    netDisplay,
    bpColorClass,
    netColorClass,
    // Dashboard
    incomeSources,
    expenseEntries,
    debtTokens,
    stabilityMalus,
    hasDebt,
  }
}
