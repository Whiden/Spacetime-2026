<script setup lang="ts">
/**
 * SchematicCard.vue — Displays a single schematic owned by a shipbuilding corp.
 *
 * Shows: name (with Mk iteration), category, level, stat bonus, and owning corp name.
 *
 * Used by: ScienceView.vue (schematics section, grouped by category)
 */
import type { Schematic } from '../../types/science'
import { SCIENCE_DOMAIN_DEFINITIONS } from '../../data/science-sectors'

defineProps<{
  schematic: Schematic
  /** Name of the owning corp (looked up by caller). */
  corpName: string
}>()
</script>

<template>
  <div class="rounded-md border border-zinc-700 bg-zinc-800/40 px-3 py-2 flex items-center gap-3">
    <!-- Name + Mk iteration -->
    <div class="flex-1 min-w-0">
      <span class="text-white text-sm font-medium">{{ schematic.name }}</span>
      <span v-if="schematic.iteration > 1" class="text-xs text-zinc-400 ml-1">
        Mk{{ schematic.iteration }}
      </span>
    </div>

    <!-- Domain -->
    <span class="text-xs text-zinc-500">
      {{ SCIENCE_DOMAIN_DEFINITIONS[schematic.scienceDomain]?.name ?? schematic.scienceDomain }}
    </span>

    <!-- Level badge -->
    <span class="text-xs bg-zinc-700 text-zinc-300 rounded px-1.5 py-0.5 shrink-0">
      Lv {{ schematic.level }}
    </span>

    <!-- Stat bonus -->
    <span class="text-xs font-semibold text-emerald-300 bg-emerald-900/40 rounded px-1.5 py-0.5 shrink-0">
      {{ schematic.statTarget }} +{{ schematic.bonusAmount }}
    </span>

    <!-- Owning corp -->
    <span class="text-xs text-zinc-500 truncate max-w-[120px]" :title="corpName">
      {{ corpName }}
    </span>
  </div>
</template>
