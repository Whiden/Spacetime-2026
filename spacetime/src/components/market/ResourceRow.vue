<script setup lang="ts">
/**
 * ResourceRow — One row in the sector market resource table.
 *
 * Displays a single resource's aggregate data for a sector:
 *   - Resource name
 *   - Total production (across all colonies in the sector)
 *   - Total consumption
 *   - Net surplus (positive = export available, negative = deficit / shortage)
 *
 * Color coding follows the surplus/deficit status:
 *   - Surplus (positive): emerald
 *   - Balanced (0): zinc
 *   - Deficit (negative): red + shortage warning indicator
 *
 * Story 9.4 — Market View.
 */
import { computed } from 'vue'
import { ResourceType } from '../../types/common'

const props = defineProps<{
  /** Resource type for this row. */
  resource: ResourceType
  /** Total units produced in this sector this turn. */
  production: number
  /** Total units consumed in this sector this turn. */
  consumption: number
  /** Net surplus: production − consumption. Positive = exportable, negative = deficit. */
  netSurplus: number
  /** Whether any colony in this sector is in shortage for this resource. */
  inShortage: boolean
}>()

/** Human-readable display name for the resource. */
const resourceLabel = computed<string>(() => {
  const labels: Record<ResourceType, string> = {
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
  return labels[props.resource] ?? props.resource
})

/** Short category label shown as a badge. */
const resourceCategory = computed<string>(() => {
  const extracted = [
    ResourceType.Food,
    ResourceType.CommonMaterials,
    ResourceType.RareMaterials,
    ResourceType.Volatiles,
  ]
  const service = [ResourceType.TransportCapacity]
  if (extracted.includes(props.resource)) return 'Extracted'
  if (service.includes(props.resource)) return 'Service'
  return 'Manufactured'
})

const categoryClass = computed<string>(() => {
  switch (resourceCategory.value) {
    case 'Extracted': return 'bg-amber-500/15 text-amber-400'
    case 'Service': return 'bg-sky-500/15 text-sky-400'
    default: return 'bg-violet-500/15 text-violet-400'
  }
})

/** Color class applied to the net surplus value cell. */
const surplusColorClass = computed<string>(() => {
  if (props.netSurplus > 0) return 'text-emerald-400'
  if (props.netSurplus < 0) return 'text-red-400'
  return 'text-zinc-400'
})

/** Formatted surplus string with a leading sign. */
const surplusLabel = computed<string>(() => {
  if (props.netSurplus > 0) return `+${props.netSurplus}`
  return String(props.netSurplus)
})

/** Whether this row has any activity (non-zero production or consumption). */
const hasActivity = computed<boolean>(() => props.production > 0 || props.consumption > 0)
</script>

<template>
  <!-- Skip rows with zero activity to keep the table readable -->
  <tr
    v-if="hasActivity"
    class="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors"
  >
    <!-- Resource name + category badge -->
    <td class="py-2.5 pr-4">
      <div class="flex items-center gap-2">
        <!-- Shortage warning indicator -->
        <span
          v-if="inShortage"
          class="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500"
          title="Shortage active"
        />
        <span v-else class="shrink-0 w-1.5 h-1.5" />

        <span class="text-sm text-white">{{ resourceLabel }}</span>
        <span
          class="text-[10px] font-medium px-1.5 py-0.5 rounded"
          :class="categoryClass"
        >
          {{ resourceCategory }}
        </span>

        <!-- Shortage badge -->
        <span
          v-if="inShortage"
          class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400"
        >
          SHORTAGE
        </span>
      </div>
    </td>

    <!-- Production -->
    <td class="py-2.5 px-4 text-sm text-right tabular-nums text-zinc-300">
      {{ production > 0 ? production : '—' }}
    </td>

    <!-- Consumption -->
    <td class="py-2.5 px-4 text-sm text-right tabular-nums text-zinc-300">
      {{ consumption > 0 ? consumption : '—' }}
    </td>

    <!-- Net surplus / deficit -->
    <td class="py-2.5 pl-4 text-sm text-right tabular-nums font-medium" :class="surplusColorClass">
      {{ surplusLabel }}
    </td>
  </tr>
</template>
