<script setup lang="ts">
/**
 * SectorCard — Displays a single sector with name, density, exploration %,
 * adjacency connections, presence indicators, and discovered planets.
 *
 * Emits 'explore' when the Explore quick action is clicked.
 * Emits 'accept-planet' / 'reject-planet' for discovered planet actions.
 */
import { ref, computed } from 'vue'
import type { SectorId } from '../../types/common'
import type { Sector } from '../../types/sector'
import type { Planet } from '../../types/planet'
import { PlanetStatus } from '../../types/common'
import ProgressBar from '../shared/ProgressBar.vue'

const props = defineProps<{
  sector: Sector
  /** Names of adjacent sectors for display. */
  adjacentSectorNames: string[]
  /** Whether this is the starting sector. */
  isStartingSector: boolean
  /** Whether this sector is explorable (adjacent to player presence). */
  isExplorable: boolean
  /** Whether the player has presence in this sector. */
  hasPresence: boolean
  /** Planets discovered in this sector (OrbitScanned, GroundSurveyed, Accepted). */
  planets: Planet[]
}>()

const emit = defineEmits<{
  explore: [sectorId: SectorId]
  'accept-planet': [planetId: string]
  'reject-planet': [planetId: string]
}>()

const expanded = ref(false)

/** Color for the exploration progress bar based on percentage. */
function explorationColor(percent: number): string {
  if (percent >= 100) return 'bg-emerald-500'
  if (percent > 0) return 'bg-indigo-500'
  return 'bg-zinc-600'
}

/** Visible planets (not Rejected, not Colonized). */
const visiblePlanets = computed<Planet[]>(() =>
  props.planets.filter(
    (p) =>
      p.status === PlanetStatus.OrbitScanned ||
      p.status === PlanetStatus.GroundSurveyed ||
      p.status === PlanetStatus.Accepted,
  ),
)

/** Status badge style per planet status. */
const statusStyle: Record<string, string> = {
  [PlanetStatus.OrbitScanned]: 'bg-indigo-500/20 text-indigo-300',
  [PlanetStatus.GroundSurveyed]: 'bg-teal-500/20 text-teal-300',
  [PlanetStatus.Accepted]: 'bg-emerald-500/20 text-emerald-300',
}

const statusLabel: Record<string, string> = {
  [PlanetStatus.OrbitScanned]: 'Orbit Scanned',
  [PlanetStatus.GroundSurveyed]: 'Ground Surveyed',
  [PlanetStatus.Accepted]: 'Accepted',
}

/** Prettify a deposit type string for display (e.g. "CommonOreVein" → "Common Ore Vein"). */
function formatDepositType(dt: string): string {
  return dt.replace(/([A-Z])/g, ' $1').trim()
}

/** Prettify a feature ID for display. */
function formatFeatureId(id: string): string {
  return id.replace(/([A-Z])/g, ' $1').trim()
}

/** Revealed deposit types for an orbit-scanned planet (richness hidden). */
function revealedDeposits(planet: Planet): string[] {
  return planet.deposits
    .filter((d) => !d.richnessRevealed)
    .map((d) => formatDepositType(d.type))
    .filter((v, i, a) => a.indexOf(v) === i) // dedupe
}

/** Fully revealed deposits (ground surveyed) with richness. */
function revealedDepositsWithRichness(planet: Planet): { label: string; richness: string }[] {
  return planet.deposits
    .filter((d) => d.richnessRevealed)
    .map((d) => ({ label: formatDepositType(d.type), richness: d.richness }))
}

/** Orbit-visible features revealed. */
function revealedFeatures(planet: Planet): string[] {
  return planet.features
    .filter((f) => f.revealed)
    .map((f) => formatFeatureId(f.featureId))
}

function onExplore(event: Event) {
  event.stopPropagation()
  emit('explore', props.sector.id)
}

function onAccept(event: Event, planetId: string) {
  event.stopPropagation()
  emit('accept-planet', planetId)
}

function onReject(event: Event, planetId: string) {
  event.stopPropagation()
  emit('reject-planet', planetId)
}
</script>

<template>
  <div
    class="rounded-lg border transition-colors cursor-pointer"
    :class="[
      isExplorable || hasPresence
        ? 'border-zinc-700 bg-zinc-900/80 hover:border-zinc-600'
        : 'border-zinc-800/50 bg-zinc-900/30 opacity-60',
    ]"
    @click="expanded = !expanded"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between px-4 py-3">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Presence indicator dot -->
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="[
            hasPresence ? 'bg-emerald-400' : isExplorable ? 'bg-indigo-400' : 'bg-zinc-700',
          ]"
        />

        <!-- Sector name -->
        <h3 class="text-sm font-medium text-white truncate">
          {{ sector.name }}
        </h3>

        <!-- Starting sector badge -->
        <span
          v-if="isStartingSector"
          class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400"
        >
          Home
        </span>

        <!-- Explorable badge -->
        <span
          v-if="isExplorable && !hasPresence"
          class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400"
        >
          Explorable
        </span>

        <!-- Planet count badge -->
        <span
          v-if="visiblePlanets.length > 0"
          class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300"
        >
          {{ visiblePlanets.length }} planet{{ visiblePlanets.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        <!-- Density -->
        <span class="text-xs text-zinc-500">{{ sector.density }}</span>

        <!-- Exploration % -->
        <div class="w-24">
          <ProgressBar
            :value="sector.explorationPercent"
            :color="explorationColor(sector.explorationPercent)"
            :label="`${sector.explorationPercent}%`"
          />
        </div>

        <!-- Explore quick action -->
        <button
          v-if="isExplorable || hasPresence"
          class="text-[10px] font-medium px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors"
          @click="onExplore"
        >
          Explore
        </button>

        <!-- Expand chevron -->
        <span
          class="text-zinc-500 text-xs transition-transform"
          :class="expanded ? 'rotate-180' : ''"
        >
          ▼
        </span>
      </div>
    </div>

    <!-- Expanded detail -->
    <div v-if="expanded" class="px-4 pb-4 pt-1 border-t border-zinc-800/50">
      <div class="grid grid-cols-2 gap-4 text-xs mb-4">
        <!-- Connections -->
        <div>
          <p class="text-zinc-500 mb-1">Connected to</p>
          <p v-if="adjacentSectorNames.length > 0" class="text-zinc-300">
            {{ adjacentSectorNames.join(', ') }}
          </p>
          <p v-else class="text-zinc-600 italic">None</p>
        </div>

        <!-- Stats -->
        <div class="space-y-1">
          <div class="flex justify-between">
            <span class="text-zinc-500">Density</span>
            <span class="text-zinc-300">{{ sector.density }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-zinc-500">Exploration</span>
            <span class="text-zinc-300">{{ sector.explorationPercent }}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-zinc-500">Threat Modifier</span>
            <span class="text-zinc-300">×{{ sector.threatModifier }}</span>
          </div>
        </div>
      </div>

      <!-- Presence info -->
      <div class="pt-3 border-t border-zinc-800/50">
        <div v-if="isStartingSector" class="flex items-center gap-2 text-xs mb-3">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span class="text-emerald-400">Terra Nova colony</span>
        </div>

        <!-- Discovered Planets -->
        <div v-if="visiblePlanets.length > 0" class="space-y-2">
          <p class="text-zinc-500 text-xs mb-2">Discovered Planets</p>

          <div
            v-for="planet in visiblePlanets"
            :key="planet.id"
            class="rounded-md border border-zinc-800 bg-zinc-900/50 p-3"
            @click.stop
          >
            <!-- Planet header -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-white">{{ planet.name }}</span>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  :class="statusStyle[planet.status] ?? 'bg-zinc-700 text-zinc-300'"
                >
                  {{ statusLabel[planet.status] ?? planet.status }}
                </span>
              </div>

              <!-- Accept/Reject buttons (only for OrbitScanned or GroundSurveyed) -->
              <div
                v-if="
                  planet.status === PlanetStatus.OrbitScanned ||
                  planet.status === PlanetStatus.GroundSurveyed
                "
                class="flex gap-1"
              >
                <button
                  class="text-[10px] px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors"
                  @click="onAccept($event, planet.id)"
                >
                  Accept
                </button>
                <button
                  class="text-[10px] px-2 py-0.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
                  @click="onReject($event, planet.id)"
                >
                  Reject
                </button>
              </div>
            </div>

            <!-- Planet basic info (always visible once orbit-scanned) -->
            <div class="flex gap-3 text-[10px] text-zinc-400 mb-2">
              <span>{{ planet.type }}</span>
              <span>{{ planet.size }}</span>
              <span v-if="planet.baseHabitability !== undefined && planet.status === PlanetStatus.GroundSurveyed">
                Hab {{ planet.baseHabitability }}
              </span>
            </div>

            <!-- Ground Surveyed: full data -->
            <template v-if="planet.status === PlanetStatus.GroundSurveyed || planet.status === PlanetStatus.Accepted">
              <!-- Deposits with richness -->
              <div v-if="revealedDepositsWithRichness(planet).length > 0" class="mb-1">
                <span class="text-[10px] text-zinc-500">Deposits: </span>
                <span
                  v-for="(dep, i) in revealedDepositsWithRichness(planet)"
                  :key="i"
                  class="text-[10px] text-zinc-300"
                >
                  {{ dep.label }} ({{ dep.richness }})<template v-if="i < revealedDepositsWithRichness(planet).length - 1">, </template>
                </span>
              </div>
              <!-- Features -->
              <div v-if="revealedFeatures(planet).length > 0">
                <span class="text-[10px] text-zinc-500">Features: </span>
                <span class="text-[10px] text-zinc-300">{{ revealedFeatures(planet).join(', ') }}</span>
              </div>
            </template>

            <!-- Orbit Scanned: partial data (deposit types only, no richness) -->
            <template v-else-if="planet.status === PlanetStatus.OrbitScanned">
              <div v-if="revealedDeposits(planet).length > 0" class="mb-1">
                <span class="text-[10px] text-zinc-500">Deposits: </span>
                <span class="text-[10px] text-zinc-300">
                  {{ revealedDeposits(planet).join(', ') }}
                  <span class="text-zinc-600">(richness unknown)</span>
                </span>
              </div>
              <div v-if="revealedFeatures(planet).length > 0">
                <span class="text-[10px] text-zinc-500">Features: </span>
                <span class="text-[10px] text-zinc-300">{{ revealedFeatures(planet).join(', ') }}</span>
              </div>
              <p v-if="revealedDeposits(planet).length === 0 && revealedFeatures(planet).length === 0" class="text-[10px] text-zinc-600 italic">
                Low-quality scan — no additional data.
              </p>
            </template>
          </div>
        </div>

        <p
          v-else-if="!isStartingSector && !hasPresence"
          class="text-zinc-600 text-xs italic"
        >
          No presence in this sector.
        </p>

        <p v-else-if="visiblePlanets.length === 0 && (isExplorable || hasPresence)" class="text-zinc-600 text-xs italic">
          No planets discovered yet.
        </p>

        <!-- TODO (Story 7.5): List active contracts in this sector here -->
      </div>
    </div>
  </div>
</template>
