/**
 * useTurnActions.ts — Composable for End Turn button flow and turn event tracking.
 *
 * Story 12.5: Orchestrates the end turn UI flow:
 * - Exposes confirmation dialog state.
 * - Calls game.store.ts actions.
 * - Exposes last-turn events (sorted by priority) for dashboard display.
 */

import { ref, computed } from 'vue'
import { useGameStore } from '../stores/game.store'
import { useBudgetStore } from '../stores/budget.store'
import { EventPriority } from '../types/common'

export function useTurnActions() {
  const gameStore = useGameStore()
  const budgetStore = useBudgetStore()

  // ─── State ────────────────────────────────────────────────────────────────

  /** Whether the end turn confirmation dialog is open. */
  const showConfirm = ref(false)

  // ─── Computed ────────────────────────────────────────────────────────────

  /** True when the player can act (button enabled). */
  const canEndTurn = computed(() => gameStore.gamePhase === 'player_action')

  /** True while the turn resolver is running. */
  const isResolving = computed(() => gameStore.gamePhase === 'resolving')

  /** True when the player is reviewing events after turn resolution. */
  const isReviewing = computed(() => gameStore.gamePhase === 'reviewing')

  /** Current turn number for display. */
  const currentTurn = computed(() => gameStore.currentTurn)

  /** Budget values for the confirmation dialog summary. */
  const income = computed(() => budgetStore.totalIncome)
  const expenses = computed(() => budgetStore.totalExpenses)
  const net = computed(() => budgetStore.netBP)

  /** True if ending the turn will create debt tokens (deficit). */
  const willCreateDebt = computed(() => net.value < 0)

  /** Priority sort order (lower = higher urgency). */
  const PRIORITY_ORDER: Record<EventPriority, number> = {
    [EventPriority.Critical]: 0,
    [EventPriority.Warning]: 1,
    [EventPriority.Positive]: 2,
    [EventPriority.Info]: 3,
  }

  /** Events from the last resolved turn, sorted priority-first. */
  const sortedEvents = computed(() =>
    [...gameStore.lastTurnEvents].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3),
    ),
  )

  // ─── Actions ─────────────────────────────────────────────────────────────

  /** Open the confirmation dialog. */
  function requestEndTurn() {
    if (!canEndTurn.value) return
    showConfirm.value = true
  }

  /** Cancel from the confirmation dialog. */
  function cancelEndTurn() {
    showConfirm.value = false
  }

  /** Confirm: close dialog and run turn resolution. */
  function confirmEndTurn() {
    showConfirm.value = false
    if (!canEndTurn.value) return
    gameStore.endTurn()
  }

  /** Acknowledge the review phase and return to player_action. */
  function acknowledgeResults() {
    gameStore.acknowledgeResults()
  }

  return {
    // State
    showConfirm,
    // Computed
    canEndTurn,
    isResolving,
    isReviewing,
    currentTurn,
    income,
    expenses,
    net,
    willCreateDebt,
    sortedEvents,
    // Actions
    requestEndTurn,
    cancelEndTurn,
    confirmEndTurn,
    acknowledgeResults,
  }
}
