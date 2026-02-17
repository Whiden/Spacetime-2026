<script setup lang="ts">
/**
 * CorpHistory — Contract history for a corporation.
 *
 * Shows all contracts (active and completed) assigned to this corp,
 * sorted by most recent first.
 *
 * TODO (Story 11.1): Display capital action log (investments, level ups, acquisitions).
 */
import { computed } from 'vue'
import type { Corporation } from '../../types/corporation'
import type { Contract } from '../../types/contract'
import { useContractStore } from '../../stores/contract.store'
import { ContractStatus } from '../../types/common'

const props = defineProps<{
  corp: Corporation
}>()

const contractStore = useContractStore()

const corpContracts = computed(() => contractStore.contractsByCorp(props.corp.id))

const activeContracts = computed(() =>
  corpContracts.value.filter((c) => c.status === ContractStatus.Active),
)

const completedContracts = computed(() =>
  corpContracts.value
    .filter((c) => c.status === ContractStatus.Completed)
    .sort((a, b) => (b.completedTurn ?? 0) - (a.completedTurn ?? 0)),
)

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  Exploration: 'Exploration',
  GroundSurvey: 'Ground Survey',
  Colonization: 'Colonization',
  ShipCommission: 'Ship Commission',
  TradeRoute: 'Trade Route',
}

function contractLabel(type: string): string {
  return CONTRACT_TYPE_LABELS[type] ?? type
}

function targetLabel(contract: Contract): string {
  if (contract.target.type === 'sector') return 'Sector'
  if (contract.target.type === 'planet') return 'Planet'
  if (contract.target.type === 'colony') return 'Colony'
  if (contract.target.type === 'sector_pair') return 'Trade Route'
  return ''
}
</script>

<template>
  <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div class="px-4 py-3 border-b border-zinc-800">
      <h3 class="text-sm font-medium text-white">Contract History</h3>
    </div>

    <!-- Empty state -->
    <div v-if="corpContracts.length === 0" class="px-4 py-6 text-center">
      <p class="text-xs text-zinc-500">No contract history yet.</p>
      <p class="text-[10px] text-zinc-600 mt-1">Completed contracts will appear here.</p>
    </div>

    <div v-else class="divide-y divide-zinc-800">
      <!-- Active contracts -->
      <div v-if="activeContracts.length > 0" class="px-4 py-3">
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Active</p>
        <div class="space-y-2">
          <div
            v-for="contract in activeContracts"
            :key="contract.id"
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              <span class="text-xs text-zinc-300">
                {{ contractLabel(contract.type) }}
                <span class="text-zinc-500"> · {{ targetLabel(contract) }}</span>
              </span>
            </div>
            <div class="flex items-center gap-3 text-[10px] text-zinc-500">
              <span>{{ contract.bpPerTurn }} BP/turn</span>
              <span>{{ contract.turnsRemaining }}t left</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Completed contracts -->
      <div v-if="completedContracts.length > 0" class="px-4 py-3">
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Completed</p>
        <div class="space-y-2">
          <div
            v-for="contract in completedContracts"
            :key="contract.id"
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span class="text-xs text-zinc-400">
                {{ contractLabel(contract.type) }}
                <span class="text-zinc-600"> · {{ targetLabel(contract) }}</span>
              </span>
            </div>
            <div class="text-[10px] text-zinc-600">
              Turn {{ contract.completedTurn }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
