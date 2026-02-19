/**
 * accept-planet.test.ts — Unit tests for the accept/reject planet action.
 *
 * Covers (Story 13.3 acceptance criteria):
 * - Accept: OrbitScanned planet → status becomes Accepted
 * - Accept: GroundSurveyed planet → status becomes Accepted
 * - Reject: OrbitScanned planet → status becomes Rejected
 * - Reject: GroundSurveyed planet → status becomes Rejected
 * - Invalid status: Undiscovered planet → INVALID_STATUS error
 * - Invalid status: Already Accepted planet → INVALID_STATUS error
 * - Invalid status: Already Rejected planet → INVALID_STATUS error
 * - Invalid status: Colonized planet → INVALID_STATUS error
 * - Planet not found → PLANET_NOT_FOUND error
 * - Other planet fields unchanged after accept/reject
 */

import { describe, it, expect } from 'vitest'
import { acceptPlanet, rejectPlanet } from '../../../engine/actions/accept-planet'
import type { Planet } from '../../../types/planet'
import type { PlanetId, SectorId } from '../../../types/common'
import { PlanetStatus, PlanetType, PlanetSize } from '../../../types/common'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlanet(status: PlanetStatus): Planet {
  return {
    id: 'plt_test' as PlanetId,
    name: 'Test Planet',
    sectorId: 'sec_test' as SectorId,
    type: PlanetType.Continental,
    size: PlanetSize.Medium,
    status,
    baseHabitability: 6,
    deposits: [],
    features: [],
    featureModifiers: [],
    orbitScanTurn: status === PlanetStatus.Undiscovered ? null : 1,
    groundSurveyTurn: null,
  }
}

function makeMap(planet: Planet): Map<string, Planet> {
  return new Map([[planet.id, planet]])
}

// ─── acceptPlanet ─────────────────────────────────────────────────────────────

describe('acceptPlanet', () => {
  it('accepts an OrbitScanned planet → status Accepted', () => {
    const planet = makePlanet(PlanetStatus.OrbitScanned)
    const result = acceptPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.updatedPlanet.status).toBe(PlanetStatus.Accepted)
    }
  })

  it('accepts a GroundSurveyed planet → status Accepted', () => {
    const planet = makePlanet(PlanetStatus.GroundSurveyed)
    const result = acceptPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.updatedPlanet.status).toBe(PlanetStatus.Accepted)
    }
  })

  it('preserves all other planet fields on accept', () => {
    const planet = makePlanet(PlanetStatus.OrbitScanned)
    const result = acceptPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(true)
    if (result.success) {
      const updated = result.updatedPlanet
      expect(updated.id).toBe(planet.id)
      expect(updated.name).toBe(planet.name)
      expect(updated.sectorId).toBe(planet.sectorId)
      expect(updated.type).toBe(planet.type)
      expect(updated.size).toBe(planet.size)
      expect(updated.baseHabitability).toBe(planet.baseHabitability)
    }
  })

  it('returns PLANET_NOT_FOUND for unknown ID', () => {
    const result = acceptPlanet('plt_unknown' as PlanetId, new Map())
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('PLANET_NOT_FOUND')
    }
  })

  it('returns INVALID_STATUS for Undiscovered planet', () => {
    const planet = makePlanet(PlanetStatus.Undiscovered)
    const result = acceptPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INVALID_STATUS')
    }
  })

  it('returns INVALID_STATUS for already Accepted planet', () => {
    const planet = makePlanet(PlanetStatus.Accepted)
    const result = acceptPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INVALID_STATUS')
    }
  })

  it('returns INVALID_STATUS for Rejected planet', () => {
    const planet = makePlanet(PlanetStatus.Rejected)
    const result = acceptPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INVALID_STATUS')
    }
  })

  it('returns INVALID_STATUS for Colonized planet', () => {
    const planet = makePlanet(PlanetStatus.Colonized)
    const result = acceptPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INVALID_STATUS')
    }
  })
})

// ─── rejectPlanet ─────────────────────────────────────────────────────────────

describe('rejectPlanet', () => {
  it('rejects an OrbitScanned planet → status Rejected', () => {
    const planet = makePlanet(PlanetStatus.OrbitScanned)
    const result = rejectPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.updatedPlanet.status).toBe(PlanetStatus.Rejected)
    }
  })

  it('rejects a GroundSurveyed planet → status Rejected', () => {
    const planet = makePlanet(PlanetStatus.GroundSurveyed)
    const result = rejectPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.updatedPlanet.status).toBe(PlanetStatus.Rejected)
    }
  })

  it('preserves all other planet fields on reject', () => {
    const planet = makePlanet(PlanetStatus.OrbitScanned)
    const result = rejectPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(true)
    if (result.success) {
      const updated = result.updatedPlanet
      expect(updated.id).toBe(planet.id)
      expect(updated.name).toBe(planet.name)
      expect(updated.sectorId).toBe(planet.sectorId)
    }
  })

  it('returns PLANET_NOT_FOUND for unknown ID', () => {
    const result = rejectPlanet('plt_unknown' as PlanetId, new Map())
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('PLANET_NOT_FOUND')
    }
  })

  it('returns INVALID_STATUS for Undiscovered planet', () => {
    const planet = makePlanet(PlanetStatus.Undiscovered)
    const result = rejectPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INVALID_STATUS')
    }
  })

  it('returns INVALID_STATUS for already Accepted planet', () => {
    const planet = makePlanet(PlanetStatus.Accepted)
    const result = rejectPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INVALID_STATUS')
    }
  })

  it('returns INVALID_STATUS for Colonized planet', () => {
    const planet = makePlanet(PlanetStatus.Colonized)
    const result = rejectPlanet(planet.id, makeMap(planet))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INVALID_STATUS')
    }
  })
})
