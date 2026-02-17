<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const corpId = route.params.id as string

// TODO: Epic 6 (Story 6.4) — Full corporation detail: stats, traits, infrastructure owned, contract history
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-white mb-6">Corporation Detail</h1>

    <div class="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 px-8">
      <p class="text-zinc-400 text-sm">Corporation {{ corpId }} — details not yet available.</p>
      <p class="text-zinc-500 text-xs mt-2">Stats, personality traits, infrastructure, and contract history will be displayed here.</p>
    </div>
  </div>
</template>
