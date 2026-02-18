/**
 * colony-phase.test.ts — Unit tests for the colony-phase turn resolver.
 *
 * Covers (Story 10.3 acceptance criteria):
 * - Recalculates all attributes for every colony (habitability, accessibility,
 *   dynamism, QoL, stability, growthPerTurn) using current market data and infra.
 * - Applies growth tick (growth accumulator + growthPerTurn → population transitions).
 * - Checks population level-up (growth ≥ 10 + civilian infra req met → pop +1).
 * - Checks population level-down (growth ≤ -1 → pop -1, growth → 9).
 * - Checks organic infrastructure growth (dynamism × 5% chance).
 * - Recalculates infrastructure caps per domain.
 * - Returns updated colonies + events (population milestones, attribute warnings).
 * - Colonies with missing planets are skipped gracefully.
 * - Shortage resources derived from previous sector market state.
 */

import { describe, it, expect } from 'vitest'
import { resolveColonyPhase } from '../../../engine/turn/colony-phase'
import type { GameState } from '../../../types/game'
import type { Colony } from '../../../types/colony'
import type { Planet, Deposit } from '../../../types/planet'
import type { Sector, Galaxy } from '../../../types/sector'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { Modifier } from '../../../types/modifier'
import type { BudgetState } from '../../../types/budget'
import type { SectorMarketState } from '../../../types/trade'
import type { ColonyId, PlanetId, SectorId, TurnNumber, BPAmount } from '../../../types/common'
import {
  InfraDomain,
  ResourceType,
  DepositType,
  RichnessLevel,
  ColonyType,
  PlanetType,
  PlanetSize,
  PlanetStatus,
  SectorDensity,
  EventPriority,
} from '../../../types/common'
import { createEmptyEmpireBonuses } from '../../../types/empire'

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const SECTOR_ID = 'sec_test01' as SectorId
const PLANET_A  = 'pln_testA1' as PlanetId
const PLANET_B  = 'pln_testB1' as PlanetId
const COLONY_A  = 'col_testA1' as ColonyId
const COLONY_B  = 'col_testB1' as ColonyId

// ─── Infrastructure helpers ───────────────────────────────────────────────────

function makeInfraState(domain: InfraDomain, publicLevels: number, cap = Infinity): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: cap,
  }
}

/**
 * Builds a complete ColonyInfrastructure with zero levels for all domains
 * unless overridden. Caps start at Infinity — colony-phase will recalculate them.
 */
function makeInfra(overrides: Partial<Record<InfraDomain, number>> = {}): ColonyInfrastructure {
  const result = {} as ColonyInfrastructure
  for (const domain of Object.values(InfraDomain)) {
    result[domain] = makeInfraState(domain, overrides[domain] ?? 0)
  }
  return result
}

// ─── Colony helper ────────────────────────────────────────────────────────────

function makeColony(
  id: ColonyId,
  planetId: PlanetId,
  sectorId: SectorId,
  infra: ColonyInfrastructure,
  populationLevel: number,
  growthAccumulator: number,
  modifiers: Modifier[] = [],
): Colony {
  return {
    id,
    planetId,
    sectorId,
    name: `Colony ${id}`,
    type: ColonyType.FrontierColony,
    populationLevel,
    attributes: {
      habitability: 8,
      accessibility: 3,
      dynamism: 3,
      qualityOfLife: 8,
      stability: 8,
      growth: growthAccumulator,
    },
    infrastructure: infra,
    corporationsPresent: [],
    modifiers,
    foundedTurn: 1 as TurnNumber,
  }
}

// ─── Planet helper ────────────────────────────────────────────────────────────

function makePlanet(
  id: PlanetId,
  sectorId: SectorId,
  deposits: Deposit[] = [],
  baseHabitability = 8,
  size = PlanetSize.Large,
): Planet {
  return {
    id,
    name: `Planet ${id}`,
    sectorId,
    type: PlanetType.Continental,
    size,
    status: PlanetStatus.Colonized,
    baseHabitability,
    deposits,
    features: [],
    featureModifiers: [],
    orbitScanTurn: 1,
    groundSurveyTurn: 1,
  }
}

// ─── Deposit helper ───────────────────────────────────────────────────────────

function makeDeposit(type: DepositType, richness: RichnessLevel): Deposit {
  return { type, richness, richnessRevealed: true }
}

// ─── Sector / Galaxy helpers ──────────────────────────────────────────────────

function makeSector(id: SectorId, name: string): Sector {
  return {
    id,
    name,
    density: SectorDensity.Moderate,
    explorationPercent: 10,
    threatModifier: 1.0,
    firstEnteredTurn: 1 as TurnNumber,
  }
}

function makeGalaxy(sectors: Sector[]): Galaxy {
  const sectorsMap = new Map<SectorId, Sector>()
  const adjacency = new Map<SectorId, SectorId[]>()
  for (const s of sectors) {
    sectorsMap.set(s.id, s)
    adjacency.set(s.id, [])
  }
  return {
    sectors: sectorsMap,
    adjacency,
    startingSectorId: sectors[0]?.id ?? SECTOR_ID,
  }
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

// ─── Sector market state helper ───────────────────────────────────────────────

/**
 * Builds a minimal SectorMarketState with the given net surplus per resource.
 * Resources omitted from the overrides default to 0 (no surplus/deficit).
 */
function makeSectorMarket(
  sectorId: SectorId,
  netSurplusOverrides: Partial<Record<ResourceType, number>> = {},
): SectorMarketState {
  const zero = Object.values(ResourceType).reduce(
    (acc, r) => ({ ...acc, [r]: 0 }),
    {} as Record<ResourceType, number>,
  )
  return {
    sectorId,
    totalProduction: { ...zero },
    totalConsumption: { ...zero },
    netSurplus: { ...zero, ...netSurplusOverrides },
    inboundFlows: [],
    outboundFlows: [],
  }
}

// ─── GameState builder ────────────────────────────────────────────────────────

function makeState(overrides: {
  sectors?: Sector[]
  colonies?: Colony[]
  planets?: Planet[]
  debtTokens?: number
  sectorMarkets?: Map<string, SectorMarketState>
}): GameState {
  const sectors = overrides.sectors ?? [makeSector(SECTOR_ID, 'Test Sector')]
  const colonies = overrides.colonies ?? []
  const planets  = overrides.planets  ?? []

  const coloniesMap = new Map<string, Colony>()
  for (const c of colonies) coloniesMap.set(c.id, c)

  const planetsMap = new Map<string, Planet>()
  for (const p of planets) planetsMap.set(p.id, p)

  return {
    turn: 1 as TurnNumber,
    phase: 'player_action',
    currentBP: 10 as BPAmount,
    debtTokens: overrides.debtTokens ?? 0,
    budget: makeMinimalBudget(),
    empireBonuses: createEmptyEmpireBonuses(),
    galaxy: makeGalaxy(sectors),
    colonies: coloniesMap,
    planets: planetsMap,
    corporations: new Map(),
    contracts: new Map(),
    ships: new Map(),
    missions: new Map(),
    scienceDomains: new Map(),
    discoveries: new Map(),
    schematics: new Map(),
    patents: new Map(),
    sectorMarkets: overrides.sectorMarkets ?? new Map(),
    tradeRoutes: [],
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveColonyPhase', () => {

  // ── No colonies ───────────────────────────────────────────────────────────

  describe('no colonies', () => {
    it('returns state unchanged when there are no colonies', () => {
      const state = makeState({})
      const { updatedState, events } = resolveColonyPhase(state)
      expect(updatedState.colonies.size).toBe(0)
      expect(events).toHaveLength(0)
    })
  })

  // ── Missing planet graceful skip ──────────────────────────────────────────

  describe('colony with no matching planet', () => {
    it('skips colony whose planet is missing from state.planets', () => {
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 1, 0)
      // Planet NOT added to planets map → colony is orphaned
      const state = makeState({ colonies: [colony], planets: [] })
      const { updatedState, events } = resolveColonyPhase(state)
      // Colony unchanged (skipped) — still present but not updated
      expect(updatedState.colonies.has(COLONY_A)).toBe(true)
      expect(events).toHaveLength(0)
    })
  })

  // ── Attribute recalculation ────────────────────────────────────────────────
  //
  // Planet: Continental, Large, baseHab = 8, no deposits, no features.
  // Colony: pop 3, no infra at all, no modifiers, no debt, growthAccumulator = 2.
  //
  // Expected attribute values:
  //   habitability   = 8       (baseHab 8, no feature mods)
  //   accessibility  = 3       (3 + floor(0/2) = 3, no transport)
  //   dynamism       = 3       (floor((3+3)/2) + 0 = 3, no corp infra)
  //   qualityOfLife  = 10      (10 - floor(max(0,10-8)/3) = 10 - 0 = 10)
  //   stability      = 10      (10 - max(0,5-10) - floor(0/2) + 0 = 10)
  //   growthPerTurn  = 4       (floor((10+10+3)/3) - 3 - 0 = 7 - 3 = 4)
  //   newGrowth      = 2 + 4 = 6   (no transition)

  describe('basic attribute recalculation', () => {
    it('recalculates all colony attributes correctly', () => {
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 2)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.attributes.habitability).toBe(8)
      expect(updated.attributes.accessibility).toBe(3)
      expect(updated.attributes.dynamism).toBe(3)
      expect(updated.attributes.qualityOfLife).toBe(10)
      expect(updated.attributes.stability).toBe(10)
      // growthPerTurn = 4 → growth = 2 + 4 = 6
      expect(updated.attributes.growth).toBe(6)
    })

    it('accessibility increases with transport infrastructure', () => {
      // transport = 4 → accessibility = 3 + floor(4/2) = 5
      const infra = makeInfra({ [InfraDomain.Transport]: 4 })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.attributes.accessibility).toBe(5)
    })

    it('stability is reduced by debt tokens', () => {
      // debtTokens = 4 → debt_malus = floor(4/2) = 2 → stability = 10 - 2 = 8
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet], debtTokens: 4 })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.attributes.stability).toBe(8) // 10 - 2 = 8
    })

    it('stability is improved by military infrastructure', () => {
      // military = 6 → military_bonus = min(3, floor(6/3)) = min(3,2) = 2
      // stability = 10 - 0 - 0 + 2 = 10 (clamped at 10)
      const infra = makeInfra({ [InfraDomain.Military]: 6 })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.attributes.stability).toBe(10) // already max
    })

    it('QoL degrades on low-habitability planet', () => {
      // hab = 4 → hab_malus = floor(max(0, 10-4)/3) = floor(2) = 2
      // qol = 10 - 2 = 8
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 4, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.attributes.habitability).toBe(4)
      expect(updated.attributes.qualityOfLife).toBe(8)
    })

    it('QoL is reduced by shortage modifiers already on the colony', () => {
      // Food shortage: -2 QoL modifier already applied by market-phase
      const shortageModifier: Modifier = {
        id: 'mod_foodshortage',
        target: 'qualityOfLife',
        operation: 'add',
        value: -2,
        sourceType: 'shortage',
        sourceId: 'shortage_Food',
        sourceName: 'Food Shortage',
      }
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0, [shortageModifier])
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      // qol = 10 - 0 (hab mods) - 2 (shortage mod) = 8
      expect(updated.attributes.qualityOfLife).toBe(8)
    })
  })

  // ── Infrastructure cap recalculation ──────────────────────────────────────
  //
  // colony-phase must write fresh currentCap values based on pop level and deposits.

  describe('infrastructure cap recalculation', () => {
    it('sets Civilian cap to Infinity', () => {
      const infra = makeInfra({ [InfraDomain.Civilian]: 2 })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.infrastructure[InfraDomain.Civilian].currentCap).toBe(Infinity)
    })

    it('sets non-extraction domain caps to pop × 2', () => {
      // pop = 3 → Transport cap = 3 × 2 = 6
      const infra = makeInfra({ [InfraDomain.Transport]: 2 })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.infrastructure[InfraDomain.Transport].currentCap).toBe(6)
      expect(updated.infrastructure[InfraDomain.Science].currentCap).toBe(6)
      expect(updated.infrastructure[InfraDomain.Military].currentCap).toBe(6)
    })

    it('extraction cap is min(pop cap, richness cap) when deposit exists', () => {
      // pop = 3 → pop cap = 3 × 2 = 6
      // FertileGround Rich → richness cap = 15
      // Agricultural cap = min(6, 15) = 6
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const deposit = makeDeposit(DepositType.FertileGround, RichnessLevel.Rich)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [deposit], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.infrastructure[InfraDomain.Agricultural].currentCap).toBe(6)
    })

    it('richness cap dominates when deposit richness is tighter than pop cap', () => {
      // pop = 5 → pop cap = 5 × 2 = 10
      // CommonOreVein Poor → richness cap = 5
      // Mining cap = min(10, 5) = 5 ← richness is tighter
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5, 0)
      const deposit = makeDeposit(DepositType.CommonOreVein, RichnessLevel.Poor)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [deposit], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.infrastructure[InfraDomain.Mining].currentCap).toBe(5)
    })

    it('extraction cap is 0 when planet has no matching deposit', () => {
      // No Agricultural deposit → Agricultural cap = 0
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.infrastructure[InfraDomain.Agricultural].currentCap).toBe(0)
      expect(updated.infrastructure[InfraDomain.Mining].currentCap).toBe(0)
      expect(updated.infrastructure[InfraDomain.DeepMining].currentCap).toBe(0)
      expect(updated.infrastructure[InfraDomain.GasExtraction].currentCap).toBe(0)
    })

    it('uses best deposit when multiple deposits for same domain exist', () => {
      // Two Mining deposits: Poor (cap 5) and Rich (cap 15)
      // Mining cap = min(pop×2=6, 15) = 6 — best deposit wins
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const deposits = [
        makeDeposit(DepositType.CommonOreVein, RichnessLevel.Poor),
        makeDeposit(DepositType.CommonOreVein, RichnessLevel.Rich),
      ]
      const planet = makePlanet(PLANET_A, SECTOR_ID, deposits, 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.infrastructure[InfraDomain.Mining].currentCap).toBe(6)
    })
  })

  // ── Growth tick ───────────────────────────────────────────────────────────
  //
  // Boundary conditions for growth accumulation and thresholds are tested in
  // colony-sim.test.ts (applyGrowthTick unit tests). Here we only verify
  // integration: growth accumulates through the full phase pipeline.

  describe('growth tick', () => {
    it('accumulates growth each turn without a transition', () => {
      // growth = 2, conditions give growthPerTurn = 4 (hab=8, no infra, pop=3)
      // newGrowth = 2 + 4 = 6 — no level change
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 2)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState, events } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.populationLevel).toBe(3)  // unchanged
      expect(updated.attributes.growth).toBe(6) // 2 + 4
      const popEvents = events.filter((e) => e.title.includes('Population'))
      expect(popEvents).toHaveLength(0)
    })
  })

  // ── Population level-up ───────────────────────────────────────────────────
  //
  // Boundary conditions (civilian infra check, planet size cap) are covered
  // in colony-sim.test.ts. Here we verify the phase emits the correct event.

  describe('population level-up', () => {
    it('increments population and emits Positive event on level-up', () => {
      // pop=2, growth=7, civilian=6 ≥ (2+1)×2=6; growthPerTurn=4 → 11 ≥ 10
      const infra = makeInfra({ [InfraDomain.Civilian]: 6 })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 2, 7)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState, events } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.populationLevel).toBe(3)
      expect(updated.attributes.growth).toBe(0)

      const popEvents = events.filter((e) => e.title.includes('Population Growth'))
      expect(popEvents).toHaveLength(1)
      expect(popEvents[0]!.priority).toBe(EventPriority.Positive)
      expect(popEvents[0]!.category).toBe('colony')
      expect(popEvents[0]!.relatedEntityIds).toContain(COLONY_A)
    })
  })

  // ── Population level-down ─────────────────────────────────────────────────
  //
  // Boundary conditions (pop=1 floor) covered in colony-sim.test.ts.
  // Here we verify the phase emits the correct event.

  describe('population level-down', () => {
    it('decrements population and emits Warning event on level-down', () => {
      // pop=3, growth=-9, growthPerTurn≈4 → newGrowth=-5 ≤ -1 → pop 3→2
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, -9)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState, events } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.populationLevel).toBe(2)
      expect(updated.attributes.growth).toBe(9)

      const popEvents = events.filter((e) => e.title.includes('Population Decline'))
      expect(popEvents).toHaveLength(1)
      expect(popEvents[0]!.priority).toBe(EventPriority.Warning)
      expect(popEvents[0]!.category).toBe('colony')
      expect(popEvents[0]!.relatedEntityIds).toContain(COLONY_A)
    })
  })

  // ── Organic infrastructure growth ─────────────────────────────────────────
  //
  // Organic growth fires at dynamism × 5% per turn.
  // With dynamism = 0 (no infra, pop 1, access 3) → chance = 0 → no growth ever.
  // With dynamism guaranteed and forced rng, we can test growth triggers.

  describe('organic infrastructure growth', () => {
    it('does not trigger organic growth when colony has no infrastructure', () => {
      // applyOrganicInfraGrowth requires at least 1 total infra level
      // Colony has no infra → organic growth always skipped
      const infra = makeInfra() // all zeros
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      // Total infra should remain 0 everywhere
      const totalLevels = Object.values(updated.infrastructure).reduce(
        (sum, s) => sum + (s as import('../../../types/infrastructure').InfraState).ownership.publicLevels,
        0,
      )
      expect(totalLevels).toBe(0)
    })

    it('dynamism calculation reflects transport and population inputs', () => {
      // transport=4 → access=5; pop=4; no corp infra
      // dynamism = floor((5+4)/2) + 0 = 4 (matches 'dynamism × 5% = 20% chance')
      const infra = makeInfra({ [InfraDomain.Transport]: 4 })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 4, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated.attributes.dynamism).toBe(4)
    })
  })

  // ── Shortage resource derivation ──────────────────────────────────────────
  //
  // Shortage resources for organic growth weighting come from state.sectorMarkets.
  // Resources with negative netSurplus are in shortage.

  describe('shortage resources from sector market state', () => {
    it('passes shortage resources to organic growth when sector market shows deficit', () => {
      // Colony with infra so organic growth CAN fire.
      // With a sector market showing Food shortage, organic growth will prefer
      // Agricultural over other domains (if they have levels).
      // We just verify the phase completes without error using sector market data.
      const infra = makeInfra({
        [InfraDomain.Agricultural]: 2,
        [InfraDomain.Mining]: 2,
      })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const deposits = [
        makeDeposit(DepositType.FertileGround, RichnessLevel.Rich),
        makeDeposit(DepositType.CommonOreVein, RichnessLevel.Rich),
      ]
      const planet = makePlanet(PLANET_A, SECTOR_ID, deposits, 8, PlanetSize.Large)

      const sectorMarket = makeSectorMarket(SECTOR_ID, {
        [ResourceType.Food]: -3, // food shortage
      })
      const sectorMarkets = new Map([[SECTOR_ID as string, sectorMarket]])
      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets })

      // Just verify no crash and state is consistent
      const { updatedState } = resolveColonyPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!

      expect(updated).toBeDefined()
      expect(updated.populationLevel).toBe(3)
    })

    it('uses no shortage resources when sector has no market data', () => {
      // No sectorMarkets entry → shortageResources = [] → organic growth is unweighted
      const infra = makeInfra({ [InfraDomain.Transport]: 2 })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })
      // sectorMarkets is empty by default in makeState

      const { updatedState } = resolveColonyPhase(state)
      expect(updatedState.colonies.has(COLONY_A)).toBe(true)
    })
  })

  // ── Attribute warning events ───────────────────────────────────────────────
  //
  // Warnings emitted when stability ≤ 2 or qualityOfLife ≤ 2.

  describe('attribute warning events', () => {
    it('emits a Warning event when stability is critically low', () => {
      // Use hab=1 (very inhospitable) + 4 debt tokens:
      // hab=1, hab_malus = floor(9/3) = 3
      // qol = 10 - 3 = 7 (no shortage mods) → stable
      // debt_malus = floor(4/2) = 2
      // stability = 10 - max(0,5-7) - 2 + 0 = 10 - 0 - 2 = 8 ... not low enough
      //
      // Need more: Add shortage modifiers to push qol down → stability down.
      // Food shortage: -2 QoL → qol = 7 - 2 = 5
      // stability = 10 - max(0, 5-5) - 2 = 8 ... still not ≤ 2
      //
      // Use hab=2 (hab_malus=2) + food+cg+tc shortages + high debt:
      // qol = 10 - 2 - 2 - 1 = 5
      // debtTokens=10 → debt_malus=5
      // stability = 10 - max(0,5-5) - 5 = 5 ... still not ≤ 2
      //
      // Use hab=1 + food+cg shortages + debt=10:
      // hab_malus = floor(9/3)=3, qol = 10-3-2-1=4
      // stability = 10 - max(0,5-4) - 5 + 0 = 10 - 1 - 5 = 4 ... close but not ≤ 2
      //
      // Add a direct stability modifier: -3 stability from a feature
      const shortageModifiers: Modifier[] = [
        {
          id: 'mod_food',
          target: 'qualityOfLife',
          operation: 'add',
          value: -2,
          sourceType: 'shortage',
          sourceId: 'shortage_Food',
          sourceName: 'Food Shortage',
        },
        {
          id: 'mod_cg',
          target: 'qualityOfLife',
          operation: 'add',
          value: -1,
          sourceType: 'shortage',
          sourceId: 'shortage_CG',
          sourceName: 'Consumer Goods Shortage',
        },
        {
          id: 'mod_stab',
          target: 'stability',
          operation: 'add',
          value: -3,
          sourceType: 'feature',
          sourceId: 'feature_unstable',
          sourceName: 'Unstable Tectonics',
        },
      ]
      // hab=2, debt=10:
      // hab_malus = floor(8/3) = 2; qol = 10-2-2-1=5
      // stability_qol_malus = max(0, 5-5) = 0
      // debt_malus = floor(10/2) = 5
      // stability = 10 - 0 - 5 + 0 (feature mod -3) = 2 ← exactly 2 ≤ 2 → warning
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0, shortageModifiers)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 2, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet], debtTokens: 10 })

      const { events } = resolveColonyPhase(state)

      const stabilityWarnings = events.filter(
        (e) => e.title.includes('Low Stability') && e.priority === EventPriority.Warning,
      )
      expect(stabilityWarnings).toHaveLength(1)
      expect(stabilityWarnings[0]!.category).toBe('colony')
      expect(stabilityWarnings[0]!.relatedEntityIds).toContain(COLONY_A)
    })

    it('emits a Warning event when quality of life is critically low', () => {
      // Very low habitability + food, CG, TC shortage modifiers:
      // hab=1, hab_malus=3
      // qol = 10 - 3 - 2 - 1 = 4 ... still above 2
      //
      // Need more malus. Use hab=1 + 3 shortage types + feature modifier:
      // food: -2, cg: -1, direct -5 qol modifier from feature
      // qol = 10 - 3 (hab) - 2 - 1 - 5 = -1 → clamped to 0 ≤ 2 → warning
      const modifiers: Modifier[] = [
        {
          id: 'mod_food2',
          target: 'qualityOfLife',
          operation: 'add',
          value: -2,
          sourceType: 'shortage',
          sourceId: 'shortage_Food2',
          sourceName: 'Food Shortage',
        },
        {
          id: 'mod_qol_feat',
          target: 'qualityOfLife',
          operation: 'add',
          value: -5,
          sourceType: 'feature',
          sourceId: 'feature_toxic',
          sourceName: 'Toxic Atmosphere',
        },
      ]
      // hab=1, hab_malus = floor(9/3) = 3
      // qol = 10 - 3 - 2 - 5 = 0 ≤ 2 → warning
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0, modifiers)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 1, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { events } = resolveColonyPhase(state)

      const qolWarnings = events.filter(
        (e) => e.title.includes('Low Quality of Life') && e.priority === EventPriority.Warning,
      )
      expect(qolWarnings).toHaveLength(1)
      expect(qolWarnings[0]!.relatedEntityIds).toContain(COLONY_A)
    })

    it('emits no attribute warnings for a healthy colony', () => {
      // Good planet (hab=8), no debt, no shortages → all attributes high → no warnings
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 0)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const { events } = resolveColonyPhase(state)

      const warnings = events.filter((e) => e.priority === EventPriority.Warning)
      expect(warnings).toHaveLength(0)
    })
  })

  // ── Multiple colonies ─────────────────────────────────────────────────────

  describe('multiple colonies in the same state', () => {
    it('processes both colonies independently and returns all updates', () => {
      const infraA = makeInfra({ [InfraDomain.Transport]: 4 }) // access=5
      const infraB = makeInfra({ [InfraDomain.Transport]: 0 }) // access=3

      const colonyA = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infraA, 3, 0)
      const colonyB = makeColony(COLONY_B, PLANET_B, SECTOR_ID, infraB, 5, 0)

      const planetA = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const planetB = makePlanet(PLANET_B, SECTOR_ID, [], 6, PlanetSize.Medium)

      const state = makeState({
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
      })

      const { updatedState } = resolveColonyPhase(state)

      expect(updatedState.colonies.size).toBe(2)

      const updatedA = updatedState.colonies.get(COLONY_A)!
      const updatedB = updatedState.colonies.get(COLONY_B)!

      expect(updatedA.attributes.accessibility).toBe(5) // transport=4
      expect(updatedB.attributes.accessibility).toBe(3) // no transport
    })

    it('generates events for each colony independently', () => {
      // Colony A: will level up (growth=7, civilian=6, pop=2)
      // Colony B: will level down (growth=-9, pop=3)
      const infraA = makeInfra({ [InfraDomain.Civilian]: 6 })
      const infraB = makeInfra()

      const colonyA = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infraA, 2, 7)
      const colonyB = makeColony(COLONY_B, PLANET_B, SECTOR_ID, infraB, 3, -9)

      const planetA = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const planetB = makePlanet(PLANET_B, SECTOR_ID, [], 8, PlanetSize.Large)

      const state = makeState({
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
      })

      const { events } = resolveColonyPhase(state)

      const levelUpEvents   = events.filter((e) => e.title.includes('Population Growth'))
      const levelDownEvents = events.filter((e) => e.title.includes('Population Decline'))

      expect(levelUpEvents).toHaveLength(1)
      expect(levelDownEvents).toHaveLength(1)
      expect(levelUpEvents[0]!.relatedEntityIds).toContain(COLONY_A)
      expect(levelDownEvents[0]!.relatedEntityIds).toContain(COLONY_B)
    })
  })

  // ── State immutability ────────────────────────────────────────────────────

  describe('state immutability', () => {
    it('does not mutate the input game state', () => {
      const infra = makeInfra()
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 3, 2)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [], 8, PlanetSize.Large)
      const state = makeState({ colonies: [colony], planets: [planet] })

      const originalGrowth = colony.attributes.growth
      const originalPop = colony.populationLevel

      resolveColonyPhase(state)

      // Original objects must remain unchanged
      expect(colony.attributes.growth).toBe(originalGrowth)
      expect(colony.populationLevel).toBe(originalPop)
    })
  })
})
