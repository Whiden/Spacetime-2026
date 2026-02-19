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
} from '../../../engine/simulation/science-sim'
import type { Colony } from '../../../types/colony'
import type { ScienceDomainState } from '../../../types/science'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { ColonyId, PlanetId, SectorId, TurnNumber } from '../../../types/common'
import { InfraDomain, ScienceSectorType, ColonyType } from '../../../types/common'

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
