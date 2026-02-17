<script setup lang="ts">
import { ref } from 'vue'

/**
 * Tooltip — Hover-triggered info box that displays explanatory text.
 * Wraps any content via the default slot; tooltip text appears on hover.
 */
defineProps<{
  /** Text content displayed in the tooltip. */
  text: string
}>()

const visible = ref(false)
</script>

<template>
  <span
    class="relative inline-block"
    @mouseenter="visible = true"
    @mouseleave="visible = false"
  >
    <!-- Trigger (default slot) -->
    <slot />

    <!-- Tooltip popup -->
    <Transition name="tooltip">
      <div
        v-if="visible"
        class="absolute z-40 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 whitespace-normal max-w-64 shadow-lg pointer-events-none"
      >
        {{ text }}
      </div>
    </Transition>
  </span>
</template>

<style scoped>
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.15s ease;
}
.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}
</style>
