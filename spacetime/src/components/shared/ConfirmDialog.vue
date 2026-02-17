<script setup lang="ts">
/**
 * ConfirmDialog — Modal overlay with message and confirm/cancel buttons.
 * Emits 'confirm' or 'cancel' for parent to handle.
 */
defineProps<{
  /** Dialog title. */
  title: string
  /** Message body displayed in the dialog. */
  message: string
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="emit('cancel')"
  >
    <!-- Dialog -->
    <div class="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
      <h2 class="text-lg font-semibold text-white mb-2">{{ title }}</h2>
      <p class="text-sm text-zinc-400 mb-6">{{ message }}</p>

      <div class="flex justify-end gap-3">
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
          @click="emit('cancel')"
        >
          {{ cancelLabel ?? 'Cancel' }}
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          @click="emit('confirm')"
        >
          {{ confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>
