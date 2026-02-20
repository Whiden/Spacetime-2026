<script setup lang="ts">
/**
 * DashboardView — Home screen with budget summary, debt warning, and event feed.
 *
 * Story 19.2: Current-turn events shown as expandable priority-sorted cards.
 * Critical events (red) are pinned at top. Dismiss marks an event as read.
 * Clicking a card with a related entity navigates to its detail view.
 *
 * TODO (Story 19.3): Full dashboard with empire summary cards, quick actions.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBudgetDisplay } from '../composables/useBudgetDisplay'
import { useEventStore } from '../stores/event.store'
import { EventPriority } from '../types/common'
import type { GameEvent } from '../types/event'
import StatCard from '../components/shared/StatCard.vue'

const router = useRouter()

const {
  currentBP,
  income,
  expenses,
  net,
  netColorClass,
  incomeSources,
  expenseEntries,
  debtTokens,
  stabilityMalus,
  hasDebt,
} = useBudgetDisplay()

const eventStore = useEventStore()

/** Current turn events, already priority-sorted by the store. */
const currentEvents = computed(() => eventStore.currentTurnEvents)

// ─── Priority styling ─────────────────────────────────────────────────────────

const priorityBorder: Record<EventPriority, string> = {
  [EventPriority.Critical]: 'border-red-600/60 bg-red-950/20',
  [EventPriority.Warning]:  'border-amber-600/50 bg-amber-950/10',
  [EventPriority.Info]:     'border-zinc-700 bg-zinc-900/30',
  [EventPriority.Positive]: 'border-emerald-700/50 bg-emerald-950/10',
}

const priorityDot: Record<EventPriority, string> = {
  [EventPriority.Critical]: 'bg-red-500',
  [EventPriority.Warning]:  'bg-amber-500',
  [EventPriority.Info]:     'bg-zinc-400',
  [EventPriority.Positive]: 'bg-emerald-500',
}

const priorityLabel: Record<EventPriority, string> = {
  [EventPriority.Critical]: 'Critical',
  [EventPriority.Warning]:  'Warning',
  [EventPriority.Info]:     'Info',
  [EventPriority.Positive]: 'Positive',
}

const priorityLabelColor: Record<EventPriority, string> = {
  [EventPriority.Critical]: 'text-red-400',
  [EventPriority.Warning]:  'text-amber-400',
  [EventPriority.Info]:     'text-zinc-400',
  [EventPriority.Positive]: 'text-emerald-400',
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Track which events are expanded (by ID). */
const expandedIds = new Set<string>()
function toggleExpand(id: string): void {
  if (expandedIds.has(id)) expandedIds.delete(id)
  else expandedIds.add(id)
}
function isExpanded(id: string): boolean {
  return expandedIds.has(id)
}

function dismiss(event: GameEvent): void {
  eventStore.dismissEvent(event.id)
}

/**
 * Returns router path for first recognizable related entity, or null.
 * TODO (Story 19.3): extend with more entity types as views become available.
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
  if (route) router.push(route)
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-white mb-6">Dashboard</h1>

    <!-- Current Turn Events Panel -->
    <div
      v-if="currentEvents.length > 0"
      class="rounded-xl border border-indigo-700/40 bg-indigo-950/20 p-4 mb-6"
    >
      <h2 class="text-sm font-medium text-indigo-300 uppercase tracking-wider mb-3">
        Turn Events ({{ currentEvents.length }})
      </h2>
      <div class="space-y-2">
        <div
          v-for="event in currentEvents"
          :key="event.id"
          class="rounded-lg border px-4 py-3 transition-colors"
          :class="[
            priorityBorder[event.priority],
            event.dismissed ? 'opacity-50' : '',
          ]"
        >
          <div class="flex items-start gap-3">
            <!-- Priority dot -->
            <span class="mt-1 h-2 w-2 rounded-full shrink-0" :class="priorityDot[event.priority]" />

            <div class="flex-1 min-w-0">
              <!-- Header row: title + priority label -->
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-medium text-zinc-200">{{ event.title }}</p>
                <span
                  class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  :class="priorityLabelColor[event.priority]"
                >
                  {{ priorityLabel[event.priority] }}
                </span>
              </div>

              <!-- Expanded description -->
              <p v-if="isExpanded(event.id)" class="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                {{ event.description }}
              </p>

              <!-- Entity navigation link -->
              <button
                v-if="entityRoute(event)"
                class="text-[11px] text-indigo-400 hover:text-indigo-300 mt-1.5 transition-colors"
                @click="navigateToEntity(event)"
              >
                View details →
              </button>
            </div>

            <!-- Right: expand toggle + dismiss -->
            <div class="flex items-center gap-2 shrink-0">
              <!-- Dismiss — Critical events can be dismissed after viewing (expand first) -->
              <button
                class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
                :title="event.dismissed ? 'Already read' : 'Mark as read'"
                @click="dismiss(event)"
              >
                {{ event.dismissed ? '✓' : '×' }}
              </button>
              <!-- Expand toggle -->
              <button
                class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                @click="toggleExpand(event.id)"
              >
                {{ isExpanded(event.id) ? '▾' : '▸' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Budget Summary Cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <StatCard label="Balance" :value="`${currentBP} BP`" />
      <StatCard label="Income / Turn" :value="`+${income} BP`" />
      <StatCard label="Expenses / Turn" :value="`-${expenses} BP`" />
      <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Net / Turn</p>
        <span class="text-lg font-semibold" :class="netColorClass">
          {{ net > 0 ? '+' : '' }}{{ net }} BP
        </span>
      </div>
    </div>

    <!-- Debt Warning -->
    <div
      v-if="hasDebt"
      class="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 mb-6"
    >
      <div class="flex items-center gap-3">
        <span class="text-red-400 text-lg">⚠</span>
        <div>
          <p class="text-sm font-medium text-red-300">
            Debt Crisis — {{ debtTokens }} debt token{{ debtTokens !== 1 ? 's' : '' }} active
          </p>
          <p class="text-xs text-red-400/80 mt-0.5">
            All colonies suffer -{{ stabilityMalus }} stability. 1 token cleared per turn at a cost of 1 BP.
          </p>
        </div>
      </div>
    </div>

    <!-- Income & Expense Breakdown -->
    <div class="grid grid-cols-2 gap-6 mb-6">
      <!-- Income Breakdown -->
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 class="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Income Breakdown</h2>
        <div v-if="incomeSources.length === 0" class="text-xs text-zinc-600">
          No income sources yet.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="source in incomeSources"
            :key="`${source.type}-${source.sourceId}`"
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <span
                class="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded"
                :class="source.type === 'planet_tax'
                  ? 'bg-blue-900/50 text-blue-400'
                  : 'bg-purple-900/50 text-purple-400'"
              >
                {{ source.type === 'planet_tax' ? 'Colony' : 'Corp' }}
              </span>
              <span class="text-sm text-zinc-300">{{ source.sourceName }}</span>
            </div>
            <span class="text-sm font-medium text-emerald-400">+{{ source.amount }} BP</span>
          </div>
        </div>
      </div>

      <!-- Expense Breakdown -->
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 class="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Expense Breakdown</h2>
        <div v-if="expenseEntries.length === 0" class="text-xs text-zinc-600">
          No expenses yet. Expenses come from contracts, missions, and investments.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="entry in expenseEntries"
            :key="`${entry.type}-${entry.sourceId}`"
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <span
                class="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded"
                :class="{
                  'bg-amber-900/50 text-amber-400': entry.type === 'contract',
                  'bg-red-900/50 text-red-400': entry.type === 'mission',
                  'bg-cyan-900/50 text-cyan-400': entry.type === 'direct_invest',
                  'bg-orange-900/50 text-orange-400': entry.type === 'debt_clearance',
                }"
              >
                {{ entry.type === 'contract' ? 'Contract'
                  : entry.type === 'mission' ? 'Mission'
                  : entry.type === 'direct_invest' ? 'Investment'
                  : 'Debt' }}
              </span>
              <span class="text-sm text-zinc-300">{{ entry.sourceName }}</span>
            </div>
            <span class="text-sm font-medium text-red-400">-{{ entry.amount }} BP</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Placeholder for future dashboard content -->
    <div class="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 px-8">
      <p class="text-zinc-400 text-sm">Welcome to Spacetime. Your empire begins here.</p>
      <p class="text-zinc-500 text-xs mt-2">Events and empire overview will appear as systems come online.</p>
    </div>
  </div>
</template>
