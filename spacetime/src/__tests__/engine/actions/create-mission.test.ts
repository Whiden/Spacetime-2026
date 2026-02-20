/**
 * create-mission.test.ts — Unit tests for mission creation engine action.
 *
 * Story 16.1 — Mission Creation.
 *
 * Tests cover:
 * - Valid creation (basic case)
 * - NO_SHIPS_SELECTED — empty ship list
 * - SECTOR_NOT_FOUND — target sector not in galaxy
 * - SHIP_NOT_FOUND — shipId not in state.ships
 * - SHIP_NOT_AVAILABLE — ship status is not Stationed
 * - SHIP_NOT_GOVERNMENT — ship not owned by government
 * - Cost calculation: base cost only (no surcharge)
 * - Cost calculation: fleet surcharge (+1 per ship with size ≥ 7)
 * - Commander selection by experience level (highest wins)
 * - Travel time equals hop count between home sector and target
 * - Execution duration within type's [min, max] range
 * - Ship statuses set to OnMission on success
 * - travelTurnsRemaining equals returnTurnsRemaining (same distance)
 */

import { describe, it, expect } from 'vitest'
import { createMission } from '../../../engine/actions/create-mission'
import {
  MissionType,
  MissionPhase,
  ShipStatus,
  ShipRole,
  SizeVariant,
  CaptainExperience,
  SectorDensity,
  PlanetType,
  PlanetSize,
  PlanetStatus,
  ColonyType,
  CorpType,
} from '../../../types/common'
import type {
  ShipId,
  SectorId,
  TurnNumber,
  CaptainId,
  CorpId,
} from '../../../types/common'
import type { Ship } from '../../../types/ship'
import type { GameState } from '../../../types/game'
import type { Sector } from '../../../types/sector'

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const TURN_1 = 1 as TurnNumber
const SECTOR_A = 'sec_aaaaaaaa' as SectorId   // home sector
const SECTOR_B = 'sec_bbbbbbbb' as SectorId   // 1 hop from A
const SECTOR_C = 'sec_cccccccc' as SectorId   // 2 hops from A (A→B→C)
const SHIP_1   = 'ship_0001' as ShipId
const SHIP_2   = 'ship_0002' as ShipId
const CAPTAIN_1 = 'cpt_0001' as CaptainId
const CAPTAIN_2 = 'cpt_0002' as CaptainId

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function makeShip(
  id: ShipId,
  overrides: Partial<{
    status: ShipStatus
    ownerCorpId: string
    size: number
    captainId: CaptainId
    captainExperience: CaptainExperience
    homeSectorId: SectorId
  }> = {},
): Ship {
  const captainId = overrides.captainId ?? CAPTAIN_1
  const captainExperience = overrides.captainExperience ?? CaptainExperience.Green
  return {
    id,
    name: 'Test Ship',
    role: ShipRole.SystemPatrol,
    sizeVariant: SizeVariant.Standard,
    primaryStats: {
      size: overrides.size ?? 3,
      speed: 5,
      firepower: 3,
      armor: 3,
      sensors: 4,
      evasion: 5,
    },
    derivedStats: {
      hullPoints: 45,
      powerProjection: 4,
      bpPerTurn: 1,
      buildTimeTurns: 3,
    },
    abilities: { fight: 5, investigation: 4, support: 3 },
    condition: 100,
    captain: {
      id: captainId,
      name: 'Test Captain',
      experience: captainExperience,
      missionsCompleted: 0,
      battlesCount: 0,
    },
    serviceRecord: {
      shipId: id,
      builtTurn: TURN_1,
      builtByCorpId: 'corp_test' as CorpId,
      missionsCompleted: 0,
      battlesCount: 0,
      destroyed: false,
      destroyedTurn: null,
    },
    status: overrides.status ?? ShipStatus.Stationed,
    homeSectorId: overrides.homeSectorId ?? SECTOR_A,
    ownerCorpId: (overrides.ownerCorpId ?? 'government') as CorpId | 'government',
    modifiers: [],
    appliedSchematicIds: [],
    builtTurn: TURN_1,
  }
}

/**
 * Builds a minimal GameState with the given sectors (A→B→C chain) and ships.
 */
function makeState(ships: Map<string, Ship>): GameState {
  const sectors = new Map([
    [SECTOR_A, makeSector(SECTOR_A)],
    [SECTOR_B, makeSector(SECTOR_B)],
    [SECTOR_C, makeSector(SECTOR_C)],
  ])

  // A <-> B <-> C
  const adjacency = new Map<SectorId, SectorId[]>([
    [SECTOR_A, [SECTOR_B]],
    [SECTOR_B, [SECTOR_A, SECTOR_C]],
    [SECTOR_C, [SECTOR_B]],
  ])

  return {
    turn: TURN_1,
    phase: 'player_action',
    currentBP: 20 as any,
    debtTokens: 0,
    budget: {} as any,
    empireBonuses: {} as any,
    galaxy: { sectors, adjacency, startingSectorId: SECTOR_A },
    colonies: new Map(),
    planets: new Map(),
    corporations: new Map(),
    contracts: new Map(),
    ships,
    missions: new Map(),
    scienceDomains: new Map(),
    discoveries: new Map(),
    schematics: new Map(),
    patents: new Map(),
    sectorMarkets: new Map(),
    tradeRoutes: [],
    events: [],
    startedAt: '',
    lastSavedAt: '',
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createMission', () => {
  // ── Validation errors ──────────────────────────────────────────────────────

  it('returns NO_SHIPS_SELECTED when shipIds is empty', () => {
    const state = makeState(new Map())
    const result = createMission(
      { missionType: MissionType.Assault, targetSectorId: SECTOR_B, shipIds: [] },
      state,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('NO_SHIPS_SELECTED')
  })

  it('returns SECTOR_NOT_FOUND when targetSectorId does not exist', () => {
    const ship = makeShip(SHIP_1)
    const state = makeState(new Map([[SHIP_1, ship]]))
    const missingId = 'sec_missing0' as SectorId
    const result = createMission(
      { missionType: MissionType.Assault, targetSectorId: missingId, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('SECTOR_NOT_FOUND')
  })

  it('returns SHIP_NOT_FOUND when a shipId is not in state.ships', () => {
    const state = makeState(new Map())
    const result = createMission(
      { missionType: MissionType.Assault, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('SHIP_NOT_FOUND')
  })

  it('returns SHIP_NOT_AVAILABLE when ship is OnMission', () => {
    const ship = makeShip(SHIP_1, { status: ShipStatus.OnMission })
    const state = makeState(new Map([[SHIP_1, ship]]))
    const result = createMission(
      { missionType: MissionType.Assault, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('SHIP_NOT_AVAILABLE')
  })

  it('returns SHIP_NOT_AVAILABLE when ship is UnderRepair', () => {
    const ship = makeShip(SHIP_1, { status: ShipStatus.UnderRepair })
    const state = makeState(new Map([[SHIP_1, ship]]))
    const result = createMission(
      { missionType: MissionType.Investigation, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('SHIP_NOT_AVAILABLE')
  })

  it('returns SHIP_NOT_GOVERNMENT when ship is corp-owned', () => {
    const ship = makeShip(SHIP_1, { ownerCorpId: 'corp_aaaaaa' })
    const state = makeState(new Map([[SHIP_1, ship]]))
    const result = createMission(
      { missionType: MissionType.Escort, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('SHIP_NOT_GOVERNMENT')
  })

  // ── Valid creation ─────────────────────────────────────────────────────────

  it('returns a valid mission on success', () => {
    const ship = makeShip(SHIP_1)
    const state = makeState(new Map([[SHIP_1, ship]]))
    const result = createMission(
      { missionType: MissionType.Assault, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.mission.type).toBe(MissionType.Assault)
      expect(result.mission.targetSectorId).toBe(SECTOR_B)
      expect(result.mission.phase).toBe(MissionPhase.Travel)
      expect(result.mission.completedTurn).toBeNull()
      expect(result.mission.report).toBeNull()
      expect(result.mission.taskForce.shipIds).toContain(SHIP_1)
    }
  })

  // ── Travel time ────────────────────────────────────────────────────────────

  it('sets travelTurnsRemaining = 1 when target is 1 hop away', () => {
    const ship = makeShip(SHIP_1, { homeSectorId: SECTOR_A })
    const state = makeState(new Map([[SHIP_1, ship]]))
    const result = createMission(
      { missionType: MissionType.Defense, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.mission.travelTurnsRemaining).toBe(1)
      expect(result.mission.returnTurnsRemaining).toBe(1) // same distance back
    }
  })

  it('sets travelTurnsRemaining = 2 when target is 2 hops away', () => {
    const ship = makeShip(SHIP_1, { homeSectorId: SECTOR_A })
    const state = makeState(new Map([[SHIP_1, ship]]))
    const result = createMission(
      { missionType: MissionType.Rescue, targetSectorId: SECTOR_C, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.mission.travelTurnsRemaining).toBe(2)
      expect(result.mission.returnTurnsRemaining).toBe(2)
    }
  })

  it('sets travelTurnsRemaining = 0 when target is the home sector', () => {
    const ship = makeShip(SHIP_1, { homeSectorId: SECTOR_A })
    const state = makeState(new Map([[SHIP_1, ship]]))
    const result = createMission(
      { missionType: MissionType.Defense, targetSectorId: SECTOR_A, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.mission.travelTurnsRemaining).toBe(0)
    }
  })

  // ── Cost calculation ───────────────────────────────────────────────────────

  it('calculates base cost for Assault mission with no surcharge ships', () => {
    // Assault base = 3; ship size 3 < 7, no surcharge
    const ship = makeShip(SHIP_1, { size: 3 })
    const state = makeState(new Map([[SHIP_1, ship]]))
    const result = createMission(
      { missionType: MissionType.Assault, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) expect(result.mission.bpPerTurn).toBe(3)
  })

  it('adds fleet surcharge of +1 per ship with size >= 7', () => {
    // Defense base = 2; two ships: size 7 (+1) and size 3 (+0) → total 3
    const bigShip = makeShip(SHIP_1, { size: 7 })
    const smallShip = makeShip(SHIP_2, { size: 3 })
    const state = makeState(new Map([[SHIP_1, bigShip], [SHIP_2, smallShip]]))
    const result = createMission(
      { missionType: MissionType.Defense, targetSectorId: SECTOR_B, shipIds: [SHIP_1, SHIP_2] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) expect(result.mission.bpPerTurn).toBe(3) // 2 base + 1 surcharge
  })

  it('adds surcharge for each large ship independently', () => {
    // Investigation base = 1; two ships size 9 → 2 surcharges → total 3
    const ship1 = makeShip(SHIP_1, { size: 9 })
    const ship2 = makeShip(SHIP_2, { size: 9 })
    const state = makeState(new Map([[SHIP_1, ship1], [SHIP_2, ship2]]))
    const result = createMission(
      { missionType: MissionType.Investigation, targetSectorId: SECTOR_B, shipIds: [SHIP_1, SHIP_2] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) expect(result.mission.bpPerTurn).toBe(3) // 1 base + 2 surcharge
  })

  // ── Commander selection ────────────────────────────────────────────────────

  it('selects the highest-experience captain as commander (Veteran wins over Green)', () => {
    const greenShip = makeShip(SHIP_1, { captainId: CAPTAIN_1, captainExperience: CaptainExperience.Green })
    const vetShip = makeShip(SHIP_2, {
      captainId: CAPTAIN_2,
      captainExperience: CaptainExperience.Veteran,
    })
    const state = makeState(new Map([[SHIP_1, greenShip], [SHIP_2, vetShip]]))
    const result = createMission(
      { missionType: MissionType.Rescue, targetSectorId: SECTOR_B, shipIds: [SHIP_1, SHIP_2] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.mission.taskForce.commanderCaptainId).toBe(CAPTAIN_2)
    }
  })

  it('selects the first captain when both have equal experience', () => {
    const ship1 = makeShip(SHIP_1, { captainId: CAPTAIN_1, captainExperience: CaptainExperience.Regular })
    const ship2 = makeShip(SHIP_2, { captainId: CAPTAIN_2, captainExperience: CaptainExperience.Regular })
    const state = makeState(new Map([[SHIP_1, ship1], [SHIP_2, ship2]]))
    const result = createMission(
      { missionType: MissionType.Escort, targetSectorId: SECTOR_B, shipIds: [SHIP_1, SHIP_2] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) {
      // First ship's captain is commander when tied
      expect(result.mission.taskForce.commanderCaptainId).toBe(CAPTAIN_1)
    }
  })

  // ── Execution duration ─────────────────────────────────────────────────────

  it('execution duration is within the Assault range [3, 8]', () => {
    const ship = makeShip(SHIP_1)
    const state = makeState(new Map([[SHIP_1, ship]]))
    // Run many times to check bounds
    for (let i = 0; i < 50; i++) {
      const result = createMission(
        { missionType: MissionType.Assault, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
        state,
      )
      if (result.success) {
        expect(result.mission.executionTurnsRemaining).toBeGreaterThanOrEqual(3)
        expect(result.mission.executionTurnsRemaining).toBeLessThanOrEqual(8)
      }
    }
  })

  it('execution duration is within the Investigation range [2, 4]', () => {
    const ship = makeShip(SHIP_1)
    const state = makeState(new Map([[SHIP_1, ship]]))
    for (let i = 0; i < 50; i++) {
      const result = createMission(
        { missionType: MissionType.Investigation, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
        state,
      )
      if (result.success) {
        expect(result.mission.executionTurnsRemaining).toBeGreaterThanOrEqual(2)
        expect(result.mission.executionTurnsRemaining).toBeLessThanOrEqual(4)
      }
    }
  })

  // ── Ship status update ─────────────────────────────────────────────────────

  it('sets all task force ships to OnMission in updatedShips', () => {
    const ship1 = makeShip(SHIP_1)
    const ship2 = makeShip(SHIP_2)
    const state = makeState(new Map([[SHIP_1, ship1], [SHIP_2, ship2]]))
    const result = createMission(
      { missionType: MissionType.Defense, targetSectorId: SECTOR_B, shipIds: [SHIP_1, SHIP_2] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.updatedShips.get(SHIP_1)?.status).toBe(ShipStatus.OnMission)
      expect(result.updatedShips.get(SHIP_2)?.status).toBe(ShipStatus.OnMission)
    }
  })

  it('does not mutate the original state.ships map', () => {
    const ship = makeShip(SHIP_1)
    const state = makeState(new Map([[SHIP_1, ship]]))
    createMission(
      { missionType: MissionType.Assault, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
      state,
    )
    // Original ship should still be Stationed
    expect(state.ships.get(SHIP_1)?.status).toBe(ShipStatus.Stationed)
  })

  // ── Mission ID ─────────────────────────────────────────────────────────────

  it('generates a unique mission ID with msn_ prefix', () => {
    const ship = makeShip(SHIP_1)
    const state = makeState(new Map([[SHIP_1, ship]]))
    const result = createMission(
      { missionType: MissionType.Assault, targetSectorId: SECTOR_B, shipIds: [SHIP_1] },
      state,
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.mission.id).toMatch(/^msn_/)
    }
  })
})
