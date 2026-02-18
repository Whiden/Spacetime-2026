/**
 * corp-phase.test.ts — Unit tests for the Corp Phase turn resolution (Story 11.2).
 *
 * Covers:
 * - Multi-corp turn: capital gain applied to all corps before/during AI decisions.
 * - Multi-corp turn: investments from multiple corps applied to state correctly.
 * - Corps are processed in order: highest level acts first.
 * - Acquisition: acquired corp is removed from updated state.
 * - Acquisition: buyer's assets merge and level increases.
 * - Events from all corps are collected in the PhaseResult.
 * - Absorbed corps are skipped if they appear later in the processing queue.
 */

import { describe, it, expect } from 'vitest'
import { resolveCorpPhase } from '../../../engine/turn/corp-phase'
import type { GameState } from '../../../types/game'
import type { Corporation, CorpInfrastructureHoldings } from '../../../types/corporation'
import type { Colony } from '../../../types/colony'
import type { Planet, Deposit } from '../../../types/planet'
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
  DepositType,
  RichnessLevel,
} from '../../../types/common'
import { createEmptyEmpireBonuses } from '../../../types/empire'

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const SECTOR_ID = 'sec_phase01' as SectorId
const PLANET_A = 'pln_phaseA1' as PlanetId
const PLANET_B = 'pln_phaseB1' as PlanetId
const COLONY_A = 'col_phaseA1' as ColonyId
const COLONY_B = 'col_phaseB1' as ColonyId
const CORP_HIGH = 'corp_high001' as CorpId  // higher-level corp
const CORP_LOW  = 'corp_low0001' as CorpId  // lower-level corp
const CORP_TARGET = 'corp_tgt001' as CorpId // acquisition target

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

// ─── Corporation helper ───────────────────────────────────────────────────────

function makeCorp(
  id: CorpId,
  type: CorpType,
  level: number,
  capital: number,
  holdings: Map<ColonyId, CorpInfrastructureHoldings> = new Map(),
  planetsPresent: PlanetId[] = [],
): Corporation {
  return {
    id,
    name: `Corp ${id}`,
    type,
    level,
    capital,
    traits: [],
    homePlanetId: PLANET_A,
    planetsPresent,
    assets: {
      infrastructureByColony: holdings,
      schematics: [],
      patents: [],
    },
    activeContractIds: [],
    foundedTurn: 1 as TurnNumber,
  }
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

function makePlanet(id: PlanetId, sectorId: SectorId, deposits: Deposit[] = []): Planet {
  return {
    id,
    name: `Planet ${id}`,
    sectorId,
    type: PlanetType.Continental,
    size: PlanetSize.Large,
    status: PlanetStatus.Colonized,
    baseHabitability: 8,
    deposits,
    features: [],
    featureModifiers: [],
    orbitScanTurn: 1,
    groundSurveyTurn: 1,
  }
}

function makeDeposit(type: DepositType, richness = RichnessLevel.Moderate): Deposit {
  return { type, richness, richnessRevealed: true }
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

// ─── Market helper ────────────────────────────────────────────────────────────

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

describe('resolveCorpPhase', () => {

  // ── Capital gain ──────────────────────────────────────────────────────────

  describe('capital gain', () => {
    it('applies capital gain to all corporations each turn', () => {
      // Corp with 10 infra levels owned → capital gain bonus = floor(10/10) = 1
      // Plus random(0,1) so capital increases by at least 1
      const holdings = new Map<ColonyId, CorpInfrastructureHoldings>()
      holdings.set(COLONY_A, { [InfraDomain.LowIndustry]: 10 })

      const corp = makeCorp(CORP_HIGH, CorpType.Industrial, 3, 0, holdings)
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, makeInfra())
      const planet = makePlanet(PLANET_A, SECTOR_ID)

      const state = makeState({ colonies: [colony], planets: [planet], corporations: [corp] })
      const result = resolveCorpPhase(state)

      const updatedCorp = result.updatedState.corporations.get(CORP_HIGH)
      // Capital is 0 + gain. With 10 infra, gain = random(0,1) + 1. Always >= 1.
      expect(updatedCorp!.capital).toBeGreaterThanOrEqual(1)
    })

    it('applies capital gain to multiple corps independently', () => {
      // Two corps with no infra: gain = random(0,1), so capital ends up 0 or 1
      const corpA = makeCorp(CORP_HIGH, CorpType.Industrial, 3, 5)
      const corpB = makeCorp(CORP_LOW, CorpType.Science, 1, 3)

      const state = makeState({ corporations: [corpA, corpB] })
      const result = resolveCorpPhase(state)

      const updatedA = result.updatedState.corporations.get(CORP_HIGH)
      const updatedB = result.updatedState.corporations.get(CORP_LOW)

      // Both should have gained at least 0 capital (could be 0 or 1 from random)
      expect(updatedA!.capital).toBeGreaterThanOrEqual(5)
      expect(updatedB!.capital).toBeGreaterThanOrEqual(3)
    })
  })

  // ── Multi-corp investment ──────────────────────────────────────────────────

  describe('multi-corp investment', () => {
    it('both corps invest when there is a clear deficit and eligible colonies', () => {
      // Two colonies with different domains, both with room to grow.
      // Two corps with matching type and enough capital.
      // Sector has ConsumerGoods deficit (LowIndustry eligible) and Food deficit (Agricultural).

      const infraA = makeInfra({ [InfraDomain.LowIndustry]: { levels: 0, cap: 10 } })
      const infraB = makeInfra({ [InfraDomain.Agricultural]: { levels: 0, cap: 10 } })

      const colonyA = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infraA, 6)
      const colonyB = makeColony(COLONY_B, PLANET_B, SECTOR_ID, infraB, 4)

      const soilDeposit = makeDeposit(DepositType.FertileGround)
      const planetA = makePlanet(PLANET_A, SECTOR_ID)
      const planetB = makePlanet(PLANET_B, SECTOR_ID, [soilDeposit])

      // Level 3 industrial corp: can invest in any domain, so it can pick LowIndustry
      const corpA = makeCorp(CORP_HIGH, CorpType.Industrial, 3, 4)
      // Level 1 agricultural corp: only Agricultural domain is allowed
      const corpB = makeCorp(CORP_LOW, CorpType.Agricultural, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,
          [ResourceType.Food]: -3,
          [ResourceType.CommonMaterials]: 2, // inputs available for LowIndustry
        }),
      )

      const state = makeState({
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
        corporations: [corpA, corpB],
        sectorMarkets: markets,
      })

      const result = resolveCorpPhase(state)

      // Both corps should have invested (capital reduced by 2 each)
      // Their starting capital was 4; after gain + investment the net changes
      const updatedCorpA = result.updatedState.corporations.get(CORP_HIGH)
      const updatedCorpB = result.updatedState.corporations.get(CORP_LOW)

      // Investment costs 2 capital; gain adds 0-1; net capital change should be -2 to -1
      expect(updatedCorpA!.capital).toBeLessThan(4 + 2) // less than gain with no investment
      expect(updatedCorpB!.capital).toBeLessThan(4 + 2)

      // At least one investment event per corp
      expect(result.events.length).toBeGreaterThanOrEqual(1)
    })

    it('returns both corps in updated state even when neither invests', () => {
      // No market deficits → no investments, but corps still gain capital
      const corpA = makeCorp(CORP_HIGH, CorpType.Industrial, 3, 1)
      const corpB = makeCorp(CORP_LOW, CorpType.Science, 2, 1)

      const state = makeState({ corporations: [corpA, corpB] })
      const result = resolveCorpPhase(state)

      // Both corps still present in output
      expect(result.updatedState.corporations.has(CORP_HIGH)).toBe(true)
      expect(result.updatedState.corporations.has(CORP_LOW)).toBe(true)
      expect(result.events).toHaveLength(0) // No events when no action taken
    })
  })

  // ── Processing order ──────────────────────────────────────────────────────

  describe('processing order', () => {
    it('processes higher-level corps first (higher-level events appear earlier)', () => {
      // Two corps of different levels, both can invest in the same deficit.
      // The colony has only 1 infra slot available.
      // The higher-level corp should grab it first.

      // Only 1 infra slot on the colony: cap 1, levels 0
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 0, cap: 1 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 8)
      const planet = makePlanet(PLANET_A, SECTOR_ID)

      // Level 3 corp (higher) vs Level 1 corp (lower), both Industrial
      const highCorp = makeCorp(CORP_HIGH, CorpType.Industrial, 3, 4)
      const lowCorp  = makeCorp(CORP_LOW, CorpType.Industrial, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -10,
          [ResourceType.CommonMaterials]: 5, // inputs available
        }),
      )

      const state = makeState({
        colonies: [colony],
        planets: [planet],
        corporations: [highCorp, lowCorp],
        sectorMarkets: markets,
      })

      const result = resolveCorpPhase(state)

      // Only 1 slot available: exactly one corp should have invested
      const events = result.events
      expect(events).toHaveLength(1)

      // The event should reference the high-level corp (it went first)
      expect(events[0].relatedEntityIds).toContain(CORP_HIGH)
    })
  })

  // ── Acquisition ──────────────────────────────────────────────────────────
  //
  // Acquisition eligibility, capital requirements, and asset merging logic
  // are tested in corp-ai.test.ts. Here we test orchestration-specific
  // behaviour: removal from state and skip-if-absorbed.

  describe('acquisition', () => {
    it('removes acquired corp, merges assets into buyer, and increments level', () => {
      const targetHoldings = new Map<ColonyId, CorpInfrastructureHoldings>()
      targetHoldings.set(COLONY_B, { [InfraDomain.Mining]: 3 })

      const buyer  = makeCorp(CORP_HIGH, CorpType.Industrial, 8, 22)
      const target = makeCorp(CORP_TARGET, CorpType.Industrial, 4, 0, targetHoldings, [PLANET_B])

      const colony = makeColony(COLONY_B, PLANET_B, SECTOR_ID, makeInfra())
      const planet = makePlanet(PLANET_B, SECTOR_ID)

      const state = makeState({
        colonies: [colony],
        planets: [planet],
        corporations: [buyer, target],
      })

      const result = resolveCorpPhase(state)

      // Target removed, buyer remains
      expect(result.updatedState.corporations.has(CORP_TARGET)).toBe(false)
      expect(result.updatedState.corporations.has(CORP_HIGH)).toBe(true)

      // Buyer gains 1 level and inherits target's assets
      const updatedBuyer = result.updatedState.corporations.get(CORP_HIGH)!
      expect(updatedBuyer.level).toBe(9)
      expect(updatedBuyer.assets.infrastructureByColony.get(COLONY_B)?.[InfraDomain.Mining]).toBe(3)
      expect(updatedBuyer.planetsPresent).toContain(PLANET_B)

      // Acquisition event generated
      expect(result.events.find((e) => e.title.includes('acquired'))).toBeDefined()
    })

    it('skips the absorbed corp if it appears later in the processing queue', () => {
      // Buyer is level 8, target is level 4. If sorted desc: [8, 4].
      // After buyer processes and absorbs target, target should be skipped.
      // We verify the final corp count is 1 (not 2).

      const targetHoldings = new Map<ColonyId, CorpInfrastructureHoldings>()
      targetHoldings.set(COLONY_A, { [InfraDomain.LowIndustry]: 2 })

      const buyer  = makeCorp(CORP_HIGH, CorpType.Industrial, 8, 22)
      const target = makeCorp(CORP_TARGET, CorpType.Industrial, 4, 0, targetHoldings)

      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, makeInfra())
      const planet = makePlanet(PLANET_A, SECTOR_ID)

      const state = makeState({
        colonies: [colony],
        planets: [planet],
        corporations: [buyer, target],
      })

      const result = resolveCorpPhase(state)

      // Only buyer remains — target was absorbed and not processed again
      expect(result.updatedState.corporations.size).toBe(1)
      expect(result.updatedState.corporations.has(CORP_HIGH)).toBe(true)
    })
  })

  // ── Colony infrastructure updates ─────────────────────────────────────────

  describe('colony infrastructure updates', () => {
    it('updates colony corporate ownership when a corp invests', () => {
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 0, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 7)
      const planet = makePlanet(PLANET_A, SECTOR_ID)

      const corp = makeCorp(CORP_HIGH, CorpType.Industrial, 3, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -8,
          [ResourceType.CommonMaterials]: 3,
        }),
      )

      const state = makeState({
        colonies: [colony],
        planets: [planet],
        corporations: [corp],
        sectorMarkets: markets,
      })

      const result = resolveCorpPhase(state)
      const updatedColony = result.updatedState.colonies.get(COLONY_A)!

      // Corp should now have 1 level in LowIndustry at this colony
      const lowIndustryOwnership = updatedColony.infrastructure[InfraDomain.LowIndustry].ownership
      const corpLevels = lowIndustryOwnership.corporateLevels.get(CORP_HIGH as CorpId)
      expect(corpLevels).toBe(1)
    })

    it('preserves colonies not touched by any corp', () => {
      // Colony B is in a different sector — no corp can invest there
      const infraA = makeInfra({ [InfraDomain.LowIndustry]: { levels: 0, cap: 10 } })
      const infraB = makeInfra()

      const colonyA = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infraA, 6)
      const colonyB = makeColony(COLONY_B, PLANET_B, 'sec_other11' as SectorId, infraB, 3)

      const planetA = makePlanet(PLANET_A, SECTOR_ID)
      const planetB = makePlanet(PLANET_B, 'sec_other11' as SectorId)

      const corp = makeCorp(CORP_HIGH, CorpType.Industrial, 3, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,
          [ResourceType.CommonMaterials]: 2,
        }),
      )

      const state = makeState({
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
        corporations: [corp],
        sectorMarkets: markets,
      })

      const result = resolveCorpPhase(state)

      // Colony B should be unchanged
      const updatedColonyB = result.updatedState.colonies.get(COLONY_B)!
      expect(updatedColonyB).toEqual(colonyB)
    })
  })

  // ── Phase result structure ────────────────────────────────────────────────

  describe('phase result structure', () => {
    it('returns a PhaseResult with updatedState and events', () => {
      const corp = makeCorp(CORP_HIGH, CorpType.Industrial, 2, 0)
      const state = makeState({ corporations: [corp] })
      const result = resolveCorpPhase(state)

      expect(result).toHaveProperty('updatedState')
      expect(result).toHaveProperty('events')
      expect(Array.isArray(result.events)).toBe(true)
    })

    it('input state is not mutated (pure function)', () => {
      const corp = makeCorp(CORP_HIGH, CorpType.Industrial, 2, 0)
      const state = makeState({ corporations: [corp] })
      const originalCapital = corp.capital

      resolveCorpPhase(state)

      // Original corp in original state map should be unchanged
      expect(state.corporations.get(CORP_HIGH)!.capital).toBe(originalCapital)
    })
  })
})
