<script setup lang="ts">
/**
 * CorpCard — Corporation summary card for the list view.
 * Shows name, type, level, capital, personality traits, home planet.
 * Clickable — navigates to corporation detail view.
 *
 * TODO (Story 11.1): Show investment activity indicator.
 * TODO (Story 11.3): Show "New" badge for corps founded this turn.
 */
import type { Corporation } from '../../types/corporation'
import { CORP_TYPE_DEFINITIONS } from '../../data/corporation-types'
import { PERSONALITY_TRAIT_DEFINITIONS } from '../../data/personality-traits'
import { usePlanetStore } from '../../stores/planet.store'
import { calculateCorpTax } from '../../engine/formulas/tax'
import { calculateMaxInfra, getTotalOwnedInfra } from '../../engine/formulas/growth'
import ProgressBar from '../shared/ProgressBar.vue'

const props = defineProps<{
  corp: Corporation
}>()

const planetStore = usePlanetStore()

/** Resolved corp type name. */
const typeDef = CORP_TYPE_DEFINITIONS[props.corp.type]

/** Home planet name (resolved from store). */
const homePlanetName = planetStore.getPlanet(props.corp.homePlanetId)?.name ?? 'Unknown'

/** Tax this corp pays. */
const tax = calculateCorpTax(props.corp.level)

/** Total owned infrastructure. */
const totalInfra = getTotalOwnedInfra(props.corp.assets.infrastructureByColony)

/** Max infrastructure for current level. */
const maxInfra = calculateMaxInfra(props.corp.level)

/** Color for the corp type badge based on corp type. */
const typeColorClasses: Record<string, string> = {
  Exploitation: 'bg-amber-500/20 text-amber-400',
  Construction: 'bg-orange-500/20 text-orange-400',
  Industrial: 'bg-slate-500/20 text-slate-400',
  Shipbuilding: 'bg-sky-500/20 text-sky-400',
  Science: 'bg-violet-500/20 text-violet-400',
  Transport: 'bg-teal-500/20 text-teal-400',
  Military: 'bg-red-500/20 text-red-400',
  Exploration: 'bg-emerald-500/20 text-emerald-400',
  Agriculture: 'bg-lime-500/20 text-lime-400',
}
</script>

<template>
  <router-link
    :to="{ name: 'corp-detail', params: { id: corp.id } }"
    class="block rounded-lg border border-zinc-700 bg-zinc-900/80 hover:border-zinc-600 transition-colors"
  >
    <div class="px-4 py-3">
      <!-- Header row: name, type badge -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-3 min-w-0">
          <h3 class="text-sm font-medium text-white truncate">{{ corp.name }}</h3>
          <span
            class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded"
            :class="typeColorClasses[corp.type] ?? 'bg-indigo-500/20 text-indigo-400'"
          >
            {{ typeDef.name }}
          </span>
        </div>
      </div>

      <!-- Stats row: level, capital, tax, infra -->
      <div class="flex items-center gap-4 mb-2">
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-zinc-500">Level</span>
          <span class="text-sm font-semibold text-white">{{ corp.level }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-zinc-500">Capital</span>
          <span class="text-sm font-medium text-amber-400">{{ corp.capital }}</span>
        </div>
        <div v-if="tax > 0" class="flex items-center gap-1.5">
          <span class="text-xs text-zinc-500">Tax</span>
          <span class="text-sm font-medium text-emerald-400">{{ tax }} BP</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-zinc-500">Infra</span>
          <span class="text-sm font-medium text-zinc-300">{{ totalInfra }}/{{ maxInfra }}</span>
        </div>
      </div>

      <!-- Infrastructure capacity bar -->
      <div class="mb-2">
        <ProgressBar
          :value="maxInfra > 0 ? Math.round((totalInfra / maxInfra) * 100) : 0"
          color="bg-indigo-500"
          :label="`${totalInfra}/${maxInfra} infrastructure`"
        />
      </div>

      <!-- Traits + home planet -->
      <div class="flex items-center justify-between">
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="trait in corp.traits"
            :key="trait"
            class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400"
          >
            {{ PERSONALITY_TRAIT_DEFINITIONS[trait].name }}
          </span>
        </div>
        <span class="text-[10px] text-zinc-500 shrink-0 ml-2">
          {{ homePlanetName }}
        </span>
      </div>
    </div>
  </router-link>
</template>
