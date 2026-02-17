<script setup lang="ts">
/**
 * CorpDetailView — Full corporation information display.
 *
 * Shows: full stats, personality trait descriptions, infrastructure owned (by planet),
 * contract history, capital breakdown.
 *
 * TODO (Story 7.2): Display active/completed contracts from contract store.
 * TODO (Story 11.1): Display capital action log.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CorpId } from '../types/common'
import { useCorporationStore } from '../stores/corporation.store'
import { usePlanetStore } from '../stores/planet.store'
import { CORP_TYPE_DEFINITIONS } from '../data/corporation-types'
import { PERSONALITY_TRAIT_DEFINITIONS } from '../data/personality-traits'
import { calculateCorpTax } from '../engine/formulas/tax'
import { calculateLevelUpCost, calculateMaxInfra, calculateAcquisitionCost, getTotalOwnedInfra } from '../engine/formulas/growth'
import CorpAssets from '../components/corporation/CorpAssets.vue'
import CorpHistory from '../components/corporation/CorpHistory.vue'
import EmptyState from '../components/shared/EmptyState.vue'
import ProgressBar from '../components/shared/ProgressBar.vue'

const route = useRoute()
const router = useRouter()
const corpStore = useCorporationStore()
const planetStore = usePlanetStore()

const corpId = route.params.id as CorpId

const corp = computed(() => corpStore.getCorp(corpId))

const typeDef = computed(() => {
  if (!corp.value) return undefined
  return CORP_TYPE_DEFINITIONS[corp.value.type]
})

/** Home planet name. */
const homePlanetName = computed(() => {
  if (!corp.value) return ''
  return planetStore.getPlanet(corp.value.homePlanetId)?.name ?? 'Unknown'
})

/** Tax this corp pays per turn. */
const tax = computed(() => {
  if (!corp.value) return 0
  return calculateCorpTax(corp.value.level)
})

/** Cost to level up. */
const levelUpCost = computed(() => {
  if (!corp.value) return 0
  return calculateLevelUpCost(corp.value.level)
})

/** Max infra capacity. */
const maxInfra = computed(() => {
  if (!corp.value) return 0
  return calculateMaxInfra(corp.value.level)
})

/** Total owned infrastructure. */
const totalInfra = computed(() => {
  if (!corp.value) return 0
  return getTotalOwnedInfra(corp.value.assets.infrastructureByColony)
})

/** Acquisition cost (what it would cost another corp to acquire this one). */
const acquisitionCost = computed(() => {
  if (!corp.value) return 0
  return calculateAcquisitionCost(corp.value.level)
})

/** Color for the corp type badge. */
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

function goBack() {
  router.push({ name: 'corporations' })
}
</script>

<template>
  <div v-if="corp && typeDef">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <button
        class="text-zinc-400 hover:text-white transition-colors text-sm"
        @click="goBack"
      >
        &larr; Corporations
      </button>
      <div class="flex items-center gap-3 min-w-0">
        <h1 class="text-2xl font-semibold text-white truncate">{{ corp.name }}</h1>
        <span
          class="shrink-0 text-xs font-medium px-2 py-0.5 rounded"
          :class="typeColorClasses[corp.type] ?? 'bg-indigo-500/20 text-indigo-400'"
        >
          {{ typeDef.name }}
        </span>
      </div>
      <div class="ml-auto flex items-center gap-4 shrink-0">
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-zinc-500">Level</span>
          <span class="text-sm font-semibold text-white">{{ corp.level }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-zinc-500">Founded</span>
          <span class="text-sm font-medium text-white">Turn {{ corp.foundedTurn }}</span>
        </div>
      </div>
    </div>

    <!-- Main content grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Left column: Stats + Traits + Capital -->
      <div class="space-y-4">
        <!-- Full Stats panel -->
        <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
          <div class="px-4 py-3 border-b border-zinc-800">
            <h3 class="text-sm font-medium text-white">Corporation Stats</h3>
          </div>
          <div class="px-4 py-3 space-y-3">
            <!-- Type description -->
            <p class="text-xs text-zinc-400">{{ typeDef.description }}</p>

            <!-- Special abilities -->
            <div v-if="typeDef.specialAbilities.length > 0">
              <span class="text-[10px] text-zinc-500 uppercase tracking-wider">Abilities</span>
              <ul class="mt-1 space-y-0.5">
                <li
                  v-for="(ability, i) in typeDef.specialAbilities"
                  :key="i"
                  class="text-xs text-zinc-400"
                >
                  {{ ability }}
                </li>
              </ul>
            </div>

            <!-- Key stats -->
            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/50">
              <div>
                <span class="text-[10px] text-zinc-500">Level</span>
                <div class="text-lg font-semibold text-white">{{ corp.level }}<span class="text-xs text-zinc-500">/10</span></div>
              </div>
              <div>
                <span class="text-[10px] text-zinc-500">Capital</span>
                <div class="text-lg font-semibold text-amber-400">{{ corp.capital }}</div>
              </div>
              <div>
                <span class="text-[10px] text-zinc-500">Tax/turn</span>
                <div class="text-sm font-medium" :class="tax > 0 ? 'text-emerald-400' : 'text-zinc-500'">
                  {{ tax > 0 ? `${tax} BP` : 'Exempt' }}
                </div>
              </div>
              <div>
                <span class="text-[10px] text-zinc-500">Home Planet</span>
                <div class="text-sm font-medium text-zinc-300">{{ homePlanetName }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Capital Breakdown -->
        <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
          <div class="px-4 py-3 border-b border-zinc-800">
            <h3 class="text-sm font-medium text-white">Capital Breakdown</h3>
          </div>
          <div class="px-4 py-3 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-zinc-400">Current Capital</span>
              <span class="text-sm font-medium text-amber-400">{{ corp.capital }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-zinc-400">Level Up Cost</span>
              <span class="text-sm font-medium text-zinc-300" :class="corp.capital >= levelUpCost ? 'text-emerald-400' : 'text-zinc-500'">
                {{ levelUpCost }} Capital
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-zinc-400">Acquisition Value</span>
              <span class="text-sm font-medium text-zinc-300">{{ acquisitionCost }} Capital</span>
            </div>

            <!-- Infrastructure capacity -->
            <div class="pt-2 border-t border-zinc-800/50">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-zinc-400">Infrastructure</span>
                <span class="text-xs text-zinc-500">{{ totalInfra }}/{{ maxInfra }}</span>
              </div>
              <ProgressBar
                :value="maxInfra > 0 ? Math.round((totalInfra / maxInfra) * 100) : 0"
                color="bg-indigo-500"
              />
            </div>
          </div>
        </div>

        <!-- Personality Traits -->
        <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
          <div class="px-4 py-3 border-b border-zinc-800">
            <h3 class="text-sm font-medium text-white">Personality Traits</h3>
          </div>
          <div class="divide-y divide-zinc-800/50">
            <div
              v-for="trait in corp.traits"
              :key="trait"
              class="px-4 py-2"
            >
              <div class="text-xs font-medium text-zinc-300">{{ PERSONALITY_TRAIT_DEFINITIONS[trait].name }}</div>
              <p class="text-[10px] text-zinc-500 mt-0.5">{{ PERSONALITY_TRAIT_DEFINITIONS[trait].description }}</p>
              <p class="text-[10px] text-zinc-600 mt-0.5 italic">{{ PERSONALITY_TRAIT_DEFINITIONS[trait].futureEffects }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column: Assets + History -->
      <div class="space-y-4">
        <CorpAssets :corp="corp" />
        <CorpHistory :corp="corp" />

        <!-- Planets Present -->
        <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
          <div class="px-4 py-3 border-b border-zinc-800">
            <h3 class="text-sm font-medium text-white">Planets Present</h3>
          </div>
          <div v-if="corp.planetsPresent.length > 0" class="divide-y divide-zinc-800/50">
            <div
              v-for="planetId in corp.planetsPresent"
              :key="planetId"
              class="px-4 py-2 flex items-center justify-between"
            >
              <span class="text-xs font-medium text-zinc-300">
                {{ planetStore.getPlanet(planetId)?.name ?? planetId }}
              </span>
              <span
                v-if="planetId === corp.homePlanetId"
                class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400"
              >
                Home
              </span>
            </div>
          </div>
          <div v-else class="px-4 py-6 text-center">
            <p class="text-xs text-zinc-500">No planet presence.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Corporation not found -->
  <div v-else>
    <div class="flex items-center gap-4 mb-6">
      <button
        class="text-zinc-400 hover:text-white transition-colors text-sm"
        @click="goBack"
      >
        &larr; Corporations
      </button>
      <h1 class="text-2xl font-semibold text-white">Corporation Detail</h1>
    </div>
    <EmptyState
      message="Corporation not found."
      description="This corporation may not exist or the ID is invalid."
      action-label="Back to Corporations"
      @action="goBack"
    />
  </div>
</template>
