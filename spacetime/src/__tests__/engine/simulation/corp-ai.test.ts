/**
 * corp-ai.test.ts — Unit tests for the Corporation Investment AI (Story 11.1).
 *
 * Covers:
 * - Investment decision with a clear resource deficit.
 * - No investment when no sector deficit exists.
 * - No investment when the corporation is at its infrastructure ownership cap.
 * - No investment when the colony's domain is at capacity.
 * - No investment for extraction domains with no matching deposit.
 * - No investment when manufacturing inputs are also in deficit.
 * - Level restriction: level 1-2 corps only invest in their specialty.
 * - Level 3+ corps can invest in any domain.
 * - Acquisition scenario: level 6+ corp acquires a target 3+ levels below.
 * - No acquisition when target is within 2 levels of buyer (can refuse).
 * - No acquisition when buyer lacks capital.
 * - Acquisition merges infrastructure, schematics, patents, and planetsPresent.
 * - No investment returned when no eligible colony exists (no suitable planet).
 */

import { describe, it, expect } from 'vitest'
import { runCorpInvestmentAI } from '../../../engine/simulation/corp-ai'
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

const SECTOR_ID = 'sec_test01' as SectorId
const PLANET_A = 'pln_testA1' as PlanetId
const PLANET_B = 'pln_testB1' as PlanetId
const COLONY_A = 'col_testA1' as ColonyId
const COLONY_B = 'col_testB1' as ColonyId
const CORP_A = 'corp_buyer1' as CorpId
const CORP_B = 'corp_target' as CorpId

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

/** Builds a full ColonyInfrastructure with zeroed domains, with optional overrides. */
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

describe('runCorpInvestmentAI', () => {

  // ── Investment with clear deficit ──────────────────────────────────────────

  describe('investment decision with clear deficit', () => {
    it('invests in the domain matching a sector resource deficit', () => {
      // ConsumerGoods deficit in sector — LowIndustry corp should invest
      // CommonMaterials must be available (not in deficit) for LowIndustry to be eligible
      const infra = makeInfra({
        [InfraDomain.LowIndustry]: { levels: 2, cap: 10 },
      })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 6)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,  // deficit → invest in LowIndustry
          [ResourceType.CommonMaterials]: 2, // surplus → inputs available
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(1)
      expect(result.events[0].category).toBe('corporation')

      // Corp's capital reduced by 2
      expect(result.updatedCorp.capital).toBe(2)

      // Colony's LowIndustry corporate ownership was incremented
      const updatedColony = result.updatedColonies.get(COLONY_A)
      expect(updatedColony).toBeDefined()
      const corpLevels = updatedColony!.infrastructure[InfraDomain.LowIndustry].ownership.corporateLevels
      expect(corpLevels.get(CORP_A)).toBe(1)

      // Corp's holdings updated
      const holdings = result.updatedCorp.assets.infrastructureByColony.get(COLONY_A)
      expect(holdings?.[InfraDomain.LowIndustry]).toBe(1)
    })

    it('adds planet to planetsPresent when corp was not previously there', () => {
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 0, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4, new Map(), [])

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -3,
          [ResourceType.CommonMaterials]: 1,
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.updatedCorp.planetsPresent).toContain(PLANET_A)
    })

    it('picks the highest-dynamism colony when multiple are eligible', () => {
      // Two colonies in the sector — both eligible, different dynamism
      const infraA = makeInfra({ [InfraDomain.LowIndustry]: { levels: 1, cap: 10 } })
      const infraB = makeInfra({ [InfraDomain.LowIndustry]: { levels: 1, cap: 10 } })
      const colonyA = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infraA, 3) // dynamism 3
      const colonyB = makeColony(COLONY_B, PLANET_B, SECTOR_ID, infraB, 7) // dynamism 7 (higher)
      const planetA = makePlanet(PLANET_A, SECTOR_ID)
      const planetB = makePlanet(PLANET_B, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,
          [ResourceType.CommonMaterials]: 3,
        }),
      )

      const state = makeState({
        colonies: [colonyA, colonyB],
        planets: [planetA, planetB],
        sectorMarkets: markets,
      })
      const result = runCorpInvestmentAI(corp, state)

      // Should have invested in Colony B (higher dynamism)
      expect(result.updatedColonies.has(COLONY_B)).toBe(true)
      expect(result.updatedColonies.has(COLONY_A)).toBe(false)
    })
  })

  // ── No investment scenarios ────────────────────────────────────────────────

  describe('no suitable planet scenario', () => {
    it('does not invest when there are no sector market deficits', () => {
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 2, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(SECTOR_ID, makeSectorMarket(SECTOR_ID)) // all surplus = 0 (no deficits)

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(0)
      expect(result.updatedCorp.capital).toBe(4) // capital unchanged
      expect(result.updatedColonies.size).toBe(0)
    })

    it('does not invest when the colony domain is already at cap', () => {
      // Domain at cap (5/5) — no room to invest
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 5, cap: 5 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,
          [ResourceType.CommonMaterials]: 2,
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(0)
      expect(result.updatedCorp.capital).toBe(4)
    })

    it('does not invest when corp has reached its infrastructure ownership cap', () => {
      // Level 1 corp: max infra = 1 × 4 = 4. Corp already owns 4 levels.
      const holdings = new Map<ColonyId, CorpInfrastructureHoldings>()
      holdings.set(COLONY_A, { [InfraDomain.LowIndustry]: 4 }) // owns 4 = max for level 1

      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 4, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4, holdings)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,
          [ResourceType.CommonMaterials]: 2,
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(0)
      expect(result.updatedCorp.capital).toBe(4)
    })

    it('does not invest in extraction domain when planet has no matching deposit', () => {
      // Food deficit → Agricultural domain, but planet has NO agricultural deposit
      const infra = makeInfra({ [InfraDomain.Agricultural]: { levels: 0, cap: Infinity } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      // Planet has a mining deposit, NOT an agricultural one
      const planet = makePlanet(PLANET_A, SECTOR_ID, [
        makeDeposit(DepositType.CommonOreVein),
      ])
      const corp = makeCorp(CORP_A, CorpType.Agriculture, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(SECTOR_ID, makeSectorMarket(SECTOR_ID, { [ResourceType.Food]: -5 }))

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(0)
      expect(result.updatedCorp.capital).toBe(4)
    })

    it('does not invest when manufacturing inputs are also in deficit', () => {
      // ConsumerGoods deficit AND CommonMaterials deficit → LowIndustry investment blocked
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 2, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,
          [ResourceType.CommonMaterials]: -3, // required input also in deficit
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(0)
      expect(result.updatedCorp.capital).toBe(4)
    })

    it('does not invest when no markets are present', () => {
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 2, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4)

      // No sector markets at all
      const state = makeState({ colonies: [colony], planets: [planet] })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(0)
      expect(result.updatedCorp.capital).toBe(4)
    })
  })

  // ── Level restrictions ────────────────────────────────────────────────────

  describe('level restrictions', () => {
    it('level 1-2 corp invests only in specialty domains', () => {
      // Level 1 Agriculture corp: specialty = Agricultural
      // Sector has HeavyMachinery deficit → HeavyIndustry domain
      // HeavyIndustry is NOT in Agriculture specialty → should not invest
      const infra = makeInfra({
        [InfraDomain.HeavyIndustry]: { levels: 0, cap: 10 },
        [InfraDomain.Agricultural]: { levels: 0, cap: Infinity },
      })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Agriculture, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.HeavyMachinery]: -5, // HeavyIndustry domain
          [ResourceType.CommonMaterials]: 2,
          [ResourceType.RareMaterials]: 2,
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      // Agriculture corp should NOT invest in HeavyIndustry
      expect(result.events).toHaveLength(0)
      expect(result.updatedCorp.capital).toBe(4)
    })

    it('level 1 corp invests in specialty domain when that domain has a deficit', () => {
      // Level 1 Agriculture corp: specialty = Agricultural
      // Sector has Food deficit → Agricultural domain → corp should invest
      const infra = makeInfra({ [InfraDomain.Agricultural]: { levels: 0, cap: Infinity } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      // Planet has a fertile ground deposit (agricultural)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [makeDeposit(DepositType.FertileGround)])
      const corp = makeCorp(CORP_A, CorpType.Agriculture, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(SECTOR_ID, makeSectorMarket(SECTOR_ID, { [ResourceType.Food]: -5 }))

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(1)
      expect(result.updatedCorp.capital).toBe(2)
    })

    it('level 3+ corp can invest in any domain, including outside specialty', () => {
      // Level 3 Agriculture corp: at level 3+ can invest in any domain
      // Sector has HeavyMachinery deficit → HeavyIndustry domain (not Agriculture specialty)
      const infra = makeInfra({ [InfraDomain.HeavyIndustry]: { levels: 0, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Agriculture, 3, 4) // level 3 = unrestricted

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.HeavyMachinery]: -5,
          [ResourceType.CommonMaterials]: 2,
          [ResourceType.RareMaterials]: 2,
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      // Level 3 Agriculture corp CAN invest in HeavyIndustry
      expect(result.events).toHaveLength(1)
      expect(result.updatedCorp.capital).toBe(2)
    })

    it('Exploration corp (no primary domains) does not invest below level 3', () => {
      // Exploration corp at level 2: primaryDomains = [] → no allowed domains → no investment
      const infra = makeInfra({ [InfraDomain.Mining]: { levels: 0, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [makeDeposit(DepositType.CommonOreVein)])
      const corp = makeCorp(CORP_A, CorpType.Exploration, 2, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(SECTOR_ID, makeSectorMarket(SECTOR_ID, { [ResourceType.CommonMaterials]: -5 }))

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(0)
      expect(result.updatedCorp.capital).toBe(4)
    })
  })

  // ── Extraction domain with deposit ────────────────────────────────────────

  describe('extraction domain investment with matching deposit', () => {
    it('invests in Mining when colony has a matching ore deposit', () => {
      // CommonMaterials deficit → Mining domain
      // Planet has CommonOreVein deposit (extractedBy: Mining)
      const infra = makeInfra({ [InfraDomain.Mining]: { levels: 2, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID, [makeDeposit(DepositType.CommonOreVein)])
      const corp = makeCorp(CORP_A, CorpType.Exploitation, 1, 4)

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, { [ResourceType.CommonMaterials]: -4 }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(1)
      expect(result.updatedCorp.capital).toBe(2)
      const updatedColony = result.updatedColonies.get(COLONY_A)
      expect(updatedColony?.infrastructure[InfraDomain.Mining].ownership.corporateLevels.get(CORP_A)).toBe(1)
    })
  })

  // ── Acquisition scenario ───────────────────────────────────────────────────

  describe('acquisition scenario', () => {
    it('level 6+ corp acquires a corp 3+ levels below when capital sufficient', () => {
      // Buyer: level 6, capital 20
      // Target: level 2, acquisition cost = 2 × 5 = 10 → buyer has enough
      const buyerHoldings = new Map<ColonyId, CorpInfrastructureHoldings>()
      const targetHoldings = new Map<ColonyId, CorpInfrastructureHoldings>()
      targetHoldings.set(COLONY_B, { [InfraDomain.Mining]: 3 })

      const buyer = makeCorp(CORP_A, CorpType.Industrial, 6, 20, buyerHoldings, [PLANET_A])
      const target = makeCorp(CORP_B, CorpType.Exploitation, 2, 0, targetHoldings, [PLANET_B])

      // No market deficits so investment won't happen — only acquisition is tested
      const state = makeState({
        corporations: [buyer, target],
        sectorMarkets: new Map<string, SectorMarketState>(),
      })

      const result = runCorpInvestmentAI(buyer, state)

      expect(result.absorbedCorpId).toBe(CORP_B)
      expect(result.events).toHaveLength(1)
      expect(result.events[0].title).toContain('acquired')

      // Buyer gained 1 level
      expect(result.updatedCorp.level).toBe(7)

      // Buyer capital reduced by acquisition cost
      expect(result.updatedCorp.capital).toBe(10) // 20 - 10

      // Buyer now includes target's planet
      expect(result.updatedCorp.planetsPresent).toContain(PLANET_B)

      // Buyer's infrastructure holdings include target's Mining infra
      const mergedHoldings = result.updatedCorp.assets.infrastructureByColony.get(COLONY_B)
      expect(mergedHoldings?.[InfraDomain.Mining]).toBe(3)
    })

    it('does not acquire when target is too close in level (within 2 levels)', () => {
      // Buyer: level 6, Target: level 4 → gap = 2 (not >= 3, target can refuse)
      const buyer = makeCorp(CORP_A, CorpType.Industrial, 6, 50)
      const target = makeCorp(CORP_B, CorpType.Industrial, 4, 0)

      const state = makeState({ corporations: [buyer, target] })
      const result = runCorpInvestmentAI(buyer, state)

      expect(result.absorbedCorpId).toBeUndefined()
    })

    it('does not acquire when buyer has insufficient capital', () => {
      // Target level 3: cost = 3 × 5 = 15, buyer only has 10
      const buyer = makeCorp(CORP_A, CorpType.Industrial, 6, 10)
      const target = makeCorp(CORP_B, CorpType.Industrial, 3, 0)

      const state = makeState({ corporations: [buyer, target] })
      const result = runCorpInvestmentAI(buyer, state)

      expect(result.absorbedCorpId).toBeUndefined()
    })

    it('does not attempt acquisition when buyer is below level 6', () => {
      const buyer = makeCorp(CORP_A, CorpType.Industrial, 5, 50)
      const target = makeCorp(CORP_B, CorpType.Industrial, 1, 0)

      const state = makeState({ corporations: [buyer, target] })
      const result = runCorpInvestmentAI(buyer, state)

      // No acquisition even though gap is large and capital sufficient
      expect(result.absorbedCorpId).toBeUndefined()
    })

    it('acquisition merges schematics and patents from target', () => {
      const buyer = makeCorp(CORP_A, CorpType.Industrial, 6, 20)
      const target = makeCorp(CORP_B, CorpType.Shipbuilding, 2, 0)
      // Manually add schematics and patents to target
      target.assets.schematics = ['sch_abc123' as any]
      target.assets.patents = ['pat_xyz789' as any]

      const state = makeState({ corporations: [buyer, target] })
      const result = runCorpInvestmentAI(buyer, state)

      expect(result.absorbedCorpId).toBe(CORP_B)
      expect(result.updatedCorp.assets.schematics).toContain('sch_abc123')
      expect(result.updatedCorp.assets.patents).toContain('pat_xyz789')
    })

    it('acquisition capped at level 10 even if buyer was already level 10', () => {
      const buyer = makeCorp(CORP_A, CorpType.Industrial, 10, 50)
      const target = makeCorp(CORP_B, CorpType.Industrial, 1, 0)

      const state = makeState({ corporations: [buyer, target] })
      const result = runCorpInvestmentAI(buyer, state)

      if (result.absorbedCorpId) {
        expect(result.updatedCorp.level).toBe(10) // Cannot exceed 10
      }
    })

    it('prefers target with most infrastructure when multiple are eligible', () => {
      // Two eligible targets: target B has more infra
      const CORP_C = 'corp_tgt_c1' as CorpId
      const COLONY_C = 'col_testC1' as ColonyId

      const holdingsB = new Map<ColonyId, CorpInfrastructureHoldings>()
      holdingsB.set(COLONY_B, { [InfraDomain.Mining]: 2 }) // 2 total

      const holdingsC = new Map<ColonyId, CorpInfrastructureHoldings>()
      holdingsC.set(COLONY_C, { [InfraDomain.Mining]: 8 }) // 8 total — more valuable

      const buyer = makeCorp(CORP_A, CorpType.Industrial, 6, 50)
      const targetB = makeCorp(CORP_B, CorpType.Exploitation, 2, 0, holdingsB)
      const targetC: Corporation = {
        ...makeCorp(CORP_C, CorpType.Exploitation, 2, 0, holdingsC),
      }

      const state = makeState({ corporations: [buyer, targetB, targetC] })
      const result = runCorpInvestmentAI(buyer, state)

      // Should acquire the richer target (Corp C)
      expect(result.absorbedCorpId).toBe(CORP_C)
    })
  })

  // ── No capital ────────────────────────────────────────────────────────────

  describe('corp with insufficient capital', () => {
    it('does not invest when capital < 2', () => {
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 2, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 1) // only 1 capital

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,
          [ResourceType.CommonMaterials]: 2,
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      const result = runCorpInvestmentAI(corp, state)

      expect(result.events).toHaveLength(0)
      expect(result.updatedCorp.capital).toBe(1)
    })
  })

  // ── State immutability ────────────────────────────────────────────────────

  describe('state immutability', () => {
    it('does not mutate the original corporation object', () => {
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 2, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4)
      const originalCapital = corp.capital

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,
          [ResourceType.CommonMaterials]: 2,
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      runCorpInvestmentAI(corp, state)

      // Original corp object must not be mutated
      expect(corp.capital).toBe(originalCapital)
    })

    it('does not mutate the original colony infrastructure', () => {
      const infra = makeInfra({ [InfraDomain.LowIndustry]: { levels: 2, cap: 10 } })
      const colony = makeColony(COLONY_A, PLANET_A, SECTOR_ID, infra, 5)
      const planet = makePlanet(PLANET_A, SECTOR_ID)
      const corp = makeCorp(CORP_A, CorpType.Industrial, 1, 4)
      const originalSize = colony.infrastructure[InfraDomain.LowIndustry].ownership.corporateLevels.size

      const markets = new Map<string, SectorMarketState>()
      markets.set(
        SECTOR_ID,
        makeSectorMarket(SECTOR_ID, {
          [ResourceType.ConsumerGoods]: -5,
          [ResourceType.CommonMaterials]: 2,
        }),
      )

      const state = makeState({ colonies: [colony], planets: [planet], sectorMarkets: markets })
      runCorpInvestmentAI(corp, state)

      // Original colony's corporateLevels must not be mutated
      expect(colony.infrastructure[InfraDomain.LowIndustry].ownership.corporateLevels.size).toBe(
        originalSize,
      )
    })
  })
})
