<script setup lang="ts">
/**
 * ContractsView — Displays active contracts and opens the creation wizard.
 *
 * TODO (Story 7.5): Full contract list with progress bars and completed contracts.
 */
import { ref, computed } from 'vue'
import { useContractStore } from '../stores/contract.store'
import ContractWizard from '../components/contract/ContractWizard.vue'

const contractStore = useContractStore()
const showWizard = ref(false)

const activeContracts = computed(() => contractStore.activeContracts)

function openWizard() {
  showWizard.value = true
}

function closeWizard() {
  showWizard.value = false
}

/** Human-readable label for contract type. */
const TYPE_LABELS: Record<string, string> = {
  Exploration: 'Exploration',
  GroundSurvey: 'Ground Survey',
  Colonization: 'Colonization',
  ShipCommission: 'Ship Commission',
  TradeRoute: 'Trade Route',
}

/** Color accent by contract type for progress bars. */
const TYPE_COLORS: Record<string, string> = {
  Exploration: 'bg-emerald-500',
  GroundSurvey: 'bg-teal-500',
  Colonization: 'bg-amber-500',
  ShipCommission: 'bg-sky-500',
  TradeRoute: 'bg-violet-500',
}
</script>

<template>
  <div>
    <!-- Page header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-white">Contracts</h1>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        @click="openWizard"
      >
        + New Contract
      </button>
    </div>

    <!-- Active contracts -->
    <div v-if="activeContracts.length > 0" class="space-y-2">
      <div
        v-for="contract in activeContracts"
        :key="contract.id"
        class="rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-3"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
            <span class="text-sm font-medium text-white">
              {{ TYPE_LABELS[contract.type] ?? contract.type }}
            </span>
          </div>
          <span class="text-xs text-zinc-500">{{ contract.bpPerTurn }} BP/turn</span>
        </div>

        <!-- Progress bar -->
        <div class="h-1 rounded-full bg-zinc-800 overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="TYPE_COLORS[contract.type] ?? 'bg-indigo-500'"
            :style="{
              width: `${Math.round(((contract.durationTurns - contract.turnsRemaining) / contract.durationTurns) * 100)}%`,
            }"
          />
        </div>
        <div class="flex items-center justify-between mt-1">
          <span class="text-[10px] text-zinc-600">{{ contract.turnsRemaining }} turns remaining</span>
          <span class="text-[10px] text-zinc-600">{{ contract.durationTurns }} total</span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 px-8"
    >
      <p class="text-zinc-400 text-sm mb-1">No active contracts.</p>
      <p class="text-zinc-500 text-xs mb-5">
        Create a contract to explore, colonize, build infrastructure, or commission ships.
      </p>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        @click="openWizard"
      >
        + New Contract
      </button>
    </div>

    <!-- Contract creation wizard (modal) -->
    <ContractWizard v-if="showWizard" @close="closeWizard" />
  </div>
</template>
