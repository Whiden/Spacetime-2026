/**
 * colony-generator.test.ts — Tests for colony generation.
 *
 * Verifies: starting infra matches colony type, attributes calculated correctly,
 * feature modifiers registered, colony type modifiers registered, deposit-dependent infra.
 */

import { describe, it, expect } from 'vitest'
import { generateColony } from '../../generators/colony-generator'
import type { GenerateColonyOptions } from '../../generators/colony-generator'
import { generatePlanet } from '../../generators/planet-generator'
import {
  PlanetType,
  PlanetSize,
  PlanetStatus,
  ColonyType,
  InfraDomain,
  DepositType,
  RichnessLevel,
} from '../../types/common'
import type { SectorId, TurnNumber, PlanetId } from '../../types/common'
import type { Planet, Deposit, PlanetFeature } from '../../types/planet'
import type { Modifier } from '../../types/modifier'
import { COLONY_TYPE_DEFINITIONS } from '../../data/colony-types'
import { getTotalLevels } from '../../types/infrastructure'
import { generatePlanetId } from '../../utils/id'

const TEST_SECTOR_ID = 'sec_test1234' as SectorId
const TEST_TURN = 1 as TurnNumber

/** Creates a minimal planet for testing. */
function makeTestPlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: generatePlanetId(),
    name: 'Test Planet',
    sectorId: TEST_SECTOR_ID,
    type: PlanetType.Continental,
    size: PlanetSize.Medium,
    status: PlanetStatus.Accepted,
    baseHabitability: 8,
    deposits: [
      { type: DepositType.FertileGround, richness: RichnessLevel.Rich, richnessRevealed: true },
      { type: DepositType.CommonOreVein, richness: RichnessLevel.Moderate, richnessRevealed: true },
    ],
    features: [
      { featureId: 'TemperateClimate', orbitVisible: true, revealed: true },
    ],
    featureModifiers: [
      {
        id: 'mod_test0001' as any,
        target: 'habitability',
        operation: 'add',
        value: 1,
        sourceType: 'feature',
        sourceId: 'TemperateClimate',
        sourceName: 'Temperate Climate',
      },
      {
        id: 'mod_test0002' as any,
        target: 'maxAgricultural',
        operation: 'add',
        value: 5,
        sourceType: 'feature',
        sourceId: 'TemperateClimate',
        sourceName: 'Temperate Climate',
      },
    ],
    orbitScanTurn: 1,
    groundSurveyTurn: 1,
    ...overrides,
  }
}

function makeOptions(overrides: Partial<GenerateColonyOptions> = {}): GenerateColonyOptions {
  return {
    planet: makeTestPlanet(),
    colonyType: ColonyType.FrontierColony,
    foundedTurn: TEST_TURN,
    ...overrides,
  }
}

describe('generateColony — basic properties', () => {
  it('returns a Colony with all required properties', () => {
    const colony = generateColony(makeOptions())

    expect(colony.id).toMatch(/^col_/)
    expect(colony.planetId).toBeTruthy()
    expect(colony.sectorId).toBe(TEST_SECTOR_ID)
    expect(colony.name).toBe('Test Planet')
    expect(colony.type).toBe(ColonyType.FrontierColony)
    expect(colony.foundedTurn).toBe(TEST_TURN)
    expect(colony.corporationsPresent).toEqual([])
    expect(colony.infrastructure).toBeDefined()
    expect(colony.attributes).toBeDefined()
    expect(Array.isArray(colony.modifiers)).toBe(true)
  })

  it('uses custom name when provided', () => {
    const colony = generateColony(makeOptions({ name: 'Custom Name' }))
    expect(colony.name).toBe('Custom Name')
  })

  it('defaults name to planet name', () => {
    const planet = makeTestPlanet({ name: 'Kepler Prime' })
    const colony = generateColony(makeOptions({ planet }))
    expect(colony.name).toBe('Kepler Prime')
  })

  it('uses colony type starting population when no override', () => {
    const colony = generateColony(makeOptions({ colonyType: ColonyType.FrontierColony }))
    expect(colony.populationLevel).toBe(COLONY_TYPE_DEFINITIONS[ColonyType.FrontierColony].startingPopulationLevel)
  })

  it('uses override population level when provided', () => {
    const colony = generateColony(makeOptions({ populationLevel: 7 }))
    expect(colony.populationLevel).toBe(7)
  })
})

describe('generateColony — starting infrastructure', () => {
  it('Frontier Colony starts with Civilian 10, LowIndustry 1, Agricultural 1 (when deposit exists)', () => {
    const planet = makeTestPlanet({
      deposits: [
        { type: DepositType.FertileGround, richness: RichnessLevel.Rich, richnessRevealed: true },
      ],
    })
    const colony = generateColony(makeOptions({ planet, colonyType: ColonyType.FrontierColony }))

    expect(colony.infrastructure[InfraDomain.Civilian].ownership.publicLevels).toBe(10)
    expect(colony.infrastructure[InfraDomain.LowIndustry].ownership.publicLevels).toBe(1)
    expect(colony.infrastructure[InfraDomain.Agricultural].ownership.publicLevels).toBe(1)
  })

  it('Frontier Colony skips Agricultural if no food deposit', () => {
    const planet = makeTestPlanet({
      deposits: [
        { type: DepositType.CommonOreVein, richness: RichnessLevel.Moderate, richnessRevealed: true },
      ],
    })
    const colony = generateColony(makeOptions({ planet, colonyType: ColonyType.FrontierColony }))

    expect(colony.infrastructure[InfraDomain.Civilian].ownership.publicLevels).toBe(10)
    expect(colony.infrastructure[InfraDomain.LowIndustry].ownership.publicLevels).toBe(1)
    // No food deposit → Agricultural skipped
    expect(colony.infrastructure[InfraDomain.Agricultural].ownership.publicLevels).toBe(0)
  })

  it('Mining Outpost starts with extraction infra matching available deposits', () => {
    const planet = makeTestPlanet({
      deposits: [
        { type: DepositType.CommonOreVein, richness: RichnessLevel.Rich, richnessRevealed: true },
        { type: DepositType.RareOreVein, richness: RichnessLevel.Poor, richnessRevealed: true },
      ],
    })
    const colony = generateColony(makeOptions({ planet, colonyType: ColonyType.MiningOutpost }))

    expect(colony.infrastructure[InfraDomain.Civilian].ownership.publicLevels).toBe(8)
    // Mining deposit exists → Mining 3
    expect(colony.infrastructure[InfraDomain.Mining].ownership.publicLevels).toBe(3)
    // DeepMining deposit exists → DeepMining 3
    expect(colony.infrastructure[InfraDomain.DeepMining].ownership.publicLevels).toBe(3)
    // No gas deposit → GasExtraction 0
    expect(colony.infrastructure[InfraDomain.GasExtraction].ownership.publicLevels).toBe(0)
  })

  it('Science Outpost starts with Civilian 6, Science 3', () => {
    const colony = generateColony(makeOptions({ colonyType: ColonyType.ScienceOutpost }))

    expect(colony.infrastructure[InfraDomain.Civilian].ownership.publicLevels).toBe(6)
    expect(colony.infrastructure[InfraDomain.Science].ownership.publicLevels).toBe(3)
  })

  it('Military Outpost starts with Civilian 8, Military 3', () => {
    const colony = generateColony(makeOptions({ colonyType: ColonyType.MilitaryOutpost }))

    expect(colony.infrastructure[InfraDomain.Civilian].ownership.publicLevels).toBe(8)
    expect(colony.infrastructure[InfraDomain.Military].ownership.publicLevels).toBe(3)
  })

  it('uses override infrastructure when provided', () => {
    const colony = generateColony(makeOptions({
      overrideInfrastructure: [
        { domain: InfraDomain.Civilian, publicLevels: 14 },
        { domain: InfraDomain.Mining, publicLevels: 2 },
        { domain: InfraDomain.Military, publicLevels: 5 },
      ],
    }))

    expect(colony.infrastructure[InfraDomain.Civilian].ownership.publicLevels).toBe(14)
    expect(colony.infrastructure[InfraDomain.Mining].ownership.publicLevels).toBe(2)
    expect(colony.infrastructure[InfraDomain.Military].ownership.publicLevels).toBe(5)
    // Non-specified domains are zero
    expect(colony.infrastructure[InfraDomain.Science].ownership.publicLevels).toBe(0)
  })

  it('all 12 infrastructure domains are present', () => {
    const colony = generateColony(makeOptions())
    const allDomains = Object.values(InfraDomain)

    for (const domain of allDomains) {
      expect(colony.infrastructure[domain]).toBeDefined()
      expect(colony.infrastructure[domain].domain).toBe(domain)
    }
  })

  it('all corporate levels start empty', () => {
    const colony = generateColony(makeOptions())
    const allDomains = Object.values(InfraDomain)

    for (const domain of allDomains) {
      expect(colony.infrastructure[domain].ownership.corporateLevels.size).toBe(0)
    }
  })
})

describe('generateColony — modifiers', () => {
  it('registers planet feature modifiers onto colony', () => {
    const planet = makeTestPlanet()
    const colony = generateColony(makeOptions({ planet }))

    // Planet has 2 feature modifiers (from Temperate Climate: +1 hab, +5 maxAgricultural)
    const featureMods = colony.modifiers.filter((m) => m.sourceType === 'feature')
    expect(featureMods.length).toBe(2)
  })

  it('feature modifiers have correct sourceType and sourceId', () => {
    const planet = makeTestPlanet()
    const colony = generateColony(makeOptions({ planet }))

    const featureMods = colony.modifiers.filter((m) => m.sourceType === 'feature')
    for (const mod of featureMods) {
      expect(mod.sourceType).toBe('feature')
      expect(mod.sourceId).toBe('TemperateClimate')
      expect(mod.sourceName).toBe('Temperate Climate')
      expect(mod.id).toMatch(/^mod_/)
    }
  })

  it('feature modifiers get fresh IDs (independent of planet)', () => {
    const planet = makeTestPlanet()
    const colony = generateColony(makeOptions({ planet }))

    const featureMods = colony.modifiers.filter((m) => m.sourceType === 'feature')
    const planetModIds = planet.featureModifiers.map((m) => m.id)

    // Colony modifier IDs should be different from planet modifier IDs
    for (const mod of featureMods) {
      expect(planetModIds).not.toContain(mod.id)
    }
  })

  it('registers colony type passive bonus as modifiers', () => {
    const colony = generateColony(makeOptions({ colonyType: ColonyType.FrontierColony }))

    const colonyTypeMods = colony.modifiers.filter((m) => m.sourceType === 'colonyType')
    // Frontier Colony has 1 passive bonus: dynamism +1
    expect(colonyTypeMods.length).toBe(1)
    expect(colonyTypeMods[0]!.target).toBe('dynamism')
    expect(colonyTypeMods[0]!.operation).toBe('add')
    expect(colonyTypeMods[0]!.value).toBe(1)
  })

  it('colony type modifiers have correct sourceType and sourceId', () => {
    const colony = generateColony(makeOptions({ colonyType: ColonyType.FrontierColony }))

    const colonyTypeMods = colony.modifiers.filter((m) => m.sourceType === 'colonyType')
    for (const mod of colonyTypeMods) {
      expect(mod.sourceType).toBe('colonyType')
      expect(mod.sourceId).toBe(ColonyType.FrontierColony)
      expect(mod.sourceName).toBe('Frontier Colony')
      expect(mod.id).toMatch(/^mod_/)
    }
  })

  it('Mining Outpost has extraction output passive bonuses', () => {
    const colony = generateColony(makeOptions({ colonyType: ColonyType.MiningOutpost }))

    const colonyTypeMods = colony.modifiers.filter((m) => m.sourceType === 'colonyType')
    expect(colonyTypeMods.length).toBe(3)

    const targets = colonyTypeMods.map((m) => m.target).sort()
    expect(targets).toEqual(['deepMiningOutput', 'gasExtractionOutput', 'miningOutput'])
  })

  it('Military Outpost has stability and maxMilitary passive bonuses', () => {
    const colony = generateColony(makeOptions({ colonyType: ColonyType.MilitaryOutpost }))

    const colonyTypeMods = colony.modifiers.filter((m) => m.sourceType === 'colonyType')
    expect(colonyTypeMods.length).toBe(2)

    const targets = colonyTypeMods.map((m) => m.target).sort()
    expect(targets).toEqual(['maxMilitary', 'stability'])
  })

  it('does NOT register empire-wide bonuses as modifiers', () => {
    const colony = generateColony(makeOptions())

    // No modifiers should have sourceType related to empire-wide things
    for (const mod of colony.modifiers) {
      expect(['feature', 'colonyType']).toContain(mod.sourceType)
    }
  })
})

describe('generateColony — attribute calculation', () => {
  it('habitability includes planet base + feature modifiers', () => {
    // Continental base 8, Temperate Climate +1 = 9
    const planet = makeTestPlanet()
    const colony = generateColony(makeOptions({ planet }))

    expect(colony.attributes.habitability).toBe(9) // 8 + 1
  })

  it('habitability is clamped to 0–10', () => {
    // Barren base 1, add harsh features to push below 0
    const planet = makeTestPlanet({
      type: PlanetType.Barren,
      baseHabitability: 1,
      features: [
        { featureId: 'HarshRadiation', orbitVisible: true, revealed: true },
        { featureId: 'ToxicEnvironment', orbitVisible: true, revealed: true },
      ],
      featureModifiers: [
        {
          id: 'mod_test0001' as any,
          target: 'habitability',
          operation: 'add',
          value: -2,
          sourceType: 'feature',
          sourceId: 'HarshRadiation',
          sourceName: 'Harsh Radiation',
        },
        {
          id: 'mod_test0002' as any,
          target: 'habitability',
          operation: 'add',
          value: -2,
          sourceType: 'feature',
          sourceId: 'ToxicEnvironment',
          sourceName: 'Toxic Environment',
        },
      ],
    })
    const colony = generateColony(makeOptions({ planet }))

    // 1 - 2 - 2 = -3, clamped to 0
    expect(colony.attributes.habitability).toBe(0)
  })

  it('accessibility accounts for transport infrastructure', () => {
    const colony = generateColony(makeOptions({
      overrideInfrastructure: [
        { domain: InfraDomain.Transport, publicLevels: 4 },
      ],
    }))

    // Base: 3 + floor(4/2) = 5, plus any accessibility modifiers
    expect(colony.attributes.accessibility).toBeGreaterThanOrEqual(5)
  })

  it('all attributes are clamped between 0 and 10', () => {
    for (let i = 0; i < 20; i++) {
      const planet = generatePlanet({ sectorId: TEST_SECTOR_ID })
      const colony = generateColony({
        planet,
        colonyType: ColonyType.FrontierColony,
        foundedTurn: TEST_TURN,
      })

      expect(colony.attributes.habitability).toBeGreaterThanOrEqual(0)
      expect(colony.attributes.habitability).toBeLessThanOrEqual(10)
      expect(colony.attributes.accessibility).toBeGreaterThanOrEqual(0)
      expect(colony.attributes.accessibility).toBeLessThanOrEqual(10)
      expect(colony.attributes.dynamism).toBeGreaterThanOrEqual(0)
      expect(colony.attributes.dynamism).toBeLessThanOrEqual(10)
      expect(colony.attributes.qualityOfLife).toBeGreaterThanOrEqual(0)
      expect(colony.attributes.qualityOfLife).toBeLessThanOrEqual(10)
      expect(colony.attributes.stability).toBeGreaterThanOrEqual(0)
      expect(colony.attributes.stability).toBeLessThanOrEqual(10)
    }
  })

  it('growth starts at 0', () => {
    const colony = generateColony(makeOptions())
    expect(colony.attributes.growth).toBe(0)
  })
})

describe('generateColony — Terra Nova scenario', () => {
  it('can create Terra Nova with override infrastructure and population', () => {
    const planet = makeTestPlanet({ name: 'Terra Nova' })
    const colony = generateColony({
      planet,
      colonyType: ColonyType.FrontierColony,
      name: 'Terra Nova',
      populationLevel: 7,
      foundedTurn: 0 as TurnNumber,
      overrideInfrastructure: [
        { domain: InfraDomain.Civilian, publicLevels: 14 },
        { domain: InfraDomain.Mining, publicLevels: 2 },
        { domain: InfraDomain.Agricultural, publicLevels: 3 },
        { domain: InfraDomain.LowIndustry, publicLevels: 2 },
        { domain: InfraDomain.Transport, publicLevels: 2 },
        { domain: InfraDomain.Science, publicLevels: 1 },
        { domain: InfraDomain.HeavyIndustry, publicLevels: 1 },
        { domain: InfraDomain.HighTechIndustry, publicLevels: 1 },
        { domain: InfraDomain.SpaceIndustry, publicLevels: 1 },
        { domain: InfraDomain.Military, publicLevels: 2 },
      ],
    })

    expect(colony.name).toBe('Terra Nova')
    expect(colony.populationLevel).toBe(7)
    expect(colony.type).toBe(ColonyType.FrontierColony)
    expect(colony.infrastructure[InfraDomain.Civilian].ownership.publicLevels).toBe(14)
    expect(colony.infrastructure[InfraDomain.Mining].ownership.publicLevels).toBe(2)
    expect(colony.infrastructure[InfraDomain.Agricultural].ownership.publicLevels).toBe(3)
    expect(colony.infrastructure[InfraDomain.Military].ownership.publicLevels).toBe(2)
  })
})
