<script setup lang="ts">
/**
 * MissionCard.vue — Compact display card for an active or completed mission.
 *
 * Story 16.5: Shows mission type, target sector, task force ship names,
 * current phase (Travel / Execution / Return / Completed), turns remaining,
 * BP/turn cost, and an expandable mission report (outcome, losses, rounds summary).
 *
 * "Task Force has not returned" is shown for worst-case (missing) outcomes.
 */
import { ref, computed } from 'vue'
import type { Mission } from '../../types/mission'
import { MissionPhase, MissionType } from '../../types/common'
import type { Ship } from '../../types/ship'

const props = defineProps<{
  mission: Mission
  /** Ship name lookup — avoids store import in leaf component. */
  shipNames: Map<string, string>
  /** Target sector name for display. */
  targetSectorName: string
}>()

const expanded = ref(false)

// ─── Phase helpers ────────────────────────────────────────────────────────────

const phaseLabel = computed(() => {
  switch (props.mission.phase) {
    case MissionPhase.Travel:     return 'Travel'
    case MissionPhase.Execution:  return 'Execution'
    case MissionPhase.Return:     return 'Return'
    case MissionPhase.Completed:  return 'Completed'
  }
})

const phaseColor = computed(() => {
  switch (props.mission.phase) {
    case MissionPhase.Travel:     return 'text-sky-400'
    case MissionPhase.Execution:  return 'text-amber-400'
    case MissionPhase.Return:     return 'text-emerald-400'
    case MissionPhase.Completed:  return 'text-zinc-400'
  }
})

const turnsRemaining = computed<number | null>(() => {
  switch (props.mission.phase) {
    case MissionPhase.Travel:    return props.mission.travelTurnsRemaining
    case MissionPhase.Execution: return props.mission.executionTurnsRemaining
    case MissionPhase.Return:    return props.mission.returnTurnsRemaining
    case MissionPhase.Completed: return null
  }
})

// ─── Mission type badge ───────────────────────────────────────────────────────

const typeBadgeColor: Record<MissionType, string> = {
  [MissionType.Assault]:       'bg-red-900/60 text-red-300',
  [MissionType.Defense]:       'bg-amber-900/60 text-amber-300',
  [MissionType.Escort]:        'bg-sky-900/60 text-sky-300',
  [MissionType.Rescue]:        'bg-emerald-900/60 text-emerald-300',
  [MissionType.Investigation]: 'bg-violet-900/60 text-violet-300',
}

// ─── Report helpers ───────────────────────────────────────────────────────────

const isMissing = computed(() => props.mission.report?.outcome === 'missing')

const outcomeLabel = computed(() => {
  if (!props.mission.report) return null
  switch (props.mission.report.outcome) {
    case 'success':         return 'Success'
    case 'partial_success': return 'Partial Success'
    case 'failure':         return 'Failure'
    case 'missing':         return 'Task Force Has Not Returned'
  }
})

const outcomeColor = computed(() => {
  if (!props.mission.report) return ''
  switch (props.mission.report.outcome) {
    case 'success':         return 'text-emerald-400'
    case 'partial_success': return 'text-amber-400'
    case 'failure':         return 'text-red-400'
    case 'missing':         return 'text-red-300'
  }
})

const shipNameList = computed(() =>
  props.mission.taskForce.shipIds
    .map((id) => props.shipNames.get(id) ?? id)
    .join(', '),
)
</script>

<template>
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/60 overflow-hidden">
    <!-- ── Summary row ── -->
    <button
      class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
      @click="expanded = !expanded"
    >
      <!-- Type badge -->
      <span
        :class="['px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide', typeBadgeColor[mission.type]]"
      >
        {{ mission.type }}
      </span>

      <!-- Target -->
      <span class="text-sm text-white font-medium truncate flex-1">
        {{ targetSectorName }}
      </span>

      <!-- Phase -->
      <span :class="['text-xs font-semibold', phaseColor]">{{ phaseLabel }}</span>

      <!-- Turns remaining -->
      <span v-if="turnsRemaining !== null" class="text-xs text-zinc-400 tabular-nums">
        {{ turnsRemaining }}T left
      </span>

      <!-- Cost -->
      <span class="text-xs text-zinc-500 tabular-nums">{{ mission.bpPerTurn }} BP/turn</span>

      <!-- Expand chevron -->
      <svg
        class="w-4 h-4 text-zinc-500 transition-transform duration-150 flex-shrink-0"
        :class="expanded ? 'rotate-180' : ''"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <!-- ── Expanded detail ── -->
    <div v-if="expanded" class="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-3">
      <!-- Task force ships -->
      <div>
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">Task Force</p>
        <p class="text-xs text-zinc-300">{{ shipNameList }}</p>
      </div>

      <!-- Phase progress -->
      <div>
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">Progress</p>
        <div class="flex gap-4 text-xs text-zinc-400">
          <span>Travel: {{ mission.travelTurnsRemaining }}T</span>
          <span>Execution: {{ mission.executionTurnsRemaining }}T</span>
          <span>Return: {{ mission.returnTurnsRemaining }}T</span>
        </div>
      </div>

      <!-- Mission report (if completed) -->
      <template v-if="mission.report">
        <div class="border-t border-zinc-800 pt-3">
          <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Mission Report</p>

          <!-- Worst-case banner -->
          <p v-if="isMissing" class="text-sm font-semibold text-red-300 mb-2">
            Task Force Has Not Returned
          </p>

          <p v-else :class="['text-xs font-semibold mb-1', outcomeColor]">{{ outcomeLabel }}</p>

          <p class="text-xs text-zinc-400 mb-2">{{ mission.report.summary }}</p>

          <!-- Losses -->
          <div v-if="mission.report.shipsLost.length > 0" class="text-xs text-red-400">
            Lost: {{ mission.report.shipsLost.map((id) => shipNames.get(id) ?? id).join(', ') }}
          </div>

          <!-- Combat summary -->
          <p v-if="mission.report.combatSummary" class="text-xs text-zinc-500 mt-1">
            {{ mission.report.combatSummary }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
