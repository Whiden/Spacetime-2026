/**
 * create-mission.ts — Mission creation and validation.
 *
 * Story 16.1 — Mission Creation.
 *
 * The player selects a mission type, a target sector, and assembles a task force
 * from available government-owned ships. This function validates the selection
 * and returns a fully-typed Mission object or a typed error.
 *
 * Rules:
 * - All ships must have status "Stationed" and must not be on another mission.
 * - All ships must be government-owned (ownerCorpId === 'government').
 * - Target sector must exist in the galaxy.
 * - Travel time = shortest hop count between the task force's home sector and target.
 * - Execution duration comes from MISSION_DURATIONS (Data.md § 15).
 * - Total BP/turn cost = mission base cost + fleet surcharge (+1 per ship with size ≥ 7).
 * - The highest-experience captain in the task force becomes the commander.
 * - On creation, ship statuses are set to "OnMission".
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 16.3): mission-phase.ts advances missions through travel/execution/return.
 * TODO (Story 16.4): mission.store.ts wraps this with Pinia actions.
 */

import type {
  MissionType,
  ShipStatus,
  CaptainExperience,
  SectorId,
  MissionId,
  TurnNumber,
  BPAmount,
} from '../../types/common'
import { MissionPhase, ShipStatus as ShipStatusEnum } from '../../types/common'
import type { Ship } from '../../types/ship'
import type { Mission, TaskForce } from '../../types/mission'
import type { GameState } from '../../types/game'
import { generateMissionId } from '../../utils/id'
import { generateEventId } from '../../utils/id'

// ─── Mission Data (from Data.md § 15) ────────────────────────────────────────

/**
 * Base BP/turn cost and execution duration range for each mission type.
 * Duration is sampled from [min, max] inclusive.
 */
const MISSION_BASE_DATA: Record<
  MissionType,
  { baseBPPerTurn: number; durationMin: number; durationMax: number }
> = {
  Escort:        { baseBPPerTurn: 1, durationMin: 1, durationMax: 1 }, // matches contract duration — use 1 as default
  Assault:       { baseBPPerTurn: 3, durationMin: 3, durationMax: 8 },
  Defense:       { baseBPPerTurn: 2, durationMin: 1, durationMax: 3 },
  Rescue:        { baseBPPerTurn: 2, durationMin: 2, durationMax: 5 },
  Investigation: { baseBPPerTurn: 1, durationMin: 2, durationMax: 4 },
}

/** Ships with size ≥ this threshold incur a +1 BP/turn fleet surcharge each. */
const SURCHARGE_SIZE_THRESHOLD = 7

/** Experience ordering for commander selection (highest first). */
const EXPERIENCE_ORDER: CaptainExperience[] = ['Elite', 'Veteran', 'Regular', 'Green'] as CaptainExperience[]

// ─── Error Types ──────────────────────────────────────────────────────────────

export type CreateMissionError =
  | 'NO_SHIPS_SELECTED'
  | 'SHIP_NOT_FOUND'
  | 'SHIP_NOT_AVAILABLE'   // not Stationed or already on a mission
  | 'SHIP_NOT_GOVERNMENT'  // not owned by the player
  | 'SECTOR_NOT_FOUND'
  | 'NO_HOME_SECTOR'       // task force ships have no common reachable home sector

// ─── Result Type ──────────────────────────────────────────────────────────────

export type CreateMissionResult =
  | { success: true; mission: Mission; updatedShips: Map<string, Ship> }
  | { success: false; error: CreateMissionError }

// ─── BFS Shortest Path ────────────────────────────────────────────────────────

/**
 * Computes the shortest hop count between two sectors using BFS on the adjacency graph.
 * Returns null if no path exists (disconnected graph — should never happen by galaxy rules).
 */
function shortestHopCount(
  adjacency: Map<SectorId, SectorId[]>,
  from: SectorId,
  to: SectorId,
): number | null {
  if (from === to) return 0

  const visited = new Set<SectorId>([from])
  const queue: Array<{ sectorId: SectorId; hops: number }> = [{ sectorId: from, hops: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = adjacency.get(current.sectorId) ?? []
    for (const neighbor of neighbors) {
      if (neighbor === to) return current.hops + 1
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push({ sectorId: neighbor, hops: current.hops + 1 })
      }
    }
  }

  return null // unreachable — galaxy is always a connected graph
}

// ─── Commander Selection ──────────────────────────────────────────────────────

/**
 * Selects the highest-experience captain from the task force ships to be the commander.
 * Ties broken by first occurrence in the array.
 */
function selectCommander(ships: Ship[]): Ship['captain'] {
  let best = ships[0]!.captain
  let bestIndex = EXPERIENCE_ORDER.indexOf(best.experience)

  for (let i = 1; i < ships.length; i++) {
    const cap = ships[i]!.captain
    const idx = EXPERIENCE_ORDER.indexOf(cap.experience)
    if (idx < bestIndex) { // lower index = higher experience
      best = cap
      bestIndex = idx
    }
  }

  return best
}

// ─── Cost Calculation ─────────────────────────────────────────────────────────

/**
 * Calculates total BP/turn mission cost:
 * base_cost + fleet surcharge (+1 per ship with size ≥ 7).
 */
function calculateMissionCost(missionType: MissionType, ships: Ship[]): BPAmount {
  const base = MISSION_BASE_DATA[missionType].baseBPPerTurn
  const surcharge = ships.filter((s) => s.primaryStats.size >= SURCHARGE_SIZE_THRESHOLD).length
  return (base + surcharge) as BPAmount
}

// ─── Execution Duration ───────────────────────────────────────────────────────

/**
 * Samples a random execution duration from the mission type's [min, max] range.
 */
function sampleExecutionDuration(missionType: MissionType, randFn: () => number): number {
  const { durationMin, durationMax } = MISSION_BASE_DATA[missionType]
  return durationMin + Math.floor(randFn() * (durationMax - durationMin + 1))
}

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Validates and creates a mission from the player's selection.
 *
 * @param params.missionType      - The type of mission to create.
 * @param params.targetSectorId   - The sector the mission is aimed at.
 * @param params.shipIds          - IDs of ships selected for the task force.
 * @param state                   - Current full game state (used for validation).
 * @param randFn                  - Injectable RNG for deterministic testing.
 * @returns CreateMissionResult — success with Mission, or failure with typed error.
 */
export function createMission(
  params: {
    missionType: MissionType
    targetSectorId: SectorId
    shipIds: string[]
  },
  state: GameState,
  randFn: () => number = Math.random,
): CreateMissionResult {
  const { missionType, targetSectorId, shipIds } = params

  // ── 1. At least one ship required ──────────────────────────────────────────
  if (shipIds.length === 0) {
    return { success: false, error: 'NO_SHIPS_SELECTED' }
  }

  // ── 2. Target sector must exist ────────────────────────────────────────────
  if (!state.galaxy.sectors.has(targetSectorId as SectorId)) {
    return { success: false, error: 'SECTOR_NOT_FOUND' }
  }

  // ── 3. Validate each ship ──────────────────────────────────────────────────
  const taskForceShips: Ship[] = []
  for (const shipId of shipIds) {
    const ship = state.ships.get(shipId)

    if (!ship) {
      return { success: false, error: 'SHIP_NOT_FOUND' }
    }

    // Must be government-owned
    if (ship.ownerCorpId !== 'government') {
      return { success: false, error: 'SHIP_NOT_GOVERNMENT' }
    }

    // Must be Stationed (not on a mission, not under construction/repair)
    if (ship.status !== (ShipStatusEnum.Stationed as ShipStatus)) {
      return { success: false, error: 'SHIP_NOT_AVAILABLE' }
    }

    taskForceShips.push(ship)
  }

  // ── 4. Determine travel time from the first ship's home sector ─────────────
  // All ships are assumed to be reachable (player manages fleet placement).
  // Travel time uses the first ship's home sector as the departure point.
  const homeSectorId = taskForceShips[0]!.homeSectorId
  const hops = shortestHopCount(
    state.galaxy.adjacency as Map<SectorId, SectorId[]>,
    homeSectorId,
    targetSectorId as SectorId,
  )

  if (hops === null) {
    return { success: false, error: 'NO_HOME_SECTOR' }
  }

  // Travel time: 1 turn per hop (same for outbound and return)
  const travelTurns = hops

  // ── 5. Select commander ────────────────────────────────────────────────────
  const commander = selectCommander(taskForceShips)

  // ── 6. Assemble task force ─────────────────────────────────────────────────
  const taskForce: TaskForce = {
    shipIds: shipIds as unknown as ReturnType<typeof taskForceShips[0]['id']>[],
    commanderCaptainId: commander.id,
  }

  // ── 7. Calculate cost and execution duration ───────────────────────────────
  const bpPerTurn = calculateMissionCost(missionType, taskForceShips)
  const executionDuration = sampleExecutionDuration(missionType, randFn)

  // ── 8. Build mission object ────────────────────────────────────────────────
  const mission: Mission = {
    id: generateMissionId(),
    type: missionType,
    phase: MissionPhase.Travel,
    targetSectorId: targetSectorId as SectorId,
    taskForce,
    bpPerTurn,
    travelTurnsRemaining: travelTurns,
    executionTurnsRemaining: executionDuration,
    returnTurnsRemaining: travelTurns,
    startTurn: state.turn,
    completedTurn: null,
    report: null,
  }

  // ── 9. Set all task force ships to OnMission ───────────────────────────────
  const updatedShips = new Map(state.ships)
  for (const ship of taskForceShips) {
    updatedShips.set(ship.id, { ...ship, status: ShipStatusEnum.OnMission as ShipStatus })
  }

  return { success: true, mission, updatedShips }
}
