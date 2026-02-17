/**
 * planet.store.ts — Pinia store for discovered planets (pre-colonization).
 *
 * Holds all planets that have been discovered through exploration.
 * Once a planet is colonized, it remains here but its status changes to Colonized.
 *
 * TODO (Story 13.2): Exploration contract completion adds planets via addPlanet().
 * TODO (Story 13.3): Accept/reject actions change planet status.
 * TODO (Story 13.4): Ground survey updates planet data (full feature/deposit reveal).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PlanetId, SectorId } from '../types/common'
import { PlanetStatus } from '../types/common'
import type { Planet } from '../types/planet'

export const usePlanetStore = defineStore('planet', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** All discovered planets keyed by ID. */
  const planets = ref<Map<PlanetId, Planet>>(new Map())

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /** Adds a newly discovered planet to the store. */
  function addPlanet(planet: Planet) {
    planets.value.set(planet.id, planet)
  }

  /** Removes a planet from the store (e.g., cleanup). */
  function removePlanet(id: PlanetId) {
    planets.value.delete(id)
  }

  /** Updates a planet in the store (e.g., after ground survey reveals data). */
  function updatePlanet(planet: Planet) {
    planets.value.set(planet.id, planet)
  }

  /**
   * Initializes the store with a set of planets (e.g., Terra Nova at game start).
   * Clears any existing planets first.
   */
  function initialize(initialPlanets: Planet[]) {
    planets.value.clear()
    for (const planet of initialPlanets) {
      planets.value.set(planet.id, planet)
    }
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** Returns a planet by ID, or undefined if not found. */
  function getPlanet(id: PlanetId): Planet | undefined {
    return planets.value.get(id)
  }

  /** All planets as an array. */
  const allPlanets = computed<Planet[]>(() => [...planets.value.values()])

  /** Planets filtered by status. */
  function getPlanetsByStatus(status: PlanetStatus): Planet[] {
    return [...planets.value.values()].filter((p) => p.status === status)
  }

  /** Orbit-scanned planets (awaiting accept/reject or ground survey). */
  const orbitScannedPlanets = computed<Planet[]>(() =>
    getPlanetsByStatus(PlanetStatus.OrbitScanned),
  )

  /** Ground-surveyed planets (full data revealed, awaiting accept/reject). */
  const groundSurveyedPlanets = computed<Planet[]>(() =>
    getPlanetsByStatus(PlanetStatus.GroundSurveyed),
  )

  /** Accepted planets (ready for colonization contracts). */
  const acceptedPlanets = computed<Planet[]>(() =>
    getPlanetsByStatus(PlanetStatus.Accepted),
  )

  /** Rejected planets (hidden from player, available for corp independent settlement). */
  const rejectedPlanets = computed<Planet[]>(() =>
    getPlanetsByStatus(PlanetStatus.Rejected),
  )

  /** Colonized planets. */
  const colonizedPlanets = computed<Planet[]>(() =>
    getPlanetsByStatus(PlanetStatus.Colonized),
  )

  /** Planets in a specific sector. */
  function getPlanetsBySector(sectorId: SectorId): Planet[] {
    return [...planets.value.values()].filter((p) => p.sectorId === sectorId)
  }

  return {
    // State
    planets,
    // Actions
    addPlanet,
    removePlanet,
    updatePlanet,
    initialize,
    // Getters (functions)
    getPlanet,
    getPlanetsByStatus,
    getPlanetsBySector,
    // Getters (computed)
    allPlanets,
    orbitScannedPlanets,
    groundSurveyedPlanets,
    acceptedPlanets,
    rejectedPlanets,
    colonizedPlanets,
  }
})
