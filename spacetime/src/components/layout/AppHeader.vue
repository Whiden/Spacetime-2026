<script setup lang="ts">
// TODO: Story 5.3 — Wire BP display to budget store (useBudgetDisplay composable)
// TODO: Story 12.5 — Wire End Turn button to game store (useTurnActions composable)
</script>

<template>
  <header class="flex items-center justify-between h-14 px-6 bg-zinc-900 border-b border-zinc-800">
    <!-- Left: Turn info -->
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Turn</span>
        <span class="text-sm font-semibold text-white">1</span>
      </div>
    </div>

    <!-- Center: Budget -->
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">BP</span>
        <span class="text-sm font-semibold text-emerald-400">10</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Income</span>
        <span class="text-sm text-zinc-300">+0</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Expenses</span>
        <span class="text-sm text-zinc-300">-0</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Net</span>
        <span class="text-sm text-emerald-400">+0</span>
      </div>
    </div>

    <!-- Right: End Turn -->
    <button
      disabled
      class="px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600/50 text-indigo-300 cursor-not-allowed opacity-50"
    >
      End Turn
    </button>
  </header>
</template>
