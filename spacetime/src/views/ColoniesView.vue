<script setup lang="ts">
/**
 * ColoniesView — Lists all player colonies with summary cards.
 *
 * Shows colony count, renders ColonyCard for each colony.
 * Auto-initializes Terra Nova if the galaxy is generated but no colonies exist yet.
 *
 * TODO (Story 9.2): Shortage alert icons on colony cards.
 * TODO (Story 14.2): "Found Colony" action button when colonizable planets exist.
 */
import { useColonyStore } from '../stores/colony.store'
import { useGalaxyStore } from '../stores/galaxy.store'
import ColonyCard from '../components/colony/ColonyCard.vue'
import EmptyState from '../components/shared/EmptyState.vue'

const colonyStore = useColonyStore()
const galaxyStore = useGalaxyStore()

// Auto-initialize Terra Nova if no colonies exist and galaxy is generated
if (colonyStore.colonyCount === 0 && galaxyStore.startingSectorId !== null) {
  colonyStore.initializeTerraNova(galaxyStore.startingSectorId)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-white">Colonies</h1>
      <span v-if="colonyStore.colonyCount > 0" class="text-sm text-zinc-400">
        {{ colonyStore.colonyCount }} {{ colonyStore.colonyCount === 1 ? 'colony' : 'colonies' }}
      </span>
    </div>

    <div class="max-w-2xl">
      <div v-if="colonyStore.allColonies.length > 0" class="space-y-3">
        <ColonyCard
          v-for="colony in colonyStore.allColonies"
          :key="colony.id"
          :colony="colony"
        />
      </div>

      <EmptyState
        v-else
        message="No colonies yet."
        description="Terra Nova will appear once the game state is initialized."
      />
    </div>
  </div>
</template>
