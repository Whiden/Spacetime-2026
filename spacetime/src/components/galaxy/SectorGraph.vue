<script setup lang="ts">
/**
 * SectorGraph — Text-based adjacency visualization for the galaxy.
 *
 * Shows each sector as a node with its connections listed.
 * Sectors with player presence are highlighted.
 * This is a simple text-based representation — no canvas/SVG map.
 */
import type { SectorId } from '../../types/common'
import type { Sector } from '../../types/sector'

defineProps<{
  /** All sectors in the galaxy. */
  sectors: Sector[]
  /** Adjacency map: sectorId → adjacent sector IDs. */
  adjacency: Map<SectorId, SectorId[]>
  /** The starting sector ID. */
  startingSectorId: SectorId | null
  /** Set of sector IDs where the player has presence. */
  presentSectorIds: Set<SectorId>
  /** Set of sector IDs that are explorable. */
  explorableSectorIds: Set<SectorId>
}>()

/** Resolve a sector ID to its name. */
function sectorName(sectors: Sector[], id: SectorId): string {
  return sectors.find((s) => s.id === id)?.name ?? 'Unknown'
}
</script>

<template>
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
    <h3 class="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
      Sector Network
    </h3>

    <div class="space-y-2">
      <div
        v-for="sector in sectors"
        :key="sector.id"
        class="flex items-start gap-2 text-xs"
      >
        <!-- Node indicator -->
        <span
          class="w-2 h-2 rounded-full mt-1 shrink-0"
          :class="[
            presentSectorIds.has(sector.id)
              ? 'bg-emerald-400'
              : explorableSectorIds.has(sector.id)
                ? 'bg-indigo-400'
                : 'bg-zinc-700',
          ]"
        />

        <!-- Sector name and connections -->
        <div class="min-w-0">
          <span
            class="font-medium"
            :class="[
              presentSectorIds.has(sector.id)
                ? 'text-emerald-400'
                : explorableSectorIds.has(sector.id)
                  ? 'text-indigo-400'
                  : 'text-zinc-500',
            ]"
          >
            {{ sector.name }}
            <span v-if="sector.id === startingSectorId" class="text-amber-400">★</span>
          </span>
          <span class="text-zinc-600 ml-1">
            → {{ (adjacency.get(sector.id) ?? []).map((id) => sectorName(sectors, id)).join(', ') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-800/50 text-[10px] text-zinc-600">
      <span class="flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Presence
      </span>
      <span class="flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Explorable
      </span>
      <span class="flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-zinc-700" /> Unreachable
      </span>
      <span class="flex items-center gap-1">
        <span class="text-amber-400">★</span> Home Sector
      </span>
    </div>
  </div>
</template>
