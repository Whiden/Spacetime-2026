<script setup lang="ts">
/**
 * ResourceFlow — Shows production and consumption per resource for a colony.
 *
 * Reads infrastructure levels and domain definitions to show what each domain
 * produces and consumes. Shows net total (produced - consumed) per resource.
 * Actual quantities are placeholder (level counts) until market phase formulas.
 *
 * TODO (Story 9.1): Show real production/consumption from market phase results.
 */
import { computed } from 'vue'
import type { Colony } from '../../types/colony'
import { InfraDomain, ResourceType } from '../../types/common'
import { getTotalLevels } from '../../types/infrastructure'
import { INFRA_DOMAIN_DEFINITIONS } from '../../data/infrastructure'

const props = defineProps<{
  colony: Colony
}>()

/** Resource display names. */
const RESOURCE_NAMES: Record<ResourceType, string> = {
  [ResourceType.Food]: 'Food',
  [ResourceType.CommonMaterials]: 'Common Materials',
  [ResourceType.RareMaterials]: 'Rare Materials',
  [ResourceType.Volatiles]: 'Volatiles',
  [ResourceType.ConsumerGoods]: 'Consumer Goods',
  [ResourceType.HeavyMachinery]: 'Heavy Machinery',
  [ResourceType.HighTechGoods]: 'High-Tech Goods',
  [ResourceType.ShipParts]: 'Ship Parts',
  [ResourceType.TransportCapacity]: 'Transport Capacity',
}

interface ResourceFlowEntry {
  resource: ResourceType
  name: string
  producers: { domain: string; levels: number }[]
  consumers: { domain: string; levels: number }[]
  totalProduced: number
  totalConsumed: number
  net: number
}

/** Build resource flow entries from colony infrastructure. */
const resourceFlows = computed<ResourceFlowEntry[]>(() => {
  const flowMap = new Map<ResourceType, ResourceFlowEntry>()

  // Initialize all resource entries
  for (const resourceType of Object.values(ResourceType)) {
    flowMap.set(resourceType, {
      resource: resourceType,
      name: RESOURCE_NAMES[resourceType],
      producers: [],
      consumers: [],
      totalProduced: 0,
      totalConsumed: 0,
      net: 0,
    })
  }

  // Iterate over all infrastructure domains
  for (const domain of Object.values(InfraDomain)) {
    const state = props.colony.infrastructure[domain]
    const def = INFRA_DOMAIN_DEFINITIONS[domain]
    const levels = getTotalLevels(state)
    if (levels === 0) continue

    // Production
    if (def.produces) {
      const entry = flowMap.get(def.produces)!
      entry.producers.push({ domain: def.name, levels })
      entry.totalProduced += levels
    }

    // Consumption
    for (const consumed of def.consumes) {
      const entry = flowMap.get(consumed)!
      entry.consumers.push({ domain: def.name, levels })
      entry.totalConsumed += levels
    }
  }

  // Calculate net for each resource
  for (const entry of flowMap.values()) {
    entry.net = entry.totalProduced - entry.totalConsumed
  }

  // Only return resources that have at least one producer or consumer
  return [...flowMap.values()].filter(
    (e) => e.producers.length > 0 || e.consumers.length > 0,
  )
})
</script>

<template>
  <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div class="px-4 py-3 border-b border-zinc-800">
      <h3 class="text-sm font-medium text-white">Resource Flow</h3>
    </div>
    <div class="divide-y divide-zinc-800/50">
      <div
        v-for="flow in resourceFlows"
        :key="flow.resource"
        class="px-4 py-2"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-zinc-300">{{ flow.name }}</span>
          <span
            class="text-xs font-medium"
            :class="{
              'text-emerald-400': flow.net > 0,
              'text-red-400': flow.net < 0,
              'text-zinc-500': flow.net === 0,
            }"
          >
            {{ flow.net > 0 ? '+' : '' }}{{ flow.net }}
          </span>
        </div>
        <div class="flex gap-6 text-[10px]">
          <!-- Producers -->
          <div v-if="flow.producers.length > 0" class="flex items-center gap-1">
            <span class="text-emerald-500">+{{ flow.totalProduced }}</span>
            <span class="text-zinc-500">
              (<span
                v-for="(p, i) in flow.producers"
                :key="p.domain"
              >{{ p.domain }} {{ p.levels }}<span v-if="i < flow.producers.length - 1">, </span></span>)
            </span>
          </div>
          <!-- Consumers -->
          <div v-if="flow.consumers.length > 0" class="flex items-center gap-1">
            <span class="text-red-500">-{{ flow.totalConsumed }}</span>
            <span class="text-zinc-500">
              (<span
                v-for="(c, i) in flow.consumers"
                :key="c.domain"
              >{{ c.domain }} {{ c.levels }}<span v-if="i < flow.consumers.length - 1">, </span></span>)
            </span>
          </div>
        </div>
      </div>

      <div v-if="resourceFlows.length === 0" class="px-4 py-6 text-center">
        <p class="text-xs text-zinc-500">No resource production or consumption yet.</p>
      </div>
    </div>
  </div>
</template>
