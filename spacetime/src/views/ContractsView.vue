<script setup lang="ts">
/**
 * ContractsView — Active and completed contracts, grouped by status.
 *
 * Shows:
 * - Summary stats bar (active count, total BP/turn, completed count)
 * - Active contracts section with ContractCard components
 * - Completed contracts section (collapsible, collapsed by default)
 * - Prominent "New Contract" button always accessible in the header
 * - Empty state with inline create button when no active contracts
 */
import { ref, computed } from 'vue'
import { useContractStore } from '../stores/contract.store'
import ContractCard from '../components/contract/ContractCard.vue'
import ContractWizard from '../components/contract/ContractWizard.vue'

const contractStore = useContractStore()
const showWizard = ref(false)
const showCompleted = ref(false)

const activeContracts = computed(() => contractStore.activeContracts)
const completedContracts = computed(() => contractStore.completedContracts)
const totalBpPerTurn = computed(() => contractStore.totalContractExpenses)

const hasAny = computed(
  () => activeContracts.value.length > 0 || completedContracts.value.length > 0,
)

function openWizard() {
  showWizard.value = true
}

function closeWizard() {
  showWizard.value = false
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

    <!-- Summary bar -->
    <div
      v-if="hasAny"
      class="flex items-center gap-6 mb-4 px-4 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-zinc-500">Active</span>
        <span class="text-sm font-semibold text-white">{{ activeContracts.length }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-zinc-500">Completed</span>
        <span class="text-sm font-medium text-zinc-300">{{ completedContracts.length }}</span>
      </div>
      <div v-if="totalBpPerTurn > 0" class="flex items-center gap-1.5 ml-auto">
        <span class="text-xs text-zinc-500">Total cost</span>
        <span class="text-sm font-medium text-amber-400">{{ totalBpPerTurn }} BP/turn</span>
      </div>
    </div>

    <!-- Active contracts section -->
    <template v-if="activeContracts.length > 0">
      <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        Active ({{ activeContracts.length }})
      </p>
      <div class="space-y-2 mb-6">
        <ContractCard
          v-for="contract in activeContracts"
          :key="contract.id"
          :contract="contract"
        />
      </div>
    </template>

    <!-- Empty state when no active contracts -->
    <div
      v-else
      class="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 px-8 mb-6"
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

    <!-- Completed contracts section (collapsible) -->
    <template v-if="completedContracts.length > 0">
      <button
        class="flex items-center gap-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 hover:text-zinc-300 transition-colors"
        @click="showCompleted = !showCompleted"
      >
        <span>Completed ({{ completedContracts.length }})</span>
        <span class="text-zinc-600">{{ showCompleted ? '▲' : '▼' }}</span>
      </button>

      <div v-if="showCompleted" class="space-y-2">
        <ContractCard
          v-for="contract in completedContracts"
          :key="contract.id"
          :contract="contract"
        />
      </div>
    </template>

    <!-- Contract creation wizard (modal) -->
    <ContractWizard v-if="showWizard" @close="closeWizard" />
  </div>
</template>
