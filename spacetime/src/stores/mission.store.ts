/**
 * mission.store.ts — Pinia store for active and completed missions.
 *
 * Story 16.4: Holds all missions; wraps create-mission and mission-phase engine functions.
 *
 * Actions:
 * - createMission(params)       — validates and creates a mission, updates ship statuses
 * - advanceMissions(gameState)  — calls resolveMissionPhase and returns PhaseResult
 *
 * Getters:
 * - activeMissions              — missions with completedTurn === null
 * - completedMissions           — missions with completedTurn !== null
 * - missionsByShip(shipId)      — all missions that include a given ship ID
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MissionId, ShipId, SectorId } from '../types/common'
import { MissionType } from '../types/common'
import type { Mission } from '../types/mission'
import type { GameState, PhaseResult } from '../types/game'
import {
  createMission as engineCreateMission,
  type CreateMissionResult,
} from '../engine/actions/create-mission'
import { resolveMissionPhase } from '../engine/turn/mission-phase'

export const useMissionStore = defineStore('mission', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** All missions (active and completed) keyed by MissionId. */
  const missions = ref<Map<MissionId, Mission>>(new Map())

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** Missions that are currently in progress (not yet completed). */
  const activeMissions = computed<Mission[]>(() =>
    [...missions.value.values()].filter((m) => m.completedTurn === null),
  )

  /** Missions that have finished (completed or all-lost). */
  const completedMissions = computed<Mission[]>(() =>
    [...missions.value.values()].filter((m) => m.completedTurn !== null),
  )

  // ─── Getter Functions ─────────────────────────────────────────────────────────

  /**
   * Returns all missions (active or completed) that include the given ship ID
   * in their task force.
   */
  function missionsByShip(shipId: ShipId): Mission[] {
    return [...missions.value.values()].filter((m) =>
      m.taskForce.shipIds.includes(shipId),
    )
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Validates and creates a new mission.
   *
   * On success, registers the mission in the store and returns the updated ships
   * map (with task force ships set to OnMission) so the caller can sync the
   * fleet store.
   *
   * @param params  - Mission creation parameters (type, target sector, ship IDs).
   * @param state   - Current full game state (used for validation).
   * @param randFn  - Injectable RNG (defaults to Math.random).
   * @returns CreateMissionResult from the engine.
   */
  function createMission(
    params: {
      missionType: MissionType
      targetSectorId: SectorId
      shipIds: string[]
    },
    state: GameState,
    randFn: () => number = Math.random,
  ): CreateMissionResult {
    const result = engineCreateMission(params, state, randFn)

    if (result.success) {
      missions.value.set(result.mission.id as MissionId, result.mission)
    }

    return result
  }

  /**
   * Advances all active missions by one turn.
   *
   * Calls the pure mission-phase engine function and merges updated missions
   * back into the store. Returns the full PhaseResult so game.store can
   * distribute updated ships and events.
   *
   * @param gameState - Current full game state (must include current missions map).
   * @param randFn    - Injectable RNG (defaults to Math.random).
   * @returns PhaseResult with updatedState and events.
   */
  function advanceMissions(
    gameState: GameState,
    randFn: () => number = Math.random,
  ): PhaseResult {
    const result = resolveMissionPhase(gameState, randFn)

    // Sync updated missions back to store
    for (const [id, mission] of result.updatedState.missions) {
      missions.value.set(id as MissionId, mission)
    }

    return result
  }

  /**
   * Replaces the missions map wholesale after turn resolution.
   * Used by game.store._distributeResults() for full state sync.
   */
  function updateMissions(updatedMissions: Map<string, Mission>): void {
    missions.value = new Map(updatedMissions as Map<MissionId, Mission>)
  }

  return {
    // State
    missions,
    // Getters (computed)
    activeMissions,
    completedMissions,
    // Getters (functions)
    missionsByShip,
    // Actions
    createMission,
    advanceMissions,
    updateMissions,
  }
})
