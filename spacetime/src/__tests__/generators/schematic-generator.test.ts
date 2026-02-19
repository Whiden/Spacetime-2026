/**
 * schematic-generator.test.ts — Unit tests for schematic generation (Story 14.3).
 *
 * Covers:
 * - calculateSchematicChance: corp_level × 2
 * - getMaxSchematics: floor(corp_level / 2)
 * - getAllUnlockedCategories: collects categories from domains
 * - generateSchematicName: prefix + category + iteration label
 * - generateSchematic: creates Schematic with correct stats
 * - rollForSchematic: chance roll, cap enforcement, category replacement
 * - updateSchematicsOnDomainLevelUp: versioning with preserved randomModifier
 */

import { describe, it, expect } from 'vitest'
import {
  calculateSchematicChance,
  getMaxSchematics,
  getAllUnlockedCategories,
  generateSchematicName,
  generateSchematic,
  rollForSchematic,
  updateSchematicsOnDomainLevelUp,
  findDomainForCategory,
  findDiscoveryForCategory,
} from '../../generators/schematic-generator'
import type { ScienceDomainState, Schematic, Discovery } from '../../types/science'
import type { Corporation } from '../../types/corporation'
import type { CorpId, ColonyId, TurnNumber, DiscoveryId, SchematicId } from '../../types/common'
import { ScienceSectorType, SchematicCategory, CorpType, CorpPersonalityTrait } from '../../types/common'
import { SCHEMATIC_CATEGORY_DEFINITIONS } from '../../data/schematics'

// ─── Test Constants ───────────────────────────────────────────────────────────

const TURN_5 = 5 as TurnNumber
const CORP_ID = 'corp_ship01' as CorpId
const DISC_ID = 'dsc_test01' as DiscoveryId

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDomainState(
  type: ScienceSectorType,
  level: number,
  unlockedSchematicCategories: SchematicCategory[] = [],
): ScienceDomainState {
  return {
    type,
    level,
    accumulatedPoints: 0,
    thresholdToNextLevel: (level + 1) * 15,
    focused: false,
    discoveredIds: [],
    unlockedSchematicCategories,
  }
}

function makeAllDomains(overrides: Partial<Record<ScienceSectorType, { level: number; categories: SchematicCategory[] }>> = {}): Map<string, ScienceDomainState> {
  const domains = new Map<string, ScienceDomainState>()
  for (const domainType of Object.values(ScienceSectorType)) {
    const override = overrides[domainType]
    domains.set(domainType, makeDomainState(
      domainType,
      override?.level ?? 0,
      override?.categories ?? [],
    ))
  }
  return domains
}

function makeShipbuildingCorp(level: number, id: string = CORP_ID): Corporation {
  return {
    id: id as CorpId,
    name: 'Test Shipbuilding Corp',
    type: CorpType.Shipbuilding,
    level,
    capital: 5,
    traits: [CorpPersonalityTrait.Innovative],
    homePlanetId: 'pln_test01' as any,
    planetsPresent: ['pln_test01' as any],
    assets: {
      infrastructureByColony: new Map(),
      schematics: [],
      patents: [],
    },
    activeContractIds: [],
    foundedTurn: 1 as TurnNumber,
  }
}

function makeDiscovery(
  id: string,
  domain: ScienceSectorType,
  unlocksCategories: SchematicCategory[],
): Discovery {
  return {
    id: id as DiscoveryId,
    sourceDefinitionId: `def_${id}`,
    name: `Test Discovery ${id}`,
    description: 'A test discovery',
    domain,
    poolLevel: 1,
    discoveredByCorpId: 'corp_sci01' as CorpId,
    discoveredTurn: 3 as TurnNumber,
    empireBonusEffects: [],
    unlocksSchematicCategories: unlocksCategories,
  }
}

function makeSchematic(
  category: SchematicCategory,
  ownerCorpId: string = CORP_ID,
  domain: ScienceSectorType = ScienceSectorType.Weaponry,
  level: number = 1,
): Schematic {
  const catDef = SCHEMATIC_CATEGORY_DEFINITIONS[category]
  return {
    id: `sch_test_${category}` as SchematicId,
    name: `Test ${catDef.name}`,
    category,
    scienceDomain: domain,
    level,
    statTarget: catDef.primaryStatTarget,
    bonusAmount: level * catDef.baseBonusPerLevel,
    randomModifier: 0,
    iteration: 1,
    ownerCorpId: ownerCorpId as CorpId,
    sourceDiscoveryId: DISC_ID,
  }
}

// Deterministic RNG for tests: returns values from an array in sequence
function seededRand(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]!
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('calculateSchematicChance', () => {
  it('returns corp_level × 2', () => {
    expect(calculateSchematicChance(1)).toBe(2)
    expect(calculateSchematicChance(5)).toBe(10)
    expect(calculateSchematicChance(10)).toBe(20)
  })

  it('returns 0 for level 0', () => {
    expect(calculateSchematicChance(0)).toBe(0)
  })
})

describe('getMaxSchematics', () => {
  it('returns floor(corp_level / 2)', () => {
    expect(getMaxSchematics(1)).toBe(0)
    expect(getMaxSchematics(2)).toBe(1)
    expect(getMaxSchematics(3)).toBe(1)
    expect(getMaxSchematics(4)).toBe(2)
    expect(getMaxSchematics(5)).toBe(2)
    expect(getMaxSchematics(10)).toBe(5)
  })
})

describe('getAllUnlockedCategories', () => {
  it('returns empty when no categories unlocked', () => {
    const domains = makeAllDomains()
    expect(getAllUnlockedCategories(domains)).toEqual([])
  })

  it('returns categories from a single domain', () => {
    const domains = makeAllDomains({
      [ScienceSectorType.Weaponry]: { level: 1, categories: [SchematicCategory.Turret, SchematicCategory.Missile] },
    })
    const result = getAllUnlockedCategories(domains)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.category)).toContain(SchematicCategory.Turret)
    expect(result.map(r => r.category)).toContain(SchematicCategory.Missile)
  })

  it('uses higher-level domain when category appears in multiple domains', () => {
    const domains = makeAllDomains({
      [ScienceSectorType.Weaponry]: { level: 1, categories: [SchematicCategory.Turret] },
      [ScienceSectorType.Computing]: { level: 3, categories: [SchematicCategory.Turret] },
    })
    const result = getAllUnlockedCategories(domains)
    expect(result).toHaveLength(1)
    expect(result[0]!.domain).toBe(ScienceSectorType.Computing)
    expect(result[0]!.domainLevel).toBe(3)
  })
})

describe('findDomainForCategory', () => {
  it('finds the domain that unlocked a category', () => {
    const domains = makeAllDomains({
      [ScienceSectorType.Weaponry]: { level: 1, categories: [SchematicCategory.Turret] },
    })
    const result = findDomainForCategory(SchematicCategory.Turret, domains)
    expect(result).toEqual({ domain: ScienceSectorType.Weaponry, level: 1 })
  })

  it('returns null when category not unlocked', () => {
    const domains = makeAllDomains()
    expect(findDomainForCategory(SchematicCategory.Turret, domains)).toBeNull()
  })
})

describe('findDiscoveryForCategory', () => {
  it('finds the discovery that unlocked a category', () => {
    const disc = makeDiscovery('disc1', ScienceSectorType.Weaponry, [SchematicCategory.Turret])
    expect(findDiscoveryForCategory(SchematicCategory.Turret, [disc])).toBe(disc.id)
  })

  it('returns null when no discovery matches', () => {
    expect(findDiscoveryForCategory(SchematicCategory.Turret, [])).toBeNull()
  })
})

describe('generateSchematicName', () => {
  it('generates name without Mk suffix for iteration 1', () => {
    const name = generateSchematicName(SchematicCategory.Missile, 1, seededRand(0))
    // First prefix + category name, no Mk suffix
    expect(name).toContain('Missile')
    expect(name).not.toContain('Mk')
  })

  it('generates name with Mk suffix for iteration 2+', () => {
    const name = generateSchematicName(SchematicCategory.Missile, 3, seededRand(0))
    expect(name).toContain('Mk3')
  })
})

describe('generateSchematic', () => {
  it('creates a schematic with correct level-based bonus', () => {
    // randFn returns 0.5 → randomModifier = floor(0.5 * 3) - 1 = 0
    // Then 0.5 for name prefix selection
    const schematic = generateSchematic(
      SchematicCategory.Turret,
      ScienceSectorType.Weaponry,
      2,
      CORP_ID,
      DISC_ID,
      seededRand(0.5, 0.5),
    )
    const catDef = SCHEMATIC_CATEGORY_DEFINITIONS[SchematicCategory.Turret]
    expect(schematic.category).toBe(SchematicCategory.Turret)
    expect(schematic.scienceDomain).toBe(ScienceSectorType.Weaponry)
    expect(schematic.level).toBe(2)
    expect(schematic.statTarget).toBe(catDef.primaryStatTarget)
    // bonusAmount = 2 * 1 + 0 = 2
    expect(schematic.bonusAmount).toBe(2)
    expect(schematic.randomModifier).toBe(0)
    expect(schematic.iteration).toBe(1)
    expect(schematic.ownerCorpId).toBe(CORP_ID)
  })

  it('applies random modifier -1 when rand < 0.33', () => {
    const schematic = generateSchematic(
      SchematicCategory.Turret,
      ScienceSectorType.Weaponry,
      1,
      CORP_ID,
      DISC_ID,
      seededRand(0.1, 0.5), // 0.1 → floor(0.1*3)-1 = -1
    )
    expect(schematic.randomModifier).toBe(-1)
    // bonusAmount = max(0, 1 * 1 + (-1)) = 0
    expect(schematic.bonusAmount).toBe(0)
  })

  it('applies random modifier +1 when rand >= 0.66', () => {
    const schematic = generateSchematic(
      SchematicCategory.Turret,
      ScienceSectorType.Weaponry,
      1,
      CORP_ID,
      DISC_ID,
      seededRand(0.9, 0.5), // 0.9 → floor(0.9*3)-1 = +1
    )
    expect(schematic.randomModifier).toBe(1)
    // bonusAmount = 1 * 1 + 1 = 2
    expect(schematic.bonusAmount).toBe(2)
  })

  it('ensures minimum level of 1', () => {
    const schematic = generateSchematic(
      SchematicCategory.Turret,
      ScienceSectorType.Weaponry,
      0, // domain level 0 should become 1
      CORP_ID,
      DISC_ID,
      seededRand(0.5, 0.5),
    )
    expect(schematic.level).toBe(1)
  })
})

describe('rollForSchematic', () => {
  it('returns null for non-shipbuilding corps', () => {
    const corp = { ...makeShipbuildingCorp(4), type: CorpType.Science }
    const domains = makeAllDomains({
      [ScienceSectorType.Weaponry]: { level: 1, categories: [SchematicCategory.Turret] },
    })
    const discoveries = [makeDiscovery('d1', ScienceSectorType.Weaponry, [SchematicCategory.Turret])]
    const result = rollForSchematic(corp, domains, [], discoveries, TURN_5)
    expect(result.newSchematic).toBeNull()
  })

  it('returns null when no categories are unlocked', () => {
    const corp = makeShipbuildingCorp(4)
    const domains = makeAllDomains()
    const result = rollForSchematic(corp, domains, [], [], TURN_5)
    expect(result.newSchematic).toBeNull()
  })

  it('returns null when corp is at schematic cap', () => {
    // Level 2 corp → max 1 schematic. Already has 1 in a unique category.
    const corp = makeShipbuildingCorp(2)
    const domains = makeAllDomains({
      [ScienceSectorType.Weaponry]: { level: 1, categories: [SchematicCategory.Turret, SchematicCategory.Missile] },
    })
    const existingSchematic = makeSchematic(SchematicCategory.Turret, CORP_ID)
    const discoveries = [makeDiscovery('d1', ScienceSectorType.Weaponry, [SchematicCategory.Turret, SchematicCategory.Missile])]

    // Force all rolls to succeed
    const result = rollForSchematic(corp, domains, [existingSchematic], discoveries, TURN_5, seededRand(0))
    expect(result.newSchematic).toBeNull()
  })

  it('returns null when chance roll fails', () => {
    const corp = makeShipbuildingCorp(2) // chance = 4%
    const domains = makeAllDomains({
      [ScienceSectorType.Weaponry]: { level: 1, categories: [SchematicCategory.Turret] },
    })
    const discoveries = [makeDiscovery('d1', ScienceSectorType.Weaponry, [SchematicCategory.Turret])]
    // randFn returns 0.99 → 0.99 * 100 = 99 >= 4, fail
    const result = rollForSchematic(corp, domains, [], discoveries, TURN_5, seededRand(0.99))
    expect(result.newSchematic).toBeNull()
  })

  it('generates schematic on successful roll', () => {
    const corp = makeShipbuildingCorp(4) // chance = 8%, max = 2 schematics
    const domains = makeAllDomains({
      [ScienceSectorType.Weaponry]: { level: 2, categories: [SchematicCategory.Turret] },
    })
    const discoveries = [makeDiscovery('d1', ScienceSectorType.Weaponry, [SchematicCategory.Turret])]

    // rand sequence: 0.01 (chance roll passes: 0.01*100=1 < 8),
    //                0.0 (pick category index 0),
    //                0.5 (random modifier = 0),
    //                0.5 (name prefix)
    const result = rollForSchematic(corp, domains, [], discoveries, TURN_5, seededRand(0.01, 0.0, 0.5, 0.5))
    expect(result.newSchematic).not.toBeNull()
    expect(result.newSchematic!.category).toBe(SchematicCategory.Turret)
    expect(result.newSchematic!.level).toBe(2)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]!.title).toContain('New Schematic')
  })

  it('replaces existing schematic in same category', () => {
    const corp = makeShipbuildingCorp(4)
    const domains = makeAllDomains({
      [ScienceSectorType.Weaponry]: { level: 2, categories: [SchematicCategory.Turret] },
    })
    const existingSchematic = makeSchematic(SchematicCategory.Turret, CORP_ID)
    const discoveries = [makeDiscovery('d1', ScienceSectorType.Weaponry, [SchematicCategory.Turret])]

    const result = rollForSchematic(
      corp, domains, [existingSchematic], discoveries, TURN_5,
      seededRand(0.01, 0.0, 0.5, 0.5),
    )
    expect(result.newSchematic).not.toBeNull()
    expect(result.replacedSchematicId).toBe(existingSchematic.id)
  })
})

describe('updateSchematicsOnDomainLevelUp', () => {
  it('updates schematics tied to the leveled-up domain', () => {
    const schematic = makeSchematic(SchematicCategory.Turret, CORP_ID, ScienceSectorType.Weaponry, 1)
    schematic.randomModifier = 1

    const result = updateSchematicsOnDomainLevelUp(
      [schematic],
      ScienceSectorType.Weaponry,
      2,
      TURN_5,
    )

    expect(result.updatedSchematics).toHaveLength(1)
    const updated = result.updatedSchematics[0]!
    expect(updated.level).toBe(2)
    // bonusAmount = 2 * 1 + 1 = 3 (randomModifier preserved)
    expect(updated.bonusAmount).toBe(3)
    expect(updated.randomModifier).toBe(1) // preserved
    expect(updated.iteration).toBe(2)
    expect(updated.name).toContain('Mk2')
  })

  it('does not update schematics from other domains', () => {
    const schematic = makeSchematic(SchematicCategory.Engine, CORP_ID, ScienceSectorType.Propulsion, 1)

    const result = updateSchematicsOnDomainLevelUp(
      [schematic],
      ScienceSectorType.Weaponry, // different domain
      2,
      TURN_5,
    )

    expect(result.updatedSchematics).toHaveLength(0)
  })

  it('does not update if domain level did not increase', () => {
    const schematic = makeSchematic(SchematicCategory.Turret, CORP_ID, ScienceSectorType.Weaponry, 2)

    const result = updateSchematicsOnDomainLevelUp(
      [schematic],
      ScienceSectorType.Weaponry,
      2, // same level
      TURN_5,
    )

    expect(result.updatedSchematics).toHaveLength(0)
  })

  it('preserves random modifier through version updates', () => {
    const schematic = makeSchematic(SchematicCategory.Missile, CORP_ID, ScienceSectorType.Weaponry, 1)
    schematic.randomModifier = -1

    const result = updateSchematicsOnDomainLevelUp(
      [schematic],
      ScienceSectorType.Weaponry,
      3,
      TURN_5,
    )

    const updated = result.updatedSchematics[0]!
    expect(updated.randomModifier).toBe(-1)
    // bonusAmount = 3 * 2 + (-1) = 5 (Missile baseBonusPerLevel = 2)
    expect(updated.bonusAmount).toBe(5)
  })

  it('generates update events for each updated schematic', () => {
    const s1 = makeSchematic(SchematicCategory.Turret, CORP_ID, ScienceSectorType.Weaponry, 1)
    const s2 = makeSchematic(SchematicCategory.Missile, 'corp_ship02' as string, ScienceSectorType.Weaponry, 1)
    s2.id = 'sch_test_missile' as SchematicId

    const result = updateSchematicsOnDomainLevelUp(
      [s1, s2],
      ScienceSectorType.Weaponry,
      2,
      TURN_5,
    )

    expect(result.updatedSchematics).toHaveLength(2)
    expect(result.events).toHaveLength(2)
    expect(result.events[0]!.title).toContain('Schematic Updated')
  })

  it('correctly increments iteration across multiple level-ups', () => {
    let schematic = makeSchematic(SchematicCategory.Turret, CORP_ID, ScienceSectorType.Weaponry, 1)

    // First level-up: 1 → 2
    let result = updateSchematicsOnDomainLevelUp([schematic], ScienceSectorType.Weaponry, 2, TURN_5)
    schematic = result.updatedSchematics[0]!
    expect(schematic.iteration).toBe(2)
    expect(schematic.name).toContain('Mk2')

    // Second level-up: 2 → 3
    result = updateSchematicsOnDomainLevelUp([schematic], ScienceSectorType.Weaponry, 3, TURN_5)
    schematic = result.updatedSchematics[0]!
    expect(schematic.iteration).toBe(3)
    expect(schematic.name).toContain('Mk3')
    // Should not have double Mk suffixes
    expect(schematic.name).not.toContain('Mk2')
  })

  it('clamps bonusAmount to 0 minimum with negative randomModifier', () => {
    const schematic = makeSchematic(SchematicCategory.Turret, CORP_ID, ScienceSectorType.Weaponry, 1)
    schematic.randomModifier = -1
    // baseBonusPerLevel for Turret = 1, level 1: 1*1 + (-1) = 0

    const result = updateSchematicsOnDomainLevelUp(
      [schematic],
      ScienceSectorType.Weaponry,
      1, // same level, won't update
      TURN_5,
    )
    // Shouldn't update since level didn't increase
    expect(result.updatedSchematics).toHaveLength(0)
  })
})
