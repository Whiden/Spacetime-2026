/**
 * mission.store.test.ts — Unit tests for Story 16.4: Mission Store.
 *
 * Tests cover:
 * - activeMissions / completedMissions getters
 * - createMission() action: valid creation, validation errors
 * - advanceMissions() action: calls mission phase, syncs updated missions
 * - missionsByShip() getter function
 * - updateMissions() bulk sync
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMissionStore } from '../../stores/mission.store'
import { MissionType, MissionPhase, ShipStatus, ShipRole, SizeVariant } from '../../types/common'
import type { GameState } from '../../types/game'
import type { Ship } from '../../types/ship'
import type { Mission } from '../../types/mission'
import type { SectorId, ShipId, MissionId } from '../../types/common'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeShip(id: string, sectorId: string, status: ShipStatus = ShipStatus.Stationed): Ship {
  return {
    id: id as ShipId,
    name: `Ship ${id}`,
    role: ShipRole.SystemPatrol,
    variant: SizeVariant.Standard,
    ownerCorpId: 'government',
    homeSectorId: sectorId as SectorId,
    status,
    condition: 100,
    primaryStats: { size: 5, speed: 5, firepower: 5, armor: 5, sensors: 5, evasion: 5 },
    derivedStats: { hp: 100, pp: 10, bpCost: 20, buildTimeTurns: 5 },
    abilities: { fight: 10, investigation: 5, support: 5 },
    captain: {
      id: `cpt_${id}` as import('../../types/common').CaptainId,
      name: 'Cmdr Test',
      experience: 'Regular',
      missionsCompleted: 2,
    },
    serviceRecord: { missionsCompleted: 2, battlesWon: 0, battlesLost: 0 },
    schematics: [],
    builtTurn: 1 as import('../../types/common').TurnNumber,
  }
}

function makeMinimalGameState(
  ships: Map<string, Ship>,
  missions: Map<string, Mission> = new Map(),
): GameState {
  const sectorId = 'sec_home' as SectorId
  const sectors = new Map()
  sectors.set(sectorId, {
    id: sectorId,
    name: 'Home',
    density: 'Medium',
    explorationPercent: 100,
    threatModifier: 1.0,
  })

  const adjacency = new Map<SectorId, SectorId[]>()
  adjacency.set(sectorId, [])

  return {
    turn: 1 as import('../../types/common').TurnNumber,
    phase: 'player_action',
    currentBP: 50 as import('../../types/common').BPAmount,
    debtTokens: 0,
    budget: {
      currentBP: 50 as import('../../types/common').BPAmount,
      incomeSources: [],
      expenseEntries: [],
      totalIncome: 0 as import('../../types/common').BPAmount,
      totalExpenses: 0 as import('../../types/common').BPAmount,
      netBP: 0 as import('../../types/common').BPAmount,
      debtTokens: 0,
      stabilityMalus: 0,
      calculatedTurn: 1 as import('../../types/common').TurnNumber,
    },
    empireBonuses: {
      shipStats: { size: 0, speed: 0, firepower: 0, armor: 0, sensors: 0, evasion: 0 },
      infraCaps: {},
      productionModifiers: {},
    },
    galaxy: { sectors, adjacency, startingSectorId: sectorId },
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
    startedAt: '2026-01-01',
    lastSavedAt: '2026-01-01',
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setActivePinia(createPinia())
})

// ─── Initial State ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts with empty missions map', () => {
    const store = useMissionStore()
    expect(store.missions.size).toBe(0)
  })

  it('activeMissions is empty on init', () => {
    const store = useMissionStore()
    expect(store.activeMissions).toHaveLength(0)
  })

  it('completedMissions is empty on init', () => {
    const store = useMissionStore()
    expect(store.completedMissions).toHaveLength(0)
  })
})

// ─── createMission() ──────────────────────────────────────────────────────────

describe('createMission()', () => {
  it('registers a valid mission in the store', () => {
    const store = useMissionStore()
    const ship = makeShip('ship_1', 'sec_home')
    const ships = new Map([['ship_1', ship]])
    const state = makeMinimalGameState(ships)

    const result = store.createMission(
      { missionType: MissionType.Investigation, targetSectorId: 'sec_home' as SectorId, shipIds: ['ship_1'] },
      state,
      () => 0,
    )

    expect(result.success).toBe(true)
    expect(store.missions.size).toBe(1)
  })

  it('registered mission appears in activeMissions', () => {
    const store = useMissionStore()
    const ship = makeShip('ship_1', 'sec_home')
    const ships = new Map([['ship_1', ship]])
    const state = makeMinimalGameState(ships)

    store.createMission(
      { missionType: MissionType.Investigation, targetSectorId: 'sec_home' as SectorId, shipIds: ['ship_1'] },
      state,
      () => 0,
    )

    expect(store.activeMissions).toHaveLength(1)
    expect(store.completedMissions).toHaveLength(0)
  })

  it('returns validation error without adding to store when no ships selected', () => {
    const store = useMissionStore()
    const state = makeMinimalGameState(new Map())

    const result = store.createMission(
      { missionType: MissionType.Investigation, targetSectorId: 'sec_home' as SectorId, shipIds: [] },
      state,
      () => 0,
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('NO_SHIPS_SELECTED')
    expect(store.missions.size).toBe(0)
  })

  it('returns SECTOR_NOT_FOUND for unknown target sector', () => {
    const store = useMissionStore()
    const ship = makeShip('ship_1', 'sec_home')
    const ships = new Map([['ship_1', ship]])
    const state = makeMinimalGameState(ships)

    const result = store.createMission(
      { missionType: MissionType.Investigation, targetSectorId: 'sec_unknown' as SectorId, shipIds: ['ship_1'] },
      state,
      () => 0,
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('SECTOR_NOT_FOUND')
    expect(store.missions.size).toBe(0)
  })

  it('returns SHIP_NOT_AVAILABLE when ship is already OnMission', () => {
    const store = useMissionStore()
    const ship = makeShip('ship_1', 'sec_home', ShipStatus.OnMission)
    const ships = new Map([['ship_1', ship]])
    const state = makeMinimalGameState(ships)

    const result = store.createMission(
      { missionType: MissionType.Investigation, targetSectorId: 'sec_home' as SectorId, shipIds: ['ship_1'] },
      state,
      () => 0,
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('SHIP_NOT_AVAILABLE')
  })
})

// ─── missionsByShip() ─────────────────────────────────────────────────────────

describe('missionsByShip()', () => {
  it('returns missions containing the given ship', () => {
    const store = useMissionStore()
    const ship = makeShip('ship_1', 'sec_home')
    const ships = new Map([['ship_1', ship]])
    const state = makeMinimalGameState(ships)

    store.createMission(
      { missionType: MissionType.Investigation, targetSectorId: 'sec_home' as SectorId, shipIds: ['ship_1'] },
      state,
      () => 0,
    )

    const result = store.missionsByShip('ship_1' as ShipId)
    expect(result).toHaveLength(1)
  })

  it('returns empty array when ship has no missions', () => {
    const store = useMissionStore()
    expect(store.missionsByShip('ship_999' as ShipId)).toHaveLength(0)
  })
})

// ─── advanceMissions() ───────────────────────────────────────────────────────

describe('advanceMissions()', () => {
  it('decrements travelTurnsRemaining for traveling missions', () => {
    const store = useMissionStore()
    const ship = makeShip('ship_1', 'sec_home', ShipStatus.OnMission)
    const ships = new Map([['ship_1', ship]])

    const mission: Mission = {
      id: 'msn_test' as MissionId,
      type: MissionType.Investigation,
      phase: MissionPhase.Travel,
      targetSectorId: 'sec_home' as SectorId,
      taskForce: { shipIds: ['ship_1' as ShipId], commanderCaptainId: 'cpt_ship_1' as import('../../types/common').CaptainId },
      bpPerTurn: 1 as import('../../types/common').BPAmount,
      travelTurnsRemaining: 3,
      executionTurnsRemaining: 2,
      returnTurnsRemaining: 3,
      startTurn: 1 as import('../../types/common').TurnNumber,
      completedTurn: null,
      report: null,
    }

    const missions = new Map([['msn_test', mission]])
    const state = makeMinimalGameState(ships, missions)
    // Also pre-populate the store with the mission
    store.missions.set('msn_test' as MissionId, mission)

    const result = store.advanceMissions(state, () => 0.5)

    // Store should now have the updated mission
    const updated = store.missions.get('msn_test' as MissionId)
    expect(updated?.travelTurnsRemaining).toBe(2)
    expect(result.events).toHaveLength(0)
  })

  it('returns phase result with updated state', () => {
    const store = useMissionStore()
    const state = makeMinimalGameState(new Map())

    const result = store.advanceMissions(state, () => 0.5)

    expect(result).toHaveProperty('updatedState')
    expect(result).toHaveProperty('events')
  })
})

// ─── updateMissions() ────────────────────────────────────────────────────────

describe('updateMissions()', () => {
  it('replaces missions map wholesale', () => {
    const store = useMissionStore()

    const mission: Mission = {
      id: 'msn_bulk' as MissionId,
      type: MissionType.Escort,
      phase: MissionPhase.Return,
      targetSectorId: 'sec_home' as SectorId,
      taskForce: { shipIds: [], commanderCaptainId: 'cpt_x' as import('../../types/common').CaptainId },
      bpPerTurn: 1 as import('../../types/common').BPAmount,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 0,
      returnTurnsRemaining: 1,
      startTurn: 1 as import('../../types/common').TurnNumber,
      completedTurn: null,
      report: null,
    }

    store.updateMissions(new Map([['msn_bulk', mission]]))

    expect(store.missions.size).toBe(1)
    expect(store.missions.get('msn_bulk' as MissionId)?.type).toBe(MissionType.Escort)
  })

  it('completed missions appear in completedMissions getter after update', () => {
    const store = useMissionStore()

    const mission: Mission = {
      id: 'msn_done' as MissionId,
      type: MissionType.Rescue,
      phase: MissionPhase.Completed,
      targetSectorId: 'sec_home' as SectorId,
      taskForce: { shipIds: [], commanderCaptainId: 'cpt_x' as import('../../types/common').CaptainId },
      bpPerTurn: 2 as import('../../types/common').BPAmount,
      travelTurnsRemaining: 0,
      executionTurnsRemaining: 0,
      returnTurnsRemaining: 0,
      startTurn: 1 as import('../../types/common').TurnNumber,
      completedTurn: 3 as import('../../types/common').TurnNumber,
      report: null,
    }

    store.updateMissions(new Map([['msn_done', mission]]))

    expect(store.completedMissions).toHaveLength(1)
    expect(store.activeMissions).toHaveLength(0)
  })
})
