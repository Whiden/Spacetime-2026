<script setup lang="ts">
/**
 * StatCard — Key-value stat display with optional trend indicator.
 * Used on dashboard and detail views for summary numbers.
 */
defineProps<{
  /** Stat label (e.g., "Colonies", "Income"). */
  label: string
  /** Stat value (displayed prominently). */
  value: string | number
  /** Optional trend direction for comparison with last turn. */
  trend?: 'up' | 'down' | 'neutral'
}>()
</script>

<template>
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">{{ label }}</p>
    <div class="flex items-center gap-2">
      <span class="text-lg font-semibold text-white">{{ value }}</span>
      <span v-if="trend === 'up'" class="text-xs text-emerald-400">↑</span>
      <span v-else-if="trend === 'down'" class="text-xs text-red-400">↓</span>
      <span v-else-if="trend === 'neutral'" class="text-xs text-zinc-500">→</span>
    </div>
  </div>
</template>
