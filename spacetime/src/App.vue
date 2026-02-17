<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'

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
