<script setup lang="ts">
/**
 * ResourceFlow — Shows production and consumption per resource for a colony.
 *
 * Uses calculateColonyResourceFlow() (engine/simulation/colony-sim.ts) to compute
 * real produced/consumed/surplus values based on infrastructure and deposits.
 * Surplus is shown in green, deficit in red. Each row has a tooltip with the breakdown.
 *
 * TODO (Story 9.1): imported and inShortage will be filled by market-phase.ts; show
 *   import badges and shortage alerts once available.
 */
import { computed } from 'vue'
import type { Colony } from '../../types/colony'
import type { Deposit } from '../../types/planet'
import { ResourceType } from '../../types/common'
import { calculateColonyResourceFlow } from '../../engine/simulation/colony-sim'

const props = defineProps<{
  colony: Colony
  deposits: Deposit[]
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
  produced: number
  consumed: number
  surplus: number
  /** Tooltip text showing the calculation breakdown. */
  tooltip: string
}

const resourceFlows = computed<ResourceFlowEntry[]>(() => {
  const summary = calculateColonyResourceFlow(props.colony, props.deposits)

  return Object.values(ResourceType)
    .map((resource) => {
      const flow = summary[resource]
      const surplusSign = flow.surplus >= 0 ? '+' : ''
      const tooltip =
        `Produced: ${flow.produced} | Consumed: ${flow.consumed} | Surplus: ${surplusSign}${flow.surplus}`

      return {
        resource,
        name: RESOURCE_NAMES[resource],
        produced: flow.produced,
        consumed: flow.consumed,
        surplus: flow.surplus,
        tooltip,
      }
    })
    .filter((e) => e.produced > 0 || e.consumed > 0)
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
        :title="flow.tooltip"
        class="px-4 py-2 cursor-default"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-zinc-300">{{ flow.name }}</span>
          <span
            class="text-xs font-medium"
            :class="{
              'text-emerald-400': flow.surplus > 0,
              'text-red-400': flow.surplus < 0,
              'text-zinc-500': flow.surplus === 0,
            }"
          >
            {{ flow.surplus > 0 ? '+' : '' }}{{ flow.surplus }}
          </span>
        </div>
        <div class="flex gap-4 mt-0.5 text-[10px] text-zinc-500">
          <span v-if="flow.produced > 0" class="text-emerald-600">+{{ flow.produced }} produced</span>
          <span v-if="flow.consumed > 0" class="text-red-700">−{{ flow.consumed }} consumed</span>
        </div>
      </div>

      <div v-if="resourceFlows.length === 0" class="px-4 py-6 text-center">
        <p class="text-xs text-zinc-500">No resource production or consumption yet.</p>
      </div>
    </div>
  </div>
</template>
