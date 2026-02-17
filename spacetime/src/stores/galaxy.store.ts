/**
 * galaxy.store.ts — Pinia store for galaxy state (sectors and adjacency).
 *
 * Holds all sectors, the adjacency graph, and the starting sector ID.
 * Provides getters for sector lookup, adjacency queries, and explorable sectors.
 *
 * TODO (Story 15.4): fleet.store.ts provides ship-sector mapping for presence detection.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SectorId } from '../types/common'
import type { Sector } from '../types/sector'
import { generateGalaxy } from '../generators/galaxy-generator'
import { useColonyStore } from './colony.store'

export const useGalaxyStore = defineStore('galaxy', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** All sectors keyed by ID. */
  const sectors = ref<Map<SectorId, Sector>>(new Map())

  /** Adjacency list: sectorId → array of adjacent sector IDs. */
  const adjacency = ref<Map<SectorId, SectorId[]>>(new Map())

  /** ID of the starting sector (where Terra Nova is located). */
  const startingSectorId = ref<SectorId | null>(null)

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Generates a new galaxy and stores the result.
   * Called during game initialization.
   */
  function generate() {
    const galaxy = generateGalaxy()
    sectors.value = galaxy.sectors
    adjacency.value = galaxy.adjacency
    startingSectorId.value = galaxy.startingSectorId
  }

  /**
   * Updates a sector in the store (e.g., after exploration changes).
   */
  function updateSector(sector: Sector) {
    sectors.value.set(sector.id, sector)
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** Returns a sector by ID, or undefined if not found. */
  function getSector(id: SectorId): Sector | undefined {
    return sectors.value.get(id)
  }

  /** Returns adjacent sector IDs for a given sector. */
  function getAdjacentSectors(id: SectorId): SectorId[] {
    return adjacency.value.get(id) ?? []
  }

  /** All sectors as an array, sorted by name. */
  const allSectors = computed<Sector[]>(() => {
    return [...sectors.value.values()].sort((a, b) => a.name.localeCompare(b.name))
  })

  /** The starting sector object. */
  const startingSector = computed<Sector | undefined>(() => {
    if (startingSectorId.value === null) return undefined
    return sectors.value.get(startingSectorId.value)
  })

  /**
   * Sectors that are explorable: sectors adjacent to those where the player has presence.
   * A sector is explorable if:
   * - It is not yet 100% explored
   * - An adjacent sector has player presence (colony or stationed ships)
   *
   * TODO (Story 15.4): Read fleet.store for ship-sector presence.
   */
  const explorableSectors = computed<Sector[]>(() => {
    const colonyStore = useColonyStore()

    // Collect all sectors where the player has presence
    const presentSectorIds = new Set<SectorId>()

    // Starting sector always has presence (Terra Nova)
    if (startingSectorId.value !== null) {
      presentSectorIds.add(startingSectorId.value)
    }

    // Add sectors with colonies
    for (const sectorId of colonyStore.sectorsWithColonies) {
      presentSectorIds.add(sectorId)
    }

    // TODO: Add sectors with stationed ships from fleet.store

    // Collect all sectors adjacent to sectors with presence
    const explorableIds = new Set<SectorId>()
    for (const presentId of presentSectorIds) {
      for (const adjacentId of getAdjacentSectors(presentId)) {
        // Only explorable if not already at 100%
        const sector = sectors.value.get(adjacentId)
        if (sector && sector.explorationPercent < 100) {
          explorableIds.add(adjacentId)
        }
      }
    }

    // Also include the present sectors themselves if not at 100%
    for (const presentId of presentSectorIds) {
      const sector = sectors.value.get(presentId)
      if (sector && sector.explorationPercent < 100) {
        explorableIds.add(presentId)
      }
    }

    return [...explorableIds]
      .map((id) => sectors.value.get(id)!)
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  return {
    // State
    sectors,
    adjacency,
    startingSectorId,
    // Actions
    generate,
    updateSector,
    // Getters (functions)
    getSector,
    getAdjacentSectors,
    // Getters (computed)
    allSectors,
    startingSector,
    explorableSectors,
  }
})
