<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useGameStore } from '@/stores/game.store'

// ─── Global game initialization ───────────────────────────────────────────────
// Delegates to game.store.ts initializeGame() which:
// - Generates galaxy
// - Creates Terra Nova colony + planet
// - Initializes budget (income calculated AFTER colony exists)
// - Spawns starting corporations
// - Sets turn 1, player_action phase
//
// TODO (Story 18.2): Replace with save/load restore when returning to an existing game.

const gameStore = useGameStore()
gameStore.initializeGame()

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
