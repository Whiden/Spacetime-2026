<script setup lang="ts">
/**
 * CorporationsView — Lists all corporations sorted by level (highest first).
 *
 * Shows corporation count and renders CorpCard for each corp.
 * When no corporations exist, displays guidance about kickstarting via contracts.
 *
 * TODO (Story 7.4): "Create Contract" action links to contract wizard for corp kickstart.
 */
import { computed } from 'vue'
import { useCorporationStore } from '../stores/corporation.store'
import CorpCard from '../components/corporation/CorpCard.vue'
import EmptyState from '../components/shared/EmptyState.vue'

const corpStore = useCorporationStore()

/** All corporations sorted by level (highest first), then by name. */
const sortedCorps = computed(() =>
  [...corpStore.allCorporations].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level
    return a.name.localeCompare(b.name)
  }),
)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-white">Corporations</h1>
      <span v-if="corpStore.corpCount > 0" class="text-sm text-zinc-400">
        {{ corpStore.corpCount }} {{ corpStore.corpCount === 1 ? 'corporation' : 'corporations' }}
      </span>
    </div>

    <div class="max-w-2xl">
      <div v-if="sortedCorps.length > 0" class="space-y-1">
        <CorpCard
          v-for="corp in sortedCorps"
          :key="corp.id"
          :corp="corp"
        />
      </div>

      <EmptyState
        v-else
        message="No corporations yet."
        description="Post a contract to kickstart your first corporation. Corporations are autonomous entities that handle all economic, scientific, and military activity in your empire."
      />
    </div>
  </div>
</template>
