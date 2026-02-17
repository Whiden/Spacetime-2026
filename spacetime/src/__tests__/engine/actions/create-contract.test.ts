/**
 * create-contract.test.ts — Unit tests for contract creation engine action.
 *
 * Tests cover:
 * - Valid creation for each contract type
 * - Invalid target type (mismatch between contract type and target)
 * - Target not found (entity doesn't exist in the maps)
 * - Invalid planet status (colonization/survey on wrong-status planet)
 * - Non-adjacent sectors for trade route
 * - Corp not found
 * - Corp not eligible (wrong type, too low level for cross-type)
 * - Insufficient BP (balance < bp/turn)
 * - Missing required params (colonizationParams, shipCommissionParams)
 * - Corp eligibility: megacorp (level 6+) can do any contract
 * - Corp eligibility: level 3+ can do cross-type Exploration/GroundSurvey
 * - Correct cost and duration calculation
 */

import { describe, it, expect } from 'vitest'
import { createContract } from '../../../engine/actions/create-contract'
import type { CreateContractParams } from '../../../engine/actions/create-contract'
import {
  ContractType,
  ContractStatus,
  CorpType,
  ColonyType,
  ShipRole,
  SizeVariant,
  PlanetStatus,
  SectorDensity,
} from '../../../types/common'
import type {
  CorpId,
  ColonyId,
  SectorId,
  PlanetId,
  TurnNumber,
  BPAmount,
} from '../../../types/common'
import type { Corporation } from '../../../types/corporation'
import type { Colony } from '../../../types/colony'
import type { Planet } from '../../../types/planet'
import type { Sector } from '../../../types/sector'

// ─── Test Helpers ─────────────────────────────────────────────────────────────

const TURN_1 = 1 as TurnNumber
const SECTOR_A_ID = 'sec_aaaaaaaa' as SectorId
const SECTOR_B_ID = 'sec_bbbbbbbb' as SectorId
const SECTOR_C_ID = 'sec_cccccccc' as SectorId  // Not adjacent to A
const PLANET_ID = 'pln_aaaaaaaa' as PlanetId
const COLONY_ID = 'col_aaaaaaaa' as ColonyId
const CORP_ID = 'corp_aaaaaa' as CorpId

/** Build a minimal sector. */
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

/** Build a minimal corporation. */
function makeCorp(
  id: CorpId,
  type: CorpType,
  level: number = 1,
): Corporation {
  return {
    id,
    name: 'Test Corp',
    type,
    level,
    capital: 0,
    traits: [],
    homePlanetId: PLANET_ID,
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

/** Build a minimal planet with a given status. */
function makePlanet(id: PlanetId, status: PlanetStatus): Planet {
  return {
    id,
    name: 'Test Planet',
    type: 'Continental' as any,
    size: 'Medium' as any,
    status,
    sectorId: SECTOR_A_ID,
    baseHabitability: 8,
    deposits: [],
    features: [],
    featureModifiers: [],
    orbitScanTurn: null,
    groundSurveyTurn: null,
  }
}

/** Build a minimal colony. */
function makeColony(id: ColonyId): Colony {
  return {
    id,
    name: 'Test Colony',
    type: ColonyType.FrontierColony,
    planetId: PLANET_ID,
    sectorId: SECTOR_A_ID,
    populationLevel: 5,
    infrastructure: {} as any,
    attributes: {
      habitability: 5,
      accessibility: 5,
      dynamism: 5,
      qualityOfLife: 5,
      stability: 5,
      growth: 0,
    },
    corporationsPresent: [],
    modifiers: [],
    foundedTurn: TURN_1,
  }
}

/** Standard adjacency map: A <-> B, C is isolated. */
function makeAdjacency(): Map<string, string[]> {
  return new Map([
    [SECTOR_A_ID, [SECTOR_B_ID]],
    [SECTOR_B_ID, [SECTOR_A_ID]],
    [SECTOR_C_ID, []],
  ])
}

/** Build base params shared by most tests. */
function makeBaseParams(overrides: Partial<CreateContractParams> = {}): CreateContractParams {
  const explCorp = makeCorp(CORP_ID, CorpType.Exploration)
  const planet = makePlanet(PLANET_ID, PlanetStatus.OrbitScanned)
  const sector = makeSector(SECTOR_A_ID)
  const sectorB = makeSector(SECTOR_B_ID)
  const sectorC = makeSector(SECTOR_C_ID)

  return {
    type: ContractType.Exploration,
    target: { type: 'sector', sectorId: SECTOR_A_ID },
    assignedCorpId: CORP_ID,
    currentTurn: TURN_1,
    currentBP: 10 as BPAmount,
    sectors: new Map([
      [SECTOR_A_ID, sector],
      [SECTOR_B_ID, sectorB],
      [SECTOR_C_ID, sectorC],
    ]),
    sectorAdjacency: makeAdjacency(),
    colonies: new Map([[COLONY_ID, makeColony(COLONY_ID)]]),
    planets: new Map([[PLANET_ID, planet]]),
    corporations: new Map([[CORP_ID, explCorp]]),
    ...overrides,
  }
}

// ─── Valid Creation Tests ─────────────────────────────────────────────────────

describe('createContract — valid creation', () => {
  it('creates an Exploration contract with correct fields', () => {
    const result = createContract(makeBaseParams())
    expect(result.success).toBe(true)
    if (!result.success) return
    const { contract } = result
    expect(contract.type).toBe(ContractType.Exploration)
    expect(contract.status).toBe(ContractStatus.Active)
    expect(contract.assignedCorpId).toBe(CORP_ID)
    expect(contract.bpPerTurn).toBe(2)
    expect(contract.startTurn).toBe(TURN_1)
    expect(contract.completedTurn).toBeNull()
    expect(contract.id).toMatch(/^ctr_/)
    expect(contract.turnsRemaining).toBe(contract.durationTurns)
  })

  it('creates a GroundSurvey contract targeting an orbit-scanned planet', () => {
    const planet = makePlanet(PLANET_ID, PlanetStatus.OrbitScanned)
    const result = createContract(
      makeBaseParams({
        type: ContractType.GroundSurvey,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Exploration)]]),
        planets: new Map([[PLANET_ID, planet]]),
      }),
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.type).toBe(ContractType.GroundSurvey)
    expect(result.contract.bpPerTurn).toBe(1)
    expect(result.contract.durationTurns).toBe(2)
  })

  it('creates a GroundSurvey contract targeting an Accepted planet', () => {
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const result = createContract(
      makeBaseParams({
        type: ContractType.GroundSurvey,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Exploration)]]),
        planets: new Map([[PLANET_ID, planet]]),
      }),
    )
    expect(result.success).toBe(true)
  })

  it('creates a Colonization contract with colony type params', () => {
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const constructionCorp = makeCorp(CORP_ID, CorpType.Construction)
    const result = createContract(
      makeBaseParams({
        type: ContractType.Colonization,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, constructionCorp]]),
        planets: new Map([[PLANET_ID, planet]]),
        colonizationParams: { colonyType: ColonyType.FrontierColony },
      }),
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.type).toBe(ContractType.Colonization)
    expect(result.contract.bpPerTurn).toBe(2)         // FrontierColony costs 2 BP/turn
    expect(result.contract.durationTurns).toBe(15)    // FrontierColony takes 15 turns
    expect(result.contract.colonizationParams).toEqual({ colonyType: ColonyType.FrontierColony })
  })

  it('creates a Colonization contract for a GroundSurveyed planet', () => {
    const planet = makePlanet(PLANET_ID, PlanetStatus.GroundSurveyed)
    const constructionCorp = makeCorp(CORP_ID, CorpType.Construction)
    const result = createContract(
      makeBaseParams({
        type: ContractType.Colonization,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, constructionCorp]]),
        planets: new Map([[PLANET_ID, planet]]),
        colonizationParams: { colonyType: ColonyType.MiningOutpost },
      }),
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.durationTurns).toBe(6)     // MiningOutpost takes 6 turns
    expect(result.contract.bpPerTurn).toBe(2)         // MiningOutpost costs 2 BP/turn
  })

  it('creates a ShipCommission contract with ship params', () => {
    const shipbuildingCorp = makeCorp(CORP_ID, CorpType.Shipbuilding)
    const result = createContract(
      makeBaseParams({
        type: ContractType.ShipCommission,
        target: { type: 'colony', colonyId: COLONY_ID },
        corporations: new Map([[CORP_ID, shipbuildingCorp]]),
        shipCommissionParams: { role: ShipRole.Escort, sizeVariant: SizeVariant.Standard },
      }),
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.type).toBe(ContractType.ShipCommission)
    expect(result.contract.shipCommissionParams).toEqual({
      role: ShipRole.Escort,
      sizeVariant: SizeVariant.Standard,
    })
  })

  it('creates a TradeRoute contract between adjacent sectors', () => {
    const transportCorp = makeCorp(CORP_ID, CorpType.Transport)
    const result = createContract(
      makeBaseParams({
        type: ContractType.TradeRoute,
        target: { type: 'sector_pair', sectorIdA: SECTOR_A_ID, sectorIdB: SECTOR_B_ID },
        corporations: new Map([[CORP_ID, transportCorp]]),
      }),
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.type).toBe(ContractType.TradeRoute)
    expect(result.contract.bpPerTurn).toBe(2)
  })

  it('generates a unique contract ID with ctr_ prefix', () => {
    const r1 = createContract(makeBaseParams())
    const r2 = createContract(makeBaseParams())
    expect(r1.success && r2.success).toBe(true)
    if (!r1.success || !r2.success) return
    expect(r1.contract.id).toMatch(/^ctr_/)
    expect(r2.contract.id).toMatch(/^ctr_/)
    expect(r1.contract.id).not.toBe(r2.contract.id)
  })
})

// ─── Exploration Duration by Corp Level ──────────────────────────────────────

// Exploration duration formula: max(2, 4 - floor(corpLevel / 2))
// Level 1: max(2, 4-0)=4, Level 3: max(2, 4-1)=3, Level 4: max(2, 4-2)=2, Level 6+: max(2, ≤2)=2
describe('createContract — exploration duration by corp level', () => {
  it('level 1 corp gets 4 turns exploration duration', () => {
    const result = createContract(makeBaseParams({
      corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Exploration, 1)]]),
    }))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.durationTurns).toBe(4)
  })

  it('level 3 corp gets 3 turns exploration duration', () => {
    const result = createContract(makeBaseParams({
      corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Exploration, 3)]]),
    }))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.durationTurns).toBe(3)
  })

  it('level 4 corp gets 2 turns exploration duration', () => {
    const result = createContract(makeBaseParams({
      corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Exploration, 4)]]),
    }))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.durationTurns).toBe(2)
  })

  it('level 6 corp gets minimum 2 turns exploration duration', () => {
    const result = createContract(makeBaseParams({
      corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Exploration, 6)]]),
    }))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.contract.durationTurns).toBe(2)
  })
})

// ─── Corp Eligibility Tests ───────────────────────────────────────────────────

describe('createContract — corp eligibility', () => {
  it('rejects a wrong-type corp at low level (Industrial trying Exploration)', () => {
    const industrialCorp = makeCorp(CORP_ID, CorpType.Industrial, 1)
    const result = createContract(
      makeBaseParams({
        corporations: new Map([[CORP_ID, industrialCorp]]),
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('CORP_NOT_ELIGIBLE')
  })

  it('rejects a wrong-type level 2 corp (below cross-type threshold)', () => {
    const industrialCorp = makeCorp(CORP_ID, CorpType.Industrial, 2)
    const result = createContract(
      makeBaseParams({
        corporations: new Map([[CORP_ID, industrialCorp]]),
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('CORP_NOT_ELIGIBLE')
  })

  it('allows a level 3+ non-Exploration corp to run Exploration (cross-type)', () => {
    const industrialLevel3 = makeCorp(CORP_ID, CorpType.Industrial, 3)
    const result = createContract(
      makeBaseParams({
        corporations: new Map([[CORP_ID, industrialLevel3]]),
      }),
    )
    expect(result.success).toBe(true)
  })

  it('allows a level 3+ non-Exploration corp to run GroundSurvey (cross-type)', () => {
    const planet = makePlanet(PLANET_ID, PlanetStatus.OrbitScanned)
    const industrialLevel4 = makeCorp(CORP_ID, CorpType.Industrial, 4)
    const result = createContract(
      makeBaseParams({
        type: ContractType.GroundSurvey,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, industrialLevel4]]),
        planets: new Map([[PLANET_ID, planet]]),
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects level 3+ Industrial corp from Colonization (specialized — Construction only)', () => {
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const industrialLevel5 = makeCorp(CORP_ID, CorpType.Industrial, 5)
    const result = createContract(
      makeBaseParams({
        type: ContractType.Colonization,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, industrialLevel5]]),
        planets: new Map([[PLANET_ID, planet]]),
        colonizationParams: { colonyType: ColonyType.FrontierColony },
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('CORP_NOT_ELIGIBLE')
  })

  it('rejects level 3+ Industrial corp from TradeRoute (Transport only, no cross-type)', () => {
    const industrialLevel4 = makeCorp(CORP_ID, CorpType.Industrial, 4)
    const result = createContract(
      makeBaseParams({
        type: ContractType.TradeRoute,
        target: { type: 'sector_pair', sectorIdA: SECTOR_A_ID, sectorIdB: SECTOR_B_ID },
        corporations: new Map([[CORP_ID, industrialLevel4]]),
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('CORP_NOT_ELIGIBLE')
  })

  it('allows a Megacorp (level 6+) to run any contract type including Colonization', () => {
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const megacorp = makeCorp(CORP_ID, CorpType.Industrial, 6)
    const result = createContract(
      makeBaseParams({
        type: ContractType.Colonization,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, megacorp]]),
        planets: new Map([[PLANET_ID, planet]]),
        colonizationParams: { colonyType: ColonyType.FrontierColony },
      }),
    )
    expect(result.success).toBe(true)
  })
})

// ─── Insufficient BP Tests ────────────────────────────────────────────────────

describe('createContract — insufficient BP', () => {
  it('rejects when player has 0 BP and contract costs 2 BP/turn', () => {
    const result = createContract(
      makeBaseParams({ currentBP: 0 as BPAmount }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('INSUFFICIENT_BP')
  })

  it('rejects when player has 1 BP and contract costs 2 BP/turn', () => {
    const result = createContract(
      makeBaseParams({ currentBP: 1 as BPAmount }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('INSUFFICIENT_BP')
  })

  it('allows when player has exactly the BP/turn amount', () => {
    const result = createContract(
      makeBaseParams({ currentBP: 2 as BPAmount }),
    )
    expect(result.success).toBe(true)
  })
})

// ─── Invalid Target Tests ─────────────────────────────────────────────────────

describe('createContract — invalid target', () => {
  it('rejects when target type does not match contract type (sector for GroundSurvey)', () => {
    const result = createContract(
      makeBaseParams({
        type: ContractType.GroundSurvey,
        target: { type: 'sector', sectorId: SECTOR_A_ID },
        corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Exploration)]]),
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('INVALID_TARGET_TYPE')
  })

  it('rejects when target sector does not exist in the sectors map', () => {
    const unknownSector = 'sec_zzzzzzzz' as SectorId
    const result = createContract(
      makeBaseParams({
        target: { type: 'sector', sectorId: unknownSector },
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('TARGET_NOT_FOUND')
  })

  it('rejects when planet does not exist in the planets map', () => {
    const unknownPlanet = 'pln_zzzzzzzz' as PlanetId
    const result = createContract(
      makeBaseParams({
        type: ContractType.GroundSurvey,
        target: { type: 'planet', planetId: unknownPlanet },
        corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Exploration)]]),
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('TARGET_NOT_FOUND')
  })

  it('rejects GroundSurvey on a planet with Undiscovered status', () => {
    const undiscoveredPlanet = makePlanet(PLANET_ID, PlanetStatus.Undiscovered)
    const result = createContract(
      makeBaseParams({
        type: ContractType.GroundSurvey,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Exploration)]]),
        planets: new Map([[PLANET_ID, undiscoveredPlanet]]),
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('INVALID_PLANET_STATUS')
  })

  it('rejects Colonization on an OrbitScanned (not yet accepted) planet', () => {
    const orbitScannedPlanet = makePlanet(PLANET_ID, PlanetStatus.OrbitScanned)
    const result = createContract(
      makeBaseParams({
        type: ContractType.Colonization,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Construction)]]),
        planets: new Map([[PLANET_ID, orbitScannedPlanet]]),
        colonizationParams: { colonyType: ColonyType.FrontierColony },
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('INVALID_PLANET_STATUS')
  })

  it('rejects Colonization on a Rejected planet', () => {
    const rejectedPlanet = makePlanet(PLANET_ID, PlanetStatus.Rejected)
    const result = createContract(
      makeBaseParams({
        type: ContractType.Colonization,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, makeCorp(CORP_ID, CorpType.Construction)]]),
        planets: new Map([[PLANET_ID, rejectedPlanet]]),
        colonizationParams: { colonyType: ColonyType.FrontierColony },
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('INVALID_PLANET_STATUS')
  })

  it('rejects TradeRoute between non-adjacent sectors', () => {
    const transportCorp = makeCorp(CORP_ID, CorpType.Transport)
    const result = createContract(
      makeBaseParams({
        type: ContractType.TradeRoute,
        target: { type: 'sector_pair', sectorIdA: SECTOR_A_ID, sectorIdB: SECTOR_C_ID },
        corporations: new Map([[CORP_ID, transportCorp]]),
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('SECTORS_NOT_ADJACENT')
  })
})

// ─── Missing Corp Tests ───────────────────────────────────────────────────────

describe('createContract — corp not found', () => {
  it('rejects when the assigned corp ID does not exist in the corporations map', () => {
    const unknownCorpId = 'corp_zzzzzz' as CorpId
    const result = createContract(
      makeBaseParams({
        assignedCorpId: unknownCorpId,
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('CORP_NOT_FOUND')
  })
})

// ─── Missing Required Params Tests ────────────────────────────────────────────

describe('createContract — missing required params', () => {
  it('rejects Colonization when colonizationParams is not provided', () => {
    const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
    const constructionCorp = makeCorp(CORP_ID, CorpType.Construction)
    const result = createContract(
      makeBaseParams({
        type: ContractType.Colonization,
        target: { type: 'planet', planetId: PLANET_ID },
        corporations: new Map([[CORP_ID, constructionCorp]]),
        planets: new Map([[PLANET_ID, planet]]),
        // colonizationParams intentionally omitted
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('MISSING_COLONY_TYPE')
  })

  it('rejects ShipCommission when shipCommissionParams is not provided', () => {
    const shipbuildingCorp = makeCorp(CORP_ID, CorpType.Shipbuilding)
    const result = createContract(
      makeBaseParams({
        type: ContractType.ShipCommission,
        target: { type: 'colony', colonyId: COLONY_ID },
        corporations: new Map([[CORP_ID, shipbuildingCorp]]),
        // shipCommissionParams intentionally omitted
      }),
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('MISSING_SHIP_PARAMS')
  })
})

// ─── Colonization Cost by Colony Type ────────────────────────────────────────

describe('createContract — colonization costs by colony type', () => {
  const testCases: Array<{ colonyType: ColonyType; expectedBP: number; expectedDuration: number }> = [
    { colonyType: ColonyType.FrontierColony, expectedBP: 2, expectedDuration: 15 },
    { colonyType: ColonyType.MiningOutpost, expectedBP: 2, expectedDuration: 6 },
    { colonyType: ColonyType.ScienceOutpost, expectedBP: 3, expectedDuration: 10 },
    { colonyType: ColonyType.MilitaryOutpost, expectedBP: 3, expectedDuration: 8 },
  ]

  for (const { colonyType, expectedBP, expectedDuration } of testCases) {
    it(`${colonyType}: costs ${expectedBP} BP/turn for ${expectedDuration} turns`, () => {
      const planet = makePlanet(PLANET_ID, PlanetStatus.Accepted)
      const constructionCorp = makeCorp(CORP_ID, CorpType.Construction)
      const result = createContract(
        makeBaseParams({
          type: ContractType.Colonization,
          target: { type: 'planet', planetId: PLANET_ID },
          corporations: new Map([[CORP_ID, constructionCorp]]),
          planets: new Map([[PLANET_ID, planet]]),
          colonizationParams: { colonyType },
          currentBP: 10 as BPAmount,
        }),
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.contract.bpPerTurn).toBe(expectedBP)
      expect(result.contract.durationTurns).toBe(expectedDuration)
      expect(result.contract.turnsRemaining).toBe(expectedDuration)
    })
  }
})
