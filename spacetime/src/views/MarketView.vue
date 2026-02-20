<script setup lang="ts">
/**
 * MarketView — Sector market dashboard.
 *
 * Story 9.4 — Market View (Epic 9: Sector Market & Trade).
 * Story 17.3 — Trade Route UI: cross-sector import/export flows shown per sector.
 *
 * Data flow:
 * - Galaxy store → all sectors (tab list, sector names for trade flow labels)
 * - Colony store → colonies per sector
 * - Market store → per-sector totals, per-colony flows/shortages/export bonuses
 *   inboundFlows / outboundFlows on SectorMarketState (populated by Story 17.2)
 */
import { ref, computed } from 'vue'
import { useGalaxyStore } from '../stores/galaxy.store'
import { useColonyStore } from '../stores/colony.store'
import { useMarketStore } from '../stores/market.store'
import { ResourceType } from '../types/common'
import type { SectorId, ColonyId } from '../types/common'
import type { Colony } from '../types/colony'
import type { TradeFlow } from '../types/trade'
import ResourceRow from '../components/market/ResourceRow.vue'
import MarketSummary from '../components/market/MarketSummary.vue'

const galaxyStore = useGalaxyStore()
const colonyStore = useColonyStore()
const marketStore = useMarketStore()

// ─── Sector Selection ────────────────────────────────────────────────────────

/**
 * Sectors that have at least one colony (those are the only sectors with market data).
 * Sorted alphabetically by name.
 */
const sectorsWithActivity = computed(() =>
  galaxyStore.allSectors.filter(
    (sector) => colonyStore.getColoniesBySector(sector.id as SectorId).length > 0,
  ),
)

/** Currently selected sector ID. Defaults to the first sector with colonies. */
const selectedSectorId = ref<SectorId | null>(null)

// Auto-select the first sector with activity when the view mounts.
const effectiveSelectedSectorId = computed<SectorId | null>(() => {
  if (selectedSectorId.value !== null) return selectedSectorId.value
  return sectorsWithActivity.value[0]?.id as SectorId ?? null
})

function selectSector(sectorId: SectorId) {
  selectedSectorId.value = sectorId
}

// ─── Selected Sector Data ────────────────────────────────────────────────────

/** The currently selected sector object. */
const selectedSector = computed(() => {
  if (!effectiveSelectedSectorId.value) return null
  return galaxyStore.getSector(effectiveSelectedSectorId.value) ?? null
})

/** Colonies in the selected sector. */
const sectorColonies = computed<Colony[]>(() => {
  if (!effectiveSelectedSectorId.value) return []
  return colonyStore.getColoniesBySector(effectiveSelectedSectorId.value)
})

/** Market state for the selected sector (from last turn resolution). */
const sectorMarket = computed(() => {
  if (!effectiveSelectedSectorId.value) return null
  return marketStore.getSectorMarket(effectiveSelectedSectorId.value) ?? null
})

// ─── Resource Table Data ─────────────────────────────────────────────────────

/** All resource types in display order. */
const ALL_RESOURCES: ResourceType[] = [
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

/**
 * Row data for the resource table: only include resources that have
 * non-zero production or consumption in the selected sector.
 */
const resourceRows = computed(() => {
  if (!sectorMarket.value) return []

  return ALL_RESOURCES
    .map((resource) => {
      const production = sectorMarket.value!.totalProduction[resource] ?? 0
      const consumption = sectorMarket.value!.totalConsumption[resource] ?? 0
      const netSurplus = sectorMarket.value!.netSurplus[resource] ?? 0

      // Check whether any colony in this sector has a shortage for this resource.
      const inShortage = sectorColonies.value.some((colony) =>
        marketStore.colonyHasResourceShortage(colony.id as ColonyId, resource),
      )

      return { resource, production, consumption, netSurplus, inShortage }
    })
    .filter((row) => row.production > 0 || row.consumption > 0)
})

/** Whether the selected sector has any shortages at all. */
const sectorHasShortages = computed<boolean>(() =>
  sectorColonies.value.some((colony) =>
    marketStore.colonyHasShortage(colony.id as ColonyId),
  ),
)

/** Count of active shortages (resource × colony combinations). */
const totalShortageCount = computed<number>(() => {
  let count = 0
  for (const colony of sectorColonies.value) {
    count += marketStore.getColonyShortages(colony.id as ColonyId).length
  }
  return count
})

// ─── Colony Flow Maps (for MarketSummary) ────────────────────────────────────

/** colonyFlows Map sliced to the colonies in the current sector. */
const sectorColonyFlows = computed(() => {
  const result = new Map<ColonyId, import('../types/resource').ColonyResourceSummary>()
  for (const colony of sectorColonies.value) {
    const flows = marketStore.getColonyFlows(colony.id as ColonyId)
    if (flows) result.set(colony.id as ColonyId, flows)
  }
  return result
})

/** colonyShortages Map sliced to the colonies in the current sector. */
const sectorColonyShortages = computed(() => {
  const result = new Map<ColonyId, import('../types/resource').Shortage[]>()
  for (const colony of sectorColonies.value) {
    const shortages = marketStore.getColonyShortages(colony.id as ColonyId)
    if (shortages.length > 0) result.set(colony.id as ColonyId, shortages)
  }
  return result
})

/** colonyExportBonuses Map sliced to the colonies in the current sector. */
const sectorColonyExportBonuses = computed(() => {
  const result = new Map<ColonyId, import('../types/resource').ExportBonus[]>()
  for (const colony of sectorColonies.value) {
    const bonuses = marketStore.getColonyExportBonuses(colony.id as ColonyId)
    if (bonuses.length > 0) result.set(colony.id as ColonyId, bonuses)
  }
  return result
})

/** Whether the market has been resolved at least once (store has data). */
const hasMarketData = computed<boolean>(() => sectorMarket.value !== null)

// ─── Trade Flow Data ──────────────────────────────────────────────────────────

/** Inbound trade flows for the selected sector (imports from other sectors). */
const inboundFlows = computed<TradeFlow[]>(() => sectorMarket.value?.inboundFlows ?? [])

/** Outbound trade flows for the selected sector (exports to other sectors). */
const outboundFlows = computed<TradeFlow[]>(() => sectorMarket.value?.outboundFlows ?? [])

/** Whether the selected sector has any cross-sector trade flows. */
const hasCrossSectorTrade = computed<boolean>(
  () => inboundFlows.value.length > 0 || outboundFlows.value.length > 0,
)

/** Resolves a sector ID to its display name. */
function sectorDisplayName(sectorId: SectorId): string {
  return galaxyStore.getSector(sectorId)?.name ?? sectorId
}

/** Groups trade flows by the partner sector ID for compact display. */
function groupFlowsByPartner(flows: TradeFlow[], localSectorId: SectorId): Map<SectorId, TradeFlow[]> {
  const map = new Map<SectorId, TradeFlow[]>()
  for (const flow of flows) {
    const partnerId = flow.fromSectorId === localSectorId ? flow.toSectorId : flow.fromSectorId
    if (!map.has(partnerId)) map.set(partnerId, [])
    map.get(partnerId)!.push(flow)
  }
  return map
}

const inboundByPartner = computed(() =>
  groupFlowsByPartner(inboundFlows.value, effectiveSelectedSectorId.value ?? '' as SectorId),
)
const outboundByPartner = computed(() =>
  groupFlowsByPartner(outboundFlows.value, effectiveSelectedSectorId.value ?? '' as SectorId),
)
</script>

<template>
  <div>
    <!-- Page header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-white">Market</h1>
      <span v-if="sectorHasShortages" class="flex items-center gap-1.5 text-sm text-red-400">
        <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        {{ totalShortageCount }} {{ totalShortageCount === 1 ? 'shortage' : 'shortages' }} active
      </span>
    </div>

    <!-- No colonies state -->
    <div
      v-if="sectorsWithActivity.length === 0"
      class="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 px-8"
    >
      <p class="text-zinc-400 text-sm">No market activity yet.</p>
      <p class="text-zinc-500 text-xs mt-2">
        Resource production, consumption, and trade flows appear once colonies are established.
        Colonize a planet to begin.
      </p>
    </div>

    <template v-else>
      <!-- Sector Selector Tabs -->
      <div class="flex gap-1 mb-6 border-b border-zinc-800">
        <button
          v-for="sector in sectorsWithActivity"
          :key="sector.id"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors"
          :class="
            effectiveSelectedSectorId === sector.id
              ? 'bg-zinc-800 text-white border-b-2 border-indigo-500'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          "
          @click="selectSector(sector.id as SectorId)"
        >
          {{ sector.name }}
          <!-- Shortage warning on tab -->
          <span
            v-if="
              colonyStore.getColoniesBySector(sector.id as SectorId).some(
                (c) => marketStore.colonyHasShortage(c.id as ColonyId),
              )
            "
            class="ml-1.5 w-1.5 h-1.5 rounded-full bg-red-500 inline-block"
          />
        </button>
      </div>

      <!-- No market data yet (before first turn resolution) -->
      <div v-if="!hasMarketData" class="space-y-6">
        <!-- Show colonies in sector but note that market hasn't resolved -->
        <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <p class="text-sm text-zinc-400">
            Market data for <span class="text-white font-medium">{{ selectedSector?.name }}</span>
            will appear after the first turn resolves.
          </p>
          <p class="text-xs text-zinc-500 mt-1">
            {{ sectorColonies.length }} {{ sectorColonies.length === 1 ? 'colony' : 'colonies' }}
            in this sector.
          </p>
        </div>
      </div>

      <!-- Market data available -->
      <div v-else class="space-y-6">
        <!-- Shortage alert banner -->
        <div
          v-if="sectorHasShortages"
          class="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 flex items-start gap-3"
        >
          <span class="text-red-400 text-lg leading-none mt-0.5">⚠</span>
          <div>
            <p class="text-sm font-medium text-red-300">Shortages detected in {{ selectedSector?.name }}</p>
            <p class="text-xs text-red-400/80 mt-0.5">
              {{ totalShortageCount }} resource shortage{{ totalShortageCount === 1 ? '' : 's' }} are
              causing attribute penalties. Expand production or build trade routes to resolve them.
            </p>
          </div>
        </div>

        <!-- Resource Summary Table -->
        <div class="rounded-lg border border-zinc-800 bg-zinc-900/50">
          <div class="px-5 py-4 border-b border-zinc-800">
            <h2 class="text-sm font-semibold text-white">
              {{ selectedSector?.name }} — Resource Overview
            </h2>
            <p class="text-xs text-zinc-500 mt-0.5">
              Aggregate production, consumption, and net balance across all colonies this turn.
            </p>
          </div>

          <div class="px-5">
            <table class="w-full">
              <thead>
                <tr class="border-b border-zinc-800">
                  <th class="py-2.5 pr-4 text-left text-xs font-medium text-zinc-400">Resource</th>
                  <th class="py-2.5 px-4 text-right text-xs font-medium text-zinc-400">Produced</th>
                  <th class="py-2.5 px-4 text-right text-xs font-medium text-zinc-400">Consumed</th>
                  <th class="py-2.5 pl-4 text-right text-xs font-medium text-zinc-400">Net</th>
                </tr>
              </thead>
              <tbody>
                <ResourceRow
                  v-for="row in resourceRows"
                  :key="row.resource"
                  :resource="row.resource"
                  :production="row.production"
                  :consumption="row.consumption"
                  :net-surplus="row.netSurplus"
                  :in-shortage="row.inShortage"
                />
              </tbody>
            </table>

            <!-- Empty resource table -->
            <p v-if="resourceRows.length === 0" class="py-6 text-sm text-zinc-500 text-center">
              No resource activity in {{ selectedSector?.name }} yet. Build infrastructure on your colonies.
            </p>
          </div>
        </div>

        <!-- Per-Colony Breakdown -->
        <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <MarketSummary
            :colonies="sectorColonies"
            :colony-flows="sectorColonyFlows"
            :colony-export-bonuses="sectorColonyExportBonuses"
            :colony-shortages="sectorColonyShortages"
          />
        </div>

        <!-- Cross-Sector Trade Flows -->
        <div v-if="hasCrossSectorTrade" class="rounded-lg border border-amber-800/40 bg-amber-950/20">
          <div class="px-5 py-4 border-b border-amber-800/30">
            <h2 class="text-sm font-semibold text-amber-300">Cross-Sector Trade</h2>
            <p class="text-xs text-amber-400/70 mt-0.5">
              Resource flows via active trade routes (50% efficiency applied).
            </p>
          </div>
          <div class="px-5 py-4 space-y-4">
            <!-- Imports (inbound) -->
            <div v-if="inboundFlows.length > 0">
              <p class="text-xs font-medium text-zinc-400 mb-2">Imports</p>
              <div
                v-for="[partnerId, flows] in inboundByPartner"
                :key="partnerId"
                class="mb-3"
              >
                <p class="text-[10px] text-amber-400/80 mb-1">
                  ← from {{ sectorDisplayName(partnerId as SectorId) }}
                </p>
                <div class="space-y-1">
                  <div
                    v-for="flow in flows"
                    :key="flow.resource"
                    class="flex items-center justify-between text-xs"
                  >
                    <span class="text-zinc-400">{{ flow.resource }}</span>
                    <div class="flex items-center gap-3 text-[10px]">
                      <span class="text-zinc-600">surplus {{ flow.surplusAvailable }}</span>
                      <span class="text-amber-400">→ {{ flow.received }} received</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Exports (outbound) -->
            <div v-if="outboundFlows.length > 0">
              <p class="text-xs font-medium text-zinc-400 mb-2">Exports</p>
              <div
                v-for="[partnerId, flows] in outboundByPartner"
                :key="partnerId"
                class="mb-3"
              >
                <p class="text-[10px] text-amber-400/80 mb-1">
                  → to {{ sectorDisplayName(partnerId as SectorId) }}
                </p>
                <div class="space-y-1">
                  <div
                    v-for="flow in flows"
                    :key="flow.resource"
                    class="flex items-center justify-between text-xs"
                  >
                    <span class="text-zinc-400">{{ flow.resource }}</span>
                    <div class="flex items-center gap-3 text-[10px]">
                      <span class="text-zinc-600">surplus {{ flow.surplusAvailable }}</span>
                      <span class="text-amber-400">{{ flow.transferred }} transferred</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap items-center gap-6 text-xs text-zinc-500 px-1">
          <span class="flex items-center gap-1.5">
            <span class="text-emerald-400 font-medium">+N</span> Produced
          </span>
          <span class="flex items-center gap-1.5">
            <span class="text-zinc-400">−N</span> Consumed
          </span>
          <span class="flex items-center gap-1.5">
            <span class="text-sky-400">↓N</span> Imported from sector market
          </span>
          <span class="flex items-center gap-1.5">
            <span class="text-emerald-400">↑ export</span> Export bonus (+1 Dynamism)
          </span>
          <span class="flex items-center gap-1.5">
            <span class="text-red-400">⚠ shortage</span> Shortage — attribute penalty active
          </span>
          <span class="flex items-center gap-1.5">
            <span class="text-amber-400">↔</span> Cross-sector trade (50% efficiency)
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
