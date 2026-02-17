<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const corpId = route.params.id as string

// TODO: Epic 6 (Story 6.4) — Full corporation detail: stats, traits, infrastructure owned, contract history
</script>

<template>
  <div>
    <h1>Corporation Detail</h1>
    <p>Corporation ID: {{ corpId }}</p>
  </div>
</template>
