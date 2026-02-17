<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const colonyId = route.params.id as string

// TODO: Epic 4 (Story 4.5) — Full colony detail: attributes, infrastructure, resource flow, features, deposits
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-white mb-6">Colony Detail</h1>

    <div class="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 px-8">
      <p class="text-zinc-400 text-sm">Colony {{ colonyId }} — details not yet available.</p>
      <p class="text-zinc-500 text-xs mt-2">Attributes, infrastructure, and resource flows will be displayed here.</p>
    </div>
  </div>
</template>
