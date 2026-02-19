<script setup lang="ts">
/**
 * ScienceView.vue — Science domains, discoveries, schematics, and empire tech bonuses.
 *
 * Story 14.5: Full science display screen.
 *
 * Sections:
 * 1. Science Domains — 9 domains with level, progress bar, schematic categories, focus toggle
 * 2. Empire Bonus Summary — cumulative ship stat bonuses from all discoveries
 * 3. Discoveries — chronological list with effects
 * 4. Schematics — all corp schematics grouped by category
 *
 * TODO (Story 15.4): Fleet view links back here for tech context.
 * TODO (Story 19.3): Dashboard science summary card links to this view.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useScienceStore } from '../stores/science.store'
import { useCorporationStore } from '../stores/corporation.store'
import type { ScienceSectorType } from '../types/common'
import DomainProgress from '../components/science/DomainProgress.vue'
import DiscoveryCard from '../components/science/DiscoveryCard.vue'
import SchematicCard from '../components/science/SchematicCard.vue'

const scienceStore = useScienceStore()
const corpStore = useCorporationStore()
const { allDomains, focusedDomain, allDiscoveries, empireBonuses, schematicsByCategory } = storeToRefs(scienceStore)

// ─── Focus toggle ─────────────────────────────────────────────────────────────

function handleToggleFocus(domain: ScienceSectorType) {
  // If already focused, clear focus; otherwise focus the new domain
  if (focusedDomain.value === domain) {
    scienceStore.setFocus(null)
  } else {
    scienceStore.setFocus(domain)
  }
}

// ─── Corp name lookup ─────────────────────────────────────────────────────────

function getCorpName(corpId: string): string {
  const corp = corpStore.getCorp(corpId as import('../types/common').CorpId)
  return corp?.name ?? 'Unknown Corp'
}

// ─── Empire bonus display ─────────────────────────────────────────────────────

interface BonusEntry {
  label: string
  value: number
}

const shipStatBonuses = computed<BonusEntry[]>(() => {
  const stats = empireBonuses.value.shipStats
  return [
    { label: 'Size', value: stats.size },
    { label: 'Speed', value: stats.speed },
    { label: 'Firepower', value: stats.firepower },
    { label: 'Armor', value: stats.armor },
    { label: 'Sensors', value: stats.sensors },
    { label: 'Evasion', value: stats.evasion },
  ].filter((e) => e.value > 0)
})

const hasAnyEmpireBonus = computed(() => shipStatBonuses.value.length > 0)

// ─── Schematics grouped ───────────────────────────────────────────────────────

const schematicCategories = computed(() => [...schematicsByCategory.value.entries()])
const hasAnySchematics = computed(() => schematicsByCategory.value.size > 0)
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-white mb-6">Science</h1>

    <!-- ─── Science Domains ────────────────────────────────────────────────── -->
    <section class="mb-8">
      <h2 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Science Domains
      </h2>
      <p class="text-xs text-zinc-500 mb-4">
        Focus a domain to double its science output this turn. Only one domain may be focused at a time.
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DomainProgress
          v-for="domain in allDomains"
          :key="domain.type"
          :domain="domain"
          :is-focused="focusedDomain === domain.type"
          @toggle-focus="handleToggleFocus"
        />
      </div>
    </section>

    <!-- ─── Empire Tech Bonus Summary ─────────────────────────────────────── -->
    <section class="mb-8">
      <h2 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Empire Tech Bonuses
      </h2>
      <div
        v-if="hasAnyEmpireBonus"
        class="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4"
      >
        <p class="text-xs text-zinc-500 mb-3">
          Cumulative ship stat bonuses from all discoveries. Applied to every newly built ship.
        </p>
        <div class="flex flex-wrap gap-3">
          <div
            v-for="bonus in shipStatBonuses"
            :key="bonus.label"
            class="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-800/50 rounded-lg px-3 py-2"
          >
            <span class="text-zinc-300 text-sm">{{ bonus.label }}</span>
            <span class="text-emerald-300 font-semibold text-sm">+{{ bonus.value }}</span>
          </div>
        </div>
      </div>
      <div
        v-else
        class="rounded-xl border border-zinc-800 bg-zinc-900/50 py-8 px-8 text-center"
      >
        <p class="text-zinc-400 text-sm">No tech bonuses yet.</p>
        <p class="text-zinc-500 text-xs mt-1">
          Science discoveries grant permanent ship stat bonuses.
        </p>
      </div>
    </section>

    <!-- ─── Discoveries ────────────────────────────────────────────────────── -->
    <section class="mb-8">
      <h2 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Discoveries
        <span v-if="allDiscoveries.length > 0" class="text-zinc-500 font-normal normal-case ml-1">
          ({{ allDiscoveries.length }})
        </span>
      </h2>

      <div v-if="allDiscoveries.length > 0" class="flex flex-col gap-3">
        <DiscoveryCard
          v-for="discovery in allDiscoveries"
          :key="discovery.id"
          :discovery="discovery"
          :corp-name="getCorpName(discovery.discoveredByCorpId)"
        />
      </div>
      <div
        v-else
        class="rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 px-8 text-center"
      >
        <p class="text-zinc-400 text-sm">No discoveries yet.</p>
        <p class="text-zinc-500 text-xs mt-2">
          Science corporations make discoveries each turn when domain levels are high enough.
          Invest in science infrastructure and contract science corporations to accelerate progress.
        </p>
      </div>
    </section>

    <!-- ─── Schematics ─────────────────────────────────────────────────────── -->
    <section>
      <h2 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Schematics
      </h2>

      <div v-if="hasAnySchematics" class="flex flex-col gap-4">
        <div
          v-for="[category, schematics] in schematicCategories"
          :key="category"
        >
          <p class="text-xs font-semibold text-zinc-400 mb-1.5">{{ category }}</p>
          <div class="flex flex-col gap-1.5">
            <SchematicCard
              v-for="schematic in schematics"
              :key="schematic.id"
              :schematic="schematic"
              :corp-name="getCorpName(schematic.ownerCorpId)"
            />
          </div>
        </div>
      </div>
      <div
        v-else
        class="rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 px-8 text-center"
      >
        <p class="text-zinc-400 text-sm">No schematics yet.</p>
        <p class="text-zinc-500 text-xs mt-2">
          Shipbuilding corporations develop schematics based on unlocked discovery categories.
          Contract a shipbuilding corporation and advance science to unlock schematic categories.
        </p>
      </div>
    </section>
  </div>
</template>
