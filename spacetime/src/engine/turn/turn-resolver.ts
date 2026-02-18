/**
 * turn-resolver.ts — Master turn resolution function.
 *
 * Story 12.1: Implements the master turn resolver that calls all simulation
 * phases in the exact order specified in Specs.md § 1 and Structure.md.
 *
 * Turn resolution order (10 phases):
 *   1.  debt-phase    → Clear one debt token, deduct 1 BP if tokens exist
 *   2.  income-phase  → Calculate all income (planet tax + corp tax)
 *   3.  expense-phase → Calculate all expenses (contracts + missions)
 *   4.  contract-phase→ Advance contracts, check completion, spawn events
 *   5.  mission-phase → Advance missions, resolve travel / combat
 *   6.  science-phase → Advance science sectors, roll discoveries
 *   7.  corp-phase    → Corporation AI: capital spending, investment, mergers
 *   8.  colony-phase  → Recalculate all colony attributes, growth ticks
 *   9.  market-phase  → Resolve sector markets (production → consumption → trade)
 *   10. event-phase   → Generate events based on current state (placeholder)
 *
 * Design principles:
 *   - Pure function: accepts GameState, returns TurnResult. No side effects.
 *   - No store access: all state flows through function parameters and returns.
 *   - Each phase receives the accumulated state from all previous phases.
 *   - Events from all phases are merged into a single list, preserving order.
 *   - Turn number increments at the end, after all phases complete.
 *
 * State threading:
 *   Each phase follows the pattern: `{ updatedState, events } = resolvePhase(state)`
 *   The `updatedState` from each phase becomes the `state` for the next.
 *   This ensures that colony attribute changes from colony-phase are visible
 *   to market-phase, corp investments are visible to colony-phase, etc.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 12.4): game.store.ts calls resolveTurn() via endTurn() action,
 *   assembles GameState from all stores, then distributes results back.
 * TODO (Story 12.5): End Turn UI button triggers game.store.ts endTurn() action.
 */

import type { GameState } from '../../types/game'
import type { GameEvent } from '../../types/event'
import type { TurnNumber } from '../../types/common'

import { resolveDebtPhase } from './debt-phase'
import { resolveIncomePhase } from './income-phase'
import { resolveExpensePhase } from './expense-phase'
import { resolveContractPhase } from './contract-phase'
import { resolveMissionPhase } from './mission-phase'
import { resolveSciencePhase } from './science-phase'
import { resolveCorpPhase } from './corp-phase'
import { resolveColonyPhase } from './colony-phase'
import { resolveMarketPhase } from './market-phase'
import { resolveEventPhase } from './event-phase'

// ─── Turn Result ──────────────────────────────────────────────────────────────

/**
 * The result of a full turn resolution.
 * Contains the fully updated game state and all events generated across
 * every phase, merged in phase order (debt → income → … → event).
 */
export interface TurnResult {
  /** The complete updated game state after all phases have resolved. */
  updatedState: GameState
  /** All events generated across all 10 phases, in phase order. */
  events: GameEvent[]
  /** The turn number that was just completed. */
  completedTurn: TurnNumber
}

// ─── Turn Resolver ────────────────────────────────────────────────────────────

/**
 * resolveTurn — Master turn resolution entry point.
 *
 * Calls all 10 phases in order, threading state through each one.
 * Collects events from all phases into a single unified list.
 * Increments the turn number at the end.
 *
 * @param state - The complete game state at the start of the turn.
 * @returns TurnResult with fully updated state, all events, and completed turn number.
 */
export function resolveTurn(state: GameState): TurnResult {
  const allEvents: GameEvent[] = []

  // ── BP Reset ─────────────────────────────────────────────────────────────────
  // BP is political capital, not a savings account. Unused BP from the previous
  // turn is gone — each turn starts from zero and income is earned fresh.
  // Player investments made during the player-action phase have already been
  // deducted from currentBP; resetting to 0 here wipes any unspent remainder.
  let currentState: GameState = {
    ...state,
    currentBP: 0,
    budget: { ...state.budget, currentBP: 0 },
  }

  // ── Phase 1: Debt ───────────────────────────────────────────────────────────
  // Clear one debt token if any exist, deduct 1 BP.
  {
    const { updatedState, events } = resolveDebtPhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Phase 2: Income ─────────────────────────────────────────────────────────
  // Sum all planet taxes + corp taxes, credit to BP balance.
  {
    const { updatedState, events } = resolveIncomePhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Phase 3: Expenses ───────────────────────────────────────────────────────
  // Deduct all active contract and mission costs. Handle deficit → debt tokens.
  {
    const { updatedState, events } = resolveExpensePhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Phase 4: Contracts ──────────────────────────────────────────────────────
  // Advance contracts, check completion, fire completion effects and events.
  {
    const { updatedState, events } = resolveContractPhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Phase 5: Missions ───────────────────────────────────────────────────────
  // Advance missions through travel / execution / return phases.
  {
    const { updatedState, events } = resolveMissionPhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Phase 6: Science ────────────────────────────────────────────────────────
  // Advance science domains, roll discoveries, generate schematics / patents.
  {
    const { updatedState, events } = resolveSciencePhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Phase 7: Corporations ───────────────────────────────────────────────────
  // Corporation AI: capital gain, infrastructure investment, mergers/acquisitions.
  // Organic corporation emergence on high-dynamism colonies.
  {
    const { updatedState, events } = resolveCorpPhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Phase 8: Colonies ───────────────────────────────────────────────────────
  // Recalculate infra caps → all colony attributes → growth ticks → organic growth.
  {
    const { updatedState, events } = resolveColonyPhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Phase 9: Market ─────────────────────────────────────────────────────────
  // Resolve sector markets: production → internal consumption → surplus pool →
  // deficit purchasing (dynamism-priority) → shortage resolution.
  {
    const { updatedState, events } = resolveMarketPhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Phase 10: Events ────────────────────────────────────────────────────────
  // Generate any remaining events from current state (placeholder — no active
  // threat logic in prototype).
  {
    const { updatedState, events } = resolveEventPhase(currentState)
    currentState = updatedState
    allEvents.push(...events)
  }

  // ── Increment turn number ───────────────────────────────────────────────────
  // Turn increments after all phases complete. The new turn number represents
  // the turn the player will act on next.
  const completedTurn = currentState.turn as TurnNumber
  const finalState: GameState = {
    ...currentState,
    turn: (currentState.turn + 1) as TurnNumber,
    // Append new turn events to the historical event list
    events: [...currentState.events, ...allEvents],
  }

  return {
    updatedState: finalState,
    events: allEvents,
    completedTurn,
  }
}
