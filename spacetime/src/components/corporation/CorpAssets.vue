<script setup lang="ts">
/**
 * CorpAssets — Displays corporation infrastructure holdings by planet.
 *
 * Shows each colony where the corp owns infrastructure, with domain-level breakdowns.
 *
 * TODO (Story 11.1): Updates in real-time as corp AI invests.
 * TODO (Story 14.3): Also display schematics owned.
 */
import type { Corporation } from '../../types/corporation'
import { useColonyStore } from '../../stores/colony.store'
import { usePlanetStore } from '../../stores/planet.store'
import { INFRA_DOMAIN_DEFINITIONS } from '../../data/infrastructure'
import type { ColonyId } from '../../types/common'
import type { InfraDomain } from '../../types/common'
import { getTotalOwnedInfra, calculateMaxInfra } from '../../engine/formulas/growth'

const props = defineProps<{
  corp: Corporation
}>()

const colonyStore = useColonyStore()
const planetStore = usePlanetStore()

/** Total owned infrastructure across all colonies. */
const totalInfra = getTotalOwnedInfra(props.corp.assets.infrastructureByColony)

/** Max infrastructure for current level. */
const maxInfra = calculateMaxInfra(props.corp.level)

/** Resolve colony/planet name from a colony ID. */
function getColonyName(colonyId: ColonyId): string {
  const colony = colonyStore.getColony(colonyId)
  if (colony) return colony.name
  const planet = planetStore.getPlanet(colonyId as unknown as import('../../types/common').PlanetId)
  return planet?.name ?? colonyId
}

/** Get sorted domain entries for a colony's holdings. */
function getDomainEntries(holdings: Partial<Record<InfraDomain, number>>): { domain: string; levels: number }[] {
  return Object.entries(holdings)
    .filter(([, levels]) => levels > 0)
    .map(([domain, levels]) => ({
      domain: INFRA_DOMAIN_DEFINITIONS[domain as InfraDomain]?.name ?? domain,
      levels,
    }))
    .sort((a, b) => b.levels - a.levels)
}
</script>

<template>
  <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div class="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
      <h3 class="text-sm font-medium text-white">Infrastructure Assets</h3>
      <span class="text-xs text-zinc-400">{{ totalInfra }}/{{ maxInfra }} total</span>
    </div>

    <div v-if="corp.assets.infrastructureByColony.size > 0" class="divide-y divide-zinc-800/50">
      <div
        v-for="[colonyId, holdings] in corp.assets.infrastructureByColony"
        :key="colonyId"
        class="px-4 py-2"
      >
        <div class="text-xs font-medium text-zinc-300 mb-1">{{ getColonyName(colonyId) }}</div>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="entry in getDomainEntries(holdings)"
            :key="entry.domain"
            class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400"
          >
            {{ entry.domain }} {{ entry.levels }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="px-4 py-6 text-center">
      <p class="text-xs text-zinc-500">No infrastructure owned yet.</p>
      <p class="text-[10px] text-zinc-600 mt-1">Corporations acquire infrastructure through AI investment or contracts.</p>
    </div>
  </div>
</template>
