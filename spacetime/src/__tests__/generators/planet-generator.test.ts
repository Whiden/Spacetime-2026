/**
 * planet-generator.test.ts — Tests for planet generation.
 *
 * Verifies: type/size spawn weight distribution, deposit pool matching,
 * feature slot limits, richness levels, modifier generation, and edge cases.
 */

import { describe, it, expect } from 'vitest'
import { generatePlanet } from '../../generators/planet-generator'
import type { GeneratePlanetOptions } from '../../generators/planet-generator'
import {
  PlanetType,
  PlanetSize,
  PlanetStatus,
  RichnessLevel,
  DepositType,
} from '../../types/common'
import type { SectorId } from '../../types/common'
import { PLANET_TYPE_DEFINITIONS, PLANET_TYPE_SPAWN_WEIGHTS } from '../../data/planet-types'
import { PLANET_SIZE_DEFINITIONS, PLANET_SIZE_SPAWN_WEIGHTS } from '../../data/planet-sizes'
import { PLANET_FEATURE_DEFINITIONS } from '../../data/planet-features'
import { DEPOSIT_DEFINITIONS } from '../../data/planet-deposits'

const TEST_SECTOR_ID = 'sec_test1234' as SectorId

function makeOptions(overrides: Partial<GeneratePlanetOptions> = {}): GeneratePlanetOptions {
  return {
    sectorId: TEST_SECTOR_ID,
    ...overrides,
  }
}

describe('generatePlanet', () => {
  it('returns a valid Planet object with all required properties', () => {
    const planet = generatePlanet(makeOptions())

    expect(planet.id).toMatch(/^pln_/)
    expect(planet.name).toBeTruthy()
    expect(planet.sectorId).toBe(TEST_SECTOR_ID)
    expect(Object.values(PlanetType)).toContain(planet.type)
    expect(Object.values(PlanetSize)).toContain(planet.size)
    expect(planet.status).toBe(PlanetStatus.OrbitScanned)
    expect(typeof planet.baseHabitability).toBe('number')
    expect(Array.isArray(planet.deposits)).toBe(true)
    expect(Array.isArray(planet.features)).toBe(true)
    expect(Array.isArray(planet.featureModifiers)).toBe(true)
    expect(planet.orbitScanTurn).toBeNull()
    expect(planet.groundSurveyTurn).toBeNull()
  })

  it('generates unique IDs for each planet', () => {
    const ids = Array.from({ length: 50 }, () => generatePlanet(makeOptions()).id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(50)
  })

  it('generates unique names when usedNames set is provided', () => {
    const usedNames = new Set<string>()
    const planets = Array.from({ length: 30 }, () =>
      generatePlanet(makeOptions({ usedNames })),
    )
    const names = planets.map((p) => p.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(30)
  })

  it('uses forced type when provided', () => {
    const planet = generatePlanet(makeOptions({ forcedType: PlanetType.Continental }))
    expect(planet.type).toBe(PlanetType.Continental)
    expect(planet.baseHabitability).toBe(8)
  })

  it('uses forced size when provided', () => {
    const planet = generatePlanet(makeOptions({ forcedSize: PlanetSize.Huge }))
    expect(planet.size).toBe(PlanetSize.Huge)
  })

  it('uses custom initial status when provided', () => {
    const planet = generatePlanet(makeOptions({ initialStatus: PlanetStatus.Undiscovered }))
    expect(planet.status).toBe(PlanetStatus.Undiscovered)
  })

  it('sets baseHabitability from planet type definition', () => {
    for (const planetType of Object.values(PlanetType)) {
      const planet = generatePlanet(makeOptions({ forcedType: planetType }))
      expect(planet.baseHabitability).toBe(PLANET_TYPE_DEFINITIONS[planetType].baseHabitability)
    }
  })
})

describe('planet type distribution', () => {
  it('distributes types roughly by spawn weight over 1000 runs (±5%)', () => {
    const counts: Record<string, number> = {}
    for (const pt of Object.values(PlanetType)) {
      counts[pt] = 0
    }

    const runs = 1000
    for (let i = 0; i < runs; i++) {
      const planet = generatePlanet(makeOptions())
      counts[planet.type]!++
    }

    // Calculate total weight for normalization
    const totalWeight = PLANET_TYPE_SPAWN_WEIGHTS.reduce((sum, w) => sum + w.weight, 0)

    for (const entry of PLANET_TYPE_SPAWN_WEIGHTS) {
      const expectedFraction = entry.weight / totalWeight
      const actualFraction = counts[entry.value]! / runs
      // ±5% tolerance as per acceptance criteria
      expect(actualFraction).toBeGreaterThan(expectedFraction - 0.05)
      expect(actualFraction).toBeLessThan(expectedFraction + 0.05)
    }
  })
})

describe('planet size distribution', () => {
  it('distributes sizes roughly by spawn weight over 1000 runs', () => {
    const counts: Record<string, number> = {}
    for (const ps of Object.values(PlanetSize)) {
      counts[ps] = 0
    }

    const runs = 1000
    for (let i = 0; i < runs; i++) {
      const planet = generatePlanet(makeOptions())
      counts[planet.size]!++
    }

    const totalWeight = PLANET_SIZE_SPAWN_WEIGHTS.reduce((sum, w) => sum + w.weight, 0)

    for (const entry of PLANET_SIZE_SPAWN_WEIGHTS) {
      const expectedFraction = entry.weight / totalWeight
      const actualFraction = counts[entry.value]! / runs
      // ±5% tolerance
      expect(actualFraction).toBeGreaterThan(expectedFraction - 0.05)
      expect(actualFraction).toBeLessThan(expectedFraction + 0.05)
    }
  })
})

describe('deposit generation', () => {
  it('deposits come from the planet type deposit pool', () => {
    // Run many times to check all generated deposits are in the pool
    for (let i = 0; i < 200; i++) {
      const planet = generatePlanet(makeOptions())
      const typeDef = PLANET_TYPE_DEFINITIONS[planet.type]
      const poolTypes = typeDef.depositPool.map((d) => d.type)

      for (const deposit of planet.deposits) {
        expect(poolTypes).toContain(deposit.type)
      }
    }
  })

  it('deposit count is within the size deposit slot range', () => {
    for (let i = 0; i < 200; i++) {
      const planet = generatePlanet(makeOptions())
      const sizeDef = PLANET_SIZE_DEFINITIONS[planet.size]
      // Deposits can be fewer than min if the pool is too small or rolls fail
      // But should never exceed max
      expect(planet.deposits.length).toBeLessThanOrEqual(sizeDef.depositSlots.max)
    }
  })

  it('guaranteed deposits always appear (when slots allow)', () => {
    // Jungle always has Fertile Ground guaranteed
    let foundGuaranteed = 0
    const runs = 100
    for (let i = 0; i < runs; i++) {
      const planet = generatePlanet(makeOptions({ forcedType: PlanetType.Jungle }))
      if (planet.deposits.some((d) => d.type === DepositType.FertileGround)) {
        foundGuaranteed++
      }
    }
    // Should be 100% (guaranteed)
    expect(foundGuaranteed).toBe(runs)
  })

  it('each deposit has a valid richness level', () => {
    const validRichness = Object.values(RichnessLevel)
    for (let i = 0; i < 100; i++) {
      const planet = generatePlanet(makeOptions())
      for (const deposit of planet.deposits) {
        expect(validRichness).toContain(deposit.richness)
      }
    }
  })

  it('deposits start with richnessRevealed = false', () => {
    for (let i = 0; i < 50; i++) {
      const planet = generatePlanet(makeOptions())
      for (const deposit of planet.deposits) {
        expect(deposit.richnessRevealed).toBe(false)
      }
    }
  })
})

describe('feature generation', () => {
  it('feature count is within the size feature slot range', () => {
    for (let i = 0; i < 200; i++) {
      const planet = generatePlanet(makeOptions())
      const sizeDef = PLANET_SIZE_DEFINITIONS[planet.size]
      // Features can be fewer than min (due to spawn chance), never exceed max
      expect(planet.features.length).toBeLessThanOrEqual(sizeDef.featureSlots.max)
    }
  })

  it('features are eligible for the planet type or size', () => {
    for (let i = 0; i < 200; i++) {
      const planet = generatePlanet(makeOptions())

      for (const feature of planet.features) {
        const featureDef = PLANET_FEATURE_DEFINITIONS.find(
          (f) => f.featureId === feature.featureId,
        )
        expect(featureDef).toBeDefined()

        const { spawnCondition } = featureDef!
        // Feature must match at least one eligibility criteria
        const typeMatch =
          spawnCondition.anyPlanetType ||
          spawnCondition.allowedPlanetTypes?.includes(planet.type) ||
          spawnCondition.allowedPlanetSizes?.includes(planet.size)
        expect(typeMatch).toBe(true)
      }
    }
  })

  it('features start with revealed = false', () => {
    for (let i = 0; i < 50; i++) {
      const planet = generatePlanet(makeOptions())
      for (const feature of planet.features) {
        expect(feature.revealed).toBe(false)
      }
    }
  })

  it('features have correct orbitVisible from definition', () => {
    for (let i = 0; i < 100; i++) {
      const planet = generatePlanet(makeOptions())
      for (const feature of planet.features) {
        const featureDef = PLANET_FEATURE_DEFINITIONS.find(
          (f) => f.featureId === feature.featureId,
        )
        expect(feature.orbitVisible).toBe(featureDef!.orbitVisible)
      }
    }
  })

  it('no duplicate features on the same planet', () => {
    for (let i = 0; i < 200; i++) {
      const planet = generatePlanet(makeOptions())
      const featureIds = planet.features.map((f) => f.featureId)
      const uniqueIds = new Set(featureIds)
      expect(uniqueIds.size).toBe(featureIds.length)
    }
  })
})

describe('feature modifier generation', () => {
  it('generates modifiers matching the planet features', () => {
    for (let i = 0; i < 100; i++) {
      const planet = generatePlanet(makeOptions())

      // Count expected modifiers from feature definitions
      let expectedModCount = 0
      for (const feature of planet.features) {
        const featureDef = PLANET_FEATURE_DEFINITIONS.find(
          (f) => f.featureId === feature.featureId,
        )!
        expectedModCount += featureDef.modifierTemplates.length
      }

      expect(planet.featureModifiers.length).toBe(expectedModCount)
    }
  })

  it('each modifier has correct sourceType and sourceId', () => {
    for (let i = 0; i < 50; i++) {
      const planet = generatePlanet(makeOptions())
      for (const mod of planet.featureModifiers) {
        expect(mod.sourceType).toBe('feature')
        expect(mod.id).toMatch(/^mod_/)
        // sourceId should match one of the planet's features
        const matchingFeature = planet.features.find(
          (f) => f.featureId === mod.sourceId,
        )
        expect(matchingFeature).toBeDefined()
      }
    }
  })

  it('modifier values match the feature definition templates', () => {
    // Generate a Continental planet with forced type to have predictable features
    for (let i = 0; i < 50; i++) {
      const planet = generatePlanet(makeOptions())

      for (const mod of planet.featureModifiers) {
        const featureDef = PLANET_FEATURE_DEFINITIONS.find(
          (f) => f.featureId === mod.sourceId,
        )!
        const matchingTemplate = featureDef.modifierTemplates.find(
          (t) => t.target === mod.target && t.operation === mod.operation && t.value === mod.value,
        )
        expect(matchingTemplate).toBeDefined()
      }
    }
  })

  it('modifiers have sourceName from feature name', () => {
    for (let i = 0; i < 50; i++) {
      const planet = generatePlanet(makeOptions())
      for (const mod of planet.featureModifiers) {
        const featureDef = PLANET_FEATURE_DEFINITIONS.find(
          (f) => f.featureId === mod.sourceId,
        )!
        expect(mod.sourceName).toBe(featureDef.name)
      }
    }
  })
})

describe('Gas Giant specifics', () => {
  it('Gas Giant always has Atmospheric Layers deposit', () => {
    let foundAtmospheric = 0
    const runs = 50
    for (let i = 0; i < runs; i++) {
      const planet = generatePlanet(makeOptions({ forcedType: PlanetType.GasGiant }))
      if (planet.deposits.some((d) => d.type === DepositType.AtmosphericLayers)) {
        foundAtmospheric++
      }
    }
    expect(foundAtmospheric).toBe(runs)
  })

  it('Gas Giant has baseHabitability of 0', () => {
    const planet = generatePlanet(makeOptions({ forcedType: PlanetType.GasGiant }))
    expect(planet.baseHabitability).toBe(0)
  })
})
