<script setup lang="ts">
import { ref, computed } from 'vue'
import { EventPriority } from '@/types/common'
import type { GameEvent } from '@/types/event'

/**
 * EventCard — Displays a single game event with priority-colored indicator,
 * summary title, and expandable description.
 */
const props = defineProps<{
  event: GameEvent
}>()

const expanded = ref(false)

const priorityColors: Record<EventPriority, { dot: string; border: string }> = {
  [EventPriority.Critical]: { dot: 'bg-red-500', border: 'border-red-500/30' },
  [EventPriority.Warning]: { dot: 'bg-amber-500', border: 'border-amber-500/30' },
  [EventPriority.Info]: { dot: 'bg-zinc-400', border: 'border-zinc-700' },
  [EventPriority.Positive]: { dot: 'bg-emerald-500', border: 'border-emerald-500/30' },
}

const colors = computed(() => priorityColors[props.event.priority])
</script>

<template>
  <div
    class="rounded-lg border bg-zinc-900/50 px-4 py-3 cursor-pointer transition-colors hover:bg-zinc-900"
    :class="colors.border"
    @click="expanded = !expanded"
  >
    <div class="flex items-start gap-3">
      <!-- Priority indicator dot -->
      <span class="mt-1 h-2 w-2 rounded-full shrink-0" :class="colors.dot" />

      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-zinc-200">{{ event.title }}</p>
        <p v-if="expanded" class="text-xs text-zinc-400 mt-1">{{ event.description }}</p>
      </div>

      <!-- Expand indicator -->
      <span class="text-xs text-zinc-600 shrink-0">{{ expanded ? '▾' : '▸' }}</span>
    </div>
  </div>
</template>
