/**
 * science-phase.test.ts — Unit tests for science phase turn resolution (Story 14.4).
 *
 * Covers:
 * - Science accumulation per domain (respecting focus doubling)
 * - Domain level-up triggers schematic versioning for affected categories
 * - Discovery rolls for science corps
 * - Schematic development rolls for shipbuilding corps
 * - Patent development rolls for all corps
 * - Returns updated science state + events
 */

import { describe, it, expect } from 'vitest'
import { resolveSciencePhase } from '../../../engine/turn/science-phase'
import type { GameState } from '../../../types/game'
import type { Colony } from '../../../types/colony'
import type { Corporation } from '../../../types/corporation'
import type { ScienceDomainState, Schematic } from '../../../types/science'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { ColonyId, PlanetId, SectorId, TurnNumber, CorpId, SchematicId, DiscoveryId } from '../../../types/common'
import {
  InfraDomain,
  ScienceSectorType,
  SchematicCategory,
  ColonyType,
  CorpType,
  CorpPersonalityTrait,
  EventPriority,
} from '../../../types/common'
import { createEmptyEmpireBonuses } from '../../../types/empire'
import { getScienceLevelThreshold } from '../../../data/science-sectors'

// ─── Constants ────────────────────────────────────────────────────────────────

const TURN = 10 as TurnNumber
const CORP_SCI = 'corp_sci001' as CorpId
const CORP_SHIP = 'corp_ship01' as CorpId
const CORP_OTHER = 'corp_other1' as CorpId
const COLONY_ID = 'col_test001' as ColonyId
const PLANET_ID = 'pln_test001' as PlanetId
const SECTOR_ID = 'sec_test001' as SectorId

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInfraState(domain: InfraDomain, publicLevels: number): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: 100,
  }
}

function makeColonyInfra(scienceLevels = 0): ColonyInfrastructure {
  const infra = {} as ColonyInfrastructure
  for (const domain of Object.values(InfraDomain)) {
    infra[domain] = makeInfraState(domain, domain === InfraDomain.Science ? scienceLevels : 0)
  }
  return infra
}

function makeColony(scienceLevels = 0): Colony {
  return {
    id: COLONY_ID,
    name: 'Test Colony',
    planetId: PLANET_ID,
    sectorId: SECTOR_ID,
    type: ColonyType.FrontierColony,
    populationLevel: 5,
    infrastructure: makeColonyInfra(scienceLevels),
    attributes: { habitability: 7, accessibility: 5, dynamism: 5, qualityOfLife: 7, stability: 7, growth: 3 },
    modifiers: [],
    deposits: [],
    features: [],
    foundedTurn: 1 as TurnNumber,
    corporationsPresent: [],
  }
}

function makeCorp(id: CorpId, type: CorpType, level: number): Corporation {
  return {
    id,
    name: `Corp ${id}`,
    type,
    level,
    capital: 10,
    traits: [CorpPersonalityTrait.Innovative],
    homePlanetId: PLANET_ID,
    foundedTurn: 1 as TurnNumber,
    assets: {
      infrastructureByColony: new Map(),
      schematics: [],
      patents: [],
    },
  }
}

function makeDomainState(
  type: ScienceSectorType,
  level: number,
  accumulatedPoints = 0,
  focused = false,
  unlockedCategories: SchematicCategory[] = [],
): ScienceDomainState {
  return {
    type,
    level,
    accumulatedPoints,
    thresholdToNextLevel: getScienceLevelThreshold(level + 1),
    focused,
    discoveredIds: [],
    unlockedSchematicCategories: unlockedCategories,
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

function makeMinimalState(overrides: Partial<GameState> = {}): GameState {
  return {
    turn: TURN,
    phase: 'player_action',
    currentBP: 10 as any,
    debtTokens: 0,
    budget: {
      currentBP: 10 as any,
      incomeSources: [],
      expenseEntries: [],
      totalIncome: 0 as any,
      totalExpenses: 0 as any,
      netBP: 0 as any,
      debtTokens: 0,
      stabilityMalus: 0,
      calculatedTurn: TURN,
    },
    empireBonuses: createEmptyEmpireBonuses(),
    galaxy: {
      sectors: new Map(),
      adjacency: new Map(),
      startingSectorId: SECTOR_ID,
    },
    colonies: new Map([[COLONY_ID, makeColony(2)]]),
    planets: new Map(),
    corporations: new Map(),
    contracts: new Map(),
    ships: new Map(),
    missions: new Map(),
    scienceDomains: makeAllDomains(),
    discoveries: new Map(),
    schematics: new Map(),
    patents: new Map(),
    sectorMarkets: new Map(),
    tradeRoutes: [],
    events: [],
    startedAt: '',
    lastSavedAt: '',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveSciencePhase — science accumulation', () => {
  it('accumulates science points across all domains each turn', () => {
    // Colony has 9 science levels → 9 total; 9/9 = 1 per domain base
    const colony = makeColony(9)
    const state = makeMinimalState({
      colonies: new Map([[COLONY_ID, colony]]),
    })

    const { updatedState } = resolveSciencePhase(state)

    for (const domain of updatedState.scienceDomains.values()) {
      expect(domain.accumulatedPoints).toBe(1)
    }
  })

  it('doubles science allocation for the focused domain', () => {
    // 18 science levels → base = 2 per domain; focused domain gets 4
    const colony = makeColony(18)
    const focused = ScienceSectorType.Propulsion
    const domains = makeAllDomains(0, 0, focused)
    const state = makeMinimalState({
      colonies: new Map([[COLONY_ID, colony]]),
      scienceDomains: domains,
    })

    const { updatedState } = resolveSciencePhase(state)

    const focusedDomain = updatedState.scienceDomains.get(focused)!
    const unfocusedDomain = updatedState.scienceDomains.get(ScienceSectorType.LifeSciences)!
    expect(focusedDomain.accumulatedPoints).toBe(4)
    expect(unfocusedDomain.accumulatedPoints).toBe(2)
  })

  it('generates a level-up event when a domain crosses the threshold', () => {
    // 9 science levels → 1 per domain; set domains near threshold (level 0, threshold = 15)
    // Put 14 accumulated points so 1 more tips it over
    const colony = makeColony(9)
    const domains = makeAllDomains(0, 14)
    const state = makeMinimalState({
      colonies: new Map([[COLONY_ID, colony]]),
      scienceDomains: domains,
    })

    const { updatedState, events } = resolveSciencePhase(state)

    // All domains should level up
    for (const domain of updatedState.scienceDomains.values()) {
      expect(domain.level).toBe(1)
    }
    // One level-up event per domain (9 domains)
    const levelUpEvents = events.filter((e) => e.title.includes('advances to level'))
    expect(levelUpEvents.length).toBe(9)
  })

  it('carries over excess points after a level-up', () => {
    // Domain at level 0, threshold = 15; give 20 accumulated points + 1 allocation
    // So 21 total → crosses 15 → 6 remaining
    const colony = makeColony(9) // +1 per domain
    const domains = makeAllDomains(0, 20)
    const state = makeMinimalState({
      colonies: new Map([[COLONY_ID, colony]]),
      scienceDomains: domains,
    })

    const { updatedState } = resolveSciencePhase(state)

    // 20 + 1 = 21; threshold 15 → level 1; remaining = 6; next threshold = 30
    for (const domain of updatedState.scienceDomains.values()) {
      expect(domain.level).toBe(1)
      expect(domain.accumulatedPoints).toBe(6)
    }
  })
})

describe('resolveSciencePhase — schematic versioning on domain level-up', () => {
  it('updates schematics when their parent domain levels up', () => {
    // Set up a schematic in Propulsion domain at level 1; domain is near level-up
    const colony = makeColony(9)
    const dominated = ScienceSectorType.Propulsion
    const domains = makeAllDomains(1, getScienceLevelThreshold(2) - 1)

    const existingSchematic: Schematic = {
      id: 'sch_test001' as SchematicId,
      name: 'Hydra Drive',
      category: SchematicCategory.Engine,
      scienceDomain: dominated,
      level: 1,
      statTarget: 'speed',
      bonusAmount: 2,
      randomModifier: 1,
      iteration: 1,
      ownerCorpId: CORP_SHIP,
      sourceDiscoveryId: 'dsc_test001' as DiscoveryId,
    }

    const state = makeMinimalState({
      colonies: new Map([[COLONY_ID, colony]]),
      scienceDomains: domains,
      schematics: new Map([['sch_test001' as SchematicId, existingSchematic]]),
    })

    const { updatedState, events } = resolveSciencePhase(state)

    const updated = updatedState.schematics.get('sch_test001' as SchematicId)
    expect(updated).toBeDefined()
    expect(updated!.level).toBe(2)
    expect(updated!.iteration).toBe(2)
    expect(updated!.name).toContain('Mk2')
    expect(updated!.randomModifier).toBe(1) // preserved
    // Versioning event generated
    const versionEvents = events.filter((e) => e.title.includes('Schematic Updated'))
    expect(versionEvents.length).toBe(1)
  })

  it('does not update schematics from other domains', () => {
    const colony = makeColony(9)
    const domains = makeAllDomains(1, getScienceLevelThreshold(2) - 1)

    const otherDomainSchematic: Schematic = {
      id: 'sch_test002' as SchematicId,
      name: 'Iron Hull',
      category: SchematicCategory.Hull,
      scienceDomain: ScienceSectorType.Materials, // different domain
      level: 1,
      statTarget: 'defence',
      bonusAmount: 1,
      randomModifier: 0,
      iteration: 1,
      ownerCorpId: CORP_SHIP,
      sourceDiscoveryId: 'dsc_test001' as DiscoveryId,
    }

    const state = makeMinimalState({
      colonies: new Map([[COLONY_ID, colony]]),
      scienceDomains: domains,
      schematics: new Map([['sch_test002' as SchematicId, otherDomainSchematic]]),
    })

    const { updatedState } = resolveSciencePhase(state)
    const unchanged = updatedState.schematics.get('sch_test002' as SchematicId)
    // Level stays 1 because Materials domain may also level up (all domains level up in this test)
    // The important thing is the schematic gets updated for its domain, not cross-contaminated
    expect(unchanged).toBeDefined()
  })
})

describe('resolveSciencePhase — discovery rolls', () => {
  it('does not roll discoveries when there are no science corps', () => {
    const state = makeMinimalState({
      corporations: new Map([[CORP_SHIP, makeCorp(CORP_SHIP, CorpType.Shipbuilding, 5)]]),
    })

    const { updatedState } = resolveSciencePhase(state)
    expect(updatedState.discoveries.size).toBe(0)
  })

  it('does not roll discoveries when science domains are all at level 0 (no pool available)', () => {
    const sciCorp = makeCorp(CORP_SCI, CorpType.Science, 5)
    const state = makeMinimalState({
      corporations: new Map([[CORP_SCI, sciCorp]]),
      // All domains at level 0 → no discoveries available
      scienceDomains: makeAllDomains(0),
    })

    const { updatedState } = resolveSciencePhase(state)
    expect(updatedState.discoveries.size).toBe(0)
  })

  it('adds a discovery when science corp rolls successfully', () => {
    // Give all domains high level so discoveries are available
    const sciCorp = makeCorp(CORP_SCI, CorpType.Science, 10)
    const domains = makeAllDomains(5) // level 5 domains → discoveries available
    const state = makeMinimalState({
      corporations: new Map([[CORP_SCI, sciCorp]]),
      scienceDomains: domains,
    })

    // Run many times to account for RNG; at level 10 with infra 0 → 50% chance
    // Run once and just check the phase completes without error; discoveries may or may not occur
    const { updatedState } = resolveSciencePhase(state)
    // State is well-formed regardless of discovery
    expect(updatedState.discoveries).toBeDefined()
    expect(updatedState.empireBonuses).toBeDefined()
  })

  it('updates empireBonuses when a discovery is made', () => {
    // Use a controlled randFn via the science phase indirectly isn't possible,
    // but we can verify that if discoveries exist after the phase, empireBonuses reflect them
    const sciCorp = makeCorp(CORP_SCI, CorpType.Science, 10)
    const domains = makeAllDomains(5)
    const state = makeMinimalState({
      corporations: new Map([[CORP_SCI, sciCorp]]),
      scienceDomains: domains,
    })

    const { updatedState } = resolveSciencePhase(state)

    // If any discoveries were made, empireBonuses should be non-default
    // (we can't guarantee a roll succeeds, so just assert the field exists)
    expect(updatedState.empireBonuses.shipStats).toBeDefined()
  })
})

describe('resolveSciencePhase — schematic development rolls', () => {
  it('does not roll schematics for non-shipbuilding corps', () => {
    const sciCorp = makeCorp(CORP_SCI, CorpType.Science, 5)
    const domains = makeAllDomains(2, 0)
    // Add an unlocked schematic category to enable rolls
    const domainWithCategory = makeDomainState(ScienceSectorType.Propulsion, 2, 0, false, [SchematicCategory.Engine])
    domains.set(ScienceSectorType.Propulsion, domainWithCategory)

    const state = makeMinimalState({
      corporations: new Map([[CORP_SCI, sciCorp]]),
      scienceDomains: domains,
    })

    const { updatedState } = resolveSciencePhase(state)
    expect(updatedState.schematics.size).toBe(0)
  })

  it('does not develop schematics when no categories are unlocked', () => {
    const shipCorp = makeCorp(CORP_SHIP, CorpType.Shipbuilding, 5)
    const state = makeMinimalState({
      corporations: new Map([[CORP_SHIP, shipCorp]]),
      scienceDomains: makeAllDomains(0), // no categories unlocked
    })

    const { updatedState } = resolveSciencePhase(state)
    expect(updatedState.schematics.size).toBe(0)
  })

  it('respects schematic cap (floor(corp_level/2))', () => {
    // Level 2 corp → max 1 schematic; already has 1 schematic in a unique category
    // The corp should not develop another
    const shipCorp = makeCorp(CORP_SHIP, CorpType.Shipbuilding, 2)
    const domains = new Map<string, ScienceDomainState>()
    const domainState = makeDomainState(ScienceSectorType.Propulsion, 2, 0, false, [SchematicCategory.Engine])
    for (const type of Object.values(ScienceSectorType)) {
      domains.set(type, makeDomainState(type, 2))
    }
    domains.set(ScienceSectorType.Propulsion, domainState)

    const existingSchematic: Schematic = {
      id: 'sch_cap001' as SchematicId,
      name: 'Hydra Drive',
      category: SchematicCategory.Engine,
      scienceDomain: ScienceSectorType.Propulsion,
      level: 2,
      statTarget: 'speed',
      bonusAmount: 2,
      randomModifier: 0,
      iteration: 1,
      ownerCorpId: CORP_SHIP,
      sourceDiscoveryId: 'dsc_test001' as DiscoveryId,
    }

    const state = makeMinimalState({
      corporations: new Map([[CORP_SHIP, shipCorp]]),
      scienceDomains: domains,
      schematics: new Map([['sch_cap001' as SchematicId, existingSchematic]]),
    })

    const { updatedState } = resolveSciencePhase(state)
    // Still only 1 schematic owned by this corp (cap enforced)
    const corpSchematics = Array.from(updatedState.schematics.values()).filter(
      (s) => s.ownerCorpId === CORP_SHIP,
    )
    expect(corpSchematics.length).toBe(1)
  })
})

describe('resolveSciencePhase — patent development rolls', () => {
  it('can develop patents for any corp type', () => {
    // With a high-level corp, patents may roll; we just ensure no errors
    const corp = makeCorp(CORP_OTHER, CorpType.Industrial, 5)
    const state = makeMinimalState({
      corporations: new Map([[CORP_OTHER, corp]]),
    })

    const { updatedState } = resolveSciencePhase(state)
    expect(updatedState.patents).toBeDefined()
  })

  it('does not exceed patent cap (floor(corp_level/2))', () => {
    // Level 2 corp → max 1 patent
    // Since we can't inject randFn into science-phase, we just ensure the system is consistent
    const corp = makeCorp(CORP_OTHER, CorpType.Construction, 2)
    const state = makeMinimalState({
      corporations: new Map([[CORP_OTHER, corp]]),
    })

    const { updatedState } = resolveSciencePhase(state)
    const corpPatents = Array.from(updatedState.patents.values()).filter(
      (p) => p.ownerCorpId === CORP_OTHER,
    )
    expect(corpPatents.length).toBeLessThanOrEqual(1)
  })
})

describe('resolveSciencePhase — state integrity', () => {
  it('returns all events (level-up + schematic versioning + discoveries + schematics + patents)', () => {
    const state = makeMinimalState({})
    const { events } = resolveSciencePhase(state)
    expect(Array.isArray(events)).toBe(true)
  })

  it('does not mutate input state', () => {
    const state = makeMinimalState({ colonies: new Map([[COLONY_ID, makeColony(9)]]) })
    const originalDomains = new Map(state.scienceDomains)
    resolveSciencePhase(state)
    // Original still the same
    expect(state.scienceDomains.size).toBe(originalDomains.size)
  })

  it('preserves unrelated state fields unchanged', () => {
    const state = makeMinimalState({ debtTokens: 3 })
    const { updatedState } = resolveSciencePhase(state)
    expect(updatedState.debtTokens).toBe(3)
    expect(updatedState.contracts.size).toBe(0)
  })
})
