<script setup lang="ts">
/**
 * InfraPanel — Infrastructure panel showing all 12 domains with levels, ownership, and caps.
 *
 * Each row shows: domain name, total level / cap, public vs corporate breakdown.
 * "Invest" button is shown but disabled until budget system is implemented.
 *
 * TODO (Story 5.4): Enable Invest button when budget system is wired.
 */
import { computed } from 'vue'
import type { Colony } from '../../types/colony'
import { InfraDomain } from '../../types/common'
import { getTotalLevels, getCorporateLevels } from '../../types/infrastructure'
import { INFRA_DOMAIN_DEFINITIONS } from '../../data/infrastructure'

const props = defineProps<{
  colony: Colony
}>()

/** Ordered list of all 12 domains for display. */
const DOMAIN_ORDER: InfraDomain[] = [
  InfraDomain.Civilian,
  InfraDomain.Agricultural,
  InfraDomain.Mining,
  InfraDomain.DeepMining,
  InfraDomain.GasExtraction,
  InfraDomain.LowIndustry,
  InfraDomain.HeavyIndustry,
  InfraDomain.HighTechIndustry,
  InfraDomain.SpaceIndustry,
  InfraDomain.Transport,
  InfraDomain.Science,
  InfraDomain.Military,
]

const infraRows = computed(() => {
  return DOMAIN_ORDER.map((domain) => {
    const state = props.colony.infrastructure[domain]
    const def = INFRA_DOMAIN_DEFINITIONS[domain]
    const total = getTotalLevels(state)
    const corpLevels = getCorporateLevels(state)
    const publicLevels = state.ownership.publicLevels
    const cap = state.currentCap
    const capDisplay = cap === Infinity || cap >= 9999 ? '∞' : String(cap)

    return {
      domain,
      name: def.name,
      total,
      publicLevels,
      corpLevels,
      cap,
      capDisplay,
      atCap: total >= cap,
    }
  }).filter((row) => row.total > 0 || row.cap > 0)
})
</script>

<template>
  <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div class="px-4 py-3 border-b border-zinc-800">
      <h3 class="text-sm font-medium text-white">Infrastructure</h3>
    </div>
    <div class="divide-y divide-zinc-800/50">
      <div
        v-for="row in infraRows"
        :key="row.domain"
        class="px-4 py-2 flex items-center gap-3"
      >
        <!-- Domain name -->
        <span class="text-xs text-zinc-300 w-28 shrink-0">{{ row.name }}</span>

        <!-- Level bar -->
        <div class="flex-1 flex items-center gap-2">
          <div class="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              class="h-full rounded-full bg-indigo-500 transition-all duration-300"
              :style="{ width: row.cap > 0 && row.cap !== Infinity ? `${Math.min(100, (row.total / row.cap) * 100)}%` : (row.total > 0 ? '100%' : '0%') }"
            />
          </div>
        </div>

        <!-- Level / Cap -->
        <span class="text-xs font-medium text-zinc-300 w-14 text-right">
          {{ row.total }}/{{ row.capDisplay }}
        </span>

        <!-- Ownership breakdown -->
        <span class="text-[10px] text-zinc-500 w-20 text-right">
          <template v-if="row.corpLevels > 0">
            {{ row.publicLevels }}p + {{ row.corpLevels }}c
          </template>
          <template v-else>
            {{ row.publicLevels }} public
          </template>
        </span>

        <!-- Invest button (disabled until budget system) -->
        <button
          disabled
          class="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-600 cursor-not-allowed"
          title="Budget system not yet implemented"
        >
          Invest
        </button>
      </div>

      <div v-if="infraRows.length === 0" class="px-4 py-6 text-center">
        <p class="text-xs text-zinc-500">No infrastructure built yet.</p>
      </div>
    </div>
  </div>
</template>
