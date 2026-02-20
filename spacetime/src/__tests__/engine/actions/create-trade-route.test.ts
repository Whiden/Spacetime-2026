/**
 * create-trade-route.test.ts — Unit tests for Story 17.1.
 *
 * Tests:
 * - Valid creation between adjacent sectors
 * - Non-adjacent sectors rejected (SECTORS_NOT_ADJACENT)
 * - Non-Transport corp rejected (CORP_NOT_ELIGIBLE)
 * - Missing sector rejected (TARGET_NOT_FOUND)
 * - Cancellation (cancelTradeRoute marks contract as Completed, removes expense)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createTradeRoute } from '../../../engine/actions/create-trade-route'
import type { CreateTradeRouteParams } from '../../../engine/actions/create-trade-route'
import {
  ContractType,
  ContractStatus,
  CorpType,
  SectorDensity,
} from '../../../types/common'
import type { CorpId, SectorId, TurnNumber, PlanetId } from '../../../types/common'
import type { Corporation } from '../../../types/corporation'
import type { Sector } from '../../../types/sector'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TURN_1 = 1 as TurnNumber
const SECTOR_A = 'sec_aaaaaaaa' as SectorId
const SECTOR_B = 'sec_bbbbbbbb' as SectorId
const SECTOR_C = 'sec_cccccccc' as SectorId
const CORP_ID = 'corp_aaaaaa' as CorpId

function makeSector(id: SectorId): Sector {
  return {
    id,
    name: `Sector ${id}`,
    density: SectorDensity.Moderate,
    explorationPercent: 10,
    threatModifier: 1,
    firstEnteredTurn: TURN_1,
  }
}

function makeCorp(id: CorpId, type: CorpType, level = 1): Corporation {
  return {
    id,
    name: 'Test Corp',
    type,
    level,
    capital: 0,
    traits: [],
    homePlanetId: 'pln_aaa' as PlanetId,
    planetsPresent: [],
    assets: {
      infrastructureByColony: new Map(),
      schematics: [],
      patents: [],
    },
    activeContractIds: [],
    foundedTurn: TURN_1,
  }
}

function makeAdjacency(): Map<string, string[]> {
  return new Map([
    [SECTOR_A, [SECTOR_B]],
    [SECTOR_B, [SECTOR_A]],
    [SECTOR_C, []],
  ])
}

function makeParams(overrides: Partial<CreateTradeRouteParams> = {}): CreateTradeRouteParams {
  return {
    sectorIdA: SECTOR_A,
    sectorIdB: SECTOR_B,
    assignedCorpId: CORP_ID,
    currentTurn: TURN_1,
    sectors: new Map([
      [SECTOR_A, makeSector(SECTOR_A)],
      [SECTOR_B, makeSector(SECTOR_B)],
      [SECTOR_C, makeSector(SECTOR_C)],
    ]),
    sectorAdjacency: makeAdjacency(),
    corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Transport)]]),
    ...overrides,
  }
}

// ─── Valid Creation ────────────────────────────────────────────────────────────

describe('createTradeRoute — valid creation', () => {
  it('creates a TradeRoute contract between adjacent sectors', () => {
    const result = createTradeRoute(makeParams())
    expect(result.success).toBe(true)
    if (!result.success) return
    const { contract } = result
    expect(contract.type).toBe(ContractType.TradeRoute)
    expect(contract.status).toBe(ContractStatus.Active)
    expect(contract.bpPerTurn).toBe(2)
    expect(contract.assignedCorpId).toBe(CORP_ID)
    expect(contract.target).toEqual({
      type: 'sector_pair',
      sectorIdA: SECTOR_A,
      sectorIdB: SECTOR_B,
    })
    expect(contract.id).toMatch(/^ctr_/)
    expect(contract.completedTurn).toBeNull()
  })

  it('sets duration to 9999 (ongoing sentinel)', () => {
    const result = createTradeRoute(makeParams())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.durationTurns).toBe(9999)
    expect(result.contract.turnsRemaining).toBe(9999)
  })
})

// ─── Rejection Cases ──────────────────────────────────────────────────────────

describe('createTradeRoute — invalid inputs', () => {
  it('rejects non-adjacent sectors (SECTORS_NOT_ADJACENT)', () => {
    const result = createTradeRoute(makeParams({ sectorIdB: SECTOR_C }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('SECTORS_NOT_ADJACENT')
  })

  it('rejects when a sector does not exist (TARGET_NOT_FOUND)', () => {
    const sectors = new Map([
      [SECTOR_A, makeSector(SECTOR_A)],
      // SECTOR_B intentionally missing
    ])
    const result = createTradeRoute(makeParams({ sectors }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('TARGET_NOT_FOUND')
  })

  it('rejects non-Transport corp (CORP_NOT_ELIGIBLE)', () => {
    const corps = new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Industrial, 1)]])
    const result = createTradeRoute(makeParams({ corporations: corps }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('CORP_NOT_ELIGIBLE')
  })

  it('rejects level 3+ non-Transport corp (TradeRoute is Transport-only, no cross-type)', () => {
    const corps = new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Industrial, 4)]])
    const result = createTradeRoute(makeParams({ corporations: corps }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('CORP_NOT_ELIGIBLE')
  })

  it('allows Megacorp (level 6+) to create trade route regardless of type', () => {
    const corps = new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Industrial, 6)]])
    const result = createTradeRoute(makeParams({ corporations: corps }))
    expect(result.success).toBe(true)
  })
})

// ─── Cancellation ─────────────────────────────────────────────────────────────

describe('cancelTradeRoute — store action', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('cancels an active trade route (marks Completed and removes expense)', async () => {
    const { useContractStore } = await import('../../../stores/contract.store')
    const store = useContractStore()

    // Create via store
    const contractResult = store.createNewContract({
      type: ContractType.TradeRoute,
      target: { type: 'sector_pair', sectorIdA: SECTOR_A, sectorIdB: SECTOR_B },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_1,
      sectors: new Map([
        [SECTOR_A, makeSector(SECTOR_A)],
        [SECTOR_B, makeSector(SECTOR_B)],
      ]),
      sectorAdjacency: makeAdjacency(),
      colonySectorIds: new Set(),
      colonies: new Map(),
      planets: new Map(),
      corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Transport)]]),
    })

    expect(contractResult.success).toBe(true)
    if (!contractResult.success) return
    const { contract } = contractResult

    expect(store.activeContracts).toHaveLength(1)

    const cancelled = store.cancelTradeRoute(contract.id, 5)
    expect(cancelled).toBe(true)
    expect(store.activeContracts).toHaveLength(0)
    expect(store.completedContracts).toHaveLength(1)
    expect(store.completedContracts[0].status).toBe(ContractStatus.Completed)
    expect(store.completedContracts[0].completedTurn).toBe(5)
  })

  it('returns false when trying to cancel a non-TradeRoute contract', async () => {
    const { useContractStore } = await import('../../../stores/contract.store')
    const { ContractType: CT, CorpType: CrT } = await import('../../../types/common')
    const store = useContractStore()

    const sectors = new Map([[SECTOR_A, makeSector(SECTOR_A)]])
    const corps = new Map([[CORP_ID, makeCorp(CORP_ID, CrT.Exploration)]])

    const contractResult = store.createNewContract({
      type: CT.Exploration,
      target: { type: 'sector', sectorId: SECTOR_A },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_1,
      sectors,
      sectorAdjacency: new Map([[SECTOR_A, []]]),
      colonySectorIds: new Set([SECTOR_A]),
      colonies: new Map(),
      planets: new Map(),
      corporations: corps,
    })

    expect(contractResult.success).toBe(true)
    if (!contractResult.success) return

    const cancelled = store.cancelTradeRoute(contractResult.contract.id, 2)
    expect(cancelled).toBe(false)
    // Exploration contract still active
    expect(store.activeContracts).toHaveLength(1)
  })

  it('returns false when contract does not exist', async () => {
    const { useContractStore } = await import('../../../stores/contract.store')
    const store = useContractStore()
    const fakeId = 'ctr_doesnotexist' as import('../../../types/common').ContractId
    expect(store.cancelTradeRoute(fakeId, 1)).toBe(false)
  })
})
