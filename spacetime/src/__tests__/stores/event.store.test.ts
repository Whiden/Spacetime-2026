/**
 * event.store.test.ts — Unit tests for Story 19.1: Event Store.
 *
 * Tests cover:
 * - addEvents(): bulk add, latestTurn tracking, history pruning to 50 turns
 * - currentTurnEvents getter: returns only current-turn events, priority-sorted
 * - unreadCount getter: counts undismissed events across all turns
 * - eventHistory getter: all turns newest-first, each priority-sorted
 * - dismissEvent(): marks an event as dismissed
 * - loadEvents(): restores state from a save
 * - resetEvents(): clears all state for new game
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEventStore } from '../../stores/event.store'
import { EventPriority } from '../../types/common'
import type { GameEvent } from '../../types/event'
import type { EventId, TurnNumber } from '../../types/common'
import type { EventCategory } from '../../types/event'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0

function makeEvent(
  overrides: Partial<GameEvent> & { turn: TurnNumber; priority: EventPriority },
): GameEvent {
  _idCounter++
  return {
    id: `evt_test${_idCounter}` as EventId,
    turn: overrides.turn,
    priority: overrides.priority,
    category: (overrides.category ?? 'system') as EventCategory,
    title: overrides.title ?? 'Test Event',
    description: overrides.description ?? 'A test event.',
    relatedEntityIds: overrides.relatedEntityIds ?? [],
    dismissed: overrides.dismissed ?? false,
  }
}

function turn(n: number): TurnNumber {
  return n as TurnNumber
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useEventStore', () => {
  beforeEach(() => {
    _idCounter = 0
    setActivePinia(createPinia())
  })

  // ── addEvents ──────────────────────────────────────────────────────────────

  describe('addEvents()', () => {
    it('appends events to the store', () => {
      const store = useEventStore()
      const e1 = makeEvent({ turn: turn(1), priority: EventPriority.Info })
      const e2 = makeEvent({ turn: turn(1), priority: EventPriority.Warning })
      store.addEvents([e1, e2], turn(1))
      expect(store.events).toHaveLength(2)
    })

    it('updates latestTurn when a newer turn is added', () => {
      const store = useEventStore()
      store.addEvents([makeEvent({ turn: turn(3), priority: EventPriority.Info })], turn(3))
      expect(store.latestTurn).toBe(3)
    })

    it('does not decrease latestTurn if an older turn is added', () => {
      const store = useEventStore()
      store.addEvents([makeEvent({ turn: turn(5), priority: EventPriority.Info })], turn(5))
      store.addEvents([makeEvent({ turn: turn(3), priority: EventPriority.Info })], turn(3))
      expect(store.latestTurn).toBe(5)
    })

    it('accumulates events across multiple addEvents calls', () => {
      const store = useEventStore()
      store.addEvents([makeEvent({ turn: turn(1), priority: EventPriority.Info })], turn(1))
      store.addEvents([makeEvent({ turn: turn(2), priority: EventPriority.Info })], turn(2))
      expect(store.events).toHaveLength(2)
    })

    it('prunes events beyond 50 turns of history', () => {
      const store = useEventStore()
      // Add 51 distinct turns, 1 event each
      for (let t = 1; t <= 51; t++) {
        store.addEvents([makeEvent({ turn: turn(t), priority: EventPriority.Info })], turn(t))
      }
      // Should only retain the 50 most recent turns (turns 2–51)
      const retainedTurns = new Set(store.events.map((e) => e.turn))
      expect(retainedTurns.size).toBe(50)
      expect(retainedTurns.has(1)).toBe(false)
      expect(retainedTurns.has(51)).toBe(true)
    })

    it('retains all events when exactly 50 turns are present', () => {
      const store = useEventStore()
      for (let t = 1; t <= 50; t++) {
        store.addEvents([makeEvent({ turn: turn(t), priority: EventPriority.Info })], turn(t))
      }
      expect(store.events).toHaveLength(50)
    })
  })

  // ── currentTurnEvents ──────────────────────────────────────────────────────

  describe('currentTurnEvents', () => {
    it('returns only events from the latest turn', () => {
      const store = useEventStore()
      store.addEvents([makeEvent({ turn: turn(1), priority: EventPriority.Info })], turn(1))
      store.addEvents([makeEvent({ turn: turn(2), priority: EventPriority.Info })], turn(2))
      expect(store.currentTurnEvents.every((e) => e.turn === 2)).toBe(true)
      expect(store.currentTurnEvents).toHaveLength(1)
    })

    it('sorts by priority: Critical → Warning → Info → Positive', () => {
      const store = useEventStore()
      const positive = makeEvent({ turn: turn(1), priority: EventPriority.Positive })
      const info = makeEvent({ turn: turn(1), priority: EventPriority.Info })
      const critical = makeEvent({ turn: turn(1), priority: EventPriority.Critical })
      const warning = makeEvent({ turn: turn(1), priority: EventPriority.Warning })
      store.addEvents([positive, info, critical, warning], turn(1))

      const sorted = store.currentTurnEvents
      expect(sorted[0].priority).toBe(EventPriority.Critical)
      expect(sorted[1].priority).toBe(EventPriority.Warning)
      expect(sorted[2].priority).toBe(EventPriority.Info)
      expect(sorted[3].priority).toBe(EventPriority.Positive)
    })

    it('returns empty array when no events have been added', () => {
      const store = useEventStore()
      expect(store.currentTurnEvents).toHaveLength(0)
    })
  })

  // ── unreadCount ────────────────────────────────────────────────────────────

  describe('unreadCount', () => {
    it('counts all undismissed events', () => {
      const store = useEventStore()
      const e1 = makeEvent({ turn: turn(1), priority: EventPriority.Info })
      const e2 = makeEvent({ turn: turn(1), priority: EventPriority.Warning, dismissed: true })
      const e3 = makeEvent({ turn: turn(1), priority: EventPriority.Critical })
      store.addEvents([e1, e2, e3], turn(1))
      expect(store.unreadCount).toBe(2)
    })

    it('returns 0 when all events are dismissed', () => {
      const store = useEventStore()
      const e = makeEvent({ turn: turn(1), priority: EventPriority.Info, dismissed: true })
      store.addEvents([e], turn(1))
      expect(store.unreadCount).toBe(0)
    })

    it('returns 0 when store is empty', () => {
      const store = useEventStore()
      expect(store.unreadCount).toBe(0)
    })
  })

  // ── eventHistory ───────────────────────────────────────────────────────────

  describe('eventHistory', () => {
    it('groups events by turn, newest turn first', () => {
      const store = useEventStore()
      store.addEvents([makeEvent({ turn: turn(1), priority: EventPriority.Info })], turn(1))
      store.addEvents([makeEvent({ turn: turn(3), priority: EventPriority.Info })], turn(3))
      store.addEvents([makeEvent({ turn: turn(2), priority: EventPriority.Info })], turn(2))

      const history = store.eventHistory
      expect(history[0].turn).toBe(3)
      expect(history[1].turn).toBe(2)
      expect(history[2].turn).toBe(1)
    })

    it('sorts events within each turn by priority', () => {
      const store = useEventStore()
      const warning = makeEvent({ turn: turn(1), priority: EventPriority.Warning })
      const critical = makeEvent({ turn: turn(1), priority: EventPriority.Critical })
      store.addEvents([warning, critical], turn(1))

      const turn1Events = store.eventHistory[0].events
      expect(turn1Events[0].priority).toBe(EventPriority.Critical)
      expect(turn1Events[1].priority).toBe(EventPriority.Warning)
    })

    it('returns empty array when no events exist', () => {
      const store = useEventStore()
      expect(store.eventHistory).toHaveLength(0)
    })
  })

  // ── dismissEvent ───────────────────────────────────────────────────────────

  describe('dismissEvent()', () => {
    it('marks the target event as dismissed', () => {
      const store = useEventStore()
      const e = makeEvent({ turn: turn(1), priority: EventPriority.Info })
      store.addEvents([e], turn(1))
      store.dismissEvent(e.id)
      expect(store.events.find((ev) => ev.id === e.id)!.dismissed).toBe(true)
    })

    it('does not affect other events', () => {
      const store = useEventStore()
      const e1 = makeEvent({ turn: turn(1), priority: EventPriority.Info })
      const e2 = makeEvent({ turn: turn(1), priority: EventPriority.Warning })
      store.addEvents([e1, e2], turn(1))
      store.dismissEvent(e1.id)
      expect(store.events.find((ev) => ev.id === e2.id)!.dismissed).toBe(false)
    })

    it('is a no-op for an unknown id', () => {
      const store = useEventStore()
      expect(() => store.dismissEvent('evt_unknown' as EventId)).not.toThrow()
    })

    it('decrements unreadCount after dismissal', () => {
      const store = useEventStore()
      const e = makeEvent({ turn: turn(1), priority: EventPriority.Critical })
      store.addEvents([e], turn(1))
      expect(store.unreadCount).toBe(1)
      store.dismissEvent(e.id)
      expect(store.unreadCount).toBe(0)
    })
  })

  // ── loadEvents ─────────────────────────────────────────────────────────────

  describe('loadEvents()', () => {
    it('replaces existing events with loaded events', () => {
      const store = useEventStore()
      store.addEvents([makeEvent({ turn: turn(1), priority: EventPriority.Info })], turn(1))

      const saved = [makeEvent({ turn: turn(5), priority: EventPriority.Warning })]
      store.loadEvents(saved, turn(5))

      expect(store.events).toHaveLength(1)
      expect(store.events[0].turn).toBe(5)
    })

    it('sets latestTurn from the loaded save', () => {
      const store = useEventStore()
      store.loadEvents([], turn(10))
      expect(store.latestTurn).toBe(10)
    })
  })

  // ── resetEvents ────────────────────────────────────────────────────────────

  describe('resetEvents()', () => {
    it('clears all events', () => {
      const store = useEventStore()
      store.addEvents([makeEvent({ turn: turn(1), priority: EventPriority.Info })], turn(1))
      store.resetEvents()
      expect(store.events).toHaveLength(0)
    })

    it('resets latestTurn to 1', () => {
      const store = useEventStore()
      store.addEvents([makeEvent({ turn: turn(7), priority: EventPriority.Info })], turn(7))
      store.resetEvents()
      expect(store.latestTurn).toBe(1)
    })
  })
})
