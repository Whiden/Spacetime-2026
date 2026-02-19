/**
 * science-sim.test.ts — Unit tests for science simulation (Story 14.1).
 *
 * Covers:
 * - calculateEmpireSciencePerTurn: sums science infrastructure across colonies
 * - distributeScience: even distribution across 9 domains
 * - distributeScience with focus: focused domain receives doubled allocation
 * - Level-up at threshold (current_level+1 × 15)
 * - Multiple level-ups in a single turn
 * - Points carry over after level-up
 * - Level-up events generated
 * - createInitialScienceDomains: all 9 domains at level 0
 * - setDomainFocus: only one domain focused at a time, null clears all
 */

import { describe, it, expect } from 'vitest'
import {
  calculateEmpireSciencePerTurn,
  distributeScience,
  createInitialScienceDomains,
  setDomainFocus,
  getCorporationScienceInfra,
  calculateDiscoveryChance,
  getAvailableDiscoveries,
  applyDiscoveryEffects,
  rollForDiscovery,
} from '../../../engine/simulation/science-sim'
import type { Colony } from '../../../types/colony'
import type { ScienceDomainState } from '../../../types/science'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { ColonyId, PlanetId, SectorId, TurnNumber, CorpId } from '../../../types/common'
import { InfraDomain, ScienceSectorType, ColonyType, CorpType, CorpPersonalityTrait } from '../../../types/common'
import type { Corporation } from '../../../types/corporation'
import { createEmptyEmpireBonuses } from '../../../types/empire'
import { DISCOVERY_DEFINITIONS } from '../../../data/discoveries'

// ─── Test Constants ───────────────────────────────────────────────────────────

const COLONY_ID = 'col_sci01' as ColonyId
const PLANET_ID = 'pln_sci01' as PlanetId
const SECTOR_ID = 'sec_sci01' as SectorId
const TURN_5 = 5 as TurnNumber

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInfraState(domain: InfraDomain, publicLevels: number): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: 100,
  }
}

function makeColonyInfrastructure(scienceLevels: number): ColonyInfrastructure {
  const infra = {} as ColonyInfrastructure
  for (const domain of Object.values(InfraDomain)) {
    infra[domain] = makeInfraState(domain, domain === InfraDomain.Science ? scienceLevels : 0)
  }
  return infra
}

function makeColony(scienceLevels: number): Colony {
  return {
    id: COLONY_ID,
    name: 'Test Colony',
    planetId: PLANET_ID,
    sectorId: SECTOR_ID,
    type: ColonyType.FrontierColony,
    populationLevel: 5,
    infrastructure: makeColonyInfrastructure(scienceLevels),
    attributes: {
      habitability: 7,
      accessibility: 5,
      dynamism: 5,
      qualityOfLife: 7,
      stability: 7,
      growth: 3,
    },
    modifiers: [],
    deposits: [],
    features: [],
    foundedTurn: 1 as TurnNumber,
    corporationsPresent: [],
  }
}

/** Creates a domain state at the given level with given accumulated points. */
function makeDomainState(
  type: ScienceSectorType,
  level: number,
  accumulatedPoints: number,
  focused = false,
): ScienceDomainState {
  return {
    type,
    level,
    accumulatedPoints,
    // Threshold is for the *next* level: (level+1) × 15
    thresholdToNextLevel: (level + 1) * 15,
    focused,
    discoveredIds: [],
    unlockedSchematicCategories: [],
  }
}

function makeAllDomains(
  level = 0,
  accumulatedPoints = 0,
  focusedDomain: ScienceSectorType | null = null,
): Map<string, ScienceDomainState> {
  const domains = new Map<string, ScienceDomainState>()
  for (const domainType of Object.values(ScienceSectorType)) {
    domains.set(
      domainType,
      makeDomainState(domainType, level, accumulatedPoints, domainType === focusedDomain),
    )
  }
  return domains
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('calculateEmpireSciencePerTurn', () => {
  it('returns 0 when no colonies', () => {
    expect(calculateEmpireSciencePerTurn([])).toBe(0)
  })

  it('sums science infrastructure from a single colony', () => {
    const colony = makeColony(4)
    expect(calculateEmpireSciencePerTurn([colony])).toBe(4)
  })

  it('sums science infrastructure across multiple colonies', () => {
    const c1 = makeColony(4)
    const c2 = { ...makeColony(3), id: 'col_sci02' as ColonyId }
    expect(calculateEmpireSciencePerTurn([c1, c2])).toBe(7)
  })

  it('includes corporate-owned science levels', () => {
    const colony = makeColony(2)
    // Add 3 corporate science levels
    colony.infrastructure[InfraDomain.Science].ownership.corporateLevels.set(
      'corp_test' as any,
      3,
    )
    expect(calculateEmpireSciencePerTurn([colony])).toBe(5)
  })

  it('returns 0 when colonies have no science infrastructure', () => {
    const colony = makeColony(0)
    expect(calculateEmpireSciencePerTurn([colony])).toBe(0)
  })
})

describe('distributeScience', () => {
  it('distributes evenly across 9 domains', () => {
    // 18 science / 9 domains = 2 per domain
    const domains = makeAllDomains(0, 0)
    const result = distributeScience(domains, 18, TURN_5)

    for (const [, domain] of result.updatedDomains) {
      expect(domain.accumulatedPoints).toBe(2)
    }
  })

  it('floors the per-domain allocation', () => {
    // 10 science / 9 domains = floor(1.11) = 1 per domain
    const domains = makeAllDomains(0, 0)
    const result = distributeScience(domains, 10, TURN_5)

    for (const [, domain] of result.updatedDomains) {
      expect(domain.accumulatedPoints).toBe(1)
    }
  })

  it('accumulates points over multiple calls', () => {
    // First distribution: 9 science → 1 per domain
    const domains = makeAllDomains(0, 5)
    const result = distributeScience(domains, 9, TURN_5)

    for (const [, domain] of result.updatedDomains) {
      expect(domain.accumulatedPoints).toBe(6)
    }
  })

  it('doubles allocation for focused domain', () => {
    // 9 science / 9 = 1 per domain, focused = 2
    const domains = makeAllDomains(0, 0, ScienceSectorType.Weaponry)
    const result = distributeScience(domains, 9, TURN_5)

    const weaponry = result.updatedDomains.get(ScienceSectorType.Weaponry)!
    expect(weaponry.accumulatedPoints).toBe(2) // doubled

    const society = result.updatedDomains.get(ScienceSectorType.Society)!
    expect(society.accumulatedPoints).toBe(1) // normal
  })

  it('generates no events when no level-ups occur', () => {
    const domains = makeAllDomains(0, 0)
    const result = distributeScience(domains, 9, TURN_5)
    expect(result.events).toHaveLength(0)
  })

  it('levels up when accumulated points reach threshold', () => {
    // Level 0 → Level 1 threshold = (0+1) × 15 = 15
    // Start with 14 accumulated + 1 from distribution = 15 → level up
    const domains = makeAllDomains(0, 14)
    const result = distributeScience(domains, 9, TURN_5) // +1 per domain

    const society = result.updatedDomains.get(ScienceSectorType.Society)!
    expect(society.level).toBe(1)
    expect(society.accumulatedPoints).toBe(0) // 15 - 15 = 0
    // New threshold: (1+1) × 15 = 30
    expect(society.thresholdToNextLevel).toBe(30)
  })

  it('carries over excess points after level-up', () => {
    // Level 0, threshold = 15, accumulated = 13, +3 from distribution = 16
    const domains = new Map<string, ScienceDomainState>()
    domains.set(
      ScienceSectorType.Energy,
      makeDomainState(ScienceSectorType.Energy, 0, 13),
    )
    // Fill remaining domains
    for (const dt of Object.values(ScienceSectorType)) {
      if (dt !== ScienceSectorType.Energy) {
        domains.set(dt, makeDomainState(dt, 0, 0))
      }
    }

    const result = distributeScience(domains, 27, TURN_5) // 27/9 = 3 per domain

    const energy = result.updatedDomains.get(ScienceSectorType.Energy)!
    expect(energy.level).toBe(1)
    expect(energy.accumulatedPoints).toBe(1) // 13 + 3 = 16, 16 - 15 = 1
  })

  it('generates a Positive event for each level-up', () => {
    // All domains at 14 accumulated, +1 = 15 → all level up
    const domains = makeAllDomains(0, 14)
    const result = distributeScience(domains, 9, TURN_5)

    expect(result.events).toHaveLength(9) // one per domain
    for (const event of result.events) {
      expect(event.priority).toBe('Positive')
      expect(event.category).toBe('science')
      expect(event.title).toContain('level 1')
    }
  })

  it('can trigger multiple level-ups in a single turn', () => {
    // Level 0, threshold = 15. Give massive points: 14 + 50 = 64
    // First level-up at 15: level 1, remaining 49
    // Second threshold = 30: level 2, remaining 19
    // Third threshold = 45: not enough (19 < 45)
    const domains = new Map<string, ScienceDomainState>()
    domains.set(
      ScienceSectorType.Computing,
      makeDomainState(ScienceSectorType.Computing, 0, 14),
    )
    for (const dt of Object.values(ScienceSectorType)) {
      if (dt !== ScienceSectorType.Computing) {
        domains.set(dt, makeDomainState(dt, 0, 0))
      }
    }

    // 450/9 = 50 per domain
    const result = distributeScience(domains, 450, TURN_5)

    const computing = result.updatedDomains.get(ScienceSectorType.Computing)!
    expect(computing.level).toBe(2) // leveled up twice
    expect(computing.accumulatedPoints).toBe(19) // 64 - 15 - 30 = 19
    expect(computing.thresholdToNextLevel).toBe(45) // (2+1) × 15

    // Should have 2 level-up events for computing
    const computingEvents = result.events.filter((e) =>
      e.title.includes(ScienceSectorType.Computing),
    )
    expect(computingEvents).toHaveLength(2)
  })

  it('does not level up when points are below threshold', () => {
    const domains = makeAllDomains(0, 10) // threshold = 15
    const result = distributeScience(domains, 9, TURN_5) // +1 = 11

    for (const [, domain] of result.updatedDomains) {
      expect(domain.level).toBe(0)
      expect(domain.accumulatedPoints).toBe(11)
    }
  })

  it('handles 0 empire science gracefully', () => {
    const domains = makeAllDomains(0, 5)
    const result = distributeScience(domains, 0, TURN_5)

    // No points added, no level changes
    for (const [, domain] of result.updatedDomains) {
      expect(domain.accumulatedPoints).toBe(5)
      expect(domain.level).toBe(0)
    }
    expect(result.events).toHaveLength(0)
  })

  it('focus doubles allocation and can trigger level-up sooner', () => {
    // Level 0, threshold = 15. Focused domain gets 2 per turn, others get 1.
    // Start at 13 accumulated. Focused: 13+2=15 → level up. Others: 13+1=14.
    const domains = makeAllDomains(0, 13, ScienceSectorType.Propulsion)
    const result = distributeScience(domains, 9, TURN_5)

    const propulsion = result.updatedDomains.get(ScienceSectorType.Propulsion)!
    expect(propulsion.level).toBe(1) // leveled up

    const society = result.updatedDomains.get(ScienceSectorType.Society)!
    expect(society.level).toBe(0) // not yet
    expect(society.accumulatedPoints).toBe(14)
  })
})

describe('createInitialScienceDomains', () => {
  it('creates all 9 science domains', () => {
    const domains = createInitialScienceDomains()
    expect(domains.size).toBe(9)
  })

  it('all domains start at level 0', () => {
    const domains = createInitialScienceDomains()
    for (const [, domain] of domains) {
      expect(domain.level).toBe(0)
    }
  })

  it('all domains start with 0 accumulated points', () => {
    const domains = createInitialScienceDomains()
    for (const [, domain] of domains) {
      expect(domain.accumulatedPoints).toBe(0)
    }
  })

  it('threshold for level 0 → 1 is 15', () => {
    const domains = createInitialScienceDomains()
    for (const [, domain] of domains) {
      expect(domain.thresholdToNextLevel).toBe(15)
    }
  })

  it('no domain is focused initially', () => {
    const domains = createInitialScienceDomains()
    for (const [, domain] of domains) {
      expect(domain.focused).toBe(false)
    }
  })

  it('no discoveries initially', () => {
    const domains = createInitialScienceDomains()
    for (const [, domain] of domains) {
      expect(domain.discoveredIds).toHaveLength(0)
    }
  })
})

describe('setDomainFocus', () => {
  it('sets focus on the specified domain', () => {
    const domains = createInitialScienceDomains()
    const updated = setDomainFocus(domains, ScienceSectorType.Weaponry)

    const weaponry = updated.get(ScienceSectorType.Weaponry)!
    expect(weaponry.focused).toBe(true)
  })

  it('clears focus on all other domains', () => {
    // Start with Energy focused
    const domains = createInitialScienceDomains()
    const withFocus = setDomainFocus(domains, ScienceSectorType.Energy)
    // Switch to Weaponry
    const switched = setDomainFocus(withFocus, ScienceSectorType.Weaponry)

    const energy = switched.get(ScienceSectorType.Energy)!
    expect(energy.focused).toBe(false)

    const weaponry = switched.get(ScienceSectorType.Weaponry)!
    expect(weaponry.focused).toBe(true)
  })

  it('clears all focus when null is passed', () => {
    const domains = setDomainFocus(createInitialScienceDomains(), ScienceSectorType.Computing)
    const cleared = setDomainFocus(domains, null)

    for (const [, domain] of cleared) {
      expect(domain.focused).toBe(false)
    }
  })

  it('only one domain can be focused at a time', () => {
    const domains = createInitialScienceDomains()
    const updated = setDomainFocus(domains, ScienceSectorType.Materials)

    let focusCount = 0
    for (const [, domain] of updated) {
      if (domain.focused) focusCount++
    }
    expect(focusCount).toBe(1)
  })
})

// ─── Story 14.2: Discovery System Tests ──────────────────────────────────────

/** Minimal Corporation fixture for discovery tests. */
function makeCorp(
  level: number,
  scienceInfraByColony: Map<ColonyId, number> = new Map(),
): Corporation {
  const infrastructureByColony = new Map<ColonyId, Record<string, number>>()
  for (const [colId, sciLevels] of scienceInfraByColony) {
    infrastructureByColony.set(colId, { [InfraDomain.Science]: sciLevels })
  }
  return {
    id: 'corp_sci01' as CorpId,
    name: 'Test Science Corp',
    type: CorpType.Science,
    level,
    capital: 10,
    traits: [CorpPersonalityTrait.Innovative],
    homePlanetId: 'pln_t01' as any,
    planetsPresent: [],
    assets: {
      infrastructureByColony: infrastructureByColony as any,
      schematics: [],
      patents: [],
    },
    activeContractIds: [],
    foundedTurn: 1 as TurnNumber,
  }
}

/** Domains where every domain is at level 1 (all pools unlocked). */
function makeDomainsAtLevel1(focusedDomain: ScienceSectorType | null = null): Map<string, ScienceDomainState> {
  const domains = new Map<string, ScienceDomainState>()
  for (const type of Object.values(ScienceSectorType)) {
    domains.set(type, {
      type,
      level: 1,
      accumulatedPoints: 0,
      thresholdToNextLevel: 30,
      focused: focusedDomain !== null && type === focusedDomain,
      discoveredIds: [],
      unlockedSchematicCategories: [],
    })
  }
  return domains
}

describe('getCorporationScienceInfra', () => {
  it('returns 0 when corp has no infra holdings', () => {
    const corp = makeCorp(1)
    expect(getCorporationScienceInfra(corp)).toBe(0)
  })

  it('sums science infra from a single colony', () => {
    const corp = makeCorp(1, new Map([['col_a' as ColonyId, 3]]))
    expect(getCorporationScienceInfra(corp)).toBe(3)
  })

  it('sums science infra across multiple colonies', () => {
    const corp = makeCorp(1, new Map([
      ['col_a' as ColonyId, 3],
      ['col_b' as ColonyId, 2],
    ]))
    expect(getCorporationScienceInfra(corp)).toBe(5)
  })

  it('returns 0 when colony has no science domain entry', () => {
    // Colony with other infra but no Science key
    const corp = makeCorp(1)
    ;(corp.assets.infrastructureByColony as any).set('col_x', { [InfraDomain.Mining]: 4 })
    expect(getCorporationScienceInfra(corp)).toBe(0)
  })
})

describe('calculateDiscoveryChance', () => {
  it('calculates base chance: corpLevel × 5 + scienceInfra × 2', () => {
    expect(calculateDiscoveryChance(3, 4, false)).toBe(3 * 5 + 4 * 2) // 15 + 8 = 23
  })

  it('doubles chance when domain is focused', () => {
    expect(calculateDiscoveryChance(3, 4, true)).toBe((3 * 5 + 4 * 2) * 2) // 46
  })

  it('returns 0 for level 0 corp with no science infra', () => {
    expect(calculateDiscoveryChance(0, 0, false)).toBe(0)
  })

  it('focus only applies to the doubled base, not separately stacked', () => {
    const base = calculateDiscoveryChance(2, 0, false) // 10
    const focused = calculateDiscoveryChance(2, 0, true)  // 20
    expect(focused).toBe(base * 2)
  })
})

describe('getAvailableDiscoveries', () => {
  it('returns empty when all domains are at level 0', () => {
    const domains = createInitialScienceDomains() // all level 0
    const result = getAvailableDiscoveries(domains, [])
    expect(result).toHaveLength(0)
  })

  it('returns level-1 definitions when domains reach level 1', () => {
    const domains = makeDomainsAtLevel1()
    const result = getAvailableDiscoveries(domains, [])
    // All DISCOVERY_DEFINITIONS have poolLevel 1, so all should be available
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((d) => d.poolLevel <= 1)).toBe(true)
  })

  it('excludes already-discovered definitions', () => {
    const domains = makeDomainsAtLevel1()
    const allDefs = DISCOVERY_DEFINITIONS.filter((d) => d.poolLevel === 1)
    const firstDef = allDefs[0]!
    const result = getAvailableDiscoveries(domains, [firstDef.definitionId])
    expect(result.find((d) => d.definitionId === firstDef.definitionId)).toBeUndefined()
  })

  it('returns empty when all definitions are already discovered (pool exhaustion)', () => {
    const domains = makeDomainsAtLevel1()
    const allDefIds = DISCOVERY_DEFINITIONS.map((d) => d.definitionId)
    const result = getAvailableDiscoveries(domains, allDefIds)
    expect(result).toHaveLength(0)
  })

  it('only returns definitions whose poolLevel is <= domain level', () => {
    // Only Weaponry at level 1, rest at 0
    const domains = createInitialScienceDomains()
    const weaponry = domains.get(ScienceSectorType.Weaponry)!
    domains.set(ScienceSectorType.Weaponry, { ...weaponry, level: 1 })

    const result = getAvailableDiscoveries(domains, [])
    expect(result.every((d) => d.domain === ScienceSectorType.Weaponry)).toBe(true)
  })
})

describe('applyDiscoveryEffects', () => {
  it('increments shipStats.firepower correctly', () => {
    const def = DISCOVERY_DEFINITIONS.find((d) => d.definitionId === 'weaponry_1_railgun')!
    const bonuses = createEmptyEmpireBonuses()
    const result = applyDiscoveryEffects(def, bonuses)
    expect(result.shipStats.firepower).toBe(1)
  })

  it('increments shipStats.speed correctly', () => {
    const def = DISCOVERY_DEFINITIONS.find((d) => d.definitionId === 'propulsion_1_ion')!
    const bonuses = createEmptyEmpireBonuses()
    const result = applyDiscoveryEffects(def, bonuses)
    expect(result.shipStats.speed).toBe(1)
  })

  it('does not mutate the original EmpireBonuses', () => {
    const def = DISCOVERY_DEFINITIONS.find((d) => d.definitionId === 'weaponry_1_railgun')!
    const bonuses = createEmptyEmpireBonuses()
    applyDiscoveryEffects(def, bonuses)
    expect(bonuses.shipStats.firepower).toBe(0)
  })

  it('accumulates effects across multiple applications', () => {
    const def = DISCOVERY_DEFINITIONS.find((d) => d.definitionId === 'weaponry_1_railgun')!
    const bonuses = createEmptyEmpireBonuses()
    const after1 = applyDiscoveryEffects(def, bonuses)
    // Simulate second discovery with same stat (different definition)
    const mockDef = { ...def, definitionId: 'mock', empireBonusEffects: [{ key: 'shipStats.firepower', amount: 2 }] }
    const after2 = applyDiscoveryEffects(mockDef, after1)
    expect(after2.shipStats.firepower).toBe(3)
  })

  it('leaves other stats unchanged', () => {
    const def = DISCOVERY_DEFINITIONS.find((d) => d.definitionId === 'weaponry_1_railgun')!
    const bonuses = createEmptyEmpireBonuses()
    const result = applyDiscoveryEffects(def, bonuses)
    expect(result.shipStats.speed).toBe(0)
    expect(result.shipStats.armor).toBe(0)
    expect(result.shipStats.sensors).toBe(0)
  })

  it('is a no-op for definitions with no effects', () => {
    const def = DISCOVERY_DEFINITIONS.find((d) => d.empireBonusEffects.length === 0)!
    const bonuses = createEmptyEmpireBonuses()
    const result = applyDiscoveryEffects(def, bonuses)
    expect(result).toEqual(bonuses)
  })
})

describe('rollForDiscovery', () => {
  const TURN_1 = 1 as TurnNumber

  // randFn that always picks index 0 and always succeeds (returns 0)
  const alwaysSucceed = () => 0

  // randFn that always fails the roll (returns 0.99 → 99 ≥ any reasonable chance)
  const alwaysFail = (): number => {
    // First call picks the definition (return 0 → index 0)
    // Second call is the chance roll — return value such that randFn() * 100 >= chance
    let callCount = 0
    return (() => {
      callCount++
      return callCount === 1 ? 0 : 0.99
    })()
  }

  it('returns no discovery when pool is empty (all domains at level 0)', () => {
    const corp = makeCorp(3)
    const domains = createInitialScienceDomains()
    const result = rollForDiscovery(corp, domains, [], createEmptyEmpireBonuses(), TURN_1, alwaysSucceed)
    expect(result.discovery).toBeNull()
    expect(result.events).toHaveLength(0)
  })

  it('returns no discovery when all definitions already discovered', () => {
    const corp = makeCorp(3)
    const domains = makeDomainsAtLevel1()
    const allDefIds = DISCOVERY_DEFINITIONS.map((d) => d.definitionId)
    const result = rollForDiscovery(corp, domains, allDefIds, createEmptyEmpireBonuses(), TURN_1, alwaysSucceed)
    expect(result.discovery).toBeNull()
  })

  it('returns no discovery when roll fails', () => {
    const corp = makeCorp(1) // chance = 5%, scienceInfra = 0
    const domains = makeDomainsAtLevel1()
    // RNG: first call picks definition (0), second call returns 0.99 → 99% ≥ 5% → fail
    let call = 0
    const failRng = () => (++call === 1 ? 0 : 0.99)
    const result = rollForDiscovery(corp, domains, [], createEmptyEmpireBonuses(), TURN_1, failRng)
    expect(result.discovery).toBeNull()
    expect(result.events).toHaveLength(0)
  })

  it('returns discovery when roll succeeds', () => {
    const corp = makeCorp(5) // chance = 25%
    const domains = makeDomainsAtLevel1()
    // RNG: picks index 0, then returns 0 → 0% < 25% → success
    const result = rollForDiscovery(corp, domains, [], createEmptyEmpireBonuses(), TURN_1, alwaysSucceed)
    expect(result.discovery).not.toBeNull()
    expect(result.discovery!.sourceDefinitionId).toBeTruthy()
    expect(result.discovery!.discoveredByCorpId).toBe(corp.id)
    expect(result.discovery!.discoveredTurn).toBe(TURN_1)
  })

  it('generates one science event on successful discovery', () => {
    const corp = makeCorp(5)
    const domains = makeDomainsAtLevel1()
    const result = rollForDiscovery(corp, domains, [], createEmptyEmpireBonuses(), TURN_1, alwaysSucceed)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]!.category).toBe('science')
    expect(result.events[0]!.priority).toBe('Positive')
    expect(result.events[0]!.title).toContain('Discovery:')
  })

  it('applies empireBonuses effects on successful discovery', () => {
    const corp = makeCorp(5)
    // Force the Weaponry definition (railgun → firepower +1) to be selected
    const domains = new Map<string, ScienceDomainState>()
    // Only Weaponry at level 1 so it's the only available domain
    for (const type of Object.values(ScienceSectorType)) {
      domains.set(type, {
        type,
        level: type === ScienceSectorType.Weaponry ? 1 : 0,
        accumulatedPoints: 0,
        thresholdToNextLevel: 30,
        focused: false,
        discoveredIds: [],
        unlockedSchematicCategories: [],
      })
    }
    const bonuses = createEmptyEmpireBonuses()
    const result = rollForDiscovery(corp, domains, [], bonuses, TURN_1, alwaysSucceed)
    // Weaponry level-1 definition = railgun → firepower +1
    expect(result.updatedEmpireBonuses.shipStats.firepower).toBe(1)
  })

  it('adds discoveryId to domain discoveredIds on success', () => {
    const corp = makeCorp(5)
    const domains = makeDomainsAtLevel1()
    const result = rollForDiscovery(corp, domains, [], createEmptyEmpireBonuses(), TURN_1, alwaysSucceed)
    expect(result.discovery).not.toBeNull()
    const domainState = result.updatedScienceDomains.get(result.discovery!.domain)!
    expect(domainState.discoveredIds).toContain(result.discovery!.id)
  })

  it('focus doubles discovery chance and can turn a fail into a success', () => {
    // Corp level 1 → base chance = 5%. With focus → 10%.
    // RNG: roll returns 0.07 → 7% < 10% → success with focus, but 7% ≥ 5% → fail without
    const corp = makeCorp(1)
    // Only Weaponry available, and it's focused
    const domains = new Map<string, ScienceDomainState>()
    for (const type of Object.values(ScienceSectorType)) {
      domains.set(type, {
        type,
        level: type === ScienceSectorType.Weaponry ? 1 : 0,
        accumulatedPoints: 0,
        thresholdToNextLevel: 30,
        focused: type === ScienceSectorType.Weaponry,
        discoveredIds: [],
        unlockedSchematicCategories: [],
      })
    }
    let call = 0
    // First call: pick definition (returns 0 → index 0)
    // Second call: chance roll (returns 0.07 → 7% < 10% focus chance → success)
    const rng = () => (++call === 1 ? 0 : 0.07)

    const result = rollForDiscovery(corp, domains, [], createEmptyEmpireBonuses(), TURN_1, rng)
    expect(result.discovery).not.toBeNull()
  })

  it('empire bonuses persist correctly across two sequential discoveries', () => {
    const corp = makeCorp(5)
    // Only Weaponry available
    const domains = new Map<string, ScienceDomainState>()
    for (const type of Object.values(ScienceSectorType)) {
      domains.set(type, {
        type,
        level: type === ScienceSectorType.Weaponry ? 1 : 0,
        accumulatedPoints: 0,
        thresholdToNextLevel: 30,
        focused: false,
        discoveredIds: [],
        unlockedSchematicCategories: [],
      })
    }
    const bonuses = createEmptyEmpireBonuses()

    // First discovery
    const r1 = rollForDiscovery(corp, domains, [], bonuses, TURN_1, alwaysSucceed)
    expect(r1.discovery).not.toBeNull()
    // Second attempt: first discovery already found — pool exhausted for this domain level
    const discoveredDefIds = [r1.discovery!.sourceDefinitionId]
    const r2 = rollForDiscovery(corp, r1.updatedScienceDomains, discoveredDefIds, r1.updatedEmpireBonuses, TURN_1, alwaysSucceed)
    // No more Weaponry level-1 definitions → pool exhausted → no discovery
    expect(r2.discovery).toBeNull()
    // Bonuses from r1 are preserved unchanged in r2
    expect(r2.updatedEmpireBonuses.shipStats.firepower).toBe(r1.updatedEmpireBonuses.shipStats.firepower)
  })
})
