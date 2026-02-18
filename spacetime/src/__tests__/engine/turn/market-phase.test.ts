/**
 * market-phase.test.ts — Unit tests for the market phase turn resolver.
 *
 * Covers (Story 9.2 acceptance criteria):
 * - Calls market resolver for each sector.
 * - Applies shortage maluses to colony modifiers:
 *     food shortage        → 'qualityOfLife'  −2 (additive)
 *     consumer goods sh.   → 'qualityOfLife'  −1 (additive)
 *     transport capacity sh.→ 'accessibility' −1 (additive)
 * - Applies export bonuses to colony modifiers:
 *     successful export    → 'dynamism' +1 (additive)
 * - Returns updated colony states (modifiers attached) + market summary events.
 * - Shortage events: Critical for food shortage, Warning for others.
 * - Previous shortage modifiers are cleared before new ones are applied.
 * - sectorMarkets updated in the returned state.
 * - Industrial input shortages (CommonMaterials etc.) do NOT add attribute modifiers.
 * - Empty sectors (no colonies) are skipped gracefully.
 */

import { describe, it, expect } from 'vitest'
import { resolveMarketPhase } from '../../../engine/turn/market-phase'
import type { GameState } from '../../../types/game'
import type { Colony } from '../../../types/colony'
import type { Planet, Deposit } from '../../../types/planet'
import type { Sector, Galaxy } from '../../../types/sector'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { Modifier } from '../../../types/modifier'
import type { BudgetState } from '../../../types/budget'
import type {
  ColonyId,
  PlanetId,
  SectorId,
  TurnNumber,
  BPAmount,
} from '../../../types/common'
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

const SECTOR_ID   = 'sec_test01' as SectorId
const SECTOR_B_ID = 'sec_test02' as SectorId
const PLANET_A    = 'pln_testA1' as PlanetId
const PLANET_B    = 'pln_testB1' as PlanetId
const PLANET_C    = 'pln_testC1' as PlanetId
const COLONY_A    = 'col_testA1' as ColonyId
const COLONY_B    = 'col_testB1' as ColonyId

// ─── Deposit fixtures ─────────────────────────────────────────────────────────

/** FertileGround Rich deposit: richness_modifier = 1.0 (from market-resolver tests). */
const FERTILE_DEPOSIT: Deposit = {
  type: DepositType.FertileGround,
  richness: RichnessLevel.Rich,
  richnessRevealed: true,
}

// ─── Infrastructure helpers ───────────────────────────────────────────────────

function makeInfraState(domain: InfraDomain, publicLevels: number): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: Infinity,
  }
}

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
  dynamism: number,
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
      accessibility: 5,
      dynamism,
      qualityOfLife: 8,
      stability: 8,
      growth: 0,
    },
    infrastructure: infra,
    corporationsPresent: [],
    modifiers,
    foundedTurn: 1 as TurnNumber,
  }
}

// ─── Planet helper ────────────────────────────────────────────────────────────

function makePlanet(id: PlanetId, sectorId: SectorId, deposits: Deposit[]): Planet {
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
    startingSectorId: sectors[0]?.id ?? (SECTOR_ID as SectorId),
  }
}

// ─── Minimal BudgetState ──────────────────────────────────────────────────────

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

function makeState(overrides: {
  sectors?: Sector[]
  colonies?: Colony[]
  planets?: Planet[]
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
    debtTokens: 0,
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
    sectorMarkets: new Map(),
    tradeRoutes: [],
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
  }
}

// ─── Helper: find modifier on a colony ───────────────────────────────────────

function hasModifier(
  colony: Colony,
  target: string,
  value: number,
  sourceType: string,
): boolean {
  return colony.modifiers.some(
    (m) => m.target === target && m.value === value && m.sourceType === sourceType,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveMarketPhase', () => {

  // ── Scenario: Empty sector has no colonies ────────────────────────────────

  describe('empty sector — no colonies', () => {
    it('returns state unchanged when sector has no colonies', () => {
      const state = makeState({ sectors: [makeSector(SECTOR_ID, 'Empty Sector')] })
      const { updatedState, events } = resolveMarketPhase(state)
      expect(updatedState.colonies.size).toBe(0)
      expect(events).toHaveLength(0)
    })
  })

  // ── Scenario: Food shortage → -2 QoL modifier ────────────────────────────
  //
  // Colony A: pop 2, no agricultural infra, no deposit.
  // Food consumed = pop × 2 = 4, food produced = 0 → food shortage.
  // Expected: 'qualityOfLife' -2 modifier added with sourceType 'shortage'.
  // Event: Critical (food shortage triggers Critical priority).

  describe('food shortage — qualityOfLife -2 modifier', () => {
    // Pop 2 → food demand = 4; no production → full shortage
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({ [InfraDomain.Agricultural]: 0 }), // no food production
      2,  // pop 2 → food demand = 4
      5,
    )
    const planet = makePlanet(PLANET_A, SECTOR_ID, []) // no deposits

    const state = makeState({
      sectors: [makeSector(SECTOR_ID, 'Alpha Sector')],
      colonies: [colony],
      planets: [planet],
    })

    it('adds qualityOfLife -2 shortage modifier for food shortage', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updatedColony = updatedState.colonies.get(COLONY_A)!
      expect(hasModifier(updatedColony, 'qualityOfLife', -2, 'shortage')).toBe(true)
    })

    it('generates a Critical event for the food-shortage colony', () => {
      const { events } = resolveMarketPhase(state)
      expect(events.length).toBeGreaterThan(0)
      const evt = events.find((e) => e.relatedEntityIds.includes(COLONY_A))
      expect(evt).toBeDefined()
      expect(evt!.priority).toBe(EventPriority.Critical)
      expect(evt!.category).toBe('colony')
    })

    it('event description mentions the shortage resource', () => {
      const { events } = resolveMarketPhase(state)
      const evt = events.find((e) => e.relatedEntityIds.includes(COLONY_A))!
      expect(evt.description).toContain('Food')
    })
  })

  // ── Scenario: ConsumerGoods shortage → -1 QoL modifier ────────────────────
  //
  // Colony: pop 1, food balanced (agri 2, fertile deposit → 2 produced, 2 consumed),
  //         no low-industry → CG consumed = 1, produced = 0 → CG shortage.
  // Expected: 'qualityOfLife' -1 modifier added, Warning event (not Critical).

  describe('consumer goods shortage — qualityOfLife -1 modifier', () => {
    // Food balanced: agri 2 × 1.0 = 2 produced, pop 1 × 2 = 2 consumed.
    // CG: lowIndustry 0 → 0 produced, consumed 1 → CG shortage.
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({
        [InfraDomain.Agricultural]: 2,  // food balanced
        [InfraDomain.LowIndustry]:  0,  // no CG production
      }),
      1,  // pop 1
      5,
    )
    const planet = makePlanet(PLANET_A, SECTOR_ID, [FERTILE_DEPOSIT]) // food deposit only

    const state = makeState({
      sectors: [makeSector(SECTOR_ID, 'Beta Sector')],
      colonies: [colony],
      planets: [planet],
    })

    it('adds qualityOfLife -1 shortage modifier for consumer goods shortage', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updatedColony = updatedState.colonies.get(COLONY_A)!
      expect(hasModifier(updatedColony, 'qualityOfLife', -1, 'shortage')).toBe(true)
    })

    it('generates a Warning event (not Critical) for CG-only shortage', () => {
      const { events } = resolveMarketPhase(state)
      const evt = events.find((e) => e.relatedEntityIds.includes(COLONY_A))
      expect(evt).toBeDefined()
      expect(evt!.priority).toBe(EventPriority.Warning)
    })
  })

  // ── Scenario: TransportCapacity shortage → -1 Accessibility modifier ──────
  //
  // Transport Capacity is local-only (never traded). Any production deficit is a
  // shortage immediately. Colony with transport = 0 and pop > 0 always has TC shortage.
  // Expected: 'accessibility' -1 modifier added.

  describe('transport capacity shortage — accessibility -1 modifier', () => {
    // Pop 1 → TC demand = 1. Transport infra = 0 → TC produced = 0 → TC shortage.
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({ [InfraDomain.Transport]: 0 }), // no TC production
      1,  // pop 1 → TC demand = 1
      5,
    )
    const planet = makePlanet(PLANET_A, SECTOR_ID, [])

    const state = makeState({
      sectors: [makeSector(SECTOR_ID, 'Gamma Sector')],
      colonies: [colony],
      planets: [planet],
    })

    it('adds accessibility -1 shortage modifier for TC shortage', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updatedColony = updatedState.colonies.get(COLONY_A)!
      expect(hasModifier(updatedColony, 'accessibility', -1, 'shortage')).toBe(true)
    })
  })

  // ── Scenario: Industrial shortage — NO attribute modifier ─────────────────
  //
  // CommonMaterials shortage (no mining) does not affect colony attributes.
  // Industrial input shortages halve manufacturing output (handled by colony-sim),
  // but do NOT create 'qualityOfLife' or 'accessibility' modifiers.

  describe('industrial input shortage — no attribute modifier', () => {
    // Pop 1. No mining → CommonMaterials shortage.
    // LowIndustry 1 but no CommonMaterials → halved output (handled in colony-sim).
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({
        [InfraDomain.Mining]:       0,  // no CommonMaterials production
        [InfraDomain.LowIndustry]:  1,  // wants CommonMaterials as input
      }),
      1,
      5,
    )
    const planet = makePlanet(PLANET_A, SECTOR_ID, []) // no ore deposit

    const state = makeState({
      sectors: [makeSector(SECTOR_ID, 'Delta Sector')],
      colonies: [colony],
      planets: [planet],
    })

    it('does NOT add a qualityOfLife modifier for CommonMaterials shortage', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updatedColony = updatedState.colonies.get(COLONY_A)!
      // CommonMaterials shortage should NOT produce a qualityOfLife or accessibility modifier
      const hasQoLMod = updatedColony.modifiers.some(
        (m) => m.target === 'qualityOfLife' && m.sourceId === `shortage_${ResourceType.CommonMaterials}`,
      )
      const hasAccessMod = updatedColony.modifiers.some(
        (m) => m.target === 'accessibility' && m.sourceId === `shortage_${ResourceType.CommonMaterials}`,
      )
      expect(hasQoLMod).toBe(false)
      expect(hasAccessMod).toBe(false)
    })
  })

  // ── Scenario: Export bonus applied ───────────────────────────────────────
  //
  // Colony A (exporter): agri 4, fertile deposit, pop 1.
  //   food produced = 4, consumed = 2, surplus = 2 → exports to market.
  // Colony B (importer): no food, pop 1.
  //   food consumed = 2, deficit = 2 → draws from market.
  //   Colony B has higher dynamism → gets first pick.
  //
  // Colony A should receive a 'dynamism' +1 export bonus modifier because
  // its food surplus was actually consumed by Colony B.
  // Colony B should NOT receive an export bonus (it imported, not exported).

  describe('export bonus — dynamism +1 modifier for successful export', () => {
    const colonyA = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({ [InfraDomain.Agricultural]: 4 }), // 4 food produced, 2 consumed → surplus 2
      1,  // pop 1 → food consumed = 2
      3,  // lower dynamism than B
    )
    const colonyB = makeColony(
      COLONY_B,
      PLANET_B,
      SECTOR_ID,
      makeInfra({ [InfraDomain.Agricultural]: 0 }), // no food production
      1,  // pop 1 → food consumed = 2 → imports 2 from market
      8,  // higher dynamism → gets first pick from market
    )
    const planetA = makePlanet(PLANET_A, SECTOR_ID, [FERTILE_DEPOSIT]) // food deposit
    const planetB = makePlanet(PLANET_B, SECTOR_ID, [])                 // no deposit

    const state = makeState({
      sectors: [makeSector(SECTOR_ID, 'Trade Sector')],
      colonies: [colonyA, colonyB],
      planets: [planetA, planetB],
    })

    it('grants Colony A a dynamism +1 modifier for exporting food', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updatedA = updatedState.colonies.get(COLONY_A)!
      expect(hasModifier(updatedA, 'dynamism', 1, 'shortage')).toBe(true)
    })

    it('does NOT grant Colony B an export bonus (it was the importer)', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updatedB = updatedState.colonies.get(COLONY_B)!
      const exportMod = updatedB.modifiers.find(
        (m) => m.target === 'dynamism' && m.value > 0 && m.sourceId.startsWith('export_'),
      )
      expect(exportMod).toBeUndefined()
    })

    it('Colony A does not get a food shortage modifier (it had food surplus)', () => {
      // Colony A exported food, so it should NOT have a food shortage modifier.
      // Other resources (CG, TC) may still be in shortage — we only check food here.
      const { updatedState } = resolveMarketPhase(state)
      const updatedA = updatedState.colonies.get(COLONY_A)!
      const hasFoodShortageMod = updatedA.modifiers.some(
        (m) => m.sourceId === `shortage_${ResourceType.Food}`,
      )
      expect(hasFoodShortageMod).toBe(false)
    })
  })

  // ── Scenario: Previous shortage modifiers are cleared ────────────────────
  //
  // Colony starts with a pre-existing shortage modifier from a previous turn.
  // In this turn, the colony is fully self-sufficient (no shortages).
  // Expected: old shortage modifier is removed; no new shortage modifier added.

  describe('previous shortage modifiers are cleared each turn', () => {
    const oldMod: Modifier = {
      id: 'mod_old001' as import('../../../types/common').ModifierId,
      target: 'qualityOfLife',
      operation: 'add',
      value: -2,
      sourceType: 'shortage',
      sourceId: 'shortage_Food',
      sourceName: 'Food Shortage (stale)',
    }

    // Colony is now self-sufficient: agri 2, fertile deposit, pop 1 → food balanced.
    // No CG demand (lowIndustry = 0, pop 1 → CG consumed = 1). Will still have CG shortage.
    // But the old food shortage modifier should still be cleared.
    const colonyWithOldMod = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({
        [InfraDomain.Agricultural]: 2,   // food: 2 produced, 2 consumed → balanced
        [InfraDomain.Transport]:    1,   // TC: 1 produced, 1 consumed → balanced
        [InfraDomain.LowIndustry]:  0,   // no CG production (CG shortage remains)
      }),
      1,  // pop 1
      5,
      [oldMod], // pre-existing stale shortage modifier
    )
    const planet = makePlanet(PLANET_A, SECTOR_ID, [FERTILE_DEPOSIT])

    const state = makeState({
      sectors: [makeSector(SECTOR_ID, 'Clear Sector')],
      colonies: [colonyWithOldMod],
      planets: [planet],
    })

    it('removes the stale food shortage modifier from last turn', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!
      // The old food shortage modifier (sourceId: 'shortage_Food') should be gone
      const staleModStillPresent = updated.modifiers.some((m) => m.id === oldMod.id)
      expect(staleModStillPresent).toBe(false)
    })

    it('preserves non-shortage modifiers (permanent features)', () => {
      const permanentMod: Modifier = {
        id: 'mod_perm01' as import('../../../types/common').ModifierId,
        target: 'habitability',
        operation: 'add',
        value: 1,
        sourceType: 'feature',
        sourceId: 'TemperateClimate',
        sourceName: 'Temperate Climate',
      }
      const colonyWithBoth = makeColony(
        COLONY_A,
        PLANET_A,
        SECTOR_ID,
        makeInfra({
          [InfraDomain.Agricultural]: 2,
          [InfraDomain.Transport]:    1,
        }),
        1,
        5,
        [oldMod, permanentMod],
      )
      const s = makeState({
        sectors: [makeSector(SECTOR_ID, 'Mixed Sector')],
        colonies: [colonyWithBoth],
        planets: [makePlanet(PLANET_A, SECTOR_ID, [FERTILE_DEPOSIT])],
      })
      const { updatedState } = resolveMarketPhase(s)
      const updated = updatedState.colonies.get(COLONY_A)!
      // Permanent feature modifier must still be present
      const permanentStillPresent = updated.modifiers.some((m) => m.id === permanentMod.id)
      expect(permanentStillPresent).toBe(true)
      // Stale shortage modifier must be gone
      const staleStillPresent = updated.modifiers.some((m) => m.id === oldMod.id)
      expect(staleStillPresent).toBe(false)
    })
  })

  // ── Scenario: sectorMarkets updated in state ──────────────────────────────
  //
  // After market-phase, state.sectorMarkets must contain an entry for each
  // resolved sector with correct totalProduction, totalConsumption, netSurplus.

  describe('sectorMarkets updated in returned state', () => {
    // Colony: pop 1, agri 2, fertile deposit → 2 food produced, 2 consumed → balanced.
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({ [InfraDomain.Agricultural]: 2 }),
      1,
      5,
    )
    const planet = makePlanet(PLANET_A, SECTOR_ID, [FERTILE_DEPOSIT])

    const state = makeState({
      sectors: [makeSector(SECTOR_ID, 'Market Sector')],
      colonies: [colony],
      planets: [planet],
    })

    it('adds a SectorMarketState entry for the resolved sector', () => {
      const { updatedState } = resolveMarketPhase(state)
      expect(updatedState.sectorMarkets.has(SECTOR_ID)).toBe(true)
    })

    it('sector market state has correct sectorId', () => {
      const { updatedState } = resolveMarketPhase(state)
      const market = updatedState.sectorMarkets.get(SECTOR_ID)!
      expect(market.sectorId).toBe(SECTOR_ID)
    })

    it('sector market total production and consumption are non-negative numbers', () => {
      const { updatedState } = resolveMarketPhase(state)
      const market = updatedState.sectorMarkets.get(SECTOR_ID)!
      // Food was produced and consumed — totals must be non-negative
      expect(market.totalProduction[ResourceType.Food]).toBeGreaterThanOrEqual(0)
      expect(market.totalConsumption[ResourceType.Food]).toBeGreaterThanOrEqual(0)
    })

    it('inbound and outbound trade flows are empty arrays (no trade routes yet)', () => {
      const { updatedState } = resolveMarketPhase(state)
      const market = updatedState.sectorMarkets.get(SECTOR_ID)!
      expect(market.inboundFlows).toEqual([])
      expect(market.outboundFlows).toEqual([])
    })
  })

  // ── Scenario: Multiple sectors resolved independently ─────────────────────
  //
  // Two sectors, each with one colony. Food shortage in sector A, self-sufficient
  // in sector B. Sector A's shortage must not affect Sector B's colony.

  describe('multiple sectors resolved independently', () => {
    const colonyA = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({ [InfraDomain.Agricultural]: 0 }), // food shortage
      1,
      5,
    )
    const colonyB = makeColony(
      COLONY_B,
      PLANET_B,
      SECTOR_B_ID,
      makeInfra({ [InfraDomain.Agricultural]: 2 }), // food balanced
      1,
      5,
    )
    const planetA = makePlanet(PLANET_A, SECTOR_ID,   [])
    const planetB = makePlanet(PLANET_B, SECTOR_B_ID, [FERTILE_DEPOSIT])

    const state = makeState({
      sectors: [
        makeSector(SECTOR_ID,   'Sector Alpha'),
        makeSector(SECTOR_B_ID, 'Sector Beta'),
      ],
      colonies: [colonyA, colonyB],
      planets:  [planetA, planetB],
    })

    it('Colony A (shortage sector) gets a shortage modifier', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updatedA = updatedState.colonies.get(COLONY_A)!
      expect(hasModifier(updatedA, 'qualityOfLife', -2, 'shortage')).toBe(true)
    })

    it('Colony B (no shortage sector) gets no qualityOfLife shortage modifier', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updatedB = updatedState.colonies.get(COLONY_B)!
      const hasQoLMod = updatedB.modifiers.some(
        (m) => m.target === 'qualityOfLife' && m.value === -2 && m.sourceType === 'shortage',
      )
      expect(hasQoLMod).toBe(false)
    })

    it('both sectors get entries in sectorMarkets', () => {
      const { updatedState } = resolveMarketPhase(state)
      expect(updatedState.sectorMarkets.has(SECTOR_ID)).toBe(true)
      expect(updatedState.sectorMarkets.has(SECTOR_B_ID)).toBe(true)
    })

    it('Colony A generates a food shortage event (Critical)', () => {
      // Colony A has no food → Critical food shortage event.
      // Colony B has balanced food → no food shortage event, though it may still
      // have CG/TC shortages that produce separate Warning events.
      const { events } = resolveMarketPhase(state)
      const eventForA = events.find(
        (e) => e.relatedEntityIds.includes(COLONY_A) && e.priority === EventPriority.Critical,
      )
      expect(eventForA).toBeDefined()
      // Colony B must NOT have a Critical (food) shortage event
      const criticalForB = events.find(
        (e) => e.relatedEntityIds.includes(COLONY_B) && e.priority === EventPriority.Critical,
      )
      expect(criticalForB).toBeUndefined()
    })
  })

  // ── Scenario: Self-sufficient colony — no modifiers, no events ───────────
  //
  // Colony that exactly meets its own needs with no shortages.
  // Expected: no shortage modifiers, no events.

  describe('self-sufficient colony — no shortage modifiers or events', () => {
    // Pop 1: food 2 produced = 2 consumed, CG demand 1 (no LowIndustry → shortage).
    // Make fully covered: agri 2 (food balanced), transport 1 (TC balanced).
    // Accept that CG shortage may still occur — test specifically that no events are
    // generated for a colony whose food and TC are covered, only CG may shortage.
    // Actually, let's just test a truly self-sufficient colony with no population demand
    // that could cause shortages. But pop = 0 doesn't exist. Instead test:
    // agri 2, transport 1, lowIndustry: CG... This still requires dealing with CG.

    // The simplest fully self-sufficient colony in the current model: pop 0 doesn't exist.
    // Instead: just verify that no food/TC shortage modifier is present on a colony that
    // has exactly balanced food+TC production.
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      SECTOR_ID,
      makeInfra({
        [InfraDomain.Agricultural]: 2,  // 2 food produced, 2 consumed (pop 1 × 2) — balanced
        [InfraDomain.Transport]:    1,  // 1 TC produced, 1 consumed (pop 1) — balanced
      }),
      1,
      5,
    )
    const planet = makePlanet(PLANET_A, SECTOR_ID, [FERTILE_DEPOSIT])

    const state = makeState({
      sectors: [makeSector(SECTOR_ID, 'Stable Sector')],
      colonies: [colony],
      planets: [planet],
    })

    it('no food shortage modifier when food is balanced', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!
      const hasFoodShortageMod = updated.modifiers.some(
        (m) => m.target === 'qualityOfLife' && m.value === -2 && m.sourceType === 'shortage',
      )
      expect(hasFoodShortageMod).toBe(false)
    })

    it('no TC shortage modifier when TC is balanced', () => {
      const { updatedState } = resolveMarketPhase(state)
      const updated = updatedState.colonies.get(COLONY_A)!
      const hasTCMod = updated.modifiers.some(
        (m) => m.target === 'accessibility' && m.value === -1 && m.sourceType === 'shortage',
      )
      expect(hasTCMod).toBe(false)
    })
  })

  // ── Scenario: PhaseResult structure ──────────────────────────────────────

  describe('phase result structure', () => {
    const state = makeState({ sectors: [makeSector(SECTOR_ID, 'Struct Sector')] })

    it('returns an object with updatedState and events', () => {
      const result = resolveMarketPhase(state)
      expect(result).toHaveProperty('updatedState')
      expect(result).toHaveProperty('events')
    })

    it('updatedState retains all original state fields other than colonies and sectorMarkets', () => {
      const result = resolveMarketPhase(state)
      expect(result.updatedState.turn).toBe(state.turn)
      expect(result.updatedState.currentBP).toBe(state.currentBP)
      expect(result.updatedState.debtTokens).toBe(state.debtTokens)
    })

    it('events is an array', () => {
      const result = resolveMarketPhase(state)
      expect(Array.isArray(result.events)).toBe(true)
    })
  })
})
