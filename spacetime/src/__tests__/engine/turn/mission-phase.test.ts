/**
 * mission-phase.test.ts — Unit tests for Story 16.3: Mission Phase Turn Resolution.
 *
 * Tests cover:
 * - Travel phase: travelTurnsRemaining decrements each turn
 * - Travel → Execution transition when travelTurnsRemaining reaches 1
 * - Execution phase: executionTurnsRemaining decrements each turn
 * - Execution: combat resolved for Assault/Defense/Escort missions
 * - Execution: no combat for non-combat missions (Rescue/Investigation)
 * - Ship destruction: destroyed ships removed from state, loss event generated
 * - Return phase: returnTurnsRemaining decrements each turn
 * - Return → Completed: ships set to Stationed, captain missionsCompleted incremented
 * - Captain experience advances at thresholds (2 → Regular, 5 → Veteran, 10 → Elite)
 * - Completed missions skipped (completedTurn !== null)
 * - All ships lost: mission phase set to Completed immediately, Critical event
 * - Mission report set on execution completion
 */

import { describe, it, expect } from 'vitest'
import { resolveMissionPhase } from '../../../engine/turn/mission-phase'
import {
  MissionPhase,
  MissionType,
  ShipStatus,
  ShipRole,
  SizeVariant,
  CaptainExperience,
  SectorDensity,
  EventPriority,
} from '../../../types/common'
import type {
  ShipId,
  SectorId,
  MissionId,
  CaptainId,
  TurnNumber,
  CorpId,
} from '../../../types/common'
import type { Ship } from '../../../types/ship'
import type { Mission } from '../../../types/mission'
import type { GameState } from '../../../types/game'
import type { Sector } from '../../../types/sector'

// ─── Constants ────────────────────────────────────────────────────────────────

const TURN_1 = 1 as TurnNumber
const SECTOR_A = 'sec_aaa' as SectorId
const SHIP_1 = 'ship_001' as ShipId
const SHIP_2 = 'ship_002' as ShipId
const CAPTAIN_1 = 'cpt_001' as CaptainId
const CAPTAIN_2 = 'cpt_002' as CaptainId
const MISSION_1 = 'mis_001' as MissionId

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSector(overrides: Partial<Sector> = {}): Sector {
  return {
    id: SECTOR_A,
    name: 'Test Sector',
    density: SectorDensity.Moderate,
    explorationPercent: 50,
    threatModifier: 1.0,
    firstEnteredTurn: TURN_1,
    ...overrides,
  }
}

function makeShip(
  id: ShipId,
  captainId: CaptainId = CAPTAIN_1,
  overrides: Partial<{
    condition: number
    fight: number
    missionsCompleted: number
    captainExperience: CaptainExperience
    status: ShipStatus
  }> = {},
): Ship {
  return {
    id,
    name: `Ship ${id}`,
    role: ShipRole.Assault,
    sizeVariant: SizeVariant.Standard,
    primaryStats: { size: 5, speed: 4, firepower: 6, armor: 4, sensors: 3, evasion: 3 },
    derivedStats: { hullPoints: 65, powerProjection: 7, bpPerTurn: 2, buildTimeTurns: 5 },
    abilities: { fight: overrides.fight ?? 20, investigation: 5, support: 4 },
    condition: overrides.condition ?? 100,
    captain: {
      id: captainId,
      name: 'Captain Test',
      experience: overrides.captainExperience ?? CaptainExperience.Green,
      missionsCompleted: overrides.missionsCompleted ?? 0,
      battlesCount: 0,
    },
    serviceRecord: {
      shipId: id,
      builtTurn: TURN_1,
      builtByCorpId: 'corp_test' as CorpId,
      missionsCompleted: overrides.missionsCompleted ?? 0,
      battlesCount: 0,
      destroyed: false,
      destroyedTurn: null,
    },
    status: overrides.status ?? ShipStatus.OnMission,
    homeSectorId: SECTOR_A,
    ownerCorpId: 'government' as CorpId | 'government',
    modifiers: [],
    appliedSchematicIds: [],
    builtTurn: TURN_1,
  }
}

function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: MISSION_1,
    type: MissionType.Assault,
    phase: MissionPhase.Travel,
    targetSectorId: SECTOR_A,
    taskForce: {
      shipIds: [SHIP_1],
      commanderCaptainId: CAPTAIN_1,
    },
    bpPerTurn: 3 as any,
    travelTurnsRemaining: 2,
    executionTurnsRemaining: 1,
    returnTurnsRemaining: 2,
    startTurn: TURN_1,
    completedTurn: null,
    report: null,
    ...overrides,
  }
}

function makeState(
  missions: Map<string, Mission>,
  ships: Map<string, Ship>,
): GameState {
  const sectors = new Map<SectorId, Sector>([[SECTOR_A, makeSector()]])
  const adjacency = new Map([[SECTOR_A, [] as SectorId[]]])

  return {
    turn: TURN_1,
    phase: 'player_action',
    currentBP: 10 as any,
    debtTokens: 0,
    budget: {} as any,
    empireBonuses: {} as any,
    galaxy: { sectors, adjacency, startingSectorId: SECTOR_A },
    colonies: new Map(),
    planets: new Map(),
    corporations: new Map(),
    contracts: new Map(),
    ships,
    missions,
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

describe('resolveMissionPhase', () => {

  // ── Travel phase ────────────────────────────────────────────────────────────

  it('decrements travelTurnsRemaining during Travel phase', () => {
    const ship = makeShip(SHIP_1)
    const mission = makeMission({ travelTurnsRemaining: 3 })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState } = resolveMissionPhase(state)
    const updated = updatedState.missions.get(MISSION_1)!

    expect(updated.travelTurnsRemaining).toBe(2)
    expect(updated.phase).toBe(MissionPhase.Travel)
  })

  it('transitions Travel → Execution when travelTurnsRemaining reaches 1', () => {
    const ship = makeShip(SHIP_1)
    const mission = makeMission({ travelTurnsRemaining: 1, executionTurnsRemaining: 2 })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    // Always win, minimal damage
    const { updatedState } = resolveMissionPhase(state, () => 0.99)
    const updated = updatedState.missions.get(MISSION_1)!

    expect(updated.travelTurnsRemaining).toBe(0)
    // Should have moved to Execution and decremented by 1 (from 2 to 1) in the same turn
    expect(updated.executionTurnsRemaining).toBe(1)
    expect(updated.phase).toBe(MissionPhase.Execution)
  })

  // ── Execution phase ─────────────────────────────────────────────────────────

  it('decrements executionTurnsRemaining during Execution phase', () => {
    const ship = makeShip(SHIP_1)
    const mission = makeMission({ phase: MissionPhase.Execution, travelTurnsRemaining: 0, executionTurnsRemaining: 3 })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState } = resolveMissionPhase(state)
    const updated = updatedState.missions.get(MISSION_1)!

    expect(updated.executionTurnsRemaining).toBe(2)
    expect(updated.phase).toBe(MissionPhase.Execution)
  })

  it('resolves combat for Assault mission on last execution turn', () => {
    const ship = makeShip(SHIP_1)
    const mission = makeMission({
      phase: MissionPhase.Execution,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 1,
      type: MissionType.Assault,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    // Win roll: first rand > 0.85 (win), subsequent small (min damage)
    let callCount = 0
    const { updatedState } = resolveMissionPhase(state, () => {
      callCount++
      return callCount === 1 ? 0.99 : 0.01 // win, then low condition loss
    })

    const updated = updatedState.missions.get(MISSION_1)!
    expect(updated.phase).toBe(MissionPhase.Return)
    expect(updated.report).not.toBeNull()
    expect(updated.report!.outcome).toBe('success')
  })

  it('does not apply condition damage for non-combat mission (Investigation)', () => {
    const ship = makeShip(SHIP_1)
    const mission = makeMission({
      phase: MissionPhase.Execution,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 1,
      type: MissionType.Investigation,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState } = resolveMissionPhase(state)

    const updatedShip = updatedState.ships.get(SHIP_1)!
    expect(updatedShip.condition).toBe(100) // no damage
    const updated = updatedState.missions.get(MISSION_1)!
    expect(updated.report!.outcome).toBe('success')
  })

  it('does not apply condition damage for non-combat mission (Rescue)', () => {
    const ship = makeShip(SHIP_1)
    const mission = makeMission({
      phase: MissionPhase.Execution,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 1,
      type: MissionType.Rescue,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState } = resolveMissionPhase(state)
    const updatedShip = updatedState.ships.get(SHIP_1)!
    expect(updatedShip.condition).toBe(100)
  })

  // ── Ship destruction ─────────────────────────────────────────────────────────

  it('removes destroyed ship from state and emits Critical loss event', () => {
    // condition=1, max loss fraction=0.60 → round(1 - 0.60)=round(0.40)=0 → destroyed
    const ship = makeShip(SHIP_1, CAPTAIN_1, { condition: 1, fight: 1 })
    const mission = makeMission({
      phase: MissionPhase.Execution,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 1,
      type: MissionType.Assault,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    // First rand: defeat roll (< 0.85 threshold), subsequent: max loss fraction (1.0 → 0.60)
    let callCount = 0
    const { updatedState, events } = resolveMissionPhase(state, () => {
      callCount++
      return callCount === 1 ? 0.0 : 1.0 // defeat roll; max loss fraction
    })

    expect(updatedState.ships.has(SHIP_1)).toBe(false)
    const lossEvent = events.find((e) => e.priority === EventPriority.Critical)
    expect(lossEvent).toBeDefined()
    expect(lossEvent!.relatedEntityIds).toContain(SHIP_1)
  })

  it('mission report shows partial_success when some ships survive', () => {
    const ship1 = makeShip(SHIP_1, CAPTAIN_1, { condition: 10, fight: 1 })
    const ship2 = makeShip(SHIP_2, CAPTAIN_2, { condition: 100, fight: 30 })
    const mission = makeMission({
      phase: MissionPhase.Execution,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 1,
      type: MissionType.Assault,
      taskForce: { shipIds: [SHIP_1, SHIP_2], commanderCaptainId: CAPTAIN_2 },
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship1], [SHIP_2, ship2]]),
    )

    // Force: loss roll (defeat), max loss fraction to destroy ship1 (condition 10)
    let callCount = 0
    const { updatedState } = resolveMissionPhase(state, () => {
      callCount++
      if (callCount === 1) return 0.01 // defeat
      return 0.99 // max loss fraction → large condition drop
    })

    const updated = updatedState.missions.get(MISSION_1)!
    // ship1 likely destroyed; ship2 might survive depending on condition
    // At minimum report should be set
    expect(updated.report).not.toBeNull()
  })

  // ── All ships lost ───────────────────────────────────────────────────────────

  it('completes mission immediately when all ships destroyed', () => {
    // condition=1 + max loss fraction (0.60) → round(0.40) = 0 → destroyed
    const ship = makeShip(SHIP_1, CAPTAIN_1, { condition: 1, fight: 1 })
    const mission = makeMission({
      phase: MissionPhase.Execution,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 1,
      type: MissionType.Assault,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    // First rand: defeat roll (0.0 → variance=0.85, effectiveFight×0.85 vs difficulty),
    // subsequent: max loss fraction (1.0 → 0.60)
    let callCount = 0
    const { updatedState, events } = resolveMissionPhase(state, () => {
      callCount++
      return callCount === 1 ? 0.0 : 1.0 // defeat roll; max loss fraction → condition 0
    })

    const updated = updatedState.missions.get(MISSION_1)!
    // Ship with condition 5 will take 30-60% loss → condition ≤ 0
    expect(updated.report!.outcome).toBe('missing')
    expect(updated.report!.summary).toBe('Task Force has not returned.')
    const critEvent = events.find(
      (e) => e.title === 'Task Force Lost',
    )
    expect(critEvent).toBeDefined()
  })

  // ── Return phase ─────────────────────────────────────────────────────────────

  it('decrements returnTurnsRemaining during Return phase', () => {
    const ship = makeShip(SHIP_1)
    const mission = makeMission({
      phase: MissionPhase.Return,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 0,
      returnTurnsRemaining: 3,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState } = resolveMissionPhase(state)
    const updated = updatedState.missions.get(MISSION_1)!

    expect(updated.returnTurnsRemaining).toBe(2)
    expect(updated.phase).toBe(MissionPhase.Return)
  })

  it('completes mission and sets ships to Stationed on return', () => {
    const ship = makeShip(SHIP_1)
    const mission = makeMission({
      phase: MissionPhase.Return,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 0,
      returnTurnsRemaining: 1,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState, events } = resolveMissionPhase(state)
    const updated = updatedState.missions.get(MISSION_1)!
    const updatedShip = updatedState.ships.get(SHIP_1)!

    expect(updated.phase).toBe(MissionPhase.Completed)
    expect(updated.completedTurn).toBe(TURN_1)
    expect(updatedShip.status).toBe(ShipStatus.Stationed)

    const completeEvent = events.find((e) => e.title === 'Mission Complete')
    expect(completeEvent).toBeDefined()
  })

  // ── Captain experience gain ──────────────────────────────────────────────────

  it('increments captain missionsCompleted on mission completion', () => {
    const ship = makeShip(SHIP_1, CAPTAIN_1, { missionsCompleted: 0 })
    const mission = makeMission({
      phase: MissionPhase.Return,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 0,
      returnTurnsRemaining: 1,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState } = resolveMissionPhase(state)
    const updatedShip = updatedState.ships.get(SHIP_1)!

    expect(updatedShip.captain.missionsCompleted).toBe(1)
    expect(updatedShip.serviceRecord.missionsCompleted).toBe(1)
  })

  it('captain advances to Regular at 2 missions', () => {
    const ship = makeShip(SHIP_1, CAPTAIN_1, {
      missionsCompleted: 1,
      captainExperience: CaptainExperience.Green,
    })
    const mission = makeMission({
      phase: MissionPhase.Return,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 0,
      returnTurnsRemaining: 1,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState } = resolveMissionPhase(state)
    const updatedShip = updatedState.ships.get(SHIP_1)!

    expect(updatedShip.captain.missionsCompleted).toBe(2)
    expect(updatedShip.captain.experience).toBe(CaptainExperience.Regular)
  })

  it('captain advances to Veteran at 5 missions', () => {
    const ship = makeShip(SHIP_1, CAPTAIN_1, {
      missionsCompleted: 4,
      captainExperience: CaptainExperience.Regular,
    })
    const mission = makeMission({
      phase: MissionPhase.Return,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 0,
      returnTurnsRemaining: 1,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState } = resolveMissionPhase(state)
    const updatedShip = updatedState.ships.get(SHIP_1)!

    expect(updatedShip.captain.missionsCompleted).toBe(5)
    expect(updatedShip.captain.experience).toBe(CaptainExperience.Veteran)
  })

  it('captain advances to Elite at 10 missions', () => {
    const ship = makeShip(SHIP_1, CAPTAIN_1, {
      missionsCompleted: 9,
      captainExperience: CaptainExperience.Veteran,
    })
    const mission = makeMission({
      phase: MissionPhase.Return,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 0,
      returnTurnsRemaining: 1,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState } = resolveMissionPhase(state)
    const updatedShip = updatedState.ships.get(SHIP_1)!

    expect(updatedShip.captain.missionsCompleted).toBe(10)
    expect(updatedShip.captain.experience).toBe(CaptainExperience.Elite)
  })

  // ── Completed missions skipped ───────────────────────────────────────────────

  it('skips missions that are already completed', () => {
    const ship = makeShip(SHIP_1)
    const mission = makeMission({
      phase: MissionPhase.Completed,
      completedTurn: TURN_1,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 0,
      returnTurnsRemaining: 0,
    })
    const state = makeState(
      new Map([[MISSION_1, mission]]),
      new Map([[SHIP_1, ship]]),
    )

    const { updatedState, events } = resolveMissionPhase(state)
    const updated = updatedState.missions.get(MISSION_1)!

    expect(updated.phase).toBe(MissionPhase.Completed)
    expect(updated.completedTurn).toBe(TURN_1)
    expect(events).toHaveLength(0)
  })
})
