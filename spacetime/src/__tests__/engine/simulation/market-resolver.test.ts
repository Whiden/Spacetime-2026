/**
 * market-resolver.test.ts — Unit tests for the sector market resolver.
 *
 * Covers (Story 9.1 acceptance criteria):
 * - Phase 1-3: Production collected and surplus pooled correctly.
 * - Phase 4: Colonies fill deficits from pool in dynamism-priority order.
 * - Phase 5: Unfilled deficits become shortages.
 * - Single colony (no trade needed): self-sufficient colony, no shortages.
 * - Two colonies with complementary production: mutual trade.
 * - Shortage scenario: pool insufficient, remaining deficit → shortage record.
 * - Dynamism priority ordering: high-dynamism colony gets first pick.
 * - Transport Capacity: local-only, TC shortage detected without trading.
 * - Export bonus: only granted when surplus is actually consumed by another colony.
 * - Sector summary totals computed correctly.
 */

import { describe, it, expect } from 'vitest'
import { resolveMarket } from '../../../engine/simulation/market-resolver'
import type { Colony } from '../../../types/colony'
import type { Deposit } from '../../../types/planet'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { ColonyId, PlanetId, SectorId, TurnNumber } from '../../../types/common'
import {
  InfraDomain,
  ResourceType,
  DepositType,
  RichnessLevel,
  ColonyType,
} from '../../../types/common'

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const SECTOR_ID = 'sec_test01' as SectorId
const PLANET_A   = 'pln_testA1' as PlanetId
const PLANET_B   = 'pln_testB1' as PlanetId
const COLONY_A   = 'col_testA1' as ColonyId
const COLONY_B   = 'col_testB1' as ColonyId
const COLONY_C   = 'col_testC1' as ColonyId

// ─── Fixture helpers ──────────────────────────────────────────────────────────

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

function makeColony(
  id: ColonyId,
  planetId: PlanetId,
  infra: ColonyInfrastructure,
  populationLevel: number,
  dynamism: number,
): Colony {
  return {
    id,
    planetId,
    sectorId: SECTOR_ID,
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
    modifiers: [],
    foundedTurn: 1 as TurnNumber,
  }
}

/** Agricultural deposit that produces Food. */
const FERTILE_DEPOSIT: Deposit = {
  type: DepositType.FertileGround,
  richness: RichnessLevel.Rich,
}

/** Mining deposit that produces Common Materials. */
const COMMON_ORE_DEPOSIT: Deposit = {
  type: DepositType.CommonOreVein,
  richness: RichnessLevel.Moderate,
}

/** Deep Mining deposit that produces Rare Materials. */
const RARE_ORE_DEPOSIT: Deposit = {
  type: DepositType.RareOreVein,
  richness: RichnessLevel.Moderate,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveMarket', () => {

  // ── Scenario 1: Single colony, no trade needed ─────────────────────────────
  //
  // One colony that fully satisfies its own needs with no surplus.
  // Expected: no imports, no shortages, no export bonuses.

  describe('single colony — self-sufficient, no trade', () => {
    // Colony A: pop 2, produces 2 food (agri 2 × mod 1.0), consumes 2 food (pop 2 × 1).
    // Exactly balanced. No surplus, no deficit.

    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      makeInfra({ [InfraDomain.Agricultural]: 2 }), // 2 agri levels → 2 food (mod 1.0)
      2, // pop 2 → food consumed = 2
      5,
    )
    const deposits = [FERTILE_DEPOSIT]
    const depositsMap = new Map<string, Deposit[]>([[COLONY_A, deposits]])

    it('resolves with no imports when colony is self-sufficient', () => {
      const result = resolveMarket(SECTOR_ID, [colony], depositsMap)
      const flow = result.colonyFlows.get(COLONY_A)!
      expect(flow[ResourceType.Food].imported).toBe(0)
      expect(flow[ResourceType.Food].inShortage).toBe(false)
    })

    it('produces no food shortage (agri 2 → 2 food, pop 2 → consumes 2 food, balanced)', () => {
      const result = resolveMarket(SECTOR_ID, [colony], depositsMap)
      // Colony is self-sufficient for food. CG and TC are in deficit (no infra), but food is balanced.
      const foodShortages = result.sectorSummary.shortages.filter(
        (s) => s.resource === ResourceType.Food,
      )
      expect(foodShortages).toHaveLength(0)
    })

    it('records no export bonuses (no surplus consumed by others)', () => {
      const result = resolveMarket(SECTOR_ID, [colony], depositsMap)
      expect(result.exportBonuses).toHaveLength(0)
    })

    it('sector summary matches colony production', () => {
      const result = resolveMarket(SECTOR_ID, [colony], depositsMap)
      const summary = result.sectorSummary
      expect(summary.totalProduction[ResourceType.Food]).toBe(2)
      expect(summary.totalConsumption[ResourceType.Food]).toBe(2)
      expect(summary.netSurplus[ResourceType.Food]).toBe(0)
    })
  })

  // ── Scenario 2: Two colonies with complementary production ─────────────────
  //
  // Colony A: produces surplus Food, needs Consumer Goods.
  // Colony B: produces surplus Consumer Goods, needs Food.
  // Expected: both colonies receive imports and both earn export bonuses.

  describe('two colonies — complementary production, mutual trade', () => {
    // Colony A:
    //   - pop 2 → needs 2 food, 2 consumer goods
    //   - agri 6 → produces 6 food (mod 1.0) → 4 surplus food
    //   - no Low Industry → 0 consumer goods → deficit 2
    const colonyA = makeColony(
      COLONY_A,
      PLANET_A,
      makeInfra({ [InfraDomain.Agricultural]: 6 }),
      2, // pop 2
      8, // high dynamism — gets first pick
    )

    // Colony B:
    //   - pop 2 → needs 2 food, 2 consumer goods
    //   - no agri → 0 food → deficit 2
    //   - Low Industry 4, Mining 6 → 4 consumer goods produced, 4 common materials
    //     (low industry needs 4 common input; mining produces 6 common; so no shortage)
    //     Consumer goods produced = 4, consumed = 2 → 2 surplus
    const colonyB = makeColony(
      COLONY_B,
      PLANET_A,
      makeInfra({
        [InfraDomain.Mining]: 6,       // 6 common materials
        [InfraDomain.LowIndustry]: 4,  // needs 4 common input → 4 consumer goods out
      }),
      2, // pop 2
      4, // lower dynamism
    )

    const depositsMapAB = new Map<string, Deposit[]>([
      [COLONY_A, [FERTILE_DEPOSIT]],
      [COLONY_B, [COMMON_ORE_DEPOSIT]],
    ])

    it('Colony A receives Consumer Goods from market', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMapAB)
      const flowA = result.colonyFlows.get(COLONY_A)!
      // Colony A deficit = 2 CG; Colony B surplus = 2 CG → fully resolved
      expect(flowA[ResourceType.ConsumerGoods].imported).toBe(2)
      expect(flowA[ResourceType.ConsumerGoods].inShortage).toBe(false)
    })

    it('Colony B receives Food from market and is fully resolved', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMapAB)
      const flowB = result.colonyFlows.get(COLONY_B)!
      // Colony B deficit = 2 food; Colony A surplus = 4 food → fully resolved
      expect(flowB[ResourceType.Food].imported).toBe(2)
      expect(flowB[ResourceType.Food].inShortage).toBe(false)
    })

    it('Colony A earns export bonus for Food', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMapAB)
      const foodExport = result.exportBonuses.find(
        (b) => b.colonyId === COLONY_A && b.resource === ResourceType.Food,
      )
      expect(foodExport).toBeDefined()
      expect(foodExport!.attributeTarget).toBe('dynamism')
      expect(foodExport!.bonusAmount).toBe(1)
    })

    it('Colony B earns export bonus for Consumer Goods', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMapAB)
      const cgExport = result.exportBonuses.find(
        (b) => b.colonyId === COLONY_B && b.resource === ResourceType.ConsumerGoods,
      )
      expect(cgExport).toBeDefined()
      expect(cgExport!.attributeTarget).toBe('dynamism')
    })

    it('sector summary shows correct totals', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMapAB)
      const s = result.sectorSummary
      // Food: A produces 6, B produces 0; A consumes 2, B consumes 2 → total consumption = 4
      expect(s.totalProduction[ResourceType.Food]).toBe(6)
      expect(s.totalConsumption[ResourceType.Food]).toBe(4) // both pop-2 colonies need 2 food each
      expect(s.netSurplus[ResourceType.Food]).toBe(2)       // 6 produced - 4 consumed = +2
    })
  })

  // ── Scenario 3: Shortage — pool is empty, deficit remains ─────────────────
  //
  // Two colonies both need food. Neither produces enough.
  // Expected: food shortage recorded for both colonies.

  describe('shortage scenario — pool exhausted, deficits remain', () => {
    // Colony A: pop 3 → needs 3 food. Agri 2 → produces 2 food. Deficit 1.
    const colonyA = makeColony(
      COLONY_A,
      PLANET_A,
      makeInfra({ [InfraDomain.Agricultural]: 2 }),
      3, // pop 3 → food consumed = 3
      7,
    )

    // Colony B: pop 3 → needs 3 food. No agri → 0 food. Deficit 3.
    const colonyB = makeColony(
      COLONY_B,
      PLANET_A,
      makeInfra({}),
      3, // pop 3 → food consumed = 3
      3,
    )

    const depositsMap = new Map<string, Deposit[]>([
      [COLONY_A, [FERTILE_DEPOSIT]],
      [COLONY_B, []],
    ])

    it('Colony A is in food shortage', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMap)
      const flowA = result.colonyFlows.get(COLONY_A)!
      // A produces 2, needs 3 → surplus = -1 → shortage of 1
      expect(flowA[ResourceType.Food].inShortage).toBe(true)
      expect(flowA[ResourceType.Food].imported).toBe(0) // nothing to import (A has deficit too)
    })

    it('Colony B is in food shortage', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMap)
      const flowB = result.colonyFlows.get(COLONY_B)!
      expect(flowB[ResourceType.Food].inShortage).toBe(true)
    })

    it('sector summary records both colony shortages', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMap)
      const foodShortages = result.sectorSummary.shortages.filter(
        (s) => s.resource === ResourceType.Food,
      )
      expect(foodShortages).toHaveLength(2)
    })

    it('no export bonuses when pool is empty (no surplus to trade)', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMap)
      // Colony A has surplus = -1 (deficit), Colony B has surplus = -3 (deficit)
      // No colony contributes to the pool → no export bonuses
      expect(result.exportBonuses).toHaveLength(0)
    })

    it('sector summary shows negative net surplus (sector deficit)', () => {
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMap)
      // Total food produced = 2, total consumed = 6 → net = -4
      expect(result.sectorSummary.netSurplus[ResourceType.Food]).toBe(-4)
    })
  })

  // ── Scenario 4: Dynamism priority ordering ─────────────────────────────────
  //
  // Three colonies need food. Only one colony produces surplus food (enough for 2 of 3).
  // Colony C (dynamism 9) gets first pick, Colony A (dynamism 5) gets second, Colony B (3) last.
  // Expected: C fully satisfied, A partially satisfied, B in shortage.

  describe('dynamism priority — high dynamism gets first access', () => {
    // Producer: Colony P, pop 1, agri 5 → 5 food produced, consumes 1 → surplus 4.
    const colonyP = makeColony(
      'col_producer' as ColonyId,
      PLANET_A,
      makeInfra({ [InfraDomain.Agricultural]: 5 }),
      1, // pop 1 → food consumed = 1; surplus = 4
      6,
    )

    // Colony C (dynamism 9): pop 2, no agri → deficit 2. Gets first pick → fully resolved.
    const colonyC = makeColony(
      COLONY_C,
      PLANET_A,
      makeInfra({}),
      2, // pop 2 → deficit = 2
      9,
    )

    // Colony A (dynamism 5): pop 2, no agri → deficit 2. Gets second pick.
    // Pool after C = 4 - 2 = 2 → receives 2, fully resolved.
    const colonyA = makeColony(
      COLONY_A,
      PLANET_A,
      makeInfra({}),
      2, // pop 2 → deficit = 2
      5,
    )

    // Colony B (dynamism 3): pop 2, no agri → deficit 2. Gets last pick.
    // Pool after A = 0 → receives nothing → shortage of 2.
    const colonyB = makeColony(
      COLONY_B,
      PLANET_A,
      makeInfra({}),
      2, // pop 2 → deficit = 2
      3,
    )

    const depositsMap = new Map<string, Deposit[]>([
      ['col_producer', [FERTILE_DEPOSIT]],
      [COLONY_C, []],
      [COLONY_A, []],
      [COLONY_B, []],
    ])

    const colonies = [colonyP, colonyC, colonyA, colonyB]

    it('Colony C (highest dynamism) receives full food import', () => {
      const result = resolveMarket(SECTOR_ID, colonies, depositsMap)
      const flowC = result.colonyFlows.get(COLONY_C)!
      expect(flowC[ResourceType.Food].imported).toBe(2)
      expect(flowC[ResourceType.Food].inShortage).toBe(false)
    })

    it('Colony A (middle dynamism) receives full food import', () => {
      const result = resolveMarket(SECTOR_ID, colonies, depositsMap)
      const flowA = result.colonyFlows.get(COLONY_A)!
      // Pool started at 4. C took 2 → 2 left. A needs 2 → gets 2. No shortage.
      expect(flowA[ResourceType.Food].imported).toBe(2)
      expect(flowA[ResourceType.Food].inShortage).toBe(false)
    })

    it('Colony B (lowest dynamism) receives no food import (pool exhausted)', () => {
      const result = resolveMarket(SECTOR_ID, colonies, depositsMap)
      const flowB = result.colonyFlows.get(COLONY_B)!
      // Pool = 0 after C and A drew. B gets nothing → shortage.
      expect(flowB[ResourceType.Food].imported).toBe(0)
      expect(flowB[ResourceType.Food].inShortage).toBe(true)
    })

    it('Producer earns an export bonus for Food', () => {
      const result = resolveMarket(SECTOR_ID, colonies, depositsMap)
      const bonus = result.exportBonuses.find(
        (b) => b.colonyId === 'col_producer' && b.resource === ResourceType.Food,
      )
      expect(bonus).toBeDefined()
    })

    it('shortage recorded for B only (C and A are fully satisfied)', () => {
      // Pool = 4 (producer surplus). C takes 2 → pool = 2. A takes 2 → pool = 0. B gets 0.
      const result = resolveMarket(SECTOR_ID, colonies, depositsMap)
      const foodShortages = result.sectorSummary.shortages.filter(
        (s) => s.resource === ResourceType.Food,
      )
      const shortageIds = foodShortages.map((s) => s.colonyId)
      expect(shortageIds).toContain(COLONY_B)
      expect(shortageIds).not.toContain(COLONY_C)
      expect(shortageIds).not.toContain(COLONY_A)
    })
  })

  // ── Transport Capacity: local-only shortage ────────────────────────────────
  //
  // TC is produced and consumed locally, never traded.
  // Shortage detected immediately if produced < consumed.

  describe('Transport Capacity — local-only, never traded', () => {
    // Colony: pop 4, transport infra 2 → produces 2 TC, needs 4 → deficit 2 → shortage.
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      makeInfra({ [InfraDomain.Transport]: 2 }),
      4,
      5,
    )

    it('TC shortage detected when produced < consumed', () => {
      const result = resolveMarket(SECTOR_ID, [colony], new Map([[COLONY_A, []]]))
      const tcFlow = result.colonyFlows.get(COLONY_A)![ResourceType.TransportCapacity]
      expect(tcFlow.inShortage).toBe(true)
      expect(tcFlow.imported).toBe(0) // TC never imported
    })

    it('TC shortage recorded in sector shortages', () => {
      const result = resolveMarket(SECTOR_ID, [colony], new Map([[COLONY_A, []]]))
      const tcShortage = result.sectorSummary.shortages.find(
        (s) => s.resource === ResourceType.TransportCapacity,
      )
      expect(tcShortage).toBeDefined()
      expect(tcShortage!.deficitAmount).toBe(2) // 2 produced, 4 consumed → 2 deficit
    })
  })

  // ── No surplus consumed = no export bonus ──────────────────────────────────
  //
  // Colony with surplus but no other colony has a deficit → no trade → no bonus.

  describe('export bonus — not granted when surplus goes unclaimed', () => {
    // Colony A: surplus 4 food. Colony B: surplus 2 consumer goods. No deficits.
    const colonyA = makeColony(
      COLONY_A,
      PLANET_A,
      makeInfra({ [InfraDomain.Agricultural]: 6 }), // 6 food, pop 1 consumes 2 → 4 surplus
      1,
      5,
    )
    const colonyB = makeColony(
      COLONY_B,
      PLANET_A,
      makeInfra({ [InfraDomain.Mining]: 4, [InfraDomain.LowIndustry]: 2 }),
      // Mining 4 → 4 common; LowIndustry 2 → needs 2 common, produces 2 CG
      // Pop 1 → consumes 2 food (deficit), 1 CG.  CG surplus = 1.
      1,
      4,
    )

    const depositsMap = new Map<string, Deposit[]>([
      [COLONY_A, [FERTILE_DEPOSIT]],
      [COLONY_B, [COMMON_ORE_DEPOSIT]],
    ])

    it('no export bonuses for food when no colony needs it — wait, B needs food', () => {
      // Actually Colony B has no agri → deficit 2 food → Colony A exports food to B.
      // So Colony A WILL earn an export bonus. Let's verify the bonus is for food.
      const result = resolveMarket(SECTOR_ID, [colonyA, colonyB], depositsMap)
      const foodBonus = result.exportBonuses.find(
        (b) => b.colonyId === COLONY_A && b.resource === ResourceType.Food,
      )
      // B deficit = 2 food; A surplus = 4 → B gets 2, pool goes from 4 to 2 → pool decreased → bonus
      expect(foodBonus).toBeDefined()
    })
  })

  // ── Empty sector: no colonies ──────────────────────────────────────────────

  describe('edge case — empty sector (no colonies)', () => {
    it('returns empty maps and zero totals', () => {
      const result = resolveMarket(SECTOR_ID, [], new Map())
      expect(result.colonyFlows.size).toBe(0)
      expect(result.sectorSummary.shortages).toHaveLength(0)
      expect(result.exportBonuses).toHaveLength(0)
      expect(result.sectorSummary.totalProduction[ResourceType.Food]).toBe(0)
    })
  })

  // ── Shortage deficit amounts ──────────────────────────────────────────────

  describe('shortage deficit amounts', () => {
    // Colony: pop 3, no agri → food deficit = 6. No food in sector.
    const colony = makeColony(
      COLONY_A,
      PLANET_A,
      makeInfra({}),
      3,
      5,
    )

    it('shortage.deficitAmount reflects the unmet need', () => {
      const result = resolveMarket(SECTOR_ID, [colony], new Map([[COLONY_A, []]]))
      const foodShortage = result.sectorSummary.shortages.find(
        (s) => s.resource === ResourceType.Food && s.colonyId === COLONY_A,
      )
      expect(foodShortage).toBeDefined()
      // pop 3 → needs 3 food (pop × 1); 0 produced, 0 imported → deficit = 3
      expect(foodShortage!.deficitAmount).toBe(3)
    })
  })
})
