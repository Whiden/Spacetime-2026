<script setup lang="ts">
/**
 * DashboardView — Home screen with budget summary, debt warning, and event feed.
 *
 * TODO (Story 19.3): Full dashboard with empire summary cards, quick actions.
 */
import { useBudgetDisplay } from '../composables/useBudgetDisplay'
import { useTurnActions } from '../composables/useTurnActions'
import StatCard from '../components/shared/StatCard.vue'
import EventCard from '../components/shared/EventCard.vue'

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

const {
  sortedEvents,
} = useTurnActions()
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-white mb-6">Dashboard</h1>

    <!-- Turn Events Panel: non-blocking, shown whenever there are events from the last turn. -->
    <div
      v-if="sortedEvents.length > 0"
      class="rounded-xl border border-indigo-700/50 bg-indigo-950/30 p-4 mb-6"
    >
      <h2 class="text-sm font-medium text-indigo-300 uppercase tracking-wider mb-3">
        Turn Events ({{ sortedEvents.length }})
      </h2>
      <div class="space-y-2">
        <EventCard v-for="event in sortedEvents" :key="event.id" :event="event" />
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
