<script setup lang="ts">
/**
 * EmptyState — "Nothing here yet" display with optional action button.
 * Used across all list/detail views when there's no data to show.
 */
defineProps<{
  /** Primary message displayed to the user. */
  message: string
  /** Secondary guidance text (optional). */
  description?: string
  /** Action button label (optional). If provided, button is rendered. */
  actionLabel?: string
}>()

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 px-8">
    <p class="text-zinc-400 text-sm">{{ message }}</p>
    <p v-if="description" class="text-zinc-500 text-xs mt-2">{{ description }}</p>
    <button
      v-if="actionLabel"
      class="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
