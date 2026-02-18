/**
 * corp-phase-emergence.test.ts — Unit tests for Story 11.3: Organic Corporation Emergence.
 *
 * Covers:
 * - calculateEmergenceChance: correct percentages per dynamism value.
 * - determineCorpTypeFromDomain: correct corp type per infrastructure domain.
 * - findMostProminentPublicDomain: returns domain with most public levels; null when none.
 * - resolveCorpPhase integration:
 *   - Colony with dynamism < 6 never spawns a new corp.
 *   - Colony with dynamism >= 6 and public infra: new corp added, infra level transferred.
 *   - New corp has correct type, home planet, and infrastructure holding.
 *   - Colony's corporate ownership updated (new corp entry + corporationsPresent).
 *   - Public level on the source domain decremented by 1.
 *   - Max one emergence per colony per turn.
 *   - Emergence event has Positive priority and correct category.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  resolveCorpPhase,
  calculateEmergenceChance,
  determineCorpTypeFromDomain,
  findMostProminentPublicDomain,
} from '../../../engine/turn/corp-phase'
import { clearNameRegistry } from '../../../generators/name-generator'
import type { GameState } from '../../../types/game'
import type { Corporation, CorpInfrastructureHoldings } from '../../../types/corporation'
import type { Colony } from '../../../types/colony'
import type { Planet } from '../../../types/planet'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { SectorMarketState } from '../../../types/trade'
import type { BudgetState } from '../../../types/budget'
import type { Sector, Galaxy } from '../../../types/sector'
import type {
  ColonyId,
  CorpId,
  PlanetId,
  SectorId,
  TurnNumber,
  BPAmount,
} from '../../../types/common'
import {
  InfraDomain,
  ResourceType,
  CorpType,
  ColonyType,
  PlanetType,
  PlanetSize,
  PlanetStatus,
  SectorDensity,
  EventPriority,
} from '../../../types/common'
import { createEmptyEmpireBonuses } from '../../../types/empire'

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const SECTOR_ID = 'sec_emrg001' as SectorId
const PLANET_A = 'pln_emrgA01' as PlanetId
const COLONY_A = 'col_emrgA01' as ColonyId

// ─── Infrastructure helpers ───────────────────────────────────────────────────

function makeInfraState(
  domain: InfraDomain,
  publicLevels: number,
  cap = Infinity,
  corporateLevels: Map<CorpId, number> = new Map(),
): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels },
    currentCap: cap,
  }
}

function makeInfra(
  overrides: Partial<Record<InfraDomain, { levels: number; cap?: number }>> = {},
): ColonyInfrastructure {
  const result = {} as ColonyInfrastructure
  for (const domain of Object.values(InfraDomain)) {
    const override = overrides[domain]
    result[domain] = makeInfraState(domain, override?.levels ?? 0, override?.cap ?? Infinity)
  }
  return result
}

// ─── Colony helper ────────────────────────────────────────────────────────────

function makeColony(
  id: ColonyId,
  planetId: PlanetId,
  sectorId: SectorId,
  infra: ColonyInfrastructure,
  dynamism = 5,
): Colony {
  return {
    id,
    planetId,
    sectorId,
    name: `Colony ${id}`,
    type: ColonyType.FrontierColony,
    populationLevel: 3,
    attributes: {
      habitability: 8,
      accessibility: 5,
      dynamism,
      qualityOfLife: 8,
      stability: 8,
      growth: 0,
    },
    infrastructure: infra,
    corporationsPresent: [],
    modifiers: [],
    foundedTurn: 1 as TurnNumber,
  }
}

// ─── Planet helper ────────────────────────────────────────────────────────────

function makePlanet(id: PlanetId, sectorId: SectorId): Planet {
  return {
    id,
    name: `Planet ${id}`,
    sectorId,
    type: PlanetType.Continental,
    size: PlanetSize.Large,
    status: PlanetStatus.Colonized,
    baseHabitability: 8,
    deposits: [],
    features: [],
    featureModifiers: [],
    orbitScanTurn: 1,
    groundSurveyTurn: 1,
  }
}

// ─── Corporation helper ───────────────────────────────────────────────────────

function makeCorp(
  id: CorpId,
  type: CorpType,
  level: number,
  capital: number,
): Corporation {
  return {
    id,
    name: `Corp ${id}`,
    type,
    level,
    capital,
    traits: [],
    homePlanetId: PLANET_A,
    planetsPresent: [PLANET_A],
    assets: {
      infrastructureByColony: new Map(),
      schematics: [],
      patents: [],
    },
    activeContractIds: [],
    foundedTurn: 1 as TurnNumber,
  }
}

// ─── Sector / Galaxy helpers ──────────────────────────────────────────────────

function makeSector(id: SectorId): Sector {
  return {
    id,
    name: `Sector ${id}`,
    density: SectorDensity.Moderate,
    explorationPercent: 20,
    threatModifier: 1.0,
    firstEnteredTurn: 1 as TurnNumber,
  }
}

function makeGalaxy(sectorId: SectorId): Galaxy {
  const sectors = new Map<SectorId, Sector>()
  sectors.set(sectorId, makeSector(sectorId))
  const adjacency = new Map<SectorId, SectorId[]>()
  adjacency.set(sectorId, [])
  return { sectors, adjacency, startingSectorId: sectorId }
}

// ─── Budget helper ────────────────────────────────────────────────────────────

function makeMinimalBudget(): BudgetState {
  return {
    currentBP: 10 as BPAmount,
    incomeSources: [],
    expenseEntries: [],
    totalIncome: 0 as BPAmount,
    totalExpenses: 0 as BPAmount,
    netBP: 10 as BPAmount,
    debtTokens: 0,
    stabilityMalus: 0,
    calculatedTurn: 1 as TurnNumber,
  }
}

// ─── GameState builder ────────────────────────────────────────────────────────

function makeState(opts: {
  colonies?: Colony[]
  planets?: Planet[]
  corporations?: Corporation[]
  sectorMarkets?: Map<string, SectorMarketState>
}): GameState {
  const coloniesMap = new Map<string, Colony>()
  for (const c of opts.colonies ?? []) coloniesMap.set(c.id, c)

  const planetsMap = new Map<string, Planet>()
  for (const p of opts.planets ?? []) planetsMap.set(p.id, p)

  const corpsMap = new Map<string, Corporation>()
  for (const corp of opts.corporations ?? []) corpsMap.set(corp.id, corp)

  return {
    turn: 1 as TurnNumber,
    phase: 'player_action',
    currentBP: 10 as BPAmount,
    debtTokens: 0,
    budget: makeMinimalBudget(),
    empireBonuses: createEmptyEmpireBonuses(),
    galaxy: makeGalaxy(SECTOR_ID),
    colonies: coloniesMap,
    planets: planetsMap,
    corporations: corpsMap,
    contracts: new Map(),
    ships: new Map(),
    missions: new Map(),
    scienceDomains: new Map(),
    discoveries: new Map(),
    schematics: new Map(),
    patents: new Map(),
    sectorMarkets: opts.sectorMarkets ?? new Map(),
    tradeRoutes: [],
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset the name uniqueness registry so each test starts with a clean slate.
  // generateCorporation calls the name generator, which tracks used names globally.
  clearNameRegistry()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('calculateEmergenceChance', () => {
  it('returns 0 for dynamism 5 (below threshold)', () => {
    expect(calculateEmergenceChance(5)).toBe(0)
  })

  it('returns 0 for dynamism < 5', () => {
    expect(calculateEmergenceChance(3)).toBe(0)
    expect(calculateEmergenceChance(0)).toBe(0)
  })

  it('returns 10 for dynamism 6', () => {
    expect(calculateEmergenceChance(6)).toBe(10)
  })

  it('returns 20 for dynamism 7', () => {
    expect(calculateEmergenceChance(7)).toBe(20)
  })

  it('returns 50 for dynamism 10', () => {
    expect(calculateEmergenceChance(10)).toBe(50)
  })
})

describe('determineCorpTypeFromDomain', () => {
  it('maps Agricultural to Agriculture', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.Agricultural)).toBe(CorpType.Agriculture)
  })

  it('maps Mining to Exploitation', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.Mining)).toBe(CorpType.Exploitation)
  })

  it('maps DeepMining to Exploitation', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.DeepMining)).toBe(CorpType.Exploitation)
  })

  it('maps GasExtraction to Exploitation', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.GasExtraction)).toBe(CorpType.Exploitation)
  })

  it('maps Civilian to Construction', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.Civilian)).toBe(CorpType.Construction)
  })

  it('maps LowIndustry to Industrial', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.LowIndustry)).toBe(CorpType.Industrial)
  })

  it('maps HeavyIndustry to Industrial', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.HeavyIndustry)).toBe(CorpType.Industrial)
  })

  it('maps HighTechIndustry to Industrial', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.HighTechIndustry)).toBe(CorpType.Industrial)
  })

  it('maps SpaceIndustry to Shipbuilding', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.SpaceIndustry)).toBe(CorpType.Shipbuilding)
  })

  it('maps Science to Science', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.Science)).toBe(CorpType.Science)
  })

  it('maps Transport to Transport', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.Transport)).toBe(CorpType.Transport)
  })

  it('maps Military to Military', () => {
    expect(determineCorpTypeFromDomain(InfraDomain.Military)).toBe(CorpType.Military)
  })
})

describe('findMostProminentPublicDomain', () => {
  it('returns the domain with the most public levels', () => {
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({
        [InfraDomain.Science]: { levels: 5 },
        [InfraDomain.Mining]: { levels: 3 },
        [InfraDomain.Civilian]: { levels: 2 },
      }),
    )
    expect(findMostProminentPublicDomain(colony)).toBe(InfraDomain.Science)
  })

  it('returns a different domain when it has more public levels', () => {
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({
        [InfraDomain.Agricultural]: { levels: 8 },
        [InfraDomain.Science]: { levels: 2 },
      }),
    )
    expect(findMostProminentPublicDomain(colony)).toBe(InfraDomain.Agricultural)
  })

  it('returns null when no domain has any public levels', () => {
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra(), // all domains at 0
    )
    expect(findMostProminentPublicDomain(colony)).toBeNull()
  })

  it('returns the single domain that has public levels', () => {
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({ [InfraDomain.Transport]: { levels: 1 } }),
    )
    expect(findMostProminentPublicDomain(colony)).toBe(InfraDomain.Transport)
  })
})

describe('organic emergence integration (resolveCorpPhase)', () => {
  // ── Emergence never fires below dynamism 6 ────────────────────────────────

  it('never spawns a new corp when colony dynamism is below 6', () => {
    // dynamism 5 → 0% chance → even with Math.random mocked to 0, no emergence
    const infra = makeInfra({ [InfraDomain.Science]: { levels: 3 } })
    const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5) // dynamism 5
    const planet = makePlanet(PLANET_A, SECTOR_ID)

    const state = makeState({ colonies: [colony], planets: [planet] })
    const result = resolveCorpPhase(state)

    expect(result.updatedState.corporations.size).toBe(0)
    expect(result.events).toHaveLength(0)
  })

  // ── Guaranteed emergence via mocked Math.random ───────────────────────────

  it('spawns a new corp when dynamism >= 6 and Math.random guarantees the roll', () => {
    // Mock Math.random to return 0 so chance(percent) = (0 * 100 < percent) = true
    // for any percent > 0. dynamism 8 → 30% chance → always fires.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const infra = makeInfra({ [InfraDomain.Science]: { levels: 3 } })
    const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 8) // dynamism 8
    const planet = makePlanet(PLANET_A, SECTOR_ID)

    const state = makeState({ colonies: [colony], planets: [planet] })
    const result = resolveCorpPhase(state)

    // One new corp should have emerged
    expect(result.updatedState.corporations.size).toBe(1)

    const newCorp = [...result.updatedState.corporations.values()][0]!
    expect(newCorp.type).toBe(CorpType.Science) // Science infra → Science corp
    expect(newCorp.level).toBe(1)
    expect(newCorp.homePlanetId).toBe(PLANET_A)
  })

  it('new corp holds 1 corporate level in the source domain', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const infra = makeInfra({ [InfraDomain.Agricultural]: { levels: 4 } })
    const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 9) // dynamism 9
    const planet = makePlanet(PLANET_A, SECTOR_ID)

    const state = makeState({ colonies: [colony], planets: [planet] })
    const result = resolveCorpPhase(state)

    const newCorp = [...result.updatedState.corporations.values()][0]!
    const holdingsOnColony = newCorp.assets.infrastructureByColony.get(COLONY_A)

    expect(holdingsOnColony?.[InfraDomain.Agricultural]).toBe(1)
  })

  it('transfers infrastructure: public level decremented by 1, corporate level appears', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const infra = makeInfra({ [InfraDomain.Transport]: { levels: 5 } })
    const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 7)
    const planet = makePlanet(PLANET_A, SECTOR_ID)

    const state = makeState({ colonies: [colony], planets: [planet] })
    const result = resolveCorpPhase(state)

    const updatedColony = result.updatedState.colonies.get(COLONY_A)!
    const transportState = updatedColony.infrastructure[InfraDomain.Transport]

    // Public level decremented from 5 to 4
    expect(transportState.ownership.publicLevels).toBe(4)

    // New corp now has 1 corporate level here
    const corpLevelEntries = [...transportState.ownership.corporateLevels.entries()]
    expect(corpLevelEntries).toHaveLength(1)
    expect(corpLevelEntries[0]![1]).toBe(1)
  })

  it('new corp appears in colony.corporationsPresent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const infra = makeInfra({ [InfraDomain.Military]: { levels: 2 } })
    const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 10)
    const planet = makePlanet(PLANET_A, SECTOR_ID)

    const state = makeState({ colonies: [colony], planets: [planet] })
    const result = resolveCorpPhase(state)

    const updatedColony = result.updatedState.colonies.get(COLONY_A)!
    const newCorp = [...result.updatedState.corporations.values()][0]!

    expect(updatedColony.corporationsPresent).toContain(newCorp.id)
  })

  it('generates a Positive event describing the emergence', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const infra = makeInfra({ [InfraDomain.Civilian]: { levels: 3 } })
    const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 6)
    const planet = makePlanet(PLANET_A, SECTOR_ID)

    const state = makeState({ colonies: [colony], planets: [planet] })
    const result = resolveCorpPhase(state)

    const emergenceEvents = result.events.filter((e) => e.category === 'corporation')
    expect(emergenceEvents.length).toBeGreaterThanOrEqual(1)

    const evt = emergenceEvents[emergenceEvents.length - 1]! // last event is the emergence
    expect(evt.priority).toBe(EventPriority.Positive)
    expect(evt.relatedEntityIds).toContain(COLONY_A)
  })

  it('does not spawn a corp when colony has no public infrastructure levels', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    // All corporate-owned — no public levels to spawn from
    const corpLevels = new Map<CorpId, number>()
    corpLevels.set('corp_existing' as CorpId, 5)

    const infra = {} as ColonyInfrastructure
    for (const domain of Object.values(InfraDomain)) {
      infra[domain] = {
        domain,
        ownership: {
          publicLevels: 0, // No public levels
          corporateLevels: domain === InfraDomain.Science ? corpLevels : new Map(),
        },
        currentCap: Infinity,
      }
    }

    const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 10)
    const planet = makePlanet(PLANET_A, SECTOR_ID)

    const state = makeState({ colonies: [colony], planets: [planet] })
    const result = resolveCorpPhase(state)

    // No new corps (no public levels available to transfer)
    expect(result.updatedState.corporations.size).toBe(0)
  })

  it('max one emergence per colony per turn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const infra = makeInfra({ [InfraDomain.Mining]: { levels: 10 } })
    // dynamism 10 → 50% chance; with random=0 it fires — but only once per colony
    const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 10)
    const planet = makePlanet(PLANET_A, SECTOR_ID)

    const state = makeState({ colonies: [colony], planets: [planet] })
    const result = resolveCorpPhase(state)

    // Exactly one new corp per colony, not multiple
    expect(result.updatedState.corporations.size).toBe(1)
  })

  it('existing corporations in state are preserved alongside the newly emerged one', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 2 } })
    const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 8)
    const planet = makePlanet(PLANET_A, SECTOR_ID)

    const existingCorp = makeCorp('corp_exist01' as CorpId, CorpType.Industrial, 2, 0)

    const state = makeState({
      colonies: [colony],
      planets: [planet],
      corporations: [existingCorp],
    })
    const result = resolveCorpPhase(state)

    // Original corp still present + one new emerged corp
    expect(result.updatedState.corporations.size).toBe(2)
    expect(result.updatedState.corporations.has('corp_exist01' as CorpId)).toBe(true)
  })
})
