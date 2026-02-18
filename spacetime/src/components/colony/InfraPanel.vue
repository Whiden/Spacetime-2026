<script setup lang="ts">
/**
 * InfraPanel — Infrastructure panel showing all 12 domains with levels, ownership, and caps.
 *
 * Each row shows: domain name, proportional stacked bar (public/corporate/empty), total / cap, ownership.
 * Public levels are indigo, corporate levels are amber. Empty portion up to cap is dark.
 * For uncapped domains, the bar shows only the filled portions (public + corporate = 100%).
 * "Invest" button costs 3 BP for +1 public level. Enabled when below cap and player has ≥ 3 BP.
 *
 * Cap computation (mirrors invest-planet.ts logic, see Specs.md § 6):
 *   - Civilian: uncapped (Infinity)
 *   - Extraction domains: max richness cap among matching deposits (0 if no deposit)
 *   - All others: populationLevel × 2
 */
import { computed } from 'vue'
import type { Colony } from '../../types/colony'
import type { Deposit } from '../../types/planet'
import { InfraDomain } from '../../types/common'
import type { BPAmount } from '../../types/common'
import { getTotalLevels, getCorporateLevels } from '../../types/infrastructure'
import { INFRA_DOMAIN_DEFINITIONS, EXTRACTION_DOMAINS } from '../../data/infrastructure'
import { DEPOSIT_DEFINITIONS, RICHNESS_CAPS } from '../../data/planet-deposits'
import { useColonyStore } from '../../stores/colony.store'
import { useBudgetStore } from '../../stores/budget.store'

/** Cost in BP for +1 public infrastructure level. Mirrors INVEST_COST_BP in invest-planet.ts. */
const INVEST_COST = 3

const props = defineProps<{
  colony: Colony
  deposits: Deposit[]
}>()

const colonyStore = useColonyStore()
const budgetStore = useBudgetStore()

/** Ordered list of all 12 domains for display. */
const DOMAIN_ORDER: InfraDomain[] = [
  InfraDomain.Civilian,
  InfraDomain.Agricultural,
  InfraDomain.Mining,
  InfraDomain.DeepMining,
  InfraDomain.GasExtraction,
  InfraDomain.LowIndustry,
  InfraDomain.HeavyIndustry,
  InfraDomain.HighTechIndustry,
  InfraDomain.SpaceIndustry,
  InfraDomain.Transport,
  InfraDomain.Science,
  InfraDomain.Military,
]

interface InfraRow {
  domain: InfraDomain
  name: string
  total: number
  publicLevels: number
  corpLevels: number
  effectiveCap: number
  capDisplay: string
  canInvest: boolean
  disabledReason: string
  /** Percentage widths for the stacked bar. */
  publicPercent: number
  corpPercent: number
  emptyPercent: number
}

/**
 * Computes the effective infrastructure cap for a domain on this colony.
 * Mirrors computeEffectiveCap() in invest-planet.ts (see Specs.md § 6).
 * - Civilian → Infinity
 * - Extraction domains → max richness cap of matching deposits (0 if none)
 * - Others → populationLevel × 2
 */
function computeEffectiveCap(domain: InfraDomain): number {
  if (domain === InfraDomain.Civilian) return Infinity
  if (EXTRACTION_DOMAINS.includes(domain)) {
    const matching = props.deposits.filter(
      (d) => DEPOSIT_DEFINITIONS[d.type].extractedBy === domain,
    )
    if (matching.length === 0) return 0
    return Math.max(...matching.map((d) => RICHNESS_CAPS[d.richness]))
  }
  return props.colony.populationLevel * 2
}

const infraRows = computed<InfraRow[]>(() => {
  const currentBP = budgetStore.currentBP

  return DOMAIN_ORDER.map((domain) => {
    const state = props.colony.infrastructure[domain]
    const def = INFRA_DOMAIN_DEFINITIONS[domain]
    const total = getTotalLevels(state)
    const corpLevels = getCorporateLevels(state)
    const publicLevels = state.ownership.publicLevels
    const effectiveCap = computeEffectiveCap(domain)
    const isUncapped = effectiveCap === Infinity || effectiveCap >= 9999
    const capDisplay = isUncapped ? '∞' : String(effectiveCap)

    // Button state
    const atCap = total >= effectiveCap
    const hasEnoughBP = currentBP >= INVEST_COST
    const canInvest = !atCap && hasEnoughBP
    let disabledReason = ''
    if (atCap) disabledReason = 'At infrastructure cap'
    else if (!hasEnoughBP) disabledReason = `Need ${INVEST_COST} BP (have ${currentBP})`

    // Calculate proportional bar widths
    let publicPercent: number
    let corpPercent: number
    let emptyPercent: number

    if (isUncapped) {
      // Uncapped: public + corporate fill 100% proportionally
      if (total === 0) {
        publicPercent = 0
        corpPercent = 0
        emptyPercent = 100
      } else {
        publicPercent = (publicLevels / total) * 100
        corpPercent = (corpLevels / total) * 100
        emptyPercent = 0
      }
    } else {
      // Capped: proportions relative to cap
      if (effectiveCap === 0) {
        publicPercent = 0
        corpPercent = 0
        emptyPercent = 100
      } else {
        publicPercent = (publicLevels / effectiveCap) * 100
        corpPercent = (corpLevels / effectiveCap) * 100
        emptyPercent = Math.max(0, 100 - publicPercent - corpPercent)
      }
    }

    return {
      domain,
      name: def.name,
      total,
      publicLevels,
      corpLevels,
      effectiveCap,
      capDisplay,
      canInvest,
      disabledReason,
      publicPercent,
      corpPercent,
      emptyPercent,
    }
  }).filter((row) => row.total > 0 || (row.effectiveCap > 0 && row.effectiveCap !== Infinity))
})

/**
 * Calls the colony store invest action (+1 public level), then deducts BP on success.
 */
function handleInvest(domain: InfraDomain) {
  const result = colonyStore.investInfrastructure(
    props.colony.id,
    domain,
    budgetStore.currentBP as BPAmount,
    props.deposits,
  )
  if (result.success) {
    budgetStore.adjustBP(-result.bpSpent)
  }
}
</script>

<template>
  <div class="rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div class="px-4 py-3 border-b border-zinc-800">
      <h3 class="text-sm font-medium text-white">Infrastructure</h3>
    </div>
    <div class="divide-y divide-zinc-800/50">
      <div
        v-for="row in infraRows"
        :key="row.domain"
        class="px-4 py-2 flex items-center gap-3"
      >
        <!-- Domain name -->
        <span class="text-xs text-zinc-300 w-28 shrink-0">{{ row.name }}</span>

        <!-- Proportional stacked bar -->
        <div class="flex-1 h-3 rounded bg-zinc-800 overflow-hidden flex">
          <div
            v-if="row.publicPercent > 0"
            class="h-full bg-indigo-500 transition-all duration-300"
            :style="{ width: `${row.publicPercent}%` }"
          />
          <div
            v-if="row.corpPercent > 0"
            class="h-full bg-amber-500 transition-all duration-300"
            :style="{ width: `${row.corpPercent}%` }"
          />
          <!-- Empty portion is the remaining bg-zinc-800 background -->
        </div>

        <!-- Level / Cap -->
        <span class="text-xs font-medium text-zinc-300 w-14 text-right shrink-0">
          {{ row.total }}/{{ row.capDisplay }}
        </span>

        <!-- Ownership breakdown -->
        <span class="text-[10px] text-zinc-500 w-20 text-right shrink-0">
          <template v-if="row.corpLevels > 0">
            {{ row.publicLevels }}p + {{ row.corpLevels }}c
          </template>
          <template v-else>
            {{ row.publicLevels }} public
          </template>
        </span>

        <!-- Invest button -->
        <button
          :disabled="!row.canInvest"
          :title="row.canInvest ? `Invest 3 BP → +1 ${row.name}` : row.disabledReason"
          class="text-[10px] px-2 py-0.5 rounded shrink-0 transition-colors"
          :class="
            row.canInvest
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          "
          @click="row.canInvest && handleInvest(row.domain)"
        >
          Invest
        </button>
      </div>

      <div v-if="infraRows.length === 0" class="px-4 py-6 text-center">
        <p class="text-xs text-zinc-500">No infrastructure built yet.</p>
      </div>
    </div>
  </div>
</template>
