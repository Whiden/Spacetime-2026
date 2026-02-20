<script setup lang="ts">
/**
 * AppNotifications — Overlay panel showing event history across recent turns.
 *
 * Story 19.2: Accessible from the header notification badge. Shows all retained
 * events grouped by turn (newest first), with dismiss support and entity links.
 *
 * TODO (Story 19.3): Link from event to entity detail view is expanded when more
 * entity types are fully surfaced in the UI.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '../../stores/event.store'
import { EventPriority } from '../../types/common'
import type { GameEvent } from '../../types/event'

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const eventStore = useEventStore()

const history = computed(() => eventStore.eventHistory)

// ─── Priority styling ─────────────────────────────────────────────────────────

const priorityColors: Record<EventPriority, { dot: string; label: string; labelColor: string }> = {
  [EventPriority.Critical]: { dot: 'bg-red-500', label: 'Critical', labelColor: 'text-red-400' },
  [EventPriority.Warning]:  { dot: 'bg-amber-500', label: 'Warning', labelColor: 'text-amber-400' },
  [EventPriority.Info]:     { dot: 'bg-zinc-400', label: 'Info', labelColor: 'text-zinc-400' },
  [EventPriority.Positive]: { dot: 'bg-emerald-500', label: 'Positive', labelColor: 'text-emerald-400' },
}

// ─── Entity navigation ────────────────────────────────────────────────────────

/**
 * Returns the router link for the first recognizable related entity ID, or null.
 * Prefix map: col_ → colony detail, corp_ → corp detail.
 * TODO (Story 19.3): extend with ship_, ctr_, sector_ when those detail views exist.
 */
function entityRoute(event: GameEvent): string | null {
  for (const id of event.relatedEntityIds) {
    if (id.startsWith('col_')) return `/colonies/${id}`
    if (id.startsWith('corp_')) return `/corporations/${id}`
  }
  return null
}

function navigateToEntity(event: GameEvent): void {
  const route = entityRoute(event)
  if (route) {
    router.push(route)
    emit('close')
  }
}

function dismiss(event: GameEvent): void {
  eventStore.dismissEvent(event.id)
}
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 z-40" @click="emit('close')" />

  <!-- Panel -->
  <div
    class="fixed top-14 right-0 z-50 w-96 max-h-[calc(100vh-3.5rem)] overflow-y-auto
           bg-zinc-950 border-l border-b border-zinc-800 shadow-2xl flex flex-col"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
      <h2 class="text-sm font-semibold text-white">Notifications</h2>
      <button
        class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        @click="emit('close')"
      >
        Close
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="history.length === 0" class="flex flex-col items-center justify-center py-12 px-6 text-center">
      <p class="text-sm text-zinc-500">No events yet.</p>
      <p class="text-xs text-zinc-600 mt-1">Events appear here after each turn.</p>
    </div>

    <!-- Event history grouped by turn -->
    <div v-else class="divide-y divide-zinc-800/60">
      <div v-for="group in history" :key="group.turn" class="px-4 py-3">
        <!-- Turn label -->
        <p class="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">
          Turn {{ group.turn }}
        </p>

        <!-- Events in this turn -->
        <div class="space-y-1.5">
          <div
            v-for="event in group.events"
            :key="event.id"
            class="rounded-lg border px-3 py-2 transition-colors"
            :class="[
              event.dismissed ? 'border-zinc-800 opacity-50' : priorityColors[event.priority]?.dot
                ? 'border-zinc-700' : 'border-zinc-700',
              entityRoute(event) ? 'cursor-pointer hover:bg-zinc-800/40' : ''
            ]"
            @click="entityRoute(event) ? navigateToEntity(event) : undefined"
          >
            <div class="flex items-start gap-2">
              <!-- Priority dot -->
              <span
                class="mt-1 h-1.5 w-1.5 rounded-full shrink-0"
                :class="priorityColors[event.priority]?.dot ?? 'bg-zinc-500'"
              />

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-xs font-medium text-zinc-200 leading-snug">{{ event.title }}</p>
                  <!-- Priority label for Critical/Warning -->
                  <span
                    v-if="event.priority === EventPriority.Critical || event.priority === EventPriority.Warning"
                    class="text-[9px] font-semibold uppercase tracking-wider shrink-0"
                    :class="priorityColors[event.priority].labelColor"
                  >
                    {{ priorityColors[event.priority].label }}
                  </span>
                </div>
                <p class="text-[11px] text-zinc-500 mt-0.5 leading-snug">{{ event.description }}</p>
                <!-- Entity link hint -->
                <p v-if="entityRoute(event)" class="text-[10px] text-indigo-400 mt-1">
                  View details →
                </p>
              </div>

              <!-- Dismiss button (shown for undismissed non-Critical, or always show) -->
              <button
                class="text-[10px] text-zinc-600 hover:text-zinc-400 shrink-0 mt-0.5 transition-colors"
                :title="event.dismissed ? 'Already read' : 'Mark as read'"
                @click.stop="dismiss(event)"
              >
                {{ event.dismissed ? '✓' : '×' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
