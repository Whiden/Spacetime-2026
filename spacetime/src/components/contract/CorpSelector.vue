<script setup lang="ts">
/**
 * CorpSelector — Corporation selection list for the contract wizard Step 3.
 *
 * Shows eligible corporations with level, type badge, personality traits,
 * and an estimated quality tier (Base / Improved / Elite).
 * Includes a "Kickstart New Corporation" button when no corps are eligible.
 */
import type { Corporation } from '../../types/corporation'
import type { CorpId } from '../../types/common'
import { CORP_TYPE_DEFINITIONS } from '../../data/corporation-types'
import { PERSONALITY_TRAIT_DEFINITIONS } from '../../data/personality-traits'

const props = defineProps<{
  corps: Corporation[]
  selectedCorpId: CorpId | null
  canKickstart: boolean
}>()

const emit = defineEmits<{
  select: [corpId: CorpId]
  kickstart: []
}>()

/** Quality tier label based on corp level. */
function qualityLabel(level: number): string {
  if (level >= 7) return 'Elite'
  if (level >= 4) return 'Improved'
  return 'Base'
}

function qualityClass(level: number): string {
  if (level >= 7) return 'text-purple-400'
  if (level >= 4) return 'text-amber-400'
  return 'text-zinc-400'
}

/** Color class for corp type badge. */
const typeColorClasses: Record<string, string> = {
  Exploitation: 'bg-amber-500/20 text-amber-400',
  Construction: 'bg-orange-500/20 text-orange-400',
  Industrial: 'bg-slate-500/20 text-slate-400',
  Shipbuilding: 'bg-sky-500/20 text-sky-400',
  Science: 'bg-violet-500/20 text-violet-400',
  Transport: 'bg-teal-500/20 text-teal-400',
  Military: 'bg-red-500/20 text-red-400',
  Exploration: 'bg-emerald-500/20 text-emerald-400',
  Agriculture: 'bg-lime-500/20 text-lime-400',
}
</script>

<template>
  <div class="space-y-2">
    <!-- No eligible corps -->
    <div v-if="corps.length === 0" class="py-4 text-center">
      <p class="text-xs text-zinc-500 mb-3">No eligible corporations available.</p>
      <button
        v-if="canKickstart"
        class="px-3 py-1.5 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        @click="emit('kickstart')"
      >
        Kickstart New Corporation
      </button>
    </div>

    <!-- Corp list -->
    <div v-else>
      <div
        v-for="corp in corps"
        :key="corp.id"
        class="flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
        :class="
          selectedCorpId === corp.id
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-zinc-700 bg-zinc-900/80 hover:border-zinc-600'
        "
        @click="emit('select', corp.id)"
      >
        <!-- Left: name + type + traits -->
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm font-medium text-white truncate">{{ corp.name }}</span>
            <span
              class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded"
              :class="typeColorClasses[corp.type] ?? 'bg-indigo-500/20 text-indigo-400'"
            >
              {{ CORP_TYPE_DEFINITIONS[corp.type].name }}
            </span>
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="trait in corp.traits"
              :key="trait"
              class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400"
            >
              {{ PERSONALITY_TRAIT_DEFINITIONS[trait].name }}
            </span>
          </div>
        </div>

        <!-- Right: level + quality -->
        <div class="shrink-0 ml-4 text-right">
          <div class="text-sm font-semibold text-white">Lv {{ corp.level }}</div>
          <div class="text-[10px]" :class="qualityClass(corp.level)">
            {{ qualityLabel(corp.level) }}
          </div>
        </div>
      </div>

      <!-- Kickstart option below list -->
      <button
        v-if="canKickstart"
        class="w-full mt-2 px-3 py-2 rounded-lg border border-dashed border-zinc-600 text-xs text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
        @click="emit('kickstart')"
      >
        + Kickstart New Corporation
      </button>
    </div>
  </div>
</template>
