<script setup lang="ts">
import { computed } from 'vue'

/**
 * AttributeBar — Colony attribute display (0-10 scale) with color coding.
 * Green (>6), Yellow (4-6), Red (<4).
 */
const props = defineProps<{
  /** Attribute value from 0 to 10. */
  value: number
  /** Attribute name displayed as label. */
  label: string
}>()

const colorClass = computed(() => {
  if (props.value > 6) return 'bg-emerald-500'
  if (props.value >= 4) return 'bg-amber-500'
  return 'bg-red-500'
})

const textColorClass = computed(() => {
  if (props.value > 6) return 'text-emerald-400'
  if (props.value >= 4) return 'text-amber-400'
  return 'text-red-400'
})
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="text-xs text-zinc-400 w-24 shrink-0">{{ label }}</span>
    <div class="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-300"
        :class="colorClass"
        :style="{ width: `${Math.min(100, (value / 10) * 100)}%` }"
      />
    </div>
    <span class="text-xs font-medium w-6 text-right" :class="textColorClass">
      {{ value }}
    </span>
  </div>
</template>
