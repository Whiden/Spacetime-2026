<script setup lang="ts">
/**
 * ColonyCard — Colony summary card for the list view.
 * Shows name, type, population level, attribute bars, trend arrows, and shortage alerts.
 * Clickable — navigates to colony detail view.
 *
 * Story 10.4: Added trend arrows on attributes and growth progress indicator.
 * TODO (Story 9.2): Show shortage alert icons when market phase detects shortages.
 */
import { computed } from 'vue'
import type { Colony } from '../../types/colony'
import { COLONY_TYPE_DEFINITIONS } from '../../data/colony-types'
import AttributeBar from '../shared/AttributeBar.vue'
import ProgressBar from '../shared/ProgressBar.vue'

const props = defineProps<{
  colony: Colony
}>()

/** Formatted colony type name from definitions. */
const typeName = COLONY_TYPE_DEFINITIONS[props.colony.type].name

type TrendDirection = 'up' | 'down' | 'stable'

/** Compute trend direction for an attribute key vs last turn. */
function getTrend(key: string): TrendDirection {
  const prev = props.colony.previousAttributes
  if (!prev) return 'stable'
  const current = props.colony.attributes[key as keyof typeof props.colony.attributes]
  const previous = prev[key as keyof typeof prev]
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'stable'
}

/** Attributes to display as bars (excludes growth which uses a progress bar). */
const attributeBars = computed(() => [
  { label: 'Habitability', value: props.colony.attributes.habitability, trend: getTrend('habitability') },
  { label: 'Accessibility', value: props.colony.attributes.accessibility, trend: getTrend('accessibility') },
  { label: 'Dynamism', value: props.colony.attributes.dynamism, trend: getTrend('dynamism') },
  { label: 'Quality of Life', value: props.colony.attributes.qualityOfLife, trend: getTrend('qualityOfLife') },
  { label: 'Stability', value: props.colony.attributes.stability, trend: getTrend('stability') },
])

/** Growth progress: 0–10 mapped to 0–100%. Clamped to non-negative. */
const growthProgress = computed(() =>
  Math.max(0, Math.min(100, (props.colony.attributes.growth / 10) * 100)),
)

/** True if any attribute is declining vs last turn. */
const hasWarning = computed(() =>
  attributeBars.value.some((a) => a.trend === 'down'),
)
</script>

<template>
  <router-link
    :to="{ name: 'colony-detail', params: { id: colony.id } }"
    class="block rounded-lg border bg-zinc-900/80 hover:border-zinc-600 transition-colors"
    :class="hasWarning ? 'border-red-800/60' : 'border-zinc-700'"
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

      <!-- Attribute bars with trend arrows -->
      <div class="space-y-1.5">
        <div
          v-for="attr in attributeBars"
          :key="attr.label"
          class="flex items-center gap-1"
        >
          <!-- Trend arrow -->
          <span
            class="shrink-0 text-[10px] w-2.5 text-center leading-none"
            :class="{
              'text-emerald-400': attr.trend === 'up',
              'text-red-400': attr.trend === 'down',
              'text-zinc-700': attr.trend === 'stable',
            }"
          >
            {{ attr.trend === 'up' ? '▲' : attr.trend === 'down' ? '▼' : '–' }}
          </span>
          <div class="flex-1">
            <AttributeBar :label="attr.label" :value="attr.value" />
          </div>
        </div>
      </div>

      <!-- Growth bar with pop progress label -->
      <div class="mt-2 pt-2 border-t border-zinc-800/50">
        <div class="flex items-center gap-3">
          <span class="text-xs text-zinc-400 w-24 shrink-0">Growth</span>
          <div class="flex-1">
            <ProgressBar
              :value="growthProgress"
              color="bg-cyan-500"
              :label="`${colony.attributes.growth}/10`"
            />
          </div>
        </div>
      </div>
    </div>
  </router-link>
</template>
