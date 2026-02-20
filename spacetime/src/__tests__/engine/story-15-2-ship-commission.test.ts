/**
 * story-15-2-ship-commission.test.ts — Unit tests for Story 15.2: Ship Construction.
 *
 * Covers:
 * - Space infra validation per role and variant (INSUFFICIENT_SPACE_INFRA)
 * - Build time reduction across corp levels (actual_build_time formula)
 * - BP/turn cost calculation (role + size variant)
 * - Ship object correctness on contract completion (role, variant, status, sector)
 * - Ship added to state.ships on completion
 * - Ship commission completion event emitted
 */

import { describe, it, expect } from 'vitest'
import { createContract } from '../../engine/actions/create-contract'
import { resolveContractPhase } from '../../engine/turn/contract-phase'
import type { GameState } from '../../types/game'
import type { Contract } from '../../types/contract'
import type { Colony } from '../../types/colony'
import type { Corporation } from '../../types/corporation'
import {
  ContractStatus,
  ContractType,
  CorpType,
  ShipRole,
  SizeVariant,
  ShipStatus,
  SectorDensity,
  ColonyType,
  InfraDomain,
} from '../../types/common'
import type {
  ContractId,
  CorpId,
  ColonyId,
  SectorId,
  TurnNumber,
  BPAmount,
} from '../../types/common'
import type { Sector } from '../../types/sector'
import type { InfraState } from '../../types/infrastructure'
import { createEmptyEmpireBonuses } from '../../types/empire'
import { SHIP_ROLE_DEFINITIONS, SIZE_VARIANT_MULTIPLIERS } from '../../data/ship-roles'

// ─── Test Constants ────────────────────────────────────────────────────────────

const TURN_5 = 5 as TurnNumber
const CORP_ID = 'corp_shiptest' as CorpId
const COLONY_ID = 'col_shiptest' as ColonyId
const SECTOR_ID = 'sec_shiptest' as SectorId
const CONTRACT_ID = 'ctr_shiptest' as ContractId

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInfraState(publicLevels: number): InfraState {
  return {
    domain: InfraDomain.SpaceIndustry,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: 10,
  }
}

function makeColonyWithSpaceInfra(spaceInfraLevels: number): Colony {
  const spaceInfraState = makeInfraState(spaceInfraLevels)
  return {
    id: COLONY_ID,
    name: 'Test Colony',
    type: ColonyType.FrontierColony,
    planetId: 'pln_test' as any,
    sectorId: SECTOR_ID,
    populationLevel: 5,
    infrastructure: {
      [InfraDomain.SpaceIndustry]: spaceInfraState,
    } as any,
    attributes: { habitability: 5, accessibility: 3, dynamism: 3, qualityOfLife: 7, stability: 8, growth: 0 },
    corporationsPresent: [],
    modifiers: [],
    foundedTurn: 1 as TurnNumber,
  }
}

function makeShipbuildingCorp(level = 3): Corporation {
  return {
    id: CORP_ID,
    name: 'Stellar Works',
    type: CorpType.Shipbuilding,
    level,
    capital: 20,
    traits: [],
    homePlanetId: 'pln_test' as any,
    planetsPresent: [],
    assets: {
      infrastructureByColony: new Map(),
      schematics: [],
      patents: [],
    },
    activeContractIds: [],
    foundedTurn: 1 as TurnNumber,
  }
}

function makeSector(): Sector {
  return {
    id: SECTOR_ID,
    name: 'Alpha Sector',
    density: SectorDensity.Normal,
    explorationPercent: 50,
    threatModifier: 1,
    firstEnteredTurn: null,
  }
}

function makeBaseState(
  contracts: Map<string, Contract>,
  colonies: Map<string, Colony>,
  corporations: Map<string, Corporation>,
): GameState {
  return {
    turn: TURN_5,
    phase: 'resolving',
    currentBP: 20 as BPAmount,
    debtTokens: 0,
    budget: { incomeSources: [], expenseEntries: [] } as any,
    empireBonuses: createEmptyEmpireBonuses(),
    galaxy: {
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      adjacency: new Map(),
      startingSectorId: SECTOR_ID,
    } as any,
    colonies,
    planets: new Map(),
    corporations,
    contracts,
    ships: new Map(),
    missions: new Map(),
    scienceDomains: new Map(),
    discoveries: new Map(),
    schematics: new Map(),
    patents: new Map(),
    sectorMarkets: new Map(),
    tradeRoutes: [],
    events: [],
    startedAt: '2026-01-01',
    lastSavedAt: '2026-01-01',
  }
}

// ─── Space Infra Validation ────────────────────────────────────────────────────

describe('createContract — ShipCommission space infra validation', () => {
  it('succeeds when colony has exactly the required space infra (SystemPatrol Standard)', () => {
    // SystemPatrol base_size = 3, Standard multiplier = 1.0 → required = floor(3 × 1.0) = 3
    const colony = makeColonyWithSpaceInfra(3)
    const corp = makeShipbuildingCorp(3)

    const result = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.SystemPatrol, sizeVariant: SizeVariant.Standard },
    })

    expect(result.success).toBe(true)
  })

  it('fails with INSUFFICIENT_SPACE_INFRA when colony space infra is one below required', () => {
    // SystemPatrol Standard requires 3 levels; colony has 2
    const colony = makeColonyWithSpaceInfra(2)
    const corp = makeShipbuildingCorp(3)

    const result = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.SystemPatrol, sizeVariant: SizeVariant.Standard },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INSUFFICIENT_SPACE_INFRA')
    }
  })

  it('Light variant reduces infra requirement (SystemPatrol Light: floor(3 × 0.75) = 2)', () => {
    // Required = floor(3 × 0.75) = floor(2.25) = 2
    const colony = makeColonyWithSpaceInfra(2)
    const corp = makeShipbuildingCorp(3)

    const result = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.SystemPatrol, sizeVariant: SizeVariant.Light },
    })

    expect(result.success).toBe(true)
  })

  it('Heavy variant increases infra requirement (SystemPatrol Heavy: floor(3 × 1.25) = 3)', () => {
    // Required = floor(3 × 1.25) = floor(3.75) = 3; colony has 2 → fail
    const colony = makeColonyWithSpaceInfra(2)
    const corp = makeShipbuildingCorp(3)

    const result = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.SystemPatrol, sizeVariant: SizeVariant.Heavy },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INSUFFICIENT_SPACE_INFRA')
    }
  })

  it('large role (Flagship base_size=9) requires more infra than small role', () => {
    // Flagship Standard: required = floor(9 × 1.0) = 9
    // Colony with 8 should fail
    const colony = makeColonyWithSpaceInfra(8)
    const corp = makeShipbuildingCorp(3)

    const result = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.Flagship, sizeVariant: SizeVariant.Standard },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('INSUFFICIENT_SPACE_INFRA')
    }
  })
})

// ─── Build Time Reduction ──────────────────────────────────────────────────────

describe('createContract — ShipCommission build time reduction', () => {
  /**
   * For SystemPatrol Standard, corp level 1:
   *   corp_modifier = 0.7 + 1 × 0.06 = 0.76
   *   rawSize = floor(3 × 0.76) = floor(2.28) = 2
   *   baseBuildTime = max(3, floor(2)) = 3  (no role bonus)
   *   buildTimeTurns = max(1, floor(3 × 1.0)) = 3
   *   actual = max(1, floor(3 × (1 - 1 × 0.05))) = max(1, floor(3 × 0.95)) = max(1, floor(2.85)) = max(1, 2) = 2
   */
  it('corp level 1 applies 5% build time reduction', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(1)

    const result = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.SystemPatrol, sizeVariant: SizeVariant.Standard },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // Verify the duration is reduced: 3 × 0.95 = 2.85 → floor = 2
      expect(result.contract.durationTurns).toBe(2)
    }
  })

  it('corp level 10 applies 50% build time reduction', () => {
    // actual = max(1, floor(buildTimeTurns × (1 - 10 × 0.05))) = max(1, floor(× 0.5))
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(10)

    const result = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.SystemPatrol, sizeVariant: SizeVariant.Standard },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // corp_modifier = 0.7 + 10 × 0.06 = 1.3
      // rawSize = floor(3 × 1.3) = floor(3.9) = 3
      // baseBuildTime = max(3, 3) = 3
      // buildTimeTurns = max(1, floor(3 × 1.0)) = 3
      // actual = max(1, floor(3 × 0.5)) = max(1, 1) = 1
      expect(result.contract.durationTurns).toBe(1)
    }
  })

  it('actual build time is never below 1', () => {
    // Even at max corp level, result is at least 1
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(10)

    const result = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.Recon, sizeVariant: SizeVariant.Light },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.contract.durationTurns).toBeGreaterThanOrEqual(1)
    }
  })
})

// ─── BP/Turn Cost ─────────────────────────────────────────────────────────────

describe('createContract — ShipCommission bp_per_turn cost', () => {
  it('cost scales with ship size (Flagship > SystemPatrol)', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(3)

    const smallResult = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.SystemPatrol, sizeVariant: SizeVariant.Standard },
    })

    const largeResult = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.Flagship, sizeVariant: SizeVariant.Standard },
    })

    expect(smallResult.success).toBe(true)
    expect(largeResult.success).toBe(true)
    if (smallResult.success && largeResult.success) {
      expect(largeResult.contract.bpPerTurn).toBeGreaterThan(smallResult.contract.bpPerTurn)
    }
  })

  it('Heavy variant costs more than Light variant for same role', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(3)

    const lightResult = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.Escort, sizeVariant: SizeVariant.Light },
    })

    const heavyResult = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.Escort, sizeVariant: SizeVariant.Heavy },
    })

    expect(lightResult.success).toBe(true)
    expect(heavyResult.success).toBe(true)
    if (lightResult.success && heavyResult.success) {
      expect(heavyResult.contract.bpPerTurn).toBeGreaterThanOrEqual(lightResult.contract.bpPerTurn)
    }
  })

  it('bp_per_turn is at least 1', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(1)

    const result = createContract({
      type: ContractType.ShipCommission,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      currentTurn: TURN_5,
      sectors: new Map([[SECTOR_ID, makeSector()]]),
      sectorAdjacency: new Map(),
      colonySectorIds: new Set([SECTOR_ID]),
      colonies: new Map([[COLONY_ID, colony]]),
      planets: new Map(),
      corporations: new Map([[CORP_ID, corp]]),
      shipCommissionParams: { role: ShipRole.Recon, sizeVariant: SizeVariant.Light },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.contract.bpPerTurn).toBeGreaterThanOrEqual(1)
    }
  })
})

// ─── Ship Completion ───────────────────────────────────────────────────────────

describe('resolveContractPhase — ShipCommission completion', () => {
  function makeShipCommissionContract(turnsRemaining: number): Contract {
    return {
      id: CONTRACT_ID,
      type: ContractType.ShipCommission,
      status: ContractStatus.Active,
      target: { type: 'colony', colonyId: COLONY_ID },
      assignedCorpId: CORP_ID,
      bpPerTurn: 2 as BPAmount,
      durationTurns: 3,
      turnsRemaining,
      startTurn: 1 as TurnNumber,
      completedTurn: null,
      shipCommissionParams: { role: ShipRole.SystemPatrol, sizeVariant: SizeVariant.Standard },
    }
  }

  it('adds a ship to state.ships on completion', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(3)
    const contract = makeShipCommissionContract(1)

    const state = makeBaseState(
      new Map([[CONTRACT_ID, contract]]),
      new Map([[COLONY_ID, colony]]),
      new Map([[CORP_ID, corp]]),
    )

    const { updatedState } = resolveContractPhase(state)

    expect(updatedState.ships.size).toBe(1)
  })

  it('completed ship has correct role and size variant', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(3)
    const contract = makeShipCommissionContract(1)

    const state = makeBaseState(
      new Map([[CONTRACT_ID, contract]]),
      new Map([[COLONY_ID, colony]]),
      new Map([[CORP_ID, corp]]),
    )

    const { updatedState } = resolveContractPhase(state)

    const ship = [...updatedState.ships.values()][0]!
    expect(ship.role).toBe(ShipRole.SystemPatrol)
    expect(ship.sizeVariant).toBe(SizeVariant.Standard)
  })

  it('completed ship is Stationed at the colony sector', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(3)
    const contract = makeShipCommissionContract(1)

    const state = makeBaseState(
      new Map([[CONTRACT_ID, contract]]),
      new Map([[COLONY_ID, colony]]),
      new Map([[CORP_ID, corp]]),
    )

    const { updatedState } = resolveContractPhase(state)

    const ship = [...updatedState.ships.values()][0]!
    expect(ship.status).toBe(ShipStatus.Stationed)
    expect(ship.homeSectorId).toBe(SECTOR_ID)
  })

  it('completed ship has all primary and derived stats set (non-zero)', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(5)
    const contract = makeShipCommissionContract(1)

    const state = makeBaseState(
      new Map([[CONTRACT_ID, contract]]),
      new Map([[COLONY_ID, colony]]),
      new Map([[CORP_ID, corp]]),
    )

    const { updatedState } = resolveContractPhase(state)

    const ship = [...updatedState.ships.values()][0]!
    expect(ship.primaryStats.size).toBeGreaterThan(0)
    expect(ship.primaryStats.speed).toBeGreaterThan(0)
    expect(ship.derivedStats.hullPoints).toBeGreaterThan(0)
    expect(ship.derivedStats.bpPerTurn).toBeGreaterThan(0)
    expect(ship.derivedStats.buildTimeTurns).toBeGreaterThan(0)
    expect(ship.abilities.fight).toBeGreaterThanOrEqual(0)
  })

  it('emits a fleet-category Positive event on ship completion', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(3)
    const contract = makeShipCommissionContract(1)

    const state = makeBaseState(
      new Map([[CONTRACT_ID, contract]]),
      new Map([[COLONY_ID, colony]]),
      new Map([[CORP_ID, corp]]),
    )

    const { events } = resolveContractPhase(state)

    const fleetEvent = events.find((e) => e.category === 'fleet')
    expect(fleetEvent).toBeDefined()
    expect(fleetEvent?.priority).toBe('Positive')
  })

  it('ship not added when contract target colony is missing', () => {
    const corp = makeShipbuildingCorp(3)
    const contract = makeShipCommissionContract(1)

    const state = makeBaseState(
      new Map([[CONTRACT_ID, contract]]),
      new Map(), // no colony
      new Map([[CORP_ID, corp]]),
    )

    const { updatedState } = resolveContractPhase(state)
    expect(updatedState.ships.size).toBe(0)
  })

  it('contract with 2 turns remaining does NOT complete yet', () => {
    const colony = makeColonyWithSpaceInfra(10)
    const corp = makeShipbuildingCorp(3)
    const contract = makeShipCommissionContract(2)

    const state = makeBaseState(
      new Map([[CONTRACT_ID, contract]]),
      new Map([[COLONY_ID, colony]]),
      new Map([[CORP_ID, corp]]),
    )

    const { updatedState } = resolveContractPhase(state)

    expect(updatedState.ships.size).toBe(0)
    const updatedContract = updatedState.contracts.get(CONTRACT_ID)!
    expect(updatedContract.turnsRemaining).toBe(1)
  })
})
