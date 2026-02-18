/**
 * debt-phase.ts — Debt token resolution at the start of each turn.
 *
 * Runs as phase #1 of turn resolution (before income and expenses).
 *
 * Responsibilities:
 *   - If debt tokens > 0: clear 1 token and deduct 1 BP from the current balance.
 *   - Returns the updated state with decremented debtTokens and BP.
 *
 * Debt token mechanics (Specs.md § 2):
 *   - Gained at end of each turn: floor(deficit / 3), minimum 1 if any deficit
 *   - Max 10 tokens; player cannot spend beyond that cap
 *   - 1 token cleared per turn automatically, costing 1 BP from income
 *   - Stability malus while tokens exist: floor(debtTokens / 2) per colony
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 12.3): Full debt-phase implementation with dedicated unit tests.
 *   This stub satisfies Story 12.1's requirement that debt-phase exists and can
 *   be called by the turn resolver. Story 12.3 will add dedicated tests for the
 *   full clearing / token-gain logic.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { GameEvent } from '../../types/event'
import { EventPriority } from '../../types/common'
import { generateId } from '../../utils/id'

// ─── Debt Phase ───────────────────────────────────────────────────────────────

/**
 * resolveDebtPhase — Phase #1: clear one debt token if any exist.
 *
 * Decrements debtTokens by 1 and deducts 1 BP if tokens > 0.
 * Returns an updated GameState with the new debt count and BP balance.
 */
export function resolveDebtPhase(state: GameState): PhaseResult {
  const events: GameEvent[] = []

  if (state.debtTokens <= 0) {
    return { updatedState: state, events }
  }

  const newDebtTokens = state.debtTokens - 1
  // Deduct 1 BP for clearing the token (Specs.md § 2)
  const newBP = state.currentBP - 1

  const debtEvent: GameEvent = {
    id: generateId('evt'),
    turn: state.turn,
    priority: newDebtTokens === 0 ? EventPriority.Positive : EventPriority.Info,
    category: 'budget',
    title: newDebtTokens === 0 ? 'Debt Cleared' : 'Debt Token Cleared',
    description:
      newDebtTokens === 0
        ? 'All debt has been repaid. Economic stability restored.'
        : `Debt token cleared (${newDebtTokens} remaining). 1 BP deducted.`,
    relatedEntityIds: [],
  }
  events.push(debtEvent)

  const updatedState: GameState = {
    ...state,
    currentBP: newBP,
    debtTokens: newDebtTokens,
    budget: {
      ...state.budget,
      currentBP: newBP,
      debtTokens: newDebtTokens,
      stabilityMalus: Math.floor(newDebtTokens / 2),
    },
  }

  return { updatedState, events }
}
