<script setup lang="ts">
/**
 * AttributePanel — Shows all 6 colony attributes with bars and modifier breakdown tooltips.
 *
 * Uses getModifierBreakdown() so each attribute tooltip displays:
 *   "Habitability 9: Base 8 (Continental) + 1 (Temperate Climate)"
 */
import { computed } from 'vue'
import type { Colony } from '../../types/colony'
import type { Planet } from '../../types/planet'
import { getModifierBreakdown } from '../../engine/formulas/modifiers'
import { PLANET_TYPE_DEFINITIONS } from '../../data/planet-types'
import AttributeBar from '../shared/AttributeBar.vue'
import ProgressBar from '../shared/ProgressBar.vue'

const props = defineProps<{
  colony: Colony
  planet: Planet
}>()

/** Build attribute entries with modifier breakdown for tooltips. */
const attributes = computed(() => {
  const colony = props.colony
  const planet = props.planet
  const planetTypeName = PLANET_TYPE_DEFINITIONS[planet.type].name

  const entries = [
    { key: 'habitability', label: 'Habitability', base: planet.baseHabitability, baseLabel: planetTypeName },
    { key: 'accessibility', label: 'Accessibility', base: 0, baseLabel: 'Base' },
    { key: 'dynamism', label: 'Dynamism', base: 0, baseLabel: 'Base' },
    { key: 'qualityOfLife', label: 'Quality of Life', base: 0, baseLabel: 'Base' },
    { key: 'stability', label: 'Stability', base: 0, baseLabel: 'Base' },
  ]

  return entries.map((entry) => {
    const value = colony.attributes[entry.key as keyof typeof colony.attributes]
    const breakdown = getModifierBreakdown(entry.key, colony.modifiers)
    return {
      ...entry,
      value,
      breakdown,
    }
  })
})

/** Format a modifier value for display (+1, -2, ×1.1). */
function formatModValue(operation: 'add' | 'multiply', value: number): string {
  if (operation === 'multiply') return `×${value}`
  return value >= 0 ? `+${value}` : `${value}`
}
</script>

<template>
  <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div class="px-4 py-3 border-b border-zinc-800">
      <h3 class="text-sm font-medium text-white">Attributes</h3>
    </div>
    <div class="px-4 py-3 space-y-3">
      <!-- Standard attributes with tooltip breakdown -->
      <div v-for="attr in attributes" :key="attr.key" class="group relative">
        <AttributeBar :label="attr.label" :value="attr.value" />

        <!-- Tooltip with modifier breakdown -->
        <div class="hidden group-hover:block absolute left-0 top-full z-10 mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 shadow-lg min-w-[240px]">
          <p class="text-xs font-medium text-white mb-1">
            {{ attr.label }} {{ attr.value }}
          </p>
          <p class="text-[10px] text-zinc-400">
            Base {{ attr.base }} ({{ attr.baseLabel }})
          </p>
          <p
            v-for="(mod, i) in attr.breakdown"
            :key="i"
            class="text-[10px] text-zinc-400"
          >
            {{ formatModValue(mod.operation, mod.value) }} ({{ mod.source }})
          </p>
        </div>
      </div>

      <!-- Growth bar (separate, uses ProgressBar) -->
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
  </div>
</template>
