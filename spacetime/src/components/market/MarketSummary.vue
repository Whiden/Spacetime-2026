<script setup lang="ts">
/**
 * MarketSummary — Per-colony resource flow breakdown for one sector.
 *
 * Shows a table with one row per colony and columns per resource:
 *   - Produced locally
 *   - Consumed locally
 *   - Imported from sector market
 *   - Shortage indicator if applicable
 *   - Export bonus indicator if applicable
 *
 * This is the "planet-by-planet breakdown" required by Story 9.4.
 *
 * Story 9.4 — Market View.
 *
 * TODO (Story 17.3): Add cross-sector import/export columns when trade routes active.
 */
import { computed } from 'vue'
import { ResourceType } from '../../types/common'
import type { ColonyId } from '../../types/common'
import type { Colony } from '../../types/colony'
import type { ColonyResourceSummary, ExportBonus } from '../../types/resource'

/** Tradeable resources shown in the per-colony breakdown (TC is local-only). */
const DISPLAYED_RESOURCES: ResourceType[] = [
  ResourceType.Food,
  ResourceType.CommonMaterials,
  ResourceType.RareMaterials,
  ResourceType.Volatiles,
  ResourceType.ConsumerGoods,
  ResourceType.HeavyMachinery,
  ResourceType.HighTechGoods,
  ResourceType.ShipParts,
  ResourceType.TransportCapacity,
]

const RESOURCE_LABELS: Record<ResourceType, string> = {
  [ResourceType.Food]: 'Food',
  [ResourceType.CommonMaterials]: 'Common Mat.',
  [ResourceType.RareMaterials]: 'Rare Mat.',
  [ResourceType.Volatiles]: 'Volatiles',
  [ResourceType.ConsumerGoods]: 'Consumer Goods',
  [ResourceType.HeavyMachinery]: 'Heavy Mach.',
  [ResourceType.HighTechGoods]: 'High-Tech',
  [ResourceType.ShipParts]: 'Ship Parts',
  [ResourceType.TransportCapacity]: 'Transport',
}

const props = defineProps<{
  /** Colonies in this sector, in display order. */
  colonies: Colony[]
  /**
   * Resource flow snapshot per colony from the last market resolution.
   * Keys are ColonyId strings.
   */
  colonyFlows: Map<ColonyId, ColonyResourceSummary>
  /**
   * Export bonuses per colony from the last market resolution.
   * Keys are ColonyId strings.
   */
  colonyExportBonuses: Map<ColonyId, ExportBonus[]>
  /**
   * Shortage flags per colony from the last market resolution.
   * Keys are ColonyId strings.
   */
  colonyShortages: Map<ColonyId, import('../../types/resource').Shortage[]>
}>()

/** Only show resource columns where at least one colony has activity. */
const activeResources = computed<ResourceType[]>(() => {
  return DISPLAYED_RESOURCES.filter((resource) => {
    return props.colonies.some((colony) => {
      const flows = props.colonyFlows.get(colony.id as ColonyId)
      if (!flows) return false
      const flow = flows[resource]
      return flow.produced > 0 || flow.consumed > 0 || flow.imported > 0
    })
  })
})

/** Colonies sorted by dynamism descending (mirrors market resolution priority). */
const sortedColonies = computed<Colony[]>(() =>
  [...props.colonies].sort((a, b) => b.attributes.dynamism - a.attributes.dynamism),
)

/** Returns the flow for a colony+resource pair, or a zero-filled default. */
function getFlow(colonyId: ColonyId, resource: ResourceType) {
  const flows = props.colonyFlows.get(colonyId)
  if (!flows) return { produced: 0, consumed: 0, surplus: 0, imported: 0, inShortage: false }
  return flows[resource]
}

/** Whether a colony has a shortage for a specific resource. */
function hasShortage(colonyId: ColonyId, resource: ResourceType): boolean {
  const shortages = props.colonyShortages.get(colonyId) ?? []
  return shortages.some((s) => s.resource === resource)
}

/** Whether a colony exported a specific resource. */
function hasExportBonus(colonyId: ColonyId, resource: ResourceType): boolean {
  const bonuses = props.colonyExportBonuses.get(colonyId) ?? []
  return bonuses.some((b) => b.resource === resource)
}

/** Color class for a cell value based on flow context. */
function cellColorClass(produced: number, consumed: number, inShortage: boolean): string {
  if (inShortage) return 'text-red-400'
  if (produced > 0 && consumed === 0) return 'text-emerald-400' // pure export
  if (produced === 0 && consumed > 0) return 'text-zinc-400'    // pure consumer
  return 'text-zinc-300'
}
</script>

<template>
  <div>
    <h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
      Colony Breakdown
    </h3>

    <div v-if="colonies.length === 0" class="text-sm text-zinc-500 italic">
      No colonies in this sector.
    </div>

    <div v-else-if="activeResources.length === 0" class="text-sm text-zinc-500 italic">
      No resource activity yet. Build infrastructure to start producing.
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-zinc-700">
            <!-- Colony name column -->
            <th class="pb-2 pr-4 text-zinc-400 font-medium whitespace-nowrap">Colony</th>
            <!-- Resource columns -->
            <th
              v-for="resource in activeResources"
              :key="resource"
              class="pb-2 px-3 text-zinc-400 font-medium text-right whitespace-nowrap"
            >
              {{ RESOURCE_LABELS[resource] }}
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="colony in sortedColonies"
            :key="colony.id"
            class="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/20 transition-colors"
          >
            <!-- Colony name + dynamism indicator -->
            <td class="py-2 pr-4 whitespace-nowrap">
              <div class="flex items-center gap-2">
                <!-- Shortage warning dot -->
                <span
                  v-if="(colonyShortages.get(colony.id as ColonyId) ?? []).length > 0"
                  class="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500"
                  title="Colony has shortages"
                />
                <span v-else class="shrink-0 w-1.5 h-1.5 rounded-full bg-zinc-700" />

                <span class="text-zinc-200 font-medium">{{ colony.name }}</span>
                <span class="text-zinc-500 text-[10px]">Dyn {{ colony.attributes.dynamism }}</span>
              </div>
            </td>

            <!-- Resource cells -->
            <td
              v-for="resource in activeResources"
              :key="resource"
              class="py-2 px-3 text-right tabular-nums"
            >
              <div
                v-if="getFlow(colony.id as ColonyId, resource).produced > 0 || getFlow(colony.id as ColonyId, resource).consumed > 0 || getFlow(colony.id as ColonyId, resource).imported > 0"
                class="flex flex-col items-end gap-0.5"
              >
                <!-- Produced -->
                <span
                  v-if="getFlow(colony.id as ColonyId, resource).produced > 0"
                  :class="cellColorClass(
                    getFlow(colony.id as ColonyId, resource).produced,
                    getFlow(colony.id as ColonyId, resource).consumed,
                    false,
                  )"
                  :title="`Produced: ${getFlow(colony.id as ColonyId, resource).produced}`"
                >
                  +{{ getFlow(colony.id as ColonyId, resource).produced }}
                </span>

                <!-- Consumed (shown as negative) -->
                <span
                  v-if="getFlow(colony.id as ColonyId, resource).consumed > 0"
                  class="text-zinc-400"
                  :title="`Consumed: ${getFlow(colony.id as ColonyId, resource).consumed}`"
                >
                  −{{ getFlow(colony.id as ColonyId, resource).consumed }}
                </span>

                <!-- Imported from market -->
                <span
                  v-if="getFlow(colony.id as ColonyId, resource).imported > 0"
                  class="text-sky-400"
                  :title="`Imported from sector market: ${getFlow(colony.id as ColonyId, resource).imported}`"
                >
                  ↓{{ getFlow(colony.id as ColonyId, resource).imported }}
                </span>

                <!-- Shortage indicator -->
                <span
                  v-if="hasShortage(colony.id as ColonyId, resource)"
                  class="text-[10px] text-red-400 font-semibold"
                  title="Shortage — colony attribute penalties applied"
                >
                  ⚠ shortage
                </span>

                <!-- Export bonus indicator -->
                <span
                  v-if="hasExportBonus(colony.id as ColonyId, resource)"
                  class="text-[10px] text-emerald-400"
                  title="Export bonus: +1 Dynamism from exporting this resource"
                >
                  ↑ export
                </span>
              </div>

              <!-- No activity for this resource in this colony -->
              <span v-else class="text-zinc-700">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
