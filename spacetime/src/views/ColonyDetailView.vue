<script setup lang="ts">
/**
 * ColonyDetailView — Full colony information display.
 *
 * Shows: attributes with modifier breakdown tooltips, infrastructure panel,
 * resource flow, features list, deposits list, corporations present.
 * Story 10.4: Population progress indicator added; trend arrows are in AttributePanel.
 *
 * TODO (Story 9.2): Shortage alert icons.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ColonyId } from '../types/common'
import { useColonyStore } from '../stores/colony.store'
import { usePlanetStore } from '../stores/planet.store'
import { COLONY_TYPE_DEFINITIONS } from '../data/colony-types'
import { PLANET_FEATURE_BY_ID } from '../data/planet-features'
import { DEPOSIT_DEFINITIONS } from '../data/planet-deposits'
import { RICHNESS_CAPS } from '../data/planet-deposits'
import AttributePanel from '../components/colony/AttributePanel.vue'
import InfraPanel from '../components/colony/InfraPanel.vue'
import ResourceFlow from '../components/colony/ResourceFlow.vue'
import EmptyState from '../components/shared/EmptyState.vue'
import ProgressBar from '../components/shared/ProgressBar.vue'

const route = useRoute()
const router = useRouter()
const colonyStore = useColonyStore()
const planetStore = usePlanetStore()

const colonyId = route.params.id as ColonyId

const colony = computed(() => colonyStore.getColony(colonyId))
const planet = computed(() => {
  if (!colony.value) return undefined
  return planetStore.getPlanet(colony.value.planetId)
})

const typeName = computed(() => {
  if (!colony.value) return ''
  return COLONY_TYPE_DEFINITIONS[colony.value.type].name
})

/** Planet features with resolved names and modifier descriptions. */
const features = computed(() => {
  if (!planet.value) return []
  return planet.value.features
    .filter((f) => f.revealed)
    .map((f) => {
      const def = PLANET_FEATURE_BY_ID[f.featureId]
      return {
        featureId: f.featureId,
        name: def?.name ?? f.featureId,
        description: def?.description ?? '',
        modifiers: def?.modifierTemplates ?? [],
      }
    })
})

/** Planet deposits with resolved names and richness info. */
const deposits = computed(() => {
  if (!planet.value) return []
  return planet.value.deposits.map((d) => {
    const def = DEPOSIT_DEFINITIONS[d.type]
    return {
      type: d.type,
      name: def.name,
      richness: d.richness,
      richnessRevealed: d.richnessRevealed,
      richnessCap: RICHNESS_CAPS[d.richness],
      extractedBy: def.name,
    }
  })
})

function goBack() {
  router.push({ name: 'colonies' })
}
</script>

<template>
  <div v-if="colony && planet">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <button
        class="text-zinc-400 hover:text-white transition-colors text-sm"
        @click="goBack"
      >
        &larr; Colonies
      </button>
      <div class="flex items-center gap-3 min-w-0">
        <h1 class="text-2xl font-semibold text-white truncate">{{ colony.name }}</h1>
        <span class="shrink-0 text-xs font-medium px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
          {{ typeName }}
        </span>
      </div>
      <div class="ml-auto flex items-center gap-4 shrink-0">
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-zinc-500">Pop</span>
          <span class="text-sm font-medium text-white">{{ colony.populationLevel }}</span>
        </div>
        <!-- Growth progress toward next population level -->
        <div class="flex items-center gap-2 w-28">
          <span class="text-xs text-zinc-500 shrink-0">Growth</span>
          <ProgressBar
            :value="Math.max(0, Math.min(100, (colony.attributes.growth / 10) * 100))"
            color="bg-cyan-500"
            :label="`${colony.attributes.growth}/10`"
          />
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-zinc-500">Founded</span>
          <span class="text-sm font-medium text-white">Turn {{ colony.foundedTurn }}</span>
        </div>
      </div>
    </div>

    <!-- Main content grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Left column: Attributes + Features + Deposits -->
      <div class="space-y-4">
        <AttributePanel :colony="colony" :planet="planet" />

        <!-- Features list -->
        <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
          <div class="px-4 py-3 border-b border-zinc-800">
            <h3 class="text-sm font-medium text-white">Planet Features</h3>
          </div>
          <div v-if="features.length > 0" class="divide-y divide-zinc-800/50">
            <div
              v-for="feature in features"
              :key="feature.featureId"
              class="px-4 py-2"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-zinc-300">{{ feature.name }}</span>
              </div>
              <p v-if="feature.description" class="text-[10px] text-zinc-500 mt-0.5">
                {{ feature.description }}
              </p>
              <div v-if="feature.modifiers.length > 0" class="mt-1 flex flex-wrap gap-1.5">
                <span
                  v-for="(mod, i) in feature.modifiers"
                  :key="i"
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  :class="mod.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'"
                >
                  {{ mod.operation === 'multiply' ? `×${mod.value}` : (mod.value >= 0 ? `+${mod.value}` : mod.value) }} {{ mod.target }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="px-4 py-6 text-center">
            <p class="text-xs text-zinc-500">No revealed features.</p>
          </div>
        </div>

        <!-- Deposits list -->
        <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
          <div class="px-4 py-3 border-b border-zinc-800">
            <h3 class="text-sm font-medium text-white">Deposits</h3>
          </div>
          <div v-if="deposits.length > 0" class="divide-y divide-zinc-800/50">
            <div
              v-for="deposit in deposits"
              :key="deposit.type"
              class="px-4 py-2 flex items-center justify-between"
            >
              <span class="text-xs font-medium text-zinc-300">{{ deposit.name }}</span>
              <div class="flex items-center gap-3">
                <span
                  v-if="deposit.richnessRevealed"
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  :class="{
                    'bg-zinc-700 text-zinc-400': deposit.richness === 'Poor',
                    'bg-amber-500/10 text-amber-400': deposit.richness === 'Moderate',
                    'bg-emerald-500/10 text-emerald-400': deposit.richness === 'Rich',
                    'bg-purple-500/10 text-purple-400': deposit.richness === 'Exceptional',
                  }"
                >
                  {{ deposit.richness }} (cap {{ deposit.richnessCap }})
                </span>
                <span v-else class="text-[10px] text-zinc-600">Unknown richness</span>
              </div>
            </div>
          </div>
          <div v-else class="px-4 py-6 text-center">
            <p class="text-xs text-zinc-500">No deposits found.</p>
          </div>
        </div>
      </div>

      <!-- Right column: Infrastructure + Resource Flow + Corporations -->
      <div class="space-y-4">
        <InfraPanel :colony="colony" :deposits="planet.deposits" />
        <ResourceFlow :colony="colony" :deposits="planet.deposits" />

        <!-- Corporations present -->
        <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
          <div class="px-4 py-3 border-b border-zinc-800">
            <h3 class="text-sm font-medium text-white">Corporations</h3>
          </div>
          <div v-if="colony.corporationsPresent.length > 0" class="divide-y divide-zinc-800/50">
            <div
              v-for="corpId in colony.corporationsPresent"
              :key="corpId"
              class="px-4 py-2"
            >
              <span class="text-xs text-zinc-300">{{ corpId }}</span>
            </div>
          </div>
          <div v-else class="px-4 py-6 text-center">
            <p class="text-xs text-zinc-500">No corporations present.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Colony not found -->
  <div v-else>
    <div class="flex items-center gap-4 mb-6">
      <button
        class="text-zinc-400 hover:text-white transition-colors text-sm"
        @click="goBack"
      >
        &larr; Colonies
      </button>
      <h1 class="text-2xl font-semibold text-white">Colony Detail</h1>
    </div>
    <EmptyState
      message="Colony not found."
      description="This colony may have been removed or the ID is invalid."
      action-label="Back to Colonies"
      @action="goBack"
    />
  </div>
</template>
