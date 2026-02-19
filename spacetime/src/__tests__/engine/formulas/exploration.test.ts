/**
 * exploration.test.ts — Unit tests for exploration engine formulas.
 *
 * - calculateExplorationGain: gain range validation
 * - calculatePOICount: distribution over 1000 runs
 * - generateOrbitScan: scan quality by corp level tier
 */

import { describe, it, expect } from 'vitest'
import {
  calculateExplorationGain,
  calculatePOICount,
  generateOrbitScan,
} from '../../../engine/formulas/exploration'
import type { Planet } from '../../../types/planet'
import { PlanetType, PlanetSize, PlanetStatus, DepositType, RichnessLevel } from '../../../types/common'

// ─── Test Fixture ────────────────────────────────────────────────────────────

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'plt_test' as Planet['id'],
    name: 'Test Planet',
    sectorId: 'sec_test' as Planet['sectorId'],
    type: PlanetType.Continental,
    size: PlanetSize.Medium,
    status: PlanetStatus.Undiscovered,
    baseHabitability: 6,
    deposits: [
      { type: DepositType.FertileGround, richness: RichnessLevel.Rich, richnessRevealed: false },
      { type: DepositType.CommonOreVein, richness: RichnessLevel.Moderate, richnessRevealed: false },
    ],
    features: [
      { featureId: 'TemperateClimate', orbitVisible: true, revealed: false },
      { featureId: 'RichBiosphere', orbitVisible: false, revealed: false },
      { featureId: 'MountainRanges', orbitVisible: true, revealed: false },
    ],
    featureModifiers: [],
    orbitScanTurn: null,
    groundSurveyTurn: null,
    ...overrides,
  }
}

// ─── calculateExplorationGain ────────────────────────────────────────────────

describe('calculateExplorationGain', () => {
  it('always returns an integer in [5, 15]', () => {
    for (let i = 0; i < 200; i++) {
      const gain = calculateExplorationGain()
      expect(gain).toBeGreaterThanOrEqual(5)
      expect(gain).toBeLessThanOrEqual(15)
      expect(Number.isInteger(gain)).toBe(true)
    }
  })
})

// ─── calculatePOICount ───────────────────────────────────────────────────────

describe('calculatePOICount', () => {
  it('always returns 2, 3, or 4', () => {
    for (let i = 0; i < 200; i++) {
      const count = calculatePOICount()
      expect([2, 3, 4]).toContain(count)
    }
  })

  it('matches expected distribution over 1000 runs (±8%)', () => {
    const counts = { 2: 0, 3: 0, 4: 0 }
    const runs = 1000
    for (let i = 0; i < runs; i++) {
      const c = calculatePOICount() as 2 | 3 | 4
      counts[c]++
    }
    // poi_count = 2 + weighted_random(0:40%, 1:40%, 2:20%)
    // → 2 appears ~40%, 3 ~40%, 4 ~20%
    expect(counts[2] / runs).toBeCloseTo(0.4, 1) // ±8%
    expect(counts[3] / runs).toBeCloseTo(0.4, 1)
    expect(counts[4] / runs).toBeCloseTo(0.2, 1)
  })
})

// ─── generateOrbitScan ───────────────────────────────────────────────────────

describe('generateOrbitScan', () => {
  const planet = makePlanet()

  describe('tier 1 (corp level 1-2)', () => {
    it('reveals type and size', () => {
      const result = generateOrbitScan(planet, 1)
      expect(result.type).toBe(PlanetType.Continental)
      expect(result.size).toBe(PlanetSize.Medium)
    })

    it('does not reveal habitability', () => {
      expect(generateOrbitScan(planet, 1).habitability).toBeNull()
      expect(generateOrbitScan(planet, 2).habitability).toBeNull()
    })

    it('does not reveal deposits', () => {
      expect(generateOrbitScan(planet, 1).depositTypes).toHaveLength(0)
      expect(generateOrbitScan(planet, 2).depositTypes).toHaveLength(0)
    })

    it('does not reveal features', () => {
      expect(generateOrbitScan(planet, 1).revealedOrbitFeatureIds).toHaveLength(0)
      expect(generateOrbitScan(planet, 2).revealedOrbitFeatureIds).toHaveLength(0)
    })
  })

  describe('tier 2 (corp level 3-6)', () => {
    it('reveals deposit types but not richness', () => {
      const result = generateOrbitScan(planet, 3)
      expect(result.depositTypes).toContain(DepositType.FertileGround)
      expect(result.depositTypes).toContain(DepositType.CommonOreVein)
      expect(result.depositTypes).toHaveLength(2)
    })

    it('reveals orbit-visible features only', () => {
      const result = generateOrbitScan(planet, 5)
      expect(result.revealedOrbitFeatureIds).toContain('TemperateClimate')
      expect(result.revealedOrbitFeatureIds).toContain('MountainRanges')
      expect(result.revealedOrbitFeatureIds).not.toContain('RichBiosphere') // ground-only
      expect(result.revealedOrbitFeatureIds).toHaveLength(2)
    })

    it('does not reveal exact habitability', () => {
      expect(generateOrbitScan(planet, 3).habitability).toBeNull()
      expect(generateOrbitScan(planet, 6).habitability).toBeNull()
    })
  })

  describe('tier 3 (corp level 7-10)', () => {
    it('reveals exact habitability', () => {
      expect(generateOrbitScan(planet, 7).habitability).toBe(6)
      expect(generateOrbitScan(planet, 10).habitability).toBe(6)
    })

    it('also reveals deposits and orbit-visible features', () => {
      const result = generateOrbitScan(planet, 8)
      expect(result.depositTypes).toHaveLength(2)
      expect(result.revealedOrbitFeatureIds).toHaveLength(2)
    })
  })

  it('never reveals deposit richness', () => {
    // Orbit scan only returns deposit types, not richness — richness requires ground survey
    const result = generateOrbitScan(planet, 10)
    // OrbitScanResult has no richness field — just depositTypes: DepositType[]
    expect('richness' in result).toBe(false)
  })

  it('planet with no deposits/features returns empty arrays at tier 2+', () => {
    const bare = makePlanet({ deposits: [], features: [] })
    const result = generateOrbitScan(bare, 4)
    expect(result.depositTypes).toHaveLength(0)
    expect(result.revealedOrbitFeatureIds).toHaveLength(0)
  })
})
