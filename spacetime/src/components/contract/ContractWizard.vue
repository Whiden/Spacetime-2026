<script setup lang="ts">
/**
 * ContractWizard — 4-step modal for creating a new contract.
 *
 * Step 1: Select contract type (grid of type cards)
 * Step 2: Select target (sector / planet / colony / sector pair by type)
 *         For Colonization: also select colony type
 *         For TradeRoute: select sector A then sector B (adjacent)
 * Step 3: Select corporation (CorpSelector) — or kickstart a new one
 * Step 4: Review cost + confirm
 *
 * Emits 'close' when the wizard is dismissed or after successful creation.
 */
import { computed, onMounted } from 'vue'
import { ContractType, ColonyType } from '../../types/common'
import type { SectorId } from '../../types/common'
import { CONTRACT_TYPE_DEFINITIONS } from '../../data/contracts'
import { COLONY_TYPE_DEFINITIONS } from '../../data/colony-types'
import { useContractCreation } from '../../composables/useContractCreation'
import CorpSelector from './CorpSelector.vue'

const props = withDefaults(defineProps<{
  /** Pre-selected contract type (e.g., from Explore quick action). */
  presetType?: ContractType | null
  /** Pre-selected sector ID for Exploration contracts. */
  presetSectorId?: SectorId | null
}>(), {
  presetType: null,
  presetSectorId: null,
})

const emit = defineEmits<{
  close: []
}>()

const wizard = useContractCreation()

// Apply preset values on open (skip to step 2 if type + target are pre-filled)
onMounted(() => {
  if (props.presetType) {
    wizard.selectType(props.presetType)
    if (props.presetSectorId && props.presetType === ContractType.Exploration) {
      wizard.selectTarget(props.presetSectorId)
      // Skip to step 2 (target is pre-selected, let user confirm or change)
      wizard.nextStep()
    }
  }
})

// ─── Contract Type Display ────────────────────────────────────────────────────

const contractTypeCards = computed(() =>
  wizard.contractTypes.map((type) => ({
    type,
    def: CONTRACT_TYPE_DEFINITIONS[type],
  })),
)

/** Icon/color accent per contract type. */
const typeAccent: Record<ContractType, string> = {
  [ContractType.Exploration]: 'border-emerald-500/40 hover:border-emerald-500',
  [ContractType.GroundSurvey]: 'border-teal-500/40 hover:border-teal-500',
  [ContractType.Colonization]: 'border-amber-500/40 hover:border-amber-500',
  [ContractType.ShipCommission]: 'border-sky-500/40 hover:border-sky-500',
  [ContractType.TradeRoute]: 'border-violet-500/40 hover:border-violet-500',
}

const typeSelectedAccent: Record<ContractType, string> = {
  [ContractType.Exploration]: 'border-emerald-500 bg-emerald-500/10',
  [ContractType.GroundSurvey]: 'border-teal-500 bg-teal-500/10',
  [ContractType.Colonization]: 'border-amber-500 bg-amber-500/10',
  [ContractType.ShipCommission]: 'border-sky-500 bg-sky-500/10',
  [ContractType.TradeRoute]: 'border-violet-500 bg-violet-500/10',
}

const typeCostBadge: Record<ContractType, string> = {
  [ContractType.Exploration]: '2 BP/turn',
  [ContractType.GroundSurvey]: '1 BP/turn',
  [ContractType.Colonization]: '2-3 BP/turn',
  [ContractType.ShipCommission]: '1 BP/turn',
  [ContractType.TradeRoute]: '2 BP/turn · Ongoing',
}

// ─── Step Labels ─────────────────────────────────────────────────────────────

const stepLabels = ['Type', 'Target', 'Corporation', 'Confirm']

// ─── Target Step Helpers ──────────────────────────────────────────────────────

/** Title for the target selection step based on the selected contract type. */
const targetStepTitle = computed(() => {
  switch (wizard.selectedType.value) {
    case ContractType.Exploration: return 'Select Sector to Explore'
    case ContractType.GroundSurvey: return 'Select Planet to Survey'
    case ContractType.Colonization: return 'Select Planet to Colonize'
    case ContractType.ShipCommission: return 'Select Colony Shipyard'
    case ContractType.TradeRoute: return 'Select Trade Route Sectors'
    default: return 'Select Target'
  }
})

/** Whether a sector B selection is needed (trade route step 2 sub-step). */
const needsSectorB = computed(
  () => wizard.selectedType.value === ContractType.TradeRoute && !!wizard.selectedTarget.value,
)

// ─── Colony Type Step Helpers ─────────────────────────────────────────────────

const colonizationTypeAccent: Record<ColonyType, string> = {
  [ColonyType.FrontierColony]: 'border-amber-500/40 hover:border-amber-500',
  [ColonyType.MiningOutpost]: 'border-slate-500/40 hover:border-slate-500',
  [ColonyType.ScienceOutpost]: 'border-violet-500/40 hover:border-violet-500',
  [ColonyType.MilitaryOutpost]: 'border-red-500/40 hover:border-red-500',
}
const colonizationTypeSelectedAccent: Record<ColonyType, string> = {
  [ColonyType.FrontierColony]: 'border-amber-500 bg-amber-500/10',
  [ColonyType.MiningOutpost]: 'border-slate-500 bg-slate-500/10',
  [ColonyType.ScienceOutpost]: 'border-violet-500 bg-violet-500/10',
  [ColonyType.MilitaryOutpost]: 'border-red-500 bg-red-500/10',
}

// ─── Actions ─────────────────────────────────────────────────────────────────

function handleConfirm() {
  const ok = wizard.submit()
  if (ok) {
    wizard.reset()
    emit('close')
  }
}

function handleClose() {
  wizard.reset()
  emit('close')
}

// ─── Net BP color ─────────────────────────────────────────────────────────────

function netBpClass(net: number): string {
  if (net < 0) return 'text-red-400'
  if (net <= 2) return 'text-yellow-400'
  return 'text-emerald-400'
}
</script>

<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="handleClose"
  >
    <!-- Modal -->
    <div class="relative w-full max-w-2xl mx-4 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
        <h2 class="text-base font-semibold text-white">New Contract</h2>
        <button
          class="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
          @click="handleClose"
        >
          ✕
        </button>
      </div>

      <!-- Step indicators -->
      <div class="flex items-center gap-0 px-5 py-3 border-b border-zinc-800 shrink-0">
        <div
          v-for="(label, idx) in stepLabels"
          :key="idx"
          class="flex items-center"
        >
          <!-- Step pill -->
          <button
            class="flex items-center gap-1.5 text-xs transition-colors"
            :class="
              wizard.currentStep.value === idx + 1
                ? 'text-white font-semibold'
                : idx + 1 < wizard.currentStep.value
                  ? 'text-indigo-400 hover:text-indigo-300'
                  : 'text-zinc-600 cursor-default'
            "
            :disabled="idx + 1 >= wizard.currentStep.value"
            @click="wizard.goToStep((idx + 1) as 1 | 2 | 3 | 4)"
          >
            <span
              class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border"
              :class="
                wizard.currentStep.value === idx + 1
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                  : idx + 1 < wizard.currentStep.value
                    ? 'border-indigo-600/50 bg-indigo-600/10 text-indigo-400'
                    : 'border-zinc-700 text-zinc-600'
              "
            >
              {{ idx + 1 }}
            </span>
            {{ label }}
          </button>
          <!-- Separator -->
          <span v-if="idx < stepLabels.length - 1" class="mx-2 text-zinc-700 text-xs">›</span>
        </div>
      </div>

      <!-- Step content (scrollable) -->
      <div class="flex-1 overflow-y-auto px-5 py-4 min-h-0">

        <!-- ─── Step 1: Contract Type ────────────────────────────────────── -->
        <div v-if="wizard.currentStep.value === 1">
          <p class="text-xs text-zinc-500 mb-3">Choose the type of contract to issue.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              v-for="{ type, def } in contractTypeCards"
              :key="type"
              class="text-left rounded-lg border px-3 py-3 transition-colors"
              :class="
                wizard.selectedType.value === type
                  ? typeSelectedAccent[type]
                  : 'border-zinc-700 bg-zinc-900/60 ' + typeAccent[type]
              "
              @click="wizard.selectType(type)"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-white">{{ def.name }}</span>
                <span class="text-[10px] text-zinc-500">{{ typeCostBadge[type] }}</span>
              </div>
              <p class="text-[11px] text-zinc-400 leading-relaxed">{{ def.description }}</p>
            </button>
          </div>
        </div>

        <!-- ─── Step 2: Target ──────────────────────────────────────────── -->
        <div v-else-if="wizard.currentStep.value === 2">
          <p class="text-xs text-zinc-500 mb-3">{{ targetStepTitle }}</p>

          <!-- Trade route: sector A then sector B -->
          <template v-if="wizard.selectedType.value === ContractType.TradeRoute">
            <!-- Sector A -->
            <p class="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-2">
              Sector A
            </p>
            <div class="space-y-1 mb-4">
              <button
                v-for="opt in wizard.targetOptions.value"
                :key="opt.id"
                class="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border transition-colors"
                :class="
                  wizard.selectedTarget.value?.type === 'sector' &&
                  wizard.selectedTarget.value.sectorId === opt.id
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-600'
                "
                @click="wizard.selectTarget(opt.id)"
              >
                <span class="text-sm text-white">{{ opt.label }}</span>
                <span class="text-[10px] text-zinc-500">{{ opt.sublabel }}</span>
              </button>
            </div>

            <!-- Sector B (only after A selected) -->
            <template v-if="needsSectorB">
              <p class="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-2">
                Sector B (must be adjacent)
              </p>
              <div v-if="wizard.sectorBOptions.value.length > 0" class="space-y-1">
                <button
                  v-for="opt in wizard.sectorBOptions.value"
                  :key="opt.id"
                  class="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border transition-colors"
                  :class="
                    wizard.selectedSectorB.value === opt.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-600'
                  "
                  @click="wizard.selectSectorB(opt.id as any)"
                >
                  <span class="text-sm text-white">{{ opt.label }}</span>
                  <span class="text-[10px] text-zinc-500">{{ opt.sublabel }}</span>
                </button>
              </div>
              <p v-else class="text-xs text-zinc-500 italic">
                No adjacent sectors available.
              </p>
            </template>
          </template>

          <!-- Colonization: planet + colony type -->
          <template v-else-if="wizard.selectedType.value === ContractType.Colonization">
            <!-- Planet -->
            <div class="space-y-1 mb-4">
              <button
                v-for="opt in wizard.targetOptions.value"
                :key="opt.id"
                class="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border transition-colors"
                :class="
                  wizard.selectedTarget.value?.type === 'planet' &&
                  wizard.selectedTarget.value.planetId === opt.id
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-600'
                "
                @click="wizard.selectTarget(opt.id)"
              >
                <span class="text-sm text-white">{{ opt.label }}</span>
                <span class="text-[10px] text-zinc-500">{{ opt.sublabel }}</span>
              </button>
              <p v-if="wizard.targetOptions.value.length === 0" class="text-xs text-zinc-500 italic py-2">
                No suitable planets available. Explore and accept planets first.
              </p>
            </div>

            <!-- Colony type (shown once planet selected) -->
            <template v-if="wizard.selectedTarget.value">
              <p class="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-2">
                Colony Type
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="{ type, def } in wizard.colonyTypeOptions"
                  :key="type"
                  class="text-left rounded-lg border px-3 py-2.5 transition-colors"
                  :class="
                    wizard.selectedColonyType.value === type
                      ? colonizationTypeSelectedAccent[type]
                      : 'border-zinc-700 bg-zinc-900/60 ' + colonizationTypeAccent[type]
                  "
                  @click="wizard.selectColonyType(type)"
                >
                  <div class="flex items-center justify-between mb-0.5">
                    <span class="text-sm font-medium text-white">{{ def.name }}</span>
                    <span class="text-[10px] text-zinc-500">{{ def.bpPerTurn }} BP/t · {{ def.durationTurns }}t</span>
                  </div>
                  <p class="text-[11px] text-zinc-400">{{ def.description }}</p>
                </button>
              </div>
            </template>
          </template>

          <!-- Standard single-target selection -->
          <template v-else>
            <div class="space-y-1">
              <button
                v-for="opt in wizard.targetOptions.value"
                :key="opt.id"
                class="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border transition-colors"
                :class="
                  (wizard.selectedTarget.value?.type === 'sector' && (wizard.selectedTarget.value as any).sectorId === opt.id) ||
                  (wizard.selectedTarget.value?.type === 'planet' && (wizard.selectedTarget.value as any).planetId === opt.id) ||
                  (wizard.selectedTarget.value?.type === 'colony' && (wizard.selectedTarget.value as any).colonyId === opt.id)
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-600'
                "
                @click="wizard.selectTarget(opt.id)"
              >
                <span class="text-sm text-white">{{ opt.label }}</span>
                <span class="text-[10px] text-zinc-500">{{ opt.sublabel }}</span>
              </button>
              <p v-if="wizard.targetOptions.value.length === 0" class="text-xs text-zinc-500 italic py-2">
                No targets available for this contract type.
              </p>
            </div>
          </template>
        </div>

        <!-- ─── Step 3: Corporation ─────────────────────────────────────── -->
        <div v-else-if="wizard.currentStep.value === 3">
          <p class="text-xs text-zinc-500 mb-3">
            Choose an eligible corporation to assign this contract.
          </p>
          <CorpSelector
            :corps="wizard.eligibleCorps.value"
            :selected-corp-id="wizard.selectedCorpId.value"
            :can-kickstart="true"
            @select="wizard.selectCorp"
            @kickstart="wizard.kickstartCorp"
          />
        </div>

        <!-- ─── Step 4: Confirm ─────────────────────────────────────────── -->
        <div v-else-if="wizard.currentStep.value === 4">
          <p class="text-xs text-zinc-500 mb-4">Review the contract details before confirming.</p>

          <div class="rounded-lg border border-zinc-700 bg-zinc-900/80 divide-y divide-zinc-800">

            <!-- Contract type -->
            <div class="flex items-center justify-between px-4 py-2.5">
              <span class="text-xs text-zinc-500">Contract Type</span>
              <span class="text-sm font-medium text-white">
                {{ wizard.selectedType.value ? CONTRACT_TYPE_DEFINITIONS[wizard.selectedType.value].name : '—' }}
              </span>
            </div>

            <!-- Corporation -->
            <div class="flex items-center justify-between px-4 py-2.5">
              <span class="text-xs text-zinc-500">Corporation</span>
              <span class="text-sm font-medium text-white">
                {{ wizard.selectedCorp.value?.name ?? '—' }}
                <span class="text-zinc-500 text-xs ml-1">
                  (Lv {{ wizard.selectedCorp.value?.level }})
                </span>
              </span>
            </div>

            <!-- Colonization type (if applicable) -->
            <div
              v-if="wizard.selectedType.value === ContractType.Colonization && wizard.selectedColonyType.value"
              class="flex items-center justify-between px-4 py-2.5"
            >
              <span class="text-xs text-zinc-500">Colony Type</span>
              <span class="text-sm font-medium text-white">
                {{ COLONY_TYPE_DEFINITIONS[wizard.selectedColonyType.value].name }}
              </span>
            </div>

            <!-- BP/turn cost -->
            <div class="flex items-center justify-between px-4 py-2.5">
              <span class="text-xs text-zinc-500">Cost</span>
              <span class="text-sm font-medium text-amber-400">
                {{ wizard.previewBpPerTurn.value }} BP/turn
              </span>
            </div>

            <!-- Duration -->
            <div class="flex items-center justify-between px-4 py-2.5">
              <span class="text-xs text-zinc-500">Duration</span>
              <span class="text-sm font-medium text-white">
                {{ wizard.previewDuration.value === 'Ongoing' ? 'Ongoing' : `${wizard.previewDuration.value} turns` }}
              </span>
            </div>

            <!-- Total cost -->
            <div class="flex items-center justify-between px-4 py-2.5">
              <span class="text-xs text-zinc-500">Total Cost</span>
              <span class="text-sm font-medium text-white">
                {{ wizard.previewTotalCost.value === '∞' ? '∞' : `${wizard.previewTotalCost.value} BP` }}
              </span>
            </div>

            <!-- Budget impact -->
            <div class="flex items-center justify-between px-4 py-2.5">
              <span class="text-xs text-zinc-500">Net BP/turn After</span>
              <span
                class="text-sm font-medium"
                :class="netBpClass(wizard.previewNetBP.value)"
              >
                {{ wizard.previewNetBP.value >= 0 ? `+${wizard.previewNetBP.value}` : wizard.previewNetBP.value }}
              </span>
            </div>
          </div>

          <!-- Error message -->
          <div
            v-if="wizard.errorMessage.value"
            class="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <p class="text-xs text-red-400">{{ wizard.errorMessage.value }}</p>
          </div>
        </div>
      </div>

      <!-- Footer: navigation buttons -->
      <div class="flex items-center justify-between px-5 py-4 border-t border-zinc-800 shrink-0">
        <button
          v-if="wizard.currentStep.value > 1"
          class="px-3 py-1.5 rounded text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          @click="wizard.prevStep()"
        >
          ← Back
        </button>
        <button
          v-else
          class="px-3 py-1.5 rounded text-xs font-medium text-zinc-600"
          disabled
        >
          ← Back
        </button>

        <!-- Next or Confirm -->
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 rounded text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            @click="handleClose"
          >
            Cancel
          </button>
          <button
            v-if="wizard.currentStep.value < 4"
            class="px-4 py-1.5 rounded text-xs font-medium transition-colors"
            :class="
              wizard.canAdvance.value
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            "
            :disabled="!wizard.canAdvance.value"
            @click="wizard.nextStep()"
          >
            Next →
          </button>
          <button
            v-else
            class="px-4 py-1.5 rounded text-xs font-medium transition-colors"
            :class="
              !wizard.submitting.value
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            "
            :disabled="wizard.submitting.value"
            @click="handleConfirm"
          >
            {{ wizard.submitting.value ? 'Creating…' : 'Create Contract' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
