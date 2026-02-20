/**
 * fleet.store.ts — Pinia store for all commissioned ships and empire tech bonuses.
 *
 * Story 15.4: Holds the ship roster indexed by ID; exposes getters for
 * sector/status filtering. Empire tech bonuses (from science discoveries) are
 * read from the science store — this store does NOT duplicate them.
 *
 * Actions:
 * - addShip(ship)      — registers a completed ship (called by game.store after turn resolution)
 * - removeShip(id)     — destroys a ship; preserves its ServiceRecord in the memorial
 *
 * Getters:
 * - getShip(id)                 — O(1) lookup
 * - getShipsBySector(sectorId)  — ships stationed or en route in a sector
 * - getShipsByStatus(status)    — filter by ShipStatus
 * - availableShips              — stationed ships not on a mission
 *
 * TODO (Story 16.1): create-mission.ts uses availableShips to validate task force selection.
 * TODO (Story 16.3): mission-phase.ts calls addShip / removeShip during mission resolution.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ShipId, SectorId } from '../types/common'
import { ShipStatus } from '../types/common'
import type { Ship } from '../types/ship'
import type { ServiceRecord } from '../types/ship'

export const useFleetStore = defineStore('fleet', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** All commissioned ships keyed by ShipId. */
  const ships = ref<Map<ShipId, Ship>>(new Map())

  /**
   * Memorial: service records of destroyed ships, keyed by ShipId.
   * Preserved permanently even after the ship is removed from the active fleet.
   */
  const memorial = ref<Map<ShipId, ServiceRecord>>(new Map())

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** All ships as a sorted array (by name for stable display order). */
  const allShips = computed<Ship[]>(() =>
    [...ships.value.values()].sort((a, b) => a.name.localeCompare(b.name)),
  )

  /** Ships that are stationed and not on a mission — eligible for new missions. */
  const availableShips = computed<Ship[]>(() =>
    [...ships.value.values()].filter((s) => s.status === ShipStatus.Stationed),
  )

  /** Total number of commissioned ships. */
  const shipCount = computed<number>(() => ships.value.size)

  // ─── Getter Functions ─────────────────────────────────────────────────────────

  /** Returns a ship by ID, or undefined if not found. */
  function getShip(id: ShipId): Ship | undefined {
    return ships.value.get(id)
  }

  /**
   * Returns all ships currently associated with the given sector.
   * A ship belongs to a sector if its homeSectorId matches.
   */
  function getShipsBySector(sectorId: SectorId): Ship[] {
    return [...ships.value.values()].filter((s) => s.homeSectorId === sectorId)
  }

  /**
   * Returns all ships with the given status.
   */
  function getShipsByStatus(status: ShipStatus): Ship[] {
    return [...ships.value.values()].filter((s) => s.status === status)
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Registers a newly completed ship in the fleet.
   * Called by game.store._distributeResults() after contract-phase completes a ShipCommission.
   */
  function addShip(ship: Ship): void {
    ships.value.set(ship.id as ShipId, ship)
  }

  /**
   * Removes a ship from the active fleet (permanent destruction).
   * Copies its ServiceRecord to the memorial before deletion.
   *
   * Called on ship destruction (combat loss, incident).
   * TODO (Story 16.3): mission-phase calls this when condition reaches 0.
   */
  function removeShip(id: ShipId): void {
    const ship = ships.value.get(id)
    if (!ship) return

    // Preserve service record in memorial
    memorial.value.set(id, { ...ship.serviceRecord })

    ships.value.delete(id)
  }

  /**
   * Replaces the ships map wholesale after turn resolution.
   * Used by game.store._distributeResults() for full state sync.
   */
  function updateShips(updatedShips: Map<string, Ship>): void {
    ships.value = new Map(updatedShips as Map<ShipId, Ship>)
  }

  return {
    // State
    ships,
    memorial,
    // Getters (computed)
    allShips,
    availableShips,
    shipCount,
    // Getters (functions)
    getShip,
    getShipsBySector,
    getShipsByStatus,
    // Actions
    addShip,
    removeShip,
    updateShips,
  }
})
