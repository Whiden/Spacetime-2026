<script setup lang="ts">
/**
 * CorpCard — Compact single-line corporation row for the list view.
 * Shows name, type (color-coded), level, capital, and infra (owned/max).
 * Clickable — navigates to corporation detail view.
 */
import type { Corporation } from '../../types/corporation'
import { CORP_TYPE_DEFINITIONS } from '../../data/corporation-types'
import { calculateMaxInfra, getTotalOwnedInfra } from '../../engine/formulas/growth'

const props = defineProps<{
  corp: Corporation
}>()

const typeDef = CORP_TYPE_DEFINITIONS[props.corp.type]
const totalInfra = getTotalOwnedInfra(props.corp.assets.infrastructureByColony)
const maxInfra = calculateMaxInfra(props.corp.level)

const typeColorClasses: Record<string, string> = {
  Exploitation: 'bg-amber-500/20 text-amber-400',
  Construction: 'bg-orange-500/20 text-orange-400',
  Industrial:   'bg-slate-500/20 text-slate-400',
  Shipbuilding: 'bg-sky-500/20 text-sky-400',
  Science:      'bg-violet-500/20 text-violet-400',
  Transport:    'bg-teal-500/20 text-teal-400',
  Military:     'bg-red-500/20 text-red-400',
  Exploration:  'bg-emerald-500/20 text-emerald-400',
  Agriculture:  'bg-lime-500/20 text-lime-400',
}
</script>

<template>
  <router-link
    :to="{ name: 'corp-detail', params: { id: corp.id } }"
    class="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900/80 hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors"
  >
    <!-- Name -->
    <span class="flex-1 min-w-0 text-sm font-medium text-white truncate">{{ corp.name }}</span>

    <!-- Type badge -->
    <span
      class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded"
      :class="typeColorClasses[corp.type] ?? 'bg-indigo-500/20 text-indigo-400'"
    >
      {{ typeDef.name }}
    </span>

    <!-- Level -->
    <span class="shrink-0 text-xs text-zinc-500">Lv</span>
    <span class="shrink-0 text-sm font-semibold text-white w-4 text-right">{{ corp.level }}</span>

    <!-- Capital -->
    <span class="shrink-0 text-xs text-zinc-500">Cap</span>
    <span class="shrink-0 text-sm font-medium text-amber-400 w-6 text-right">{{ corp.capital }}</span>

    <!-- Infra -->
    <span class="shrink-0 text-xs text-zinc-500">Infra</span>
    <span class="shrink-0 text-sm font-medium text-zinc-300 w-10 text-right">{{ totalInfra }}/{{ maxInfra }}</span>
  </router-link>
</template>
