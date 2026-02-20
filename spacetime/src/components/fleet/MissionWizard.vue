<script setup lang="ts">
/**
 * MissionWizard.vue — 4-step mission creation wizard.
 *
 * Story 16.5:
 *   Step 1: Select mission type (with description)
 *   Step 2: Select target sector
 *   Step 3: Multi-select ships from available fleet; shows relevant ability score
 *   Step 4: Review cost/risk (task force ability total) and confirm
 *
 * Emits 'close' on confirm or cancel.
 */
import { MissionType } from '../../types/common'
import type { SectorId, ShipId } from '../../types/common'
import { useMissionCreation, MISSION_ABILITY_LABEL } from '../../composables/useMissionCreation'

const emit = defineEmits<{ (e: 'close'): void }>()

const wizard = useMissionCreation(() => emit('close'))

// ─── Mission type descriptions ─────────────────────────────────────────────────

const MISSION_DESCRIPTIONS: Record<MissionType, { label: string; description: string; ability: string }> = {
  [MissionType.Assault]:       { label: 'Assault',       description: 'Attack an enemy position. High risk, high reward.', ability: 'Fight' },
  [MissionType.Defense]:       { label: 'Defense',        description: 'Defend a sector from incoming threats.',            ability: 'Fight' },
  [MissionType.Escort]:        { label: 'Escort',         description: 'Escort a convoy through hostile space.',            ability: 'Support' },
  [MissionType.Rescue]:        { label: 'Rescue',         description: 'Extract personnel or assets from danger.',          ability: 'Investigation' },
  [MissionType.Investigation]: { label: 'Investigation',  description: 'Gather intelligence on a target sector.',           ability: 'Investigation' },
}

const ABILITY_COLOR: Record<string, string> = {
  Fight:         'text-red-400',
  Investigation: 'text-sky-400',
  Support:       'text-emerald-400',
}

function abilityColor(ability: string): string {
  return ABILITY_COLOR[ability] ?? 'text-zinc-400'
}

// ─── Ship ability score helper ─────────────────────────────────────────────────

function shipAbilityScore(ship: import('../../types/ship').Ship): number {
  if (!wizard.selectedType.value) return 0
  const key = MISSION_ABILITY_LABEL[wizard.selectedType.value].toLowerCase() as 'fight' | 'investigation' | 'support'
  return ship.abilities[key]
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-lg mx-4 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">

      <!-- ── Header ── -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 class="text-base font-semibold text-white">New Mission</h2>
        <button
          class="text-zinc-500 hover:text-zinc-300 transition-colors"
          @click="$emit('close')"
        >
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
          </svg>
        </button>
      </div>

      <!-- ── Step indicators ── -->
      <div class="flex gap-0 border-b border-zinc-800">
        <div
          v-for="n in [1, 2, 3, 4]"
          :key="n"
          :class="[
            'flex-1 py-2 text-center text-[11px] font-semibold',
            wizard.step.value === n ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-500',
          ]"
        >
          {{ ['Type', 'Target', 'Ships', 'Review'][n - 1] }}
        </div>
      </div>

      <!-- ── Step content ── -->
      <div class="p-5 space-y-3 max-h-[60vh] overflow-y-auto">

        <!-- Step 1: Select mission type -->
        <template v-if="wizard.step.value === 1">
          <p class="text-xs text-zinc-400 mb-3">Choose a mission type to deploy your task force.</p>
          <div class="space-y-2">
            <button
              v-for="(info, type) in MISSION_DESCRIPTIONS"
              :key="type"
              :class="[
                'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                wizard.selectedType.value === type
                  ? 'border-indigo-500 bg-indigo-900/30'
                  : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600',
              ]"
              @click="wizard.selectType(type as MissionType)"
            >
              <div class="flex items-center justify-between mb-0.5">
                <span class="text-sm font-semibold text-white">{{ info.label }}</span>
                <span :class="['text-[11px] font-semibold', abilityColor(info.ability)]">
                  {{ info.ability }}
                </span>
              </div>
              <p class="text-xs text-zinc-400">{{ info.description }}</p>
            </button>
          </div>
        </template>

        <!-- Step 2: Select target sector -->
        <template v-if="wizard.step.value === 2">
          <p class="text-xs text-zinc-400 mb-3">Select the target sector for this mission.</p>
          <div class="space-y-1.5">
            <button
              v-for="sector in wizard.allSectors.value"
              :key="sector.id"
              :class="[
                'w-full text-left px-4 py-2.5 rounded-lg border transition-colors',
                wizard.selectedSector.value === sector.id
                  ? 'border-indigo-500 bg-indigo-900/30'
                  : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600',
              ]"
              @click="wizard.selectSector(sector.id as SectorId)"
            >
              <span class="text-sm text-white">{{ sector.name }}</span>
              <span class="text-xs text-zinc-500 ml-2">Threat ×{{ sector.threatModifier.toFixed(1) }}</span>
            </button>
          </div>
        </template>

        <!-- Step 3: Select ships -->
        <template v-if="wizard.step.value === 3">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-zinc-400">Select ships for the task force. Multiple ships allowed.</p>
            <span
              v-if="wizard.selectedType.value"
              :class="['text-[11px] font-semibold', abilityColor(wizard.abilityLabel.value!)]"
            >
              {{ wizard.abilityLabel.value }} score shown
            </span>
          </div>
          <div v-if="wizard.availableShips.value.length === 0" class="text-xs text-zinc-500 text-center py-6">
            No ships available. Commission ships and ensure they are Stationed.
          </div>
          <div v-else class="space-y-1.5">
            <button
              v-for="ship in wizard.availableShips.value"
              :key="ship.id"
              :class="[
                'w-full text-left px-4 py-2.5 rounded-lg border transition-colors',
                wizard.selectedShipIds.value.has(ship.id as ShipId)
                  ? 'border-indigo-500 bg-indigo-900/30'
                  : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600',
              ]"
              @click="wizard.toggleShip(ship.id as ShipId)"
            >
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-sm text-white font-medium">{{ ship.name }}</span>
                  <span class="text-xs text-zinc-500 ml-2">{{ ship.role }} · Size {{ ship.primaryStats.size }}</span>
                </div>
                <div class="flex items-center gap-3 text-xs">
                  <span :class="abilityColor(wizard.abilityLabel.value ?? '')">
                    {{ wizard.abilityLabel.value }}: {{ shipAbilityScore(ship) }}
                  </span>
                  <span class="text-zinc-500">{{ ship.captain.name }} ({{ ship.captain.experience }})</span>
                </div>
              </div>
            </button>
          </div>
        </template>

        <!-- Step 4: Review -->
        <template v-if="wizard.step.value === 4">
          <p class="text-xs text-zinc-400 mb-4">Review the mission details before confirming.</p>

          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-zinc-400">Mission type</span>
              <span class="text-white font-semibold">{{ wizard.selectedType.value }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-zinc-400">Target sector</span>
              <span class="text-white">
                {{ wizard.allSectors.value.find(s => s.id === wizard.selectedSector.value)?.name ?? wizard.selectedSector.value }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-zinc-400">Task force</span>
              <span class="text-white">{{ wizard.selectedShips.value.length }} ship(s)</span>
            </div>

            <!-- Task force ships list -->
            <div class="bg-zinc-800/50 rounded-lg p-3 space-y-1.5">
              <div
                v-for="ship in wizard.selectedShips.value"
                :key="ship.id"
                class="flex items-center justify-between text-xs"
              >
                <span class="text-zinc-300">{{ ship.name }}</span>
                <span :class="abilityColor(wizard.abilityLabel.value ?? '')">
                  {{ wizard.abilityLabel.value }}: {{ shipAbilityScore(ship) }}
                </span>
              </div>
            </div>

            <!-- Risk / ability total -->
            <div class="border-t border-zinc-700 pt-3 flex justify-between items-center">
              <span class="text-zinc-400">
                Task force
                <span :class="abilityColor(wizard.abilityLabel.value ?? '')">{{ wizard.abilityLabel.value }}</span>
              </span>
              <span :class="['font-semibold text-base', abilityColor(wizard.abilityLabel.value ?? '')]">
                {{ wizard.taskForceAbility.value }}
              </span>
            </div>

            <div class="flex justify-between items-center">
              <span class="text-zinc-400">Estimated cost</span>
              <span class="text-white font-semibold">{{ wizard.estimatedCost.value }} BP/turn</span>
            </div>
          </div>

          <!-- Error message -->
          <p v-if="wizard.errorMessage.value" class="mt-3 text-xs text-red-400">
            {{ wizard.errorMessage.value }}
          </p>
        </template>

      </div>

      <!-- ── Footer ── -->
      <div class="flex items-center justify-between gap-3 px-5 py-4 border-t border-zinc-800 bg-zinc-900/50">
        <button
          class="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          @click="wizard.step.value > 1 ? wizard.back() : $emit('close')"
        >
          {{ wizard.step.value > 1 ? 'Back' : 'Cancel' }}
        </button>

        <button
          v-if="wizard.step.value < 4"
          :disabled="!wizard.canAdvance()"
          :class="[
            'px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
            wizard.canAdvance()
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
          ]"
          @click="wizard.next()"
        >
          Next
        </button>

        <button
          v-else
          :disabled="wizard.submitting.value"
          :class="[
            'px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
            !wizard.submitting.value
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
          ]"
          @click="wizard.confirm()"
        >
          {{ wizard.submitting.value ? 'Sending…' : 'Send Mission' }}
        </button>
      </div>

    </div>
  </div>
</template>
