<script setup lang="ts">
/**
 * GalaxyView — Displays all sectors with adjacency, exploration status, and presence.
 *
 * Auto-generates the galaxy on first load if no sectors exist.
 *
 * TODO (Story 13.5): Add "Explore" quick action on explorable sectors.
 * TODO (Story 17.3): Show trade route connections between sectors.
 */
import { computed, onMounted } from 'vue'
import type { SectorId } from '../types/common'
import { useGalaxyStore } from '../stores/galaxy.store'
import SectorCard from '../components/galaxy/SectorCard.vue'
import SectorGraph from '../components/galaxy/SectorGraph.vue'
import EmptyState from '../components/shared/EmptyState.vue'

const galaxyStore = useGalaxyStore()

// Auto-generate galaxy if not yet created
onMounted(() => {
  if (galaxyStore.allSectors.length === 0) {
    galaxyStore.generate()
  }
})

// Set of explorable sector IDs for quick lookup
const explorableSectorIds = computed<Set<SectorId>>(() => {
  return new Set(galaxyStore.explorableSectors.map((s) => s.id))
})

// Set of sectors with player presence
// For now, only the starting sector has presence
// TODO (Story 4.3): Include sectors with colonies.
// TODO (Story 15.4): Include sectors with stationed ships.
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
  </div>
</template>
