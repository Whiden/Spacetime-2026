/**
 * cross-sector-trade.test.ts — Unit tests for Story 17.2: Cross-Sector Market Integration.
 *
 * Covers the acceptance criteria:
 * - Surplus sharing at 50% efficiency from exporter to importer.
 * - Bidirectional flow: A→B and B→A evaluated simultaneously.
 * - Dynamism-priority purchasing within the importing sector.
 * - Inactive (cancelled) trade routes are ignored.
 * - Trade routes between sectors with no surplus produce no flows.
 * - Multiple trade routes work independently.
 */

import { describe, it, expect } from 'vitest'
import { applyCrossSectorTradePass } from '../../../engine/simulation/market-resolver'
import type { Colony } from '../../../types/colony'
import type { ColonyResourceSummary, ResourceFlow } from '../../../types/resource'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { ColonyId, PlanetId, SectorId, TurnNumber } from '../../../types/common'
import {
  InfraDomain,
  ResourceType,
  ColonyType,
} from '../../../types/common'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SECTOR_A = 'sec_alpha' as SectorId
const SECTOR_B = 'sec_beta' as SectorId
const COLONY_A1 = 'col_a1' as ColonyId
const COLONY_B1 = 'col_b1' as ColonyId
const COLONY_B2 = 'col_b2' as ColonyId
const PLANET_A = 'pln_a' as PlanetId
const PLANET_B = 'pln_b' as PlanetId

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

function makeColony(id: ColonyId, sectorId: SectorId, dynamism: number): Colony {
  return {
    id,
    planetId: PLANET_A,
    sectorId,
    name: `Colony ${id}`,
    type: ColonyType.FrontierColony,
    populationLevel: 2,
    attributes: {
      habitability: 8,
      accessibility: 5,
      dynamism,
      qualityOfLife: 8,
      stability: 8,
      growth: 0,
    },
    infrastructure: makeInfra(),
    corporationsPresent: [],
    modifiers: [],
    foundedTurn: 1 as TurnNumber,
  }
}

/**
 * Build a zero ResourceFlow (baseline for all resources).
 */
function zeroFlow(): ResourceFlow {
  return { produced: 0, consumed: 0, surplus: 0, imported: 0, inShortage: false }
}

/**
 * Build a ColonyResourceSummary with all resources at zero except those specified.
 */
function makeFlows(overrides: Partial<Record<ResourceType, Partial<ResourceFlow>>>): ColonyResourceSummary {
  const result = {} as ColonyResourceSummary
  for (const r of Object.values(ResourceType)) {
    result[r] = { ...zeroFlow(), ...(overrides[r] ?? {}) }
  }
  return result
}

// ─── Tests: applyCrossSectorTradePass ─────────────────────────────────────────

describe('applyCrossSectorTradePass — cross-sector surplus sharing', () => {

  // ── Test 1: Basic surplus transfer at 50% efficiency ─────────────────────────
  //
  // Sector A has 10 food surplus (net remaining after internal market).
  // Sector B colony has a deficit of 4 food.
  // Available cross-sector = floor(10 × 0.5) = 5.
  // Colony B deficit = 4, receives min(4, 5) = 4.
  // Trade flow: surplusAvailable=10, transferred=5, received=4.

  describe('50% efficiency: surplus halved before sharing', () => {
    const colonyA = makeColony(COLONY_A1, SECTOR_A, 7)
    const colonyB = makeColony(COLONY_B1, SECTOR_B, 5)

    // Exporter: Colony A has 10 food surplus (produced=10, consumed=0, imported=0).
    const flowsA = new Map([[
      COLONY_A1,
      makeFlows({ [ResourceType.Food]: { produced: 10, consumed: 0, surplus: 10, imported: 0, inShortage: false } }),
    ]])

    // Importer: Colony B has deficit of 4 food (produced=0, consumed=4, surplus=-4, imported=0).
    const flowsB = new Map([[
      COLONY_B1,
      makeFlows({ [ResourceType.Food]: { produced: 0, consumed: 4, surplus: -4, imported: 0, inShortage: true } }),
    ]])

    it('colony B receives food (up to 50% of A surplus)', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      const updatedFlow = result.importerFlows.get(COLONY_B1)![ResourceType.Food]
      // floor(10 × 0.5) = 5 available; colony B deficit = 4; receives 4.
      expect(updatedFlow.imported).toBe(4)
    })

    it('colony B shortage is resolved after full import', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      const updatedFlow = result.importerFlows.get(COLONY_B1)![ResourceType.Food]
      expect(updatedFlow.inShortage).toBe(false)
    })

    it('trade flow records surplusAvailable=10, transferred=5, received=4', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      const tf = result.tradeFlows.find((f) => f.resource === ResourceType.Food)
      expect(tf).toBeDefined()
      expect(tf!.surplusAvailable).toBe(10)
      expect(tf!.transferred).toBe(5)  // floor(10 × 0.5) = 5
      expect(tf!.received).toBe(4)     // min(deficit=4, available=5) = 4
    })

    it('trade flow has correct from/to sector IDs', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      const tf = result.tradeFlows.find((f) => f.resource === ResourceType.Food)
      expect(tf!.fromSectorId).toBe(SECTOR_A)
      expect(tf!.toSectorId).toBe(SECTOR_B)
    })
  })

  // ── Test 2: Partial shortage resolution (import limited by 50% cap) ─────────
  //
  // Sector A has 4 food surplus. 50% = 2 available.
  // Colony B needs 6 food. Receives only 2 (cap). Shortage remains.

  describe('shortage partially resolved when 50% cap is less than deficit', () => {
    const colonyA = makeColony(COLONY_A1, SECTOR_A, 7)
    const colonyB = makeColony(COLONY_B1, SECTOR_B, 5)

    const flowsA = new Map([[
      COLONY_A1,
      makeFlows({ [ResourceType.Food]: { produced: 4, consumed: 0, surplus: 4, imported: 0, inShortage: false } }),
    ]])

    // Colony B deficit = 6.
    const flowsB = new Map([[
      COLONY_B1,
      makeFlows({ [ResourceType.Food]: { produced: 0, consumed: 6, surplus: -6, imported: 0, inShortage: true } }),
    ]])

    it('colony B imports only 2 food (50% cap = floor(4×0.5) = 2)', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      const updatedFlow = result.importerFlows.get(COLONY_B1)![ResourceType.Food]
      expect(updatedFlow.imported).toBe(2)
    })

    it('colony B remains in shortage (deficit was 6, only 2 received)', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      const updatedFlow = result.importerFlows.get(COLONY_B1)![ResourceType.Food]
      expect(updatedFlow.inShortage).toBe(true)
    })
  })

  // ── Test 3: Dynamism-priority purchasing within importer sector ──────────────
  //
  // Sector A has 4 food surplus → 2 available (50%).
  // Sector B has two colonies: B1 (dynamism=8, deficit=2) and B2 (dynamism=3, deficit=2).
  // Available = 2. B1 gets first pick: receives 2 (full). B2 gets nothing.

  describe('dynamism-priority purchasing within importer sector', () => {
    const colonyA = makeColony(COLONY_A1, SECTOR_A, 7)
    const colonyB1 = makeColony(COLONY_B1, SECTOR_B, 8) // high dynamism
    const colonyB2 = makeColony(COLONY_B2, SECTOR_B, 3) // low dynamism

    const flowsA = new Map([[
      COLONY_A1,
      makeFlows({ [ResourceType.Food]: { produced: 4, consumed: 0, surplus: 4, imported: 0, inShortage: false } }),
    ]])

    const flowsB = new Map([
      [COLONY_B1, makeFlows({ [ResourceType.Food]: { produced: 0, consumed: 2, surplus: -2, imported: 0, inShortage: true } })],
      [COLONY_B2, makeFlows({ [ResourceType.Food]: { produced: 0, consumed: 2, surplus: -2, imported: 0, inShortage: true } })],
    ])

    it('high-dynamism colony (B1) receives the full available cross-sector food', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB1, colonyB2] },
      })
      const flowB1 = result.importerFlows.get(COLONY_B1)![ResourceType.Food]
      // Available = floor(4×0.5) = 2. B1 needs 2, receives 2.
      expect(flowB1.imported).toBe(2)
      expect(flowB1.inShortage).toBe(false)
    })

    it('low-dynamism colony (B2) gets nothing (pool exhausted by B1)', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB1, colonyB2] },
      })
      const flowB2 = result.importerFlows.get(COLONY_B2)![ResourceType.Food]
      expect(flowB2.imported).toBe(0)
      expect(flowB2.inShortage).toBe(true)
    })
  })

  // ── Test 4: No trade when exporter has no surplus ────────────────────────────

  describe('no trade flow when exporter has no surplus', () => {
    const colonyA = makeColony(COLONY_A1, SECTOR_A, 7)
    const colonyB = makeColony(COLONY_B1, SECTOR_B, 5)

    // Exporter: Colony A has no food surplus.
    const flowsA = new Map([[
      COLONY_A1,
      makeFlows({ [ResourceType.Food]: { produced: 2, consumed: 2, surplus: 0, imported: 0, inShortage: false } }),
    ]])

    // Importer: Colony B is in shortage.
    const flowsB = new Map([[
      COLONY_B1,
      makeFlows({ [ResourceType.Food]: { produced: 0, consumed: 3, surplus: -3, imported: 0, inShortage: true } }),
    ]])

    it('produces no trade flows when exporter has zero surplus', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      expect(result.tradeFlows).toHaveLength(0)
    })

    it('importer flows unchanged when no surplus available', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      const flowB = result.importerFlows.get(COLONY_B1)![ResourceType.Food]
      expect(flowB.imported).toBe(0)
      expect(flowB.inShortage).toBe(true)
    })
  })

  // ── Test 5: No trade when importer has no deficit ────────────────────────────

  describe('no trade flow when importer has no deficits', () => {
    const colonyA = makeColony(COLONY_A1, SECTOR_A, 7)
    const colonyB = makeColony(COLONY_B1, SECTOR_B, 5)

    // Exporter: surplus 10.
    const flowsA = new Map([[
      COLONY_A1,
      makeFlows({ [ResourceType.Food]: { produced: 10, consumed: 0, surplus: 10, imported: 0, inShortage: false } }),
    ]])

    // Importer: no deficit — colony B is surplus too.
    const flowsB = new Map([[
      COLONY_B1,
      makeFlows({ [ResourceType.Food]: { produced: 5, consumed: 2, surplus: 3, imported: 0, inShortage: false } }),
    ]])

    it('produces no trade flows when importer has no deficit', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      expect(result.tradeFlows).toHaveLength(0)
    })
  })

  // ── Test 6: Bidirectional — both passes use original flows ────────────────────
  //
  // When called as two separate passes (A→B and B→A) with original flows,
  // the results are independent: each importer's flows reflect only what
  // that sector received from the other.
  // This verifies the "simultaneous evaluation" contract used in market-phase.ts.

  describe('bidirectional trade — both passes are independent', () => {
    const colonyA = makeColony(COLONY_A1, SECTOR_A, 6)
    const colonyB = makeColony(COLONY_B1, SECTOR_B, 6)

    // Sector A: 8 food surplus, needs 4 common materials.
    const flowsA = new Map([[
      COLONY_A1,
      makeFlows({
        [ResourceType.Food]: { produced: 8, consumed: 0, surplus: 8, imported: 0, inShortage: false },
        [ResourceType.CommonMaterials]: { produced: 0, consumed: 4, surplus: -4, imported: 0, inShortage: true },
      }),
    ]])

    // Sector B: 6 common materials surplus, needs 3 food.
    const flowsB = new Map([[
      COLONY_B1,
      makeFlows({
        [ResourceType.Food]: { produced: 0, consumed: 3, surplus: -3, imported: 0, inShortage: true },
        [ResourceType.CommonMaterials]: { produced: 6, consumed: 0, surplus: 6, imported: 0, inShortage: false },
      }),
    ]])

    it('A→B pass: B receives food from A', () => {
      const passAtoB = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      // A surplus food = 8; available = floor(8×0.5) = 4. B needs 3. B receives 3.
      const foodFlowB = passAtoB.importerFlows.get(COLONY_B1)![ResourceType.Food]
      expect(foodFlowB.imported).toBe(3)
      expect(foodFlowB.inShortage).toBe(false)
    })

    it('B→A pass: A receives common materials from B', () => {
      const passBtoA = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
        importer: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
      })
      // B surplus CM = 6; available = floor(6×0.5) = 3. A needs 4. A receives 3. Partial.
      const cmFlowA = passBtoA.importerFlows.get(COLONY_A1)![ResourceType.CommonMaterials]
      expect(cmFlowA.imported).toBe(3)
      expect(cmFlowA.inShortage).toBe(true) // still short by 1
    })

    it('B→A pass does not use A→B pass results (independent passes)', () => {
      // Even if the A→B pass ran first, the B→A pass still uses original flowsA
      // (common materials deficit = 4, no imports yet from internal resolution).
      const passBtoA = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
        importer: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
      })
      const cmFlow = passBtoA.importerFlows.get(COLONY_A1)![ResourceType.CommonMaterials]
      // A's imported CM from original flowsA = 0. After B→A pass: imported = 3.
      expect(cmFlow.imported).toBe(3)
    })
  })

  // ── Test 7: Surplus already partially imported (from internal resolution) ─────
  //
  // Colony A had a deficit of 2, imported 2 from within its sector.
  // Net: produced=2, consumed=4, imported=2 → net=0 (no remaining deficit).
  // Colony A should not draw from cross-sector.

  describe('colonies with already-resolved deficits do not draw cross-sector', () => {
    const colonyA = makeColony(COLONY_A1, SECTOR_A, 7)
    const colonyB = makeColony(COLONY_B1, SECTOR_B, 5)

    const flowsExporter = new Map([[
      COLONY_A1,
      makeFlows({ [ResourceType.Food]: { produced: 10, consumed: 0, surplus: 10, imported: 0, inShortage: false } }),
    ]])

    // Colony B: deficit 4, but internally imported 4 → fully resolved.
    const flowsImporter = new Map([[
      COLONY_B1,
      makeFlows({ [ResourceType.Food]: { produced: 0, consumed: 4, surplus: -4, imported: 4, inShortage: false } }),
    ]])

    it('no food trade flow when importer was fully satisfied internally', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsExporter, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsImporter, colonies: [colonyB] },
      })
      const tf = result.tradeFlows.find((f) => f.resource === ResourceType.Food)
      expect(tf).toBeUndefined()
    })
  })

  // ── Test 8: Multiple resources traded simultaneously ──────────────────────────

  describe('multiple resources traded in one pass', () => {
    const colonyA = makeColony(COLONY_A1, SECTOR_A, 7)
    const colonyB = makeColony(COLONY_B1, SECTOR_B, 5)

    // Exporter A: surplus in both food and rare materials.
    const flowsA = new Map([[
      COLONY_A1,
      makeFlows({
        [ResourceType.Food]: { produced: 10, consumed: 0, surplus: 10, imported: 0, inShortage: false },
        [ResourceType.RareMaterials]: { produced: 8, consumed: 0, surplus: 8, imported: 0, inShortage: false },
      }),
    ]])

    // Importer B: deficit in both.
    const flowsB = new Map([[
      COLONY_B1,
      makeFlows({
        [ResourceType.Food]: { produced: 0, consumed: 4, surplus: -4, imported: 0, inShortage: true },
        [ResourceType.RareMaterials]: { produced: 0, consumed: 2, surplus: -2, imported: 0, inShortage: true },
      }),
    ]])

    it('produces trade flows for both food and rare materials', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      const resourcesTraded = result.tradeFlows.map((tf) => tf.resource)
      expect(resourcesTraded).toContain(ResourceType.Food)
      expect(resourcesTraded).toContain(ResourceType.RareMaterials)
    })

    it('food: colony B imports correct amount', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      // Food: floor(10×0.5)=5 available; B needs 4; receives 4.
      const flowB = result.importerFlows.get(COLONY_B1)![ResourceType.Food]
      expect(flowB.imported).toBe(4)
      expect(flowB.inShortage).toBe(false)
    })

    it('rare materials: colony B imports correct amount', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      // RareMaterials: floor(8×0.5)=4 available; B needs 2; receives 2.
      const flowB = result.importerFlows.get(COLONY_B1)![ResourceType.RareMaterials]
      expect(flowB.imported).toBe(2)
      expect(flowB.inShortage).toBe(false)
    })
  })

  // ── Test 9: Efficiency — odd surplus rounds down ─────────────────────────────

  describe('efficiency — floor applied to surplus × 0.5', () => {
    const colonyA = makeColony(COLONY_A1, SECTOR_A, 7)
    const colonyB = makeColony(COLONY_B1, SECTOR_B, 5)

    // Surplus = 3 → floor(3×0.5) = floor(1.5) = 1 available.
    const flowsA = new Map([[
      COLONY_A1,
      makeFlows({ [ResourceType.Food]: { produced: 3, consumed: 0, surplus: 3, imported: 0, inShortage: false } }),
    ]])

    const flowsB = new Map([[
      COLONY_B1,
      makeFlows({ [ResourceType.Food]: { produced: 0, consumed: 5, surplus: -5, imported: 0, inShortage: true } }),
    ]])

    it('available cross-sector food = floor(3 × 0.5) = 1', () => {
      const result = applyCrossSectorTradePass({
        exporter: { sectorId: SECTOR_A, colonyFlows: flowsA, colonies: [colonyA] },
        importer: { sectorId: SECTOR_B, colonyFlows: flowsB, colonies: [colonyB] },
      })
      const tf = result.tradeFlows.find((f) => f.resource === ResourceType.Food)
      expect(tf).toBeDefined()
      expect(tf!.transferred).toBe(1) // floor(3 × 0.5) = 1
      expect(tf!.received).toBe(1)    // min(deficit=5, available=1) = 1
    })
  })
})
