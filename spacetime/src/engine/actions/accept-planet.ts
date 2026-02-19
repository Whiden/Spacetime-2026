/**
 * accept-planet.ts — Player accept/reject action for discovered planets.
 *
 * Validates the planet is in a discoverable status (OrbitScanned or GroundSurveyed)
 * and returns an updated Planet with the new status.
 *
 * Pure function: no side effects, no store access.
 *
 * TODO (Story 13.5): Wire Accept/Reject buttons in GalaxyView / SectorCard.
 * TODO (future): Rejected planets become available for independent corp settlement.
 */

import type { PlanetId } from '../../types/common'
import type { Planet } from '../../types/planet'
import { PlanetStatus } from '../../types/common'

// ─── Validation Error Types ───────────────────────────────────────────────────

export type AcceptPlanetError =
  | 'PLANET_NOT_FOUND'        // Planet ID not in provided planets map
  | 'INVALID_STATUS'          // Planet not in OrbitScanned or GroundSurveyed status

export interface AcceptPlanetSuccess {
  success: true
  updatedPlanet: Planet
}

export interface AcceptPlanetFailure {
  success: false
  error: AcceptPlanetError
  message: string
}

export type AcceptPlanetResult = AcceptPlanetSuccess | AcceptPlanetFailure

// ─── Valid statuses for accept/reject ────────────────────────────────────────

const ACTIONABLE_STATUSES: PlanetStatus[] = [
  PlanetStatus.OrbitScanned,
  PlanetStatus.GroundSurveyed,
]

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Accept a discovered planet.
 * Planet status changes to Accepted, making it available for ground survey
 * and colonization contracts.
 *
 * Validation: planet must be OrbitScanned or GroundSurveyed.
 */
export function acceptPlanet(
  planetId: PlanetId,
  planets: Map<string, Planet>,
): AcceptPlanetResult {
  const planet = planets.get(planetId)
  if (!planet) {
    return {
      success: false,
      error: 'PLANET_NOT_FOUND',
      message: `Planet '${planetId}' not found.`,
    }
  }

  if (!ACTIONABLE_STATUSES.includes(planet.status)) {
    return {
      success: false,
      error: 'INVALID_STATUS',
      message: `Planet '${planetId}' has status '${planet.status}'. Only OrbitScanned or GroundSurveyed planets can be accepted.`,
    }
  }

  return {
    success: true,
    updatedPlanet: { ...planet, status: PlanetStatus.Accepted },
  }
}

/**
 * Reject a discovered planet.
 * Planet status changes to Rejected; it is hidden from player UI and
 * becomes available for independent corp settlement in a future story.
 *
 * Validation: planet must be OrbitScanned or GroundSurveyed.
 */
export function rejectPlanet(
  planetId: PlanetId,
  planets: Map<string, Planet>,
): AcceptPlanetResult {
  const planet = planets.get(planetId)
  if (!planet) {
    return {
      success: false,
      error: 'PLANET_NOT_FOUND',
      message: `Planet '${planetId}' not found.`,
    }
  }

  if (!ACTIONABLE_STATUSES.includes(planet.status)) {
    return {
      success: false,
      error: 'INVALID_STATUS',
      message: `Planet '${planetId}' has status '${planet.status}'. Only OrbitScanned or GroundSurveyed planets can be rejected.`,
    }
  }

  return {
    success: true,
    updatedPlanet: { ...planet, status: PlanetStatus.Rejected },
  }
}
