<script setup lang="ts">
import { useBudgetDisplay } from '../../composables/useBudgetDisplay'

// TODO: Story 12.5 — Wire End Turn button to game store (useTurnActions composable)
// TODO: Story 12.5 — Wire turn number from game store

const {
  currentBP,
  incomeDisplay,
  expensesDisplay,
  netDisplay,
  bpColorClass,
  netColorClass,
} = useBudgetDisplay()
</script>

<template>
  <header class="flex items-center justify-between h-14 px-6 bg-zinc-900 border-b border-zinc-800">
    <!-- Left: Turn info -->
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Turn</span>
        <!-- TODO: Story 12.5 — Wire to game store turn number -->
        <span class="text-sm font-semibold text-white">1</span>
      </div>
    </div>

    <!-- Center: Budget -->
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">BP</span>
        <span class="text-sm font-semibold" :class="bpColorClass">{{ currentBP }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Income</span>
        <span class="text-sm text-emerald-400">{{ incomeDisplay }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Expenses</span>
        <span class="text-sm text-zinc-300">{{ expensesDisplay }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Net</span>
        <span class="text-sm" :class="netColorClass">{{ netDisplay }}</span>
      </div>
    </div>

    <!-- Right: End Turn -->
    <!-- TODO: Story 12.5 — Enable button and wire to game store -->
    <button
      disabled
      class="px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600/50 text-indigo-300 cursor-not-allowed opacity-50"
    >
      End Turn
    </button>
  </header>
</template>
