<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useGalaxyStore } from '@/stores/galaxy.store'
import { useColonyStore } from '@/stores/colony.store'

// ─── Global game initialization ───────────────────────────────────────────────
// Runs once on app start so all stores are populated regardless of which view
// the user navigates to first.
// TODO (Story 12.4): Replace with game.store.ts initializeGame() which will also
// restore saved state, handle turn number, etc.

const galaxyStore = useGalaxyStore()
const colonyStore = useColonyStore()

if (galaxyStore.allSectors.length === 0) {
  galaxyStore.generate()
}
if (colonyStore.colonyCount === 0 && galaxyStore.startingSectorId !== null) {
  colonyStore.initializeTerraNova(galaxyStore.startingSectorId)
}

const sidebarCollapsed = ref(false)
</script>

<template>
  <div class="flex h-screen bg-zinc-950 text-zinc-100">
    <!-- Sidebar -->
    <AppSidebar :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />

    <!-- Main area -->
    <div class="flex flex-col flex-1 min-w-0">
      <!-- Header -->
      <AppHeader />

      <!-- Content -->
      <main class="flex-1 overflow-y-auto p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
