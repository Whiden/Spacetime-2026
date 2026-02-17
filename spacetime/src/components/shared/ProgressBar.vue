<script setup lang="ts">
/**
 * ProgressBar — Horizontal progress bar with fill percentage.
 * Used for contracts, exploration, growth, science domains.
 */
defineProps<{
  /** Progress value from 0 to 100. */
  value: number
  /** Tailwind color class for the fill (e.g., 'bg-indigo-500'). Defaults to indigo. */
  color?: string
  /** Optional label displayed inside or beside the bar. */
  label?: string
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-300"
        :class="color ?? 'bg-indigo-500'"
        :style="{ width: `${Math.min(100, Math.max(0, value))}%` }"
      />
    </div>
    <span v-if="label" class="text-xs text-zinc-400 shrink-0">{{ label }}</span>
  </div>
</template>
