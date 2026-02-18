<script setup lang="ts">
/**
 * ContractCard — Displays a single contract in the contracts list.
 *
 * Active contracts: type badge, target, assigned corp, BP/turn, progress bar, turns remaining.
 * Completed contracts: type badge, target, corp, outcome summary (completion turn).
 * Click anywhere on the card to expand/collapse full details.
 */
import { ref, computed } from 'vue'
import type { Contract } from '../../types/contract'
import { ContractStatus } from '../../types/common'
import { useGalaxyStore } from '../../stores/galaxy.store'
import { usePlanetStore } from '../../stores/planet.store'
import { useColonyStore } from '../../stores/colony.store'
import { useCorporationStore } from '../../stores/corporation.store'
import { COLONY_TYPE_DEFINITIONS } from '../../data/colony-types'
import { CONTRACT_TYPE_DEFINITIONS } from '../../data/contracts'

const props = defineProps<{
  contract: Contract
}>()

// ─── Stores (for name resolution) ─────────────────────────────────────────────

const galaxyStore = useGalaxyStore()
const planetStore = usePlanetStore()
const colonyStore = useColonyStore()
const corpStore = useCorporationStore()

// ─── Expand / Collapse ────────────────────────────────────────────────────────

const expanded = ref(false)

function toggle() {
  expanded.value = !expanded.value
}

// ─── Derived display values ───────────────────────────────────────────────────

const isActive = computed(() => props.contract.status === ContractStatus.Active)
const isCompleted = computed(() => props.contract.status === ContractStatus.Completed)

/** Progress percentage (0-100) for active contracts. */
const progressPercent = computed(() => {
  const { durationTurns, turnsRemaining } = props.contract
  if (durationTurns <= 0) return 0
  return Math.round(((durationTurns - turnsRemaining) / durationTurns) * 100)
})

/** Human-readable type label. */
const typeLabel = computed(() => CONTRACT_TYPE_DEFINITIONS[props.contract.type]?.name ?? props.contract.type)

/** Resolved target name string. */
const targetLabel = computed(() => {
  const t = props.contract.target
  switch (t.type) {
    case 'sector': {
      const sector = galaxyStore.getSector(t.sectorId)
      return sector?.name ?? t.sectorId
    }
    case 'planet': {
      const planet = planetStore.getPlanet(t.planetId)
      return planet?.name ?? t.planetId
    }
    case 'colony': {
      const colony = colonyStore.getColony(t.colonyId)
      return colony?.name ?? t.colonyId
    }
    case 'sector_pair': {
      const sA = galaxyStore.getSector(t.sectorIdA)?.name ?? t.sectorIdA
      const sB = galaxyStore.getSector(t.sectorIdB)?.name ?? t.sectorIdB
      return `${sA} ↔ ${sB}`
    }
    default:
      return '—'
  }
})

/** Resolved corporation name and level. */
const corp = computed(() => corpStore.getCorp(props.contract.assignedCorpId))

/** Outcome summary for completed contracts. */
const outcomeSummary = computed(() => {
  if (!isCompleted.value) return null

  switch (props.contract.type) {
    case 'Exploration':
      return 'Sector explored.'
    case 'GroundSurvey':
      return 'Planet ground-surveyed.'
    case 'Colonization': {
      const colonyTypeName = props.contract.colonizationParams
        ? COLONY_TYPE_DEFINITIONS[props.contract.colonizationParams.colonyType]?.name
        : null
      return colonyTypeName ? `${colonyTypeName} founded.` : 'Colony founded.'
    }
    case 'ShipCommission':
      return 'Ship commissioned.'
    case 'TradeRoute':
      return 'Trade route established.'
    default:
      return 'Contract completed.'
  }
})

// ─── Type color accent ─────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  Exploration: 'bg-emerald-500/20 text-emerald-400',
  GroundSurvey: 'bg-teal-500/20 text-teal-400',
  Colonization: 'bg-amber-500/20 text-amber-400',
  ShipCommission: 'bg-sky-500/20 text-sky-400',
  TradeRoute: 'bg-violet-500/20 text-violet-400',
}

const TYPE_BAR: Record<string, string> = {
  Exploration: 'bg-emerald-500',
  GroundSurvey: 'bg-teal-500',
  Colonization: 'bg-amber-500',
  ShipCommission: 'bg-sky-500',
  TradeRoute: 'bg-violet-500',
}

const badgeClass = computed(() => TYPE_BADGE[props.contract.type] ?? 'bg-indigo-500/20 text-indigo-400')
const barClass = computed(() => TYPE_BAR[props.contract.type] ?? 'bg-indigo-500')

/** Status dot color. */
const dotClass = computed(() =>
  isActive.value ? 'bg-indigo-400' : isCompleted.value ? 'bg-emerald-500' : 'bg-zinc-500',
)
</script>

<template>
  <div
    class="rounded-lg border bg-zinc-900/80 transition-colors cursor-pointer"
    :class="isActive ? 'border-zinc-700 hover:border-zinc-600' : 'border-zinc-800 hover:border-zinc-700'"
    @click="toggle"
  >
    <!-- ─── Collapsed row ───────────────────────────────────────────────────── -->
    <div class="px-4 py-3">
      <!-- Header: status dot, type badge, target, corp, cost -->
      <div class="flex items-center gap-2 mb-2">
        <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="dotClass" />
        <span
          class="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
          :class="badgeClass"
        >
          {{ typeLabel }}
        </span>
        <span class="text-sm font-medium text-white truncate">{{ targetLabel }}</span>
        <span class="ml-auto text-[10px] text-zinc-500 shrink-0 pl-2">
          {{ isActive ? `${contract.bpPerTurn} BP/turn` : `Turn ${contract.completedTurn}` }}
        </span>
      </div>

      <!-- Corp row -->
      <div class="flex items-center justify-between">
        <span class="text-xs text-zinc-500">
          {{ corp?.name ?? contract.assignedCorpId }}
          <span class="text-zinc-600 ml-1">Lv {{ corp?.level }}</span>
        </span>
        <span
          v-if="isCompleted"
          class="text-[10px] text-emerald-500"
        >
          {{ outcomeSummary }}
        </span>
        <span
          v-else-if="isActive && contract.type !== 'TradeRoute'"
          class="text-[10px] text-zinc-500"
        >
          {{ contract.turnsRemaining }}t left
        </span>
        <span v-else-if="isActive" class="text-[10px] text-violet-400">Ongoing</span>
      </div>

      <!-- Progress bar (active only, non-trade-route) -->
      <div
        v-if="isActive && contract.type !== 'TradeRoute'"
        class="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden"
      >
        <div
          class="h-full rounded-full transition-all"
          :class="barClass"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <!-- ─── Expanded details ────────────────────────────────────────────────── -->
    <div
      v-if="expanded"
      class="border-t border-zinc-800 px-4 py-3 space-y-1.5 text-xs"
    >
      <div class="flex items-center justify-between">
        <span class="text-zinc-500">Contract ID</span>
        <span class="text-zinc-400 font-mono text-[10px]">{{ contract.id }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-zinc-500">Status</span>
        <span
          :class="isActive ? 'text-indigo-400' : isCompleted ? 'text-emerald-400' : 'text-red-400'"
        >
          {{ contract.status }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-zinc-500">Corporation</span>
        <span class="text-zinc-300">{{ corp?.name ?? contract.assignedCorpId }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-zinc-500">Corp Level</span>
        <span class="text-zinc-300">{{ corp?.level ?? '—' }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-zinc-500">BP/Turn</span>
        <span class="text-amber-400">{{ contract.bpPerTurn }}</span>
      </div>
      <div v-if="isActive" class="flex items-center justify-between">
        <span class="text-zinc-500">Progress</span>
        <span class="text-zinc-300">
          {{ contract.durationTurns - contract.turnsRemaining }} / {{ contract.durationTurns }} turns
          <span v-if="contract.type !== 'TradeRoute'"> ({{ progressPercent }}%)</span>
        </span>
      </div>
      <div v-if="contract.completedTurn != null" class="flex items-center justify-between">
        <span class="text-zinc-500">Completed Turn</span>
        <span class="text-zinc-300">{{ contract.completedTurn }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-zinc-500">Started Turn</span>
        <span class="text-zinc-300">{{ contract.startTurn }}</span>
      </div>
      <div
        v-if="contract.colonizationParams"
        class="flex items-center justify-between"
      >
        <span class="text-zinc-500">Colony Type</span>
        <span class="text-zinc-300">
          {{ COLONY_TYPE_DEFINITIONS[contract.colonizationParams.colonyType]?.name }}
        </span>
      </div>
      <div
        v-if="contract.shipCommissionParams"
        class="flex items-center justify-between"
      >
        <span class="text-zinc-500">Ship</span>
        <span class="text-zinc-300">
          {{ contract.shipCommissionParams.sizeVariant }} {{ contract.shipCommissionParams.role }}
        </span>
      </div>
    </div>
  </div>
</template>
