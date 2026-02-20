<script setup lang="ts">
/**
 * ShipCard.vue — Compact ship summary card for fleet list view.
 *
 * Displays: name, role, size with label, stat bars (Poor→Exceptional),
 * ability scores (Fight/Investigation/Support), captain name + experience,
 * condition bar, status badge, and applied schematics.
 *
 * Expandable to show full stat breakdown:
 *   "Base 6 + Tech 2 + Corp ×1.0 + Schematic +2 + Random +1 = 11 (Exceptional)"
 * Plus: schematics list, captain service record, build turn, owning corp.
 *
 * TODO (Story 16.1): Clicking a stationed ship opens mission creation wizard.
 */
import { ref, computed } from 'vue'
import type { Ship } from '../../types/ship'
import { ShipStatus, SizeVariant } from '../../types/common'

const props = defineProps<{
  ship: Ship
  /** Optional corp name for display (passed from parent to avoid store import in component). */
  corpName?: string
  /** Optional sector name for display context. */
  sectorName?: string
}>()

const expanded = ref(false)

// ─── Stat label helpers ───────────────────────────────────────────────────────

/** Maps a stat value (1–12+) to a descriptive quality label. */
function statLabel(value: number): string {
  if (value <= 2) return 'Poor'
  if (value <= 5) return 'Average'
  if (value <= 8) return 'Good'
  if (value <= 11) return 'Excellent'
  return 'Exceptional'
}

function statLabelColor(value: number): string {
  if (value <= 2) return 'text-red-400'
  if (value <= 5) return 'text-zinc-400'
  if (value <= 8) return 'text-sky-400'
  if (value <= 11) return 'text-emerald-400'
  return 'text-amber-400'
}

/** Stat bar fill percentage, capped at 100%. Max meaningful stat ≈ 15. */
function statBarWidth(value: number): number {
  return Math.min(100, Math.round((value / 15) * 100))
}

function statBarColor(value: number): string {
  if (value <= 2) return 'bg-red-500'
  if (value <= 5) return 'bg-zinc-500'
  if (value <= 8) return 'bg-sky-500'
  if (value <= 11) return 'bg-emerald-500'
  return 'bg-amber-500'
}

// ─── Size label ───────────────────────────────────────────────────────────────

const sizeLabel = computed(() => {
  const map: Record<string, string> = {
    [SizeVariant.Light]: 'Light',
    [SizeVariant.Standard]: 'Standard',
    [SizeVariant.Heavy]: 'Heavy',
  }
  return map[props.ship.sizeVariant] ?? props.ship.sizeVariant
})

// ─── Status badge ─────────────────────────────────────────────────────────────

const statusColor = computed(() => {
  switch (props.ship.status) {
    case ShipStatus.Stationed: return 'bg-emerald-900/60 text-emerald-400 border-emerald-800'
    case ShipStatus.OnMission: return 'bg-indigo-900/60 text-indigo-400 border-indigo-800'
    case ShipStatus.UnderRepair: return 'bg-amber-900/60 text-amber-400 border-amber-800'
    case ShipStatus.UnderConstruction: return 'bg-zinc-800 text-zinc-400 border-zinc-700'
  }
})

const statusLabel = computed(() => {
  switch (props.ship.status) {
    case ShipStatus.Stationed: return 'Stationed'
    case ShipStatus.OnMission: return 'On Mission'
    case ShipStatus.UnderRepair: return 'Under Repair'
    case ShipStatus.UnderConstruction: return 'Under Construction'
  }
})

// ─── Experience badge ─────────────────────────────────────────────────────────

const experienceColor = computed(() => {
  switch (props.ship.captain.experience) {
    case 'Green': return 'text-zinc-400'
    case 'Regular': return 'text-sky-400'
    case 'Veteran': return 'text-emerald-400'
    case 'Elite': return 'text-amber-400'
  }
})

// ─── Condition bar ────────────────────────────────────────────────────────────

const conditionColor = computed(() => {
  if (props.ship.condition >= 70) return 'bg-emerald-500'
  if (props.ship.condition >= 40) return 'bg-amber-500'
  return 'bg-red-500'
})

// ─── Schematics for display ───────────────────────────────────────────────────

const schematicCount = computed(() => props.ship.appliedSchematicIds.length)

// ─── Role label ───────────────────────────────────────────────────────────────

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    SystemPatrol: 'System Patrol',
    Escort: 'Escort',
    Recon: 'Recon',
    Assault: 'Assault',
    Carrier: 'Carrier',
    Flagship: 'Flagship',
    Transport: 'Transport',
  }
  return map[role] ?? role
}
</script>

<template>
  <div
    class="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden transition-colors hover:border-zinc-700"
  >
    <!-- ── Header row ── -->
    <div
      class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
      @click="expanded = !expanded"
    >
      <!-- Name + role + size -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-semibold text-white truncate">{{ ship.name }}</span>
          <span class="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
            {{ roleLabel(ship.role) }}
          </span>
          <span class="text-[10px] text-zinc-600">·</span>
          <span class="text-[10px] text-zinc-500">{{ sizeLabel }}</span>
        </div>
        <!-- Captain -->
        <div class="flex items-center gap-1.5 mt-0.5">
          <span class="text-xs text-zinc-500">{{ ship.captain.name }}</span>
          <span :class="['text-[10px] font-medium', experienceColor]">
            {{ ship.captain.experience }}
          </span>
        </div>
      </div>

      <!-- Condition bar (compact) -->
      <div class="flex flex-col items-end gap-1 shrink-0">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-zinc-500">Condition</span>
          <span class="text-xs font-medium text-zinc-300">{{ ship.condition }}%</span>
        </div>
        <div class="w-20 h-1.5 rounded-full bg-zinc-800">
          <div
            :class="['h-full rounded-full transition-all', conditionColor]"
            :style="{ width: `${ship.condition}%` }"
          />
        </div>
      </div>

      <!-- Status badge -->
      <span
        :class="[
          'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border',
          statusColor,
        ]"
      >
        {{ statusLabel }}
      </span>

      <!-- Expand chevron -->
      <span class="text-zinc-600 text-xs ml-1">{{ expanded ? '▲' : '▼' }}</span>
    </div>

    <!-- ── Stat bars row ── -->
    <div class="px-4 pb-3 grid grid-cols-6 gap-2">
      <template
        v-for="[key, label] in [
          ['size', 'Size'],
          ['speed', 'Speed'],
          ['firepower', 'FP'],
          ['armor', 'Armor'],
          ['sensors', 'Sens'],
          ['evasion', 'Evade'],
        ]"
        :key="key"
      >
        <div class="flex flex-col gap-0.5">
          <span class="text-[9px] text-zinc-600 uppercase tracking-wide">{{ label }}</span>
          <div class="h-1 rounded-full bg-zinc-800">
            <div
              :class="['h-full rounded-full', statBarColor((ship.primaryStats as any)[key])]"
              :style="{ width: `${statBarWidth((ship.primaryStats as any)[key])}%` }"
            />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[9px] font-semibold text-zinc-400">{{ (ship.primaryStats as any)[key] }}</span>
            <span :class="['text-[8px]', statLabelColor((ship.primaryStats as any)[key])]">
              {{ statLabel((ship.primaryStats as any)[key]) }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- ── Abilities row ── -->
    <div
      class="px-4 pb-3 flex items-center gap-4 border-t border-zinc-800/60 pt-2"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-zinc-500">Fight</span>
        <span class="text-xs font-semibold text-red-400">{{ ship.abilities.fight }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-zinc-500">Investigation</span>
        <span class="text-xs font-semibold text-sky-400">{{ ship.abilities.investigation }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-zinc-500">Support</span>
        <span class="text-xs font-semibold text-emerald-400">{{ ship.abilities.support }}</span>
      </div>
      <div class="ml-auto flex items-center gap-1.5">
        <span class="text-[10px] text-zinc-500">Schematics</span>
        <span class="text-xs font-medium text-zinc-300">{{ schematicCount }}</span>
      </div>
    </div>

    <!-- ── Expanded detail panel ── -->
    <div v-if="expanded" class="border-t border-zinc-800 px-4 py-3 space-y-3">

      <!-- Full stat breakdown -->
      <div>
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
          Stat Breakdown
        </p>
        <div class="grid grid-cols-2 gap-x-6 gap-y-1">
          <template
            v-for="[key, label] in [
              ['size', 'Size'],
              ['speed', 'Speed'],
              ['firepower', 'Firepower'],
              ['armor', 'Armor'],
              ['sensors', 'Sensors'],
              ['evasion', 'Evasion'],
            ]"
            :key="key"
          >
            <div class="flex items-center justify-between text-xs">
              <span class="text-zinc-500">{{ label }}</span>
              <span :class="['font-semibold', statLabelColor((ship.primaryStats as any)[key])]">
                {{ (ship.primaryStats as any)[key] }}
                <span class="font-normal text-zinc-600">({{ statLabel((ship.primaryStats as any)[key]) }})</span>
              </span>
            </div>
          </template>
        </div>
      </div>

      <!-- Derived stats -->
      <div>
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
          Derived Stats
        </p>
        <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Hull Points</span>
            <span class="text-zinc-300 font-medium">{{ ship.derivedStats.hullPoints }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Power Projection</span>
            <span class="text-zinc-300 font-medium">{{ ship.derivedStats.powerProjection }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">BP/Turn (mission)</span>
            <span class="text-amber-400 font-medium">{{ ship.derivedStats.bpPerTurn }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Build Time</span>
            <span class="text-zinc-300 font-medium">{{ ship.derivedStats.buildTimeTurns }} turns</span>
          </div>
        </div>
      </div>

      <!-- Schematics applied -->
      <div v-if="ship.appliedSchematicIds.length > 0">
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
          Schematics Applied
        </p>
        <div class="space-y-0.5">
          <div
            v-for="(modId, idx) in ship.appliedSchematicIds"
            :key="idx"
            class="text-xs text-zinc-400"
          >
            {{ modId }}
          </div>
        </div>
      </div>
      <div v-else>
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
          Schematics Applied
        </p>
        <p class="text-xs text-zinc-600">No schematics applied.</p>
      </div>

      <!-- Captain service record -->
      <div>
        <p class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
          Captain Service Record
        </p>
        <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Missions</span>
            <span class="text-zinc-300">{{ ship.captain.missionsCompleted }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Battles</span>
            <span class="text-zinc-300">{{ ship.captain.battlesCount }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Experience</span>
            <span :class="['font-medium', experienceColor]">{{ ship.captain.experience }}</span>
          </div>
        </div>
      </div>

      <!-- Build info -->
      <div class="text-xs flex items-center gap-4 text-zinc-500 border-t border-zinc-800 pt-2">
        <span>Built turn {{ ship.builtTurn }}</span>
        <span v-if="corpName">by {{ corpName }}</span>
        <span v-if="sectorName">· {{ sectorName }}</span>
        <span class="ml-auto">Ship ID: {{ ship.id.slice(0, 14) }}</span>
      </div>
    </div>
  </div>
</template>
