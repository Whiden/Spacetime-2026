<script setup lang="ts">
/**
 * DomainProgress.vue — Science domain level + progress bar + focus toggle.
 *
 * Shows: domain name, current level, tier label, progress bar toward next level,
 * unlocked schematic categories, and a Focus toggle button.
 *
 * Used by: ScienceView.vue
 */
import { computed } from 'vue'
import type { ScienceDomainState } from '../../types/science'
import type { ScienceSectorType } from '../../types/common'
import { SCIENCE_DOMAIN_DEFINITIONS, SCIENCE_LEVEL_TIER_NAMES } from '../../data/science-sectors'

const props = defineProps<{
  domain: ScienceDomainState
  isFocused: boolean
}>()

const emit = defineEmits<{
  'toggle-focus': [domain: ScienceSectorType]
}>()

const definition = computed(() => SCIENCE_DOMAIN_DEFINITIONS[props.domain.type])

const tierName = computed(() => SCIENCE_LEVEL_TIER_NAMES[props.domain.level] ?? `Tier ${props.domain.level}`)

/** Progress percentage toward next level (0–100). */
const progressPercent = computed(() => {
  const threshold = props.domain.thresholdToNextLevel
  if (threshold <= 0) return 100
  return Math.min(100, Math.floor((props.domain.accumulatedPoints / threshold) * 100))
})

const progressBarColor = computed(() => {
  if (props.isFocused) return 'bg-indigo-500'
  if (props.domain.level >= 3) return 'bg-emerald-500'
  if (props.domain.level >= 1) return 'bg-sky-500'
  return 'bg-zinc-600'
})

function handleToggleFocus() {
  emit('toggle-focus', props.domain.type as ScienceSectorType)
}
</script>

<template>
  <div
    class="rounded-lg border p-4 transition-colors"
    :class="isFocused ? 'border-indigo-500 bg-indigo-950/30' : 'border-zinc-700 bg-zinc-800/50'"
  >
    <!-- Header: name, level, tier, focus toggle -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-white font-medium text-sm">{{ definition?.name ?? domain.type }}</span>
        <span class="text-zinc-400 text-xs">Lv {{ domain.level }}</span>
        <span class="text-zinc-500 text-xs italic">{{ tierName }}</span>
        <span
          v-if="isFocused"
          class="text-xs font-semibold text-indigo-300 bg-indigo-800/60 rounded px-1.5 py-0.5"
        >
          Focused (2× output)
        </span>
      </div>
      <button
        class="text-xs px-2 py-1 rounded transition-colors"
        :class="
          isFocused
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
        "
        @click="handleToggleFocus"
        :title="isFocused ? 'Remove focus from this domain' : 'Focus this domain to double its output'"
      >
        {{ isFocused ? 'Unfocus' : 'Focus' }}
      </button>
    </div>

    <!-- Progress bar -->
    <div class="mb-3">
      <div class="flex justify-between text-xs text-zinc-500 mb-1">
        <span>{{ domain.accumulatedPoints }} / {{ domain.thresholdToNextLevel }} pts</span>
        <span>{{ progressPercent }}%</span>
      </div>
      <div class="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          :class="progressBarColor"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <!-- Unlocked schematic categories -->
    <div v-if="domain.unlockedSchematicCategories.length > 0" class="flex flex-wrap gap-1">
      <span
        v-for="cat in domain.unlockedSchematicCategories"
        :key="cat"
        class="text-xs bg-zinc-700 text-zinc-300 rounded px-1.5 py-0.5"
      >
        {{ cat }}
      </span>
    </div>
    <p v-else class="text-xs text-zinc-600 italic">No schematic categories unlocked yet.</p>
  </div>
</template>
