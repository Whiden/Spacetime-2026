<script setup lang="ts">
/**
 * ColonyCard — Colony summary card for the list view.
 * Shows name, type, population level, attribute bars, and shortage alerts.
 * Clickable — navigates to colony detail view.
 *
 * TODO (Story 9.2): Show shortage alert icons when market phase detects shortages.
 * TODO (Story 10.4): Show trend arrows on attributes (up/down/stable).
 */
import type { Colony } from '../../types/colony'
import { COLONY_TYPE_DEFINITIONS } from '../../data/colony-types'
import AttributeBar from '../shared/AttributeBar.vue'
import ProgressBar from '../shared/ProgressBar.vue'

const props = defineProps<{
  colony: Colony
}>()

/** Formatted colony type name from definitions. */
const typeName = COLONY_TYPE_DEFINITIONS[props.colony.type].name

/** Attributes to display as bars (excludes growth which uses a progress bar). */
const attributeBars = [
  { label: 'Habitability', value: props.colony.attributes.habitability },
  { label: 'Accessibility', value: props.colony.attributes.accessibility },
  { label: 'Dynamism', value: props.colony.attributes.dynamism },
  { label: 'Quality of Life', value: props.colony.attributes.qualityOfLife },
  { label: 'Stability', value: props.colony.attributes.stability },
]
</script>

<template>
  <router-link
    :to="{ name: 'colony-detail', params: { id: colony.id } }"
    class="block rounded-lg border border-zinc-700 bg-zinc-900/80 hover:border-zinc-600 transition-colors"
  >
    <div class="px-4 py-3">
      <!-- Header row: name, type, population -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3 min-w-0">
          <h3 class="text-sm font-medium text-white truncate">{{ colony.name }}</h3>
          <span class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
            {{ typeName }}
          </span>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <!-- Population level -->
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-zinc-500">Pop</span>
            <span class="text-sm font-medium text-white">{{ colony.populationLevel }}</span>
          </div>

          <!-- TODO (Story 9.2): Shortage alert icons here -->
        </div>
      </div>

      <!-- Attribute bars -->
      <div class="space-y-1.5">
        <AttributeBar
          v-for="attr in attributeBars"
          :key="attr.label"
          :label="attr.label"
          :value="attr.value"
        />
      </div>

      <!-- Growth bar -->
      <div class="mt-2 pt-2 border-t border-zinc-800/50">
        <div class="flex items-center gap-3">
          <span class="text-xs text-zinc-400 w-24 shrink-0">Growth</span>
          <div class="flex-1">
            <ProgressBar
              :value="Math.max(0, colony.attributes.growth) * 10"
              color="bg-cyan-500"
              :label="`${colony.attributes.growth}/10`"
            />
          </div>
        </div>
      </div>
    </div>
  </router-link>
</template>
