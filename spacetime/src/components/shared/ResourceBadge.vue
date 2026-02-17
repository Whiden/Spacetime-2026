<script setup lang="ts">
import { computed } from 'vue'
import { ResourceType } from '@/types/common'
import { RESOURCES } from '@/data/resources'

/**
 * ResourceBadge — Compact resource display with symbol and formatted amount.
 */
const props = defineProps<{
  /** The resource type to display. */
  resourceType: ResourceType
  /** Amount to show (can be positive or negative). */
  amount: number
}>()

/** Short symbol per resource type for compact display. */
const RESOURCE_SYMBOLS: Record<ResourceType, string> = {
  [ResourceType.Food]: 'F',
  [ResourceType.CommonMaterials]: 'CM',
  [ResourceType.RareMaterials]: 'RM',
  [ResourceType.Volatiles]: 'V',
  [ResourceType.ConsumerGoods]: 'CG',
  [ResourceType.HeavyMachinery]: 'HM',
  [ResourceType.HighTechGoods]: 'HT',
  [ResourceType.ShipParts]: 'SP',
  [ResourceType.TransportCapacity]: 'TC',
}

const symbol = computed(() => RESOURCE_SYMBOLS[props.resourceType])
const name = computed(() => RESOURCES[props.resourceType]?.name ?? props.resourceType)
const formattedAmount = computed(() => {
  if (props.amount > 0) return `+${props.amount}`
  return String(props.amount)
})

const amountColorClass = computed(() => {
  if (props.amount > 0) return 'text-emerald-400'
  if (props.amount < 0) return 'text-red-400'
  return 'text-zinc-400'
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2 py-0.5 text-xs"
    :title="name"
  >
    <span class="font-medium text-zinc-300">{{ symbol }}</span>
    <span class="font-medium" :class="amountColorClass">{{ formattedAmount }}</span>
  </span>
</template>
