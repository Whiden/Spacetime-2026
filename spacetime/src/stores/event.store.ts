/**
 * event.store.ts — Event queue, notification state, and event history.
 *
 * Story 19.1: Collects events from turn resolution, exposes priority-sorted
 * getters, and retains the last 50 turns of history.
 *
 * Architecture:
 * - addEvents() is called by game.store.ts after each turn resolution.
 * - Events are stored flat; currentTurnEvents and eventHistory are derived getters.
 * - The store is included in save/load via game.store.ts (events field on GameState).
 *
 * TODO (Story 19.2): Notification display UI reads unreadCount and currentTurnEvents.
 * TODO (Story 19.2): dismissEvent() is wired to the "dismiss" action on EventCard.vue.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TurnNumber } from '../types/common'
import { EventPriority } from '../types/common'
import type { GameEvent } from '../types/event'

/** Maximum number of turns of event history to retain. */
const MAX_HISTORY_TURNS = 50

/** Priority ordering for sort (lower index = displayed first). */
const PRIORITY_ORDER: Record<EventPriority, number> = {
  [EventPriority.Critical]: 0,
  [EventPriority.Warning]: 1,
  [EventPriority.Info]: 2,
  [EventPriority.Positive]: 3,
}

export const useEventStore = defineStore('event', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /**
   * All events currently held by the store.
   * Includes current-turn events and history from the last MAX_HISTORY_TURNS turns.
   */
  const events = ref<GameEvent[]>([])

  /**
   * The turn number of the most recently resolved turn.
   * Used to distinguish "current turn" events from history.
   */
  const latestTurn = ref<TurnNumber>(1 as TurnNumber)

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /**
   * Events from the current (latest resolved) turn, sorted by priority.
   * Critical → Warning → Info → Positive.
   */
  const currentTurnEvents = computed<GameEvent[]>(() =>
    events.value
      .filter((e) => e.turn === latestTurn.value)
      .slice()
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
  )

  /**
   * Number of undismissed events across all retained turns.
   */
  const unreadCount = computed<number>(
    () => events.value.filter((e) => !e.dismissed).length,
  )

  /**
   * All retained events grouped by turn, newest-first.
   * Each entry: { turn, events (priority-sorted) }.
   */
  const eventHistory = computed<{ turn: TurnNumber; events: GameEvent[] }[]>(() => {
    // Collect distinct turns, sorted descending
    const turns = [...new Set(events.value.map((e) => e.turn))].sort((a, b) => b - a)
    return turns.map((turn) => ({
      turn,
      events: events.value
        .filter((e) => e.turn === turn)
        .slice()
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    }))
  })

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Bulk-adds events from a resolved turn.
   * Prunes history to the last MAX_HISTORY_TURNS turns after adding.
   *
   * Called by game.store.ts after each turn resolution.
   *
   * @param newEvents - Events returned by resolveTurn().
   * @param turn - The turn number that generated the events.
   */
  function addEvents(newEvents: GameEvent[], turn: TurnNumber): void {
    // Update the latest turn tracker
    if (turn > latestTurn.value) {
      latestTurn.value = turn
    }

    // Append all new events
    events.value.push(...newEvents)

    // Prune: keep only events from the last MAX_HISTORY_TURNS distinct turns
    const allTurns = [...new Set(events.value.map((e) => e.turn))].sort((a, b) => b - a)
    const keptTurns = new Set(allTurns.slice(0, MAX_HISTORY_TURNS))
    events.value = events.value.filter((e) => keptTurns.has(e.turn))
  }

  /**
   * Marks an event as dismissed (read).
   * Critical events can be dismissed the same as others — the UI may add
   * extra confirmation before calling this (Story 19.2).
   *
   * @param id - The EventId of the event to dismiss.
   */
  function dismissEvent(id: string): void {
    const event = events.value.find((e) => e.id === id)
    if (event) {
      event.dismissed = true
    }
  }

  /**
   * Replaces the entire event list from a loaded save.
   * Called by game.store.ts during loadGame().
   *
   * @param loadedEvents - Events from the deserialized GameState.
   * @param turn - The turn of the loaded save.
   */
  function loadEvents(loadedEvents: GameEvent[], turn: TurnNumber): void {
    events.value = loadedEvents
    latestTurn.value = turn
  }

  /**
   * Clears all events. Called by initializeGame() to reset store on new game.
   */
  function resetEvents(): void {
    events.value = []
    latestTurn.value = 1 as TurnNumber
  }

  return {
    // State
    events,
    latestTurn,
    // Getters
    currentTurnEvents,
    unreadCount,
    eventHistory,
    // Actions
    addEvents,
    dismissEvent,
    loadEvents,
    resetEvents,
  }
})
