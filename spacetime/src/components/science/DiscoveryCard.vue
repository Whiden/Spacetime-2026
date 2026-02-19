<script setup lang="ts">
/**
 * DiscoveryCard.vue — Displays a single science discovery.
 *
 * Shows: name, domain, turn discovered, description, empire bonus grants,
 * and which schematic categories were unlocked.
 *
 * Used by: ScienceView.vue (discoveries list, chronological order)
 */
import type { Discovery } from '../../types/science'
import { SCIENCE_DOMAIN_DEFINITIONS } from '../../data/science-sectors'

defineProps<{
  discovery: Discovery
  /** Name of the corp that made this discovery (looked up by caller). */
  corpName: string
}>()
</script>

<template>
  <div class="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
    <!-- Header: name + domain badge + turn -->
    <div class="flex items-start justify-between mb-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-white font-medium text-sm">{{ discovery.name }}</span>
        <span class="text-xs bg-indigo-800/60 text-indigo-300 rounded px-1.5 py-0.5">
          {{ SCIENCE_DOMAIN_DEFINITIONS[discovery.domain]?.name ?? discovery.domain }}
        </span>
        <span class="text-xs text-zinc-500">Lv {{ discovery.poolLevel }} pool</span>
      </div>
      <span class="text-xs text-zinc-500 shrink-0 ml-2">Turn {{ discovery.discoveredTurn }}</span>
    </div>

    <!-- Description -->
    <p class="text-zinc-300 text-sm mb-3">{{ discovery.description }}</p>

    <!-- Corp attribution -->
    <p class="text-xs text-zinc-500 mb-3">Discovered by {{ corpName }}</p>

    <!-- Empire bonus effects -->
    <div v-if="discovery.empireBonusEffects.length > 0" class="mb-3">
      <p class="text-xs font-semibold text-zinc-400 mb-1">Ship stat bonuses:</p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="effect in discovery.empireBonusEffects"
          :key="effect.key"
          class="text-xs bg-emerald-900/50 text-emerald-300 rounded px-1.5 py-0.5"
        >
          {{ effect.key.replace('shipStats.', '').replace('infraCaps.', '') }} +{{ effect.amount }}
        </span>
      </div>
    </div>

    <!-- Unlocked schematic categories -->
    <div v-if="discovery.unlocksSchematicCategories.length > 0">
      <p class="text-xs font-semibold text-zinc-400 mb-1">Unlocks schematics:</p>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="cat in discovery.unlocksSchematicCategories"
          :key="cat"
          class="text-xs bg-sky-900/50 text-sky-300 rounded px-1.5 py-0.5"
        >
          {{ cat }}
        </span>
      </div>
    </div>
  </div>
</template>
