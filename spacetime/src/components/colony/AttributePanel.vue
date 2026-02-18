<script setup lang="ts">
/**
 * AttributePanel — Shows all 6 colony attributes with bars, trend arrows,
 * modifier breakdown tooltips, and warnings for declining attributes.
 *
 * Story 10.4: Added trend arrows (up/down/stable vs previousAttributes),
 * improved tooltips with full derivation, and warning highlights for
 * attributes declining compared to last turn.
 */
import { computed } from 'vue'
import type { Colony } from '../../types/colony'
import type { Planet } from '../../types/planet'
import { getModifierBreakdown } from '../../engine/formulas/modifiers'
import { getTotalLevels } from '../../types/infrastructure'
import { InfraDomain } from '../../types/common'
import { PLANET_TYPE_DEFINITIONS } from '../../data/planet-types'
import AttributeBar from '../shared/AttributeBar.vue'
import ProgressBar from '../shared/ProgressBar.vue'

const props = defineProps<{
  colony: Colony
  planet: Planet
}>()

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
    const trend = getTrend(entry.key)
    const isWarning = trend === 'down'
    return {
      ...entry,
      value,
      breakdown,
      trend,
      isWarning,
    }
  })
})

/** Format a modifier value for display (+1, -2, ×1.1). */
function formatModValue(operation: 'add' | 'multiply', value: number): string {
  if (operation === 'multiply') return `×${value}`
  return value >= 0 ? `+${value}` : `${value}`
}

/**
 * Build a human-readable base explanation for each attribute's derivation.
 * Returns lines like ["Base 8 (Continental)", "+1 (Temperate Climate)", ...].
 */
function buildDerivation(attr: typeof attributes.value[number]): string[] {
  const lines: string[] = []
  const colony = props.colony
  const planet = props.planet
  const attrs = colony.attributes

  if (attr.key === 'habitability') {
    lines.push(`Base ${planet.baseHabitability} (${PLANET_TYPE_DEFINITIONS[planet.type].name})`)
  } else if (attr.key === 'accessibility') {
    const transportInfra = getTotalTransport(colony)
    const transportBonus = Math.floor(transportInfra / 2)
    lines.push(`Base 3 + floor(${transportInfra} transport ÷ 2) = ${3 + transportBonus}`)
  } else if (attr.key === 'dynamism') {
    const access = attrs.accessibility
    const pop = colony.populationLevel
    lines.push(`floor((${access} access + ${pop} pop) ÷ 2) = ${Math.floor((access + pop) / 2)}`)
  } else if (attr.key === 'qualityOfLife') {
    const habMalus = Math.floor(Math.max(0, 10 - attrs.habitability) / 3)
    if (habMalus > 0) {
      lines.push(`Base 10 − ${habMalus} habitability penalty = ${10 - habMalus}`)
    } else {
      lines.push(`Base 10`)
    }
  } else if (attr.key === 'stability') {
    const qolMalus = Math.max(0, 5 - attrs.qualityOfLife)
    const qol = attrs.qualityOfLife
    if (qolMalus > 0) {
      lines.push(`Base 10 − ${qolMalus} low QoL penalty (QoL ${qol})`)
    } else {
      lines.push(`Base 10 (QoL ${qol} ≥ 5)`)
    }
  }

  for (const mod of attr.breakdown) {
    lines.push(`${formatModValue(mod.operation, mod.value)} (${mod.source})`)
  }

  return lines
}

/** Get total transport infrastructure levels on the colony. */
function getTotalTransport(colony: Colony): number {
  return getTotalLevels(colony.infrastructure[InfraDomain.Transport])
}

/** Growth bar: show progress from 0–9 (since -1 triggers decline, 10 triggers levelup). */
const growthProgress = computed(() => {
  const g = props.colony.attributes.growth
  // Map growth 0–9 to 0–100% (values <0 show as 0%, value 10 would trigger levelup)
  return Math.max(0, Math.min(100, (g / 10) * 100))
})

const growthTrend = computed<TrendDirection>(() => getTrend('growth'))
</script>

<template>
  <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div class="px-4 py-3 border-b border-zinc-800">
      <h3 class="text-sm font-medium text-white">Attributes</h3>
    </div>
    <div class="px-4 py-3 space-y-3">
      <!-- Standard attributes with tooltip breakdown -->
      <div v-for="attr in attributes" :key="attr.key" class="group relative">
        <div class="flex items-center gap-1.5">
          <!-- Trend arrow -->
          <span
            class="shrink-0 text-xs w-3 text-center leading-none"
            :class="{
              'text-emerald-400': attr.trend === 'up',
              'text-red-400': attr.trend === 'down',
              'text-zinc-600': attr.trend === 'stable',
            }"
            :title="attr.trend === 'up' ? 'Increasing' : attr.trend === 'down' ? 'Declining' : 'Stable'"
          >
            {{ attr.trend === 'up' ? '▲' : attr.trend === 'down' ? '▼' : '–' }}
          </span>
          <!-- Attribute bar (with red border on warning) -->
          <div
            class="flex-1"
            :class="{ 'ring-1 ring-red-500/40 rounded': attr.isWarning }"
          >
            <AttributeBar :label="attr.label" :value="attr.value" />
          </div>
        </div>

        <!-- Tooltip with full derivation -->
        <div class="hidden group-hover:block absolute left-0 top-full z-10 mt-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 shadow-lg min-w-65">
          <p class="text-xs font-medium text-white mb-1.5">
            {{ attr.label }}: {{ attr.value }}/10
            <span
              v-if="attr.trend !== 'stable' && colony.previousAttributes"
              class="ml-1 text-[10px]"
              :class="attr.trend === 'up' ? 'text-emerald-400' : 'text-red-400'"
            >
              ({{ attr.trend === 'up' ? '+' : '' }}{{ attr.value - (colony.previousAttributes?.[attr.key as keyof typeof colony.previousAttributes] ?? attr.value) }} vs last turn)
            </span>
          </p>
          <div class="space-y-0.5">
            <p
              v-for="(line, i) in buildDerivation(attr)"
              :key="i"
              class="text-[10px] text-zinc-400"
            >
              {{ line }}
            </p>
          </div>
          <p v-if="attr.isWarning" class="mt-1.5 text-[10px] text-red-400 font-medium">
            ⚠ Declining — check modifiers and infrastructure
          </p>
        </div>
      </div>

      <!-- Growth bar (separate, uses ProgressBar) -->
      <div class="mt-2 pt-2 border-t border-zinc-800/50">
        <div class="flex items-center gap-3">
          <!-- Growth trend arrow -->
          <span
            class="shrink-0 text-xs w-3 text-center leading-none"
            :class="{
              'text-emerald-400': growthTrend === 'up',
              'text-red-400': growthTrend === 'down',
              'text-zinc-600': growthTrend === 'stable',
            }"
          >
            {{ growthTrend === 'up' ? '▲' : growthTrend === 'down' ? '▼' : '–' }}
          </span>
          <span class="text-xs text-zinc-400 w-20 shrink-0">Growth</span>
          <div class="flex-1">
            <ProgressBar
              :value="growthProgress"
              color="bg-cyan-500"
              :label="`${colony.attributes.growth}/10`"
            />
          </div>
        </div>
        <p class="text-[10px] text-zinc-500 mt-1 pl-6">
          Pop level {{ colony.populationLevel }} — {{ colony.attributes.growth }}/10 toward next level
        </p>
      </div>
    </div>
  </div>
</template>
