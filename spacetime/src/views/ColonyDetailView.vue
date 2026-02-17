<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const colonyId = route.params.id as string

// TODO: Epic 4 (Story 4.5) — Full colony detail: attributes, infrastructure, resource flow, features, deposits
</script>

<template>
  <div>
    <h1>Colony Detail</h1>
    <p>Colony ID: {{ colonyId }}</p>
  </div>
</template>
