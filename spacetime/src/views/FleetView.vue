<script setup lang="ts">
/**
 * FleetView — Fleet roster, active missions, and ship commission status.
 *
 * Story 15.4: Shows commissioned ships grouped by sector, ship commission
 * contracts in progress, and an empty state with guidance when no ships exist.
 *
 * Story 16.5: Added active missions section with MissionCard components,
 * and "Send Mission" button opening the MissionWizard.
 */
import { computed, ref } from 'vue'
import { useFleetStore } from '../stores/fleet.store'
import { useGalaxyStore } from '../stores/galaxy.store'
import { useCorporationStore } from '../stores/corporation.store'
import { useContractStore } from '../stores/contract.store'
import { useMissionStore } from '../stores/mission.store'
import { ContractType } from '../types/common'
import ShipCard from '../components/fleet/ShipCard.vue'
import MissionCard from '../components/fleet/MissionCard.vue'
import MissionWizard from '../components/fleet/MissionWizard.vue'
import ContractWizard from '../components/contract/ContractWizard.vue'
import ContractCard from '../components/contract/ContractCard.vue'

const fleetStore   = useFleetStore()
const galaxyStore  = useGalaxyStore()
const corpStore    = useCorporationStore()
const contractStore = useContractStore()
const missionStore = useMissionStore()

const showWizard        = ref(false)
const showMissionWizard = ref(false)

// ─── Data ─────────────────────────────────────────────────────────────────────

const allShips = computed(() => fleetStore.allShips)

const activeCommissions = computed(() =>
  contractStore.activeContracts.filter((c) => c.type === ContractType.ShipCommission),
)

const activeMissions = computed(() => missionStore.activeMissions)
const completedMissions = computed(() => missionStore.completedMissions)

/** Ships grouped by sectorId for display. */
const shipsBySector = computed(() => {
  const grouped = new Map<string, typeof allShips.value>()
  for (const ship of allShips.value) {
    const sectorId = ship.homeSectorId
    if (!grouped.has(sectorId)) grouped.set(sectorId, [])
    grouped.get(sectorId)!.push(ship)
  }
  return grouped
})

/** Ship name lookup map for MissionCard. */
const shipNameMap = computed<Map<string, string>>(() => {
  const m = new Map<string, string>()
  for (const ship of allShips.value) m.set(ship.id, ship.name)
  return m
})

function sectorName(sectorId: string): string {
  return galaxyStore.sectors.get(sectorId as any)?.name ?? sectorId
}

function corpName(corpId: string): string | undefined {
  if (!corpId) return undefined
  return corpStore.getCorp(corpId as any)?.name
}

const hasShips        = computed(() => allShips.value.length > 0)
const hasActivity     = computed(
  () => hasShips.value || activeCommissions.value.length > 0 || activeMissions.value.length > 0,
)
const hasMissions     = computed(
  () => activeMissions.value.length > 0 || completedMissions.value.length > 0,
)
const hasAvailableShips = computed(() =>
  fleetStore.availableShips.some((s) => s.ownerCorpId === 'government'),
)
</script>

<template>
  <div>
    <!-- ── Page header ── -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-white">Fleet</h1>
      <div class="flex items-center gap-2">
        <button
          v-if="hasAvailableShips"
          class="px-4 py-2 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-600 text-white transition-colors"
          @click="showMissionWizard = true"
        >
          + Send Mission
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          @click="showWizard = true"
        >
          + Commission Ship
        </button>
      </div>
    </div>

    <!-- ── Summary bar ── -->
    <div
      v-if="hasActivity"
      class="flex items-center gap-6 mb-4 px-4 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-zinc-500">Ships</span>
        <span class="text-sm font-semibold text-white">{{ fleetStore.shipCount }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-zinc-500">Available</span>
        <span class="text-sm font-medium text-emerald-400">{{ fleetStore.availableShips.length }}</span>
      </div>
      <div v-if="activeMissions.length > 0" class="flex items-center gap-1.5">
        <span class="text-xs text-zinc-500">On mission</span>
        <span class="text-sm font-medium text-amber-400">{{ activeMissions.length }}</span>
      </div>
      <div v-if="activeCommissions.length > 0" class="flex items-center gap-1.5">
        <span class="text-xs text-zinc-500">Under construction</span>
        <span class="text-sm font-medium text-amber-400">{{ activeCommissions.length }}</span>
      </div>
    </div>

    <!-- ── Active missions ── -->
    <template v-if="activeMissions.length > 0">
      <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        Active Missions ({{ activeMissions.length }})
      </p>
      <div class="space-y-2 mb-6">
        <MissionCard
          v-for="mission in activeMissions"
          :key="mission.id"
          :mission="mission"
          :ship-names="shipNameMap"
          :target-sector-name="sectorName(mission.targetSectorId)"
        />
      </div>
    </template>

    <!-- ── Completed missions ── -->
    <template v-if="completedMissions.length > 0">
      <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        Completed Missions ({{ completedMissions.length }})
      </p>
      <div class="space-y-2 mb-6">
        <MissionCard
          v-for="mission in completedMissions"
          :key="mission.id"
          :mission="mission"
          :ship-names="shipNameMap"
          :target-sector-name="sectorName(mission.targetSectorId)"
        />
      </div>
    </template>

    <!-- ── Ships in construction ── -->
    <template v-if="activeCommissions.length > 0">
      <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        Under Construction ({{ activeCommissions.length }})
      </p>
      <div class="space-y-2 mb-6">
        <ContractCard
          v-for="contract in activeCommissions"
          :key="contract.id"
          :contract="contract"
        />
      </div>
    </template>

    <!-- ── Ships grouped by sector ── -->
    <template v-if="hasShips">
      <div
        v-for="[sectorId, ships] in shipsBySector"
        :key="sectorId"
        class="mb-6"
      >
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
          {{ sectorName(sectorId) }} ({{ ships.length }})
        </p>
        <div class="space-y-2">
          <ShipCard
            v-for="ship in ships"
            :key="ship.id"
            :ship="ship"
            :corp-name="corpName(ship.ownerCorpId === 'government' ? '' : ship.ownerCorpId)"
            :sector-name="sectorName(sectorId)"
          />
        </div>
      </div>
    </template>

    <!-- ── Empty state ── -->
    <div
      v-if="!hasActivity"
      class="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 px-8"
    >
      <p class="text-zinc-400 text-sm mb-1">No ships yet.</p>
      <p class="text-zinc-500 text-xs mb-5 text-center max-w-md">
        Commission your first ship by creating a Ship Commission contract.
        You'll need a Shipbuilding corporation, a colony with Space Industry infrastructure,
        and Ship Parts production.
      </p>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        @click="showWizard = true"
      >
        + Commission Ship
      </button>
    </div>

    <!-- ── Contract wizard (modal) ── -->
    <ContractWizard
      v-if="showWizard"
      :preset-type="ContractType.ShipCommission"
      @close="showWizard = false"
    />

    <!-- ── Mission wizard (modal) ── -->
    <MissionWizard
      v-if="showMissionWizard"
      @close="showMissionWizard = false"
    />
  </div>
</template>
