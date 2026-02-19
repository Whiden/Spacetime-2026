/**
 * science.store.ts — Pinia store for science domain state, discoveries, and schematics.
 *
 * Story 14.5: Holds domain levels, accumulated progress, focused domain,
 * discoveries list, schematics, and empire tech bonuses.
 *
 * Actions:
 * - setFocus(domain | null): sets the focused domain (only one at a time)
 * - applyDiscovery(discovery): increments empireBonuses and unlocks schematic categories
 * - updateScienceDomains(domains): bulk-replace domain map (called by game.store endTurn)
 * - addDiscovery(discovery): records a new discovery
 * - addSchematic(schematic): records a new schematic
 * - addPatent(patent): records a new patent
 *
 * TODO (Story 15.1): Fleet store reads empireBonuses.shipStats for ship construction.
 * TODO (Story 18.1): Serialize discoveries, schematics, and patents in save file.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ScienceSectorType, SchematicCategory } from '../types/common'
import type { ScienceDomainState, Discovery, Schematic, Patent } from '../types/science'
import type { EmpireBonuses } from '../types/empire'
import { createEmptyEmpireBonuses } from '../types/empire'
import { createInitialScienceDomains, setDomainFocus, calculateEmpireSciencePerTurn } from '../engine/simulation/science-sim'
import { applyDiscoveryEffects } from '../engine/simulation/science-sim'
import type { DiscoveryDefinition } from '../data/discoveries'
import { useColonyStore } from './colony.store'

export const useScienceStore = defineStore('science', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** Science domain states, keyed by ScienceSectorType string. */
  const scienceDomains = ref<Map<string, ScienceDomainState>>(createInitialScienceDomains())

  /** All discoveries made empire-wide, keyed by discovery ID. */
  const discoveries = ref<Map<string, Discovery>>(new Map())

  /** All schematics held by shipbuilding corps, keyed by schematic ID. */
  const schematics = ref<Map<string, Schematic>>(new Map())

  /** All patents held by corps, keyed by patent ID. */
  const patents = ref<Map<string, Patent>>(new Map())

  /**
   * Cumulative empire-wide ship stat bonuses from all discoveries.
   * Applied to every newly built ship. Reads from discoveries directly.
   */
  const empireBonuses = ref<EmpireBonuses>(createEmptyEmpireBonuses())

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** All domain states as an array, sorted alphabetically by type for consistent display. */
  const allDomains = computed<ScienceDomainState[]>(() =>
    [...scienceDomains.value.values()].sort((a, b) => a.type.localeCompare(b.type)),
  )

  /** The currently focused domain, or null if none. */
  const focusedDomain = computed<ScienceSectorType | null>(() => {
    for (const domain of scienceDomains.value.values()) {
      if (domain.focused) return domain.type as ScienceSectorType
    }
    return null
  })

  /** All discoveries in chronological order (by turn). */
  const allDiscoveries = computed<Discovery[]>(() =>
    [...discoveries.value.values()].sort((a, b) => a.discoveredTurn - b.discoveredTurn),
  )

  /** All schematics as an array. */
  const allSchematics = computed<Schematic[]>(() => [...schematics.value.values()])

  /** All patents as an array. */
  const allPatents = computed<Patent[]>(() => [...patents.value.values()])

  /** Definition IDs already discovered (for pool exhaustion tracking). */
  const discoveredDefinitionIds = computed<string[]>(() =>
    [...discoveries.value.values()].map((d) => d.sourceDefinitionId),
  )

  /**
   * Empire science output per turn: sum of all science infrastructure levels across all colonies.
   * Used by the science view to show SP generation rate.
   */
  const sciencePerTurn = computed<number>(() => {
    const colonyStore = useColonyStore()
    return calculateEmpireSciencePerTurn(Array.from(colonyStore.colonies.values()))
  })

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Sets the focused science domain.
   * Only one domain may be focused at a time; pass null to clear focus.
   * Focus doubles output for that domain and doubles discovery chance in it.
   */
  function setFocus(domain: ScienceSectorType | null): void {
    scienceDomains.value = setDomainFocus(scienceDomains.value, domain)
  }

  /**
   * Applies a discovery definition's effects directly to empireBonuses
   * and unlocks schematic categories in the relevant domain.
   *
   * Called by game.store when the turn resolver reports a discovery.
   */
  function applyDiscovery(def: DiscoveryDefinition): void {
    empireBonuses.value = applyDiscoveryEffects(def, empireBonuses.value)
  }

  /**
   * Bulk-replaces science domain states after turn resolution.
   * Called by game.store._distributeResults().
   */
  function updateScienceDomains(updated: Map<string, ScienceDomainState>): void {
    scienceDomains.value = new Map(updated)
  }

  /**
   * Bulk-replaces empire bonuses after turn resolution (discoveries applied).
   */
  function updateEmpireBonuses(updated: EmpireBonuses): void {
    empireBonuses.value = { ...updated }
  }

  /** Records a new discovery (called after turn resolution distributes results). */
  function addDiscovery(discovery: Discovery): void {
    discoveries.value.set(discovery.id, discovery)
  }

  /** Records a new schematic (called after turn resolution distributes results). */
  function addSchematic(schematic: Schematic): void {
    schematics.value.set(schematic.id, schematic)
  }

  /** Updates an existing schematic (e.g., after domain level-up versioning). */
  function updateSchematic(schematic: Schematic): void {
    schematics.value.set(schematic.id, schematic)
  }

  /** Records a new patent (called after turn resolution distributes results). */
  function addPatent(patent: Patent): void {
    patents.value.set(patent.id, patent)
  }

  /**
   * Returns the domain state for a given science sector type.
   */
  function getDomain(type: ScienceSectorType): ScienceDomainState | undefined {
    return scienceDomains.value.get(type)
  }

  /**
   * Returns schematics grouped by category, sorted by category name.
   */
  const schematicsByCategory = computed<Map<SchematicCategory, Schematic[]>>(() => {
    const grouped = new Map<SchematicCategory, Schematic[]>()
    for (const schematic of schematics.value.values()) {
      const list = grouped.get(schematic.category) ?? []
      list.push(schematic)
      grouped.set(schematic.category, list)
    }
    return grouped
  })

  return {
    // State
    scienceDomains,
    discoveries,
    schematics,
    patents,
    empireBonuses,
    // Getters
    allDomains,
    focusedDomain,
    allDiscoveries,
    allSchematics,
    allPatents,
    discoveredDefinitionIds,
    sciencePerTurn,
    schematicsByCategory,
    // Actions
    setFocus,
    applyDiscovery,
    updateScienceDomains,
    updateEmpireBonuses,
    addDiscovery,
    addSchematic,
    updateSchematic,
    addPatent,
    getDomain,
  }
})
