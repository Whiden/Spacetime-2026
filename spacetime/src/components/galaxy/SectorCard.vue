<script setup lang="ts">
/**
 * SectorCard — Displays a single sector with name, density, exploration %,
 * adjacency connections, and presence indicators. Click to expand details.
 *
 * TODO (Story 13.5): Show discovered planets under sector detail.
 * TODO (Story 7.5): Show active contracts in sector detail.
 */
import { ref } from 'vue'
import type { SectorId } from '../../types/common'
import type { Sector } from '../../types/sector'
import ProgressBar from '../shared/ProgressBar.vue'

const props = defineProps<{
  sector: Sector
  /** Names of adjacent sectors for display. */
  adjacentSectorNames: string[]
  /** Whether this is the starting sector. */
  isStartingSector: boolean
  /** Whether this sector is explorable (adjacent to player presence). */
  isExplorable: boolean
  /** Whether the player has presence in this sector. */
  hasPresence: boolean
}>()

const expanded = ref(false)

/** Color for the exploration progress bar based on percentage. */
function explorationColor(percent: number): string {
  if (percent >= 100) return 'bg-emerald-500'
  if (percent > 0) return 'bg-indigo-500'
  return 'bg-zinc-600'
}

/** Label for sector density. */
function densityLabel(density: string): string {
  return density
}
</script>

<template>
  <div
    class="rounded-lg border transition-colors cursor-pointer"
    :class="[
      isExplorable || hasPresence
        ? 'border-zinc-700 bg-zinc-900/80 hover:border-zinc-600'
        : 'border-zinc-800/50 bg-zinc-900/30 opacity-60',
    ]"
    @click="expanded = !expanded"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between px-4 py-3">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Presence indicator dot -->
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="[
            hasPresence ? 'bg-emerald-400' : isExplorable ? 'bg-indigo-400' : 'bg-zinc-700',
          ]"
        />

        <!-- Sector name -->
        <h3 class="text-sm font-medium text-white truncate">
          {{ sector.name }}
        </h3>

        <!-- Starting sector badge -->
        <span
          v-if="isStartingSector"
          class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400"
        >
          Home
        </span>

        <!-- Explorable badge -->
        <span
          v-if="isExplorable && !hasPresence"
          class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400"
        >
          Explorable
        </span>
      </div>

      <div class="flex items-center gap-4 shrink-0">
        <!-- Density -->
        <span class="text-xs text-zinc-500">{{ densityLabel(sector.density) }}</span>

        <!-- Exploration % -->
        <div class="w-24">
          <ProgressBar
            :value="sector.explorationPercent"
            :color="explorationColor(sector.explorationPercent)"
            :label="`${sector.explorationPercent}%`"
          />
        </div>

        <!-- Expand chevron -->
        <span
          class="text-zinc-500 text-xs transition-transform"
          :class="expanded ? 'rotate-180' : ''"
        >
          ▼
        </span>
      </div>
    </div>

    <!-- Expanded detail -->
    <div v-if="expanded" class="px-4 pb-4 pt-1 border-t border-zinc-800/50">
      <div class="grid grid-cols-2 gap-4 text-xs">
        <!-- Connections -->
        <div>
          <p class="text-zinc-500 mb-1">Connected to</p>
          <p v-if="adjacentSectorNames.length > 0" class="text-zinc-300">
            {{ adjacentSectorNames.join(', ') }}
          </p>
          <p v-else class="text-zinc-600 italic">None</p>
        </div>

        <!-- Stats -->
        <div class="space-y-1">
          <div class="flex justify-between">
            <span class="text-zinc-500">Density</span>
            <span class="text-zinc-300">{{ sector.density }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-zinc-500">Exploration</span>
            <span class="text-zinc-300">{{ sector.explorationPercent }}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-zinc-500">Threat Modifier</span>
            <span class="text-zinc-300">×{{ sector.threatModifier }}</span>
          </div>
        </div>
      </div>

      <!-- Presence info -->
      <div class="mt-3 pt-3 border-t border-zinc-800/50">
        <div v-if="isStartingSector" class="flex items-center gap-2 text-xs">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span class="text-emerald-400">Terra Nova colony</span>
        </div>

        <!-- TODO (Story 13.5): List discovered planets (POIs) here -->
        <p v-if="!isStartingSector && !hasPresence" class="text-zinc-600 text-xs italic">
          No presence in this sector.
        </p>

        <!-- TODO (Story 7.5): List active contracts in this sector here -->
      </div>
    </div>
  </div>
</template>
