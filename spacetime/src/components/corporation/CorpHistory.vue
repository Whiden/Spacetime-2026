<script setup lang="ts">
/**
 * CorpHistory — Contract history and capital event log for a corporation.
 *
 * Currently a placeholder since no contracts exist yet.
 *
 * TODO (Story 7.2): Display completed contracts from contract store.
 * TODO (Story 11.1): Display capital action log (investments, level ups, acquisitions).
 */
import type { Corporation } from '../../types/corporation'

defineProps<{
  corp: Corporation
}>()
</script>

<template>
  <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div class="px-4 py-3 border-b border-zinc-800">
      <h3 class="text-sm font-medium text-white">Contract History</h3>
    </div>

    <div class="px-4 py-6 text-center">
      <p class="text-xs text-zinc-500">No contract history yet.</p>
      <p class="text-[10px] text-zinc-600 mt-1">Completed contracts will appear here.</p>
    </div>
  </div>
</template>
