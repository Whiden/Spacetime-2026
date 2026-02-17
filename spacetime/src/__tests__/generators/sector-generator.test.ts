/**
 * sector-generator.test.ts — Tests for sector generation.
 *
 * Verifies: unique names, density distribution by spawn weight, threat modifier range,
 * exploration percentage defaults, and edge cases.
 */

import { describe, it, expect } from 'vitest'
import { generateSector, DENSITY_SPAWN_WEIGHTS } from '../../generators/sector-generator'
import { SectorDensity } from '../../types/common'
import { SECTOR_NAMES } from '../../data/sector-names'
import { GALAXY_GENERATION_PARAMS } from '../../data/start-conditions'

describe('generateSector', () => {
  it('returns a valid Sector object with all required properties', () => {
    const sector = generateSector()

    expect(sector.id).toMatch(/^sec_/)
    expect(sector.name).toBeTruthy()
    expect(Object.values(SectorDensity)).toContain(sector.density)
    expect(sector.explorationPercent).toBe(0)
    expect(sector.threatModifier).toBeGreaterThanOrEqual(0.5)
    expect(sector.threatModifier).toBeLessThanOrEqual(1.5)
    expect(sector.firstEnteredTurn).toBeNull()
  })

  it('generates a name from the sector name pool', () => {
    const sector = generateSector()
    expect(SECTOR_NAMES).toContain(sector.name)
  })

  it('generates unique names when usedNames set is provided', () => {
    const usedNames = new Set<string>()
    const sectors = Array.from({ length: 15 }, () => generateSector({ usedNames }))
    const names = sectors.map((s) => s.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(15)
  })

  it('throws when all sector names are exhausted', () => {
    const usedNames = new Set(SECTOR_NAMES)
    expect(() => generateSector({ usedNames })).toThrow('All sector names exhausted')
  })

  it('assigns exploration 0% for non-starting sectors', () => {
    const sector = generateSector({ isStartingSector: false })
    expect(sector.explorationPercent).toBe(0)
  })

  it('assigns starting exploration percentage for starting sector', () => {
    const sector = generateSector({ isStartingSector: true })
    expect(sector.explorationPercent).toBe(GALAXY_GENERATION_PARAMS.startingSectorExplorationPercent)
  })

  it('assigns threat modifier within [0.5, 1.5]', () => {
    // Run 100 times to test range
    for (let i = 0; i < 100; i++) {
      const sector = generateSector()
      expect(sector.threatModifier).toBeGreaterThanOrEqual(0.5)
      expect(sector.threatModifier).toBeLessThanOrEqual(1.5)
    }
  })

  it('rounds threat modifier to 2 decimal places', () => {
    for (let i = 0; i < 50; i++) {
      const sector = generateSector()
      const decimalStr = sector.threatModifier.toString()
      const parts = decimalStr.split('.')
      if (parts.length > 1) {
        expect(parts[1]!.length).toBeLessThanOrEqual(2)
      }
    }
  })

  it('generates unique IDs for each sector', () => {
    const ids = Array.from({ length: 50 }, () => generateSector().id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(50)
  })
})

describe('density distribution', () => {
  it('assigns density from valid SectorDensity values', () => {
    const validDensities = Object.values(SectorDensity)
    for (let i = 0; i < 50; i++) {
      const sector = generateSector()
      expect(validDensities).toContain(sector.density)
    }
  })

  it('distributes density roughly by spawn weight over 1000 runs', () => {
    const counts: Record<SectorDensity, number> = {
      [SectorDensity.Sparse]: 0,
      [SectorDensity.Moderate]: 0,
      [SectorDensity.Dense]: 0,
    }

    const runs = 1000
    for (let i = 0; i < runs; i++) {
      const sector = generateSector()
      counts[sector.density]++
    }

    // Expected: Sparse 30%, Moderate 50%, Dense 20%
    // Allow ±8% tolerance for random distribution
    const tolerance = 0.08
    for (const entry of DENSITY_SPAWN_WEIGHTS) {
      const expectedFraction = entry.weight / 100
      const actualFraction = counts[entry.value] / runs
      expect(actualFraction).toBeGreaterThan(expectedFraction - tolerance)
      expect(actualFraction).toBeLessThan(expectedFraction + tolerance)
    }
  })
})
