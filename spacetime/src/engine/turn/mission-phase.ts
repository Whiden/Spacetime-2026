/**
 * mission-phase.ts — Mission advancement during turn resolution.
 *
 * Story 16.3 — Mission Phase: Turn Resolution.
 *
 * Runs as phase #5 of turn resolution (after contract-phase, before science-phase).
 *
 * Each turn:
 *  1. Travel phase: decrement travelTurnsRemaining.
 *  2. Execution phase: run mission logic (combat for combat missions) once travel done.
 *  3. Return phase: decrement returnTurnsRemaining.
 *  4. On completion: ships return to Stationed, generate mission report.
 *  5. On ship loss: remove ship, generate loss event.
 *  6. Captain experience gain: increment missionsCompleted after completion.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { Mission, MissionReport } from '../../types/mission'
import type { GameEvent } from '../../types/event'
import type { Ship } from '../../types/ship'
import type { ShipId, TurnNumber } from '../../types/common'
import { MissionPhase, MissionType, ShipStatus, EventPriority } from '../../types/common'
import { getExperienceLevel } from '../../generators/captain-generator'
import { resolveCombat } from '../simulation/combat-resolver'
import { generateEventId } from '../../utils/id'

// ─── Combat-applicable mission types ─────────────────────────────────────────

const COMBAT_MISSIONS = new Set<MissionType>([
  MissionType.Assault,
  MissionType.Defense,
  MissionType.Escort,
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createEvent(
  turn: TurnNumber,
  priority: EventPriority,
  title: string,
  description: string,
  relatedEntityIds: string[],
): GameEvent {
  return {
    id: generateEventId(),
    turn,
    priority,
    category: 'fleet',
    title,
    description,
    relatedEntityIds,
    dismissed: false,
  }
}

/**
 * Runs mission execution phase logic and returns updated ships + per-ship
 * destroyed flags + narrative.
 */
function executeMission(
  mission: Mission,
  ships: Ship[],
  state: GameState,
  randFn: () => number,
): {
  updatedShips: Ship[]
  destroyedIds: ShipId[]
  narrative: string
} {
  if (COMBAT_MISSIONS.has(mission.type)) {
    const commander = ships.find(
      (s) => s.captain.id === mission.taskForce.commanderCaptainId,
    )
    const commanderExperience = commander?.captain.experience ?? ships[0]!.captain.experience

    const targetSector = state.galaxy.sectors.get(mission.targetSectorId)

    // If sector is missing, treat as non-combat execution
    if (!targetSector) {
      return { updatedShips: ships, destroyedIds: [], narrative: 'Mission executed.' }
    }

    const result = resolveCombat({
      ships,
      commanderExperience,
      targetSector,
      missionType: mission.type,
      turn: state.turn,
      randFn,
    })

    const updatedShips = ships.map((ship) => {
      const outcome = result.shipOutcomes.find((o) => o.shipId === ship.id)
      if (!outcome) return ship
      return {
        ...ship,
        condition: outcome.conditionAfter,
      }
    })

    const destroyedIds = result.shipOutcomes
      .filter((o) => o.destroyed)
      .map((o) => o.shipId)

    return { updatedShips, destroyedIds, narrative: result.narrative }
  }

  // Non-combat missions: no condition damage, success
  return {
    updatedShips: ships,
    destroyedIds: [],
    narrative: `${mission.type} mission completed successfully.`,
  }
}

// ─── Mission Phase ────────────────────────────────────────────────────────────

/**
 * resolveMissionPhase — Phase #5: advance all active missions by one turn.
 *
 * Mutates (immutably) mission state, ship state, and emits events.
 */
export function resolveMissionPhase(
  state: GameState,
  randFn: () => number = Math.random,
): PhaseResult {
  const updatedMissions = new Map(state.missions)
  const updatedShips = new Map(state.ships)
  const events: GameEvent[] = []

  for (const [id, mission] of state.missions) {
    // Only process active missions (completedTurn === null)
    if (mission.completedTurn !== null) continue

    let m: Mission = { ...mission }

    // ── 1. Travel phase ──────────────────────────────────────────────────────
    if (m.phase === MissionPhase.Travel) {
      if (m.travelTurnsRemaining > 1) {
        m = { ...m, travelTurnsRemaining: m.travelTurnsRemaining - 1 }
        updatedMissions.set(id, m)
        continue
      }
      // Arrival — transition to Execution
      m = { ...m, travelTurnsRemaining: 0, phase: MissionPhase.Execution }
      // Fall through to execution this same turn
    }

    // ── 2. Execution phase ───────────────────────────────────────────────────
    if (m.phase === MissionPhase.Execution) {
      if (m.executionTurnsRemaining > 1) {
        m = { ...m, executionTurnsRemaining: m.executionTurnsRemaining - 1 }
        updatedMissions.set(id, m)
        continue
      }

      // Last execution turn — resolve mission
      const taskShips = m.taskForce.shipIds
        .map((sid) => updatedShips.get(sid))
        .filter((s): s is Ship => s !== undefined)

      const { updatedShips: resolvedShips, destroyedIds, narrative } =
        executeMission(m, taskShips, state, randFn)

      // Apply ship condition updates
      for (const ship of resolvedShips) {
        updatedShips.set(ship.id, ship)
      }

      // Remove destroyed ships, generate loss events
      for (const shipId of destroyedIds) {
        const ship = updatedShips.get(shipId)
        if (ship) {
          events.push(
            createEvent(
              state.turn,
              EventPriority.Critical,
              'Ship Lost in Combat',
              `${ship.name} was destroyed during a ${m.type} mission.`,
              [shipId, m.id],
            ),
          )
          updatedShips.delete(shipId)
        }
      }

      const survivingShipIds = m.taskForce.shipIds.filter(
        (sid) => !destroyedIds.includes(sid),
      )
      const allLost = survivingShipIds.length === 0

      const report: MissionReport = {
        missionId: m.id,
        outcome: allLost
          ? 'missing'
          : destroyedIds.length > 0
          ? 'partial_success'
          : 'success',
        summary: allLost ? 'Task Force has not returned.' : narrative,
        shipsLost: destroyedIds,
        shipsReturned: survivingShipIds,
        combatSummary: COMBAT_MISSIONS.has(m.type) ? narrative : undefined,
      }

      // Transition to Return
      m = {
        ...m,
        executionTurnsRemaining: 0,
        phase: MissionPhase.Return,
        taskForce: { ...m.taskForce, shipIds: survivingShipIds },
        report,
      }

      // If all ships lost, complete immediately
      if (allLost) {
        m = { ...m, phase: MissionPhase.Completed, completedTurn: state.turn }
        events.push(
          createEvent(
            state.turn,
            EventPriority.Critical,
            'Task Force Lost',
            `The entire task force on a ${m.type} mission was destroyed.`,
            [m.id],
          ),
        )
        updatedMissions.set(id, m)
        continue
      }

      updatedMissions.set(id, m)
      continue
    }

    // ── 3. Return phase ──────────────────────────────────────────────────────
    if (m.phase === MissionPhase.Return) {
      if (m.returnTurnsRemaining > 1) {
        m = { ...m, returnTurnsRemaining: m.returnTurnsRemaining - 1 }
        updatedMissions.set(id, m)
        continue
      }

      // Arrived home — complete mission
      for (const shipId of m.taskForce.shipIds) {
        const ship = updatedShips.get(shipId)
        if (!ship) continue

        // Captain experience gain
        const updatedCaptain = {
          ...ship.captain,
          missionsCompleted: ship.captain.missionsCompleted + 1,
        }
        updatedCaptain.experience = getExperienceLevel(updatedCaptain.missionsCompleted)

        // Update service record
        const updatedServiceRecord = {
          ...ship.serviceRecord,
          missionsCompleted: ship.serviceRecord.missionsCompleted + 1,
        }

        updatedShips.set(shipId, {
          ...ship,
          status: ShipStatus.Stationed,
          captain: updatedCaptain,
          serviceRecord: updatedServiceRecord,
        })
      }

      m = {
        ...m,
        returnTurnsRemaining: 0,
        phase: MissionPhase.Completed,
        completedTurn: state.turn,
      }

      const reportOutcome = m.report?.outcome ?? 'success'
      events.push(
        createEvent(
          state.turn,
          reportOutcome === 'success' ? EventPriority.Positive : EventPriority.Warning,
          'Mission Complete',
          `${m.type} mission completed. ${m.report?.summary ?? ''}`,
          [m.id, ...m.taskForce.shipIds],
        ),
      )

      updatedMissions.set(id, m)
    }
  }

  return {
    updatedState: {
      ...state,
      missions: updatedMissions,
      ships: updatedShips,
    },
    events,
  }
}
