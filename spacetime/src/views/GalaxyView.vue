<script setup lang="ts">
/**
 * GalaxyView — Displays all sectors with adjacency, exploration status, and presence.
 *
 * Auto-generates the galaxy on first load if no sectors exist.
 * Shows discovered planets per sector with Accept/Reject actions.
 * "Explore" quick action opens the contract wizard pre-filled with Exploration type.
 *
 * TODO (Story 17.3): Show trade route connections between sectors.
 */
import { computed, ref } from 'vue'
import type { SectorId } from '../types/common'
import { ContractType } from '../types/common'
import type { Planet } from '../types/planet'
import { useGalaxyStore } from '../stores/galaxy.store'
import { usePlanetStore } from '../stores/planet.store'
import SectorCard from '../components/galaxy/SectorCard.vue'
import SectorGraph from '../components/galaxy/SectorGraph.vue'
import EmptyState from '../components/shared/EmptyState.vue'
import ContractWizard from '../components/contract/ContractWizard.vue'

const galaxyStore = useGalaxyStore()
const planetStore = usePlanetStore()

// ─── Contract Wizard ──────────────────────────────────────────────────────────

const showWizard = ref(false)
/** Pre-selected type when opening wizard from Explore action. */
const wizardPresetType = ref<ContractType | null>(null)
/** Pre-selected sector ID when opening wizard from Explore action. */
const wizardPresetSectorId = ref<SectorId | null>(null)

function openExploreWizard(sectorId: SectorId) {
  wizardPresetType.value = ContractType.Exploration
  wizardPresetSectorId.value = sectorId
  showWizard.value = true
}

function closeWizard() {
  showWizard.value = false
  wizardPresetType.value = null
  wizardPresetSectorId.value = null
}

// ─── Accept / Reject ──────────────────────────────────────────────────────────

function handleAcceptPlanet(planetId: string) {
  planetStore.acceptPlanet(planetId as import('../types/common').PlanetId)
}

function handleRejectPlanet(planetId: string) {
  planetStore.rejectPlanet(planetId as import('../types/common').PlanetId)
}

// ─── Computed ─────────────────────────────────────────────────────────────────

// Set of explorable sector IDs for quick lookup
const explorableSectorIds = computed<Set<SectorId>>(() => {
  return new Set(galaxyStore.explorableSectors.map((s) => s.id))
})

// Set of sectors with player presence
const presentSectorIds = computed<Set<SectorId>>(() => {
  const ids = new Set<SectorId>()
  if (galaxyStore.startingSectorId) {
    ids.add(galaxyStore.startingSectorId)
  }
  return ids
})

/** Returns sorted names of adjacent sectors for a given sector ID. */
function getAdjacentNames(sectorId: SectorId): string[] {
  return galaxyStore
    .getAdjacentSectors(sectorId)
    .map((id) => galaxyStore.getSector(id)?.name ?? 'Unknown')
    .sort()
}

/** Returns visible (non-rejected, non-colonized) planets for a sector. */
function getPlanetsForSector(sectorId: SectorId): Planet[] {
  return planetStore.getPlanetsBySector(sectorId).filter(
    (p) =>
      p.status !== 'Rejected' && p.status !== 'Colonized' && p.status !== 'Undiscovered',
  )
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-white mb-6">Galaxy</h1>

    <!-- Empty state if no sectors generated -->
    <EmptyState
      v-if="galaxyStore.allSectors.length === 0"
      message="No sectors generated."
      description="The galaxy will be generated when a new game starts."
    />

    <template v-else>
      <!-- Summary bar -->
      <div class="flex items-center gap-6 mb-6 text-xs text-zinc-400">
        <span>{{ galaxyStore.allSectors.length }} sectors</span>
        <span>{{ explorableSectorIds.size }} explorable</span>
        <span>{{ presentSectorIds.size }} with presence</span>
        <span>{{ planetStore.allPlanets.filter(p => p.status !== 'Rejected' && p.status !== 'Undiscovered').length }} planets discovered</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Sector list (2/3 width) -->
        <div class="lg:col-span-2 space-y-2">
          <SectorCard
            v-for="sector in galaxyStore.allSectors"
            :key="sector.id"
            :sector="sector"
            :adjacent-sector-names="getAdjacentNames(sector.id)"
            :is-starting-sector="sector.id === galaxyStore.startingSectorId"
            :is-explorable="explorableSectorIds.has(sector.id)"
            :has-presence="presentSectorIds.has(sector.id)"
            :planets="getPlanetsForSector(sector.id)"
            @explore="openExploreWizard"
            @accept-planet="handleAcceptPlanet"
            @reject-planet="handleRejectPlanet"
          />
        </div>

        <!-- Adjacency graph (1/3 width) -->
        <div>
          <SectorGraph
            :sectors="galaxyStore.allSectors"
            :adjacency="galaxyStore.adjacency"
            :starting-sector-id="galaxyStore.startingSectorId"
            :present-sector-ids="presentSectorIds"
            :explorable-sector-ids="explorableSectorIds"
          />
        </div>
      </div>
    </template>

    <!-- Contract wizard (opened via Explore quick action) -->
    <ContractWizard
      v-if="showWizard"
      :preset-type="wizardPresetType"
      :preset-sector-id="wizardPresetSectorId"
      @close="closeWizard"
    />
  </div>
</template>
