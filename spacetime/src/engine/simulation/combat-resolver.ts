/**
 * combat-resolver.ts — Semi-abstracted combat resolution (prototype).
 *
 * Story 16.2 — Combat Resolver.
 *
 * Prototype: simplified win/loss via Fight score vs difficulty.
 * Full phase-by-phase combat (initiative, targeting, exchange rounds,
 * retreat, aftermath) is deferred to post-prototype (Epic 20).
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Epic 20 post-prototype): Replace with full phase-by-phase combat
 *   per Specs.md § 11 (initiative, targeting, 3-5 exchange rounds, retreat checks,
 *   disabled ship recovery).
 */

import type { MissionType, ShipId, TurnNumber } from '../../types/common'
import type { Ship } from '../../types/ship'
import type { CombatResult, ShipCombatOutcome } from '../../types/combat'
import type { Sector } from '../../types/sector'
import {
  applyCommanderModifier,
  resolveCombatRoll,
  sampleWinConditionLoss,
  sampleLoseConditionLoss,
  applyConditionDamage,
} from '../formulas/combat'

// ─── Mission Base Difficulty ──────────────────────────────────────────────────

/**
 * Base difficulty for each mission type, before sector threat modifier.
 * Multiplied by the target sector's threatModifier (0.5–1.5) to get final difficulty.
 */
const MISSION_BASE_DIFFICULTY: Record<MissionType, number> = {
  Escort:        10,
  Assault:       20,
  Defense:       15,
  Rescue:        12,
  Investigation: 8,
}

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface CombatResolverInput {
  /** All ships in the task force (must include their current condition). */
  ships: Ship[]
  /** Experience of the mission commander (highest in task force). */
  commanderExperience: import('../../types/common').CaptainExperience
  /** The target sector (used for threatModifier). */
  targetSector: Sector
  /** Mission type (used for base difficulty). */
  missionType: MissionType
  /** Current game turn. */
  turn: TurnNumber
  /** Injectable RNG for deterministic testing. */
  randFn?: () => number
}

// ─── Narrative Helpers ────────────────────────────────────────────────────────

function buildNarrative(
  won: boolean,
  missionType: MissionType,
  destroyed: ShipId[],
  shipOutcomes: ShipCombatOutcome[],
): string {
  const result = won ? 'Victory' : 'Defeat'
  const losses =
    destroyed.length > 0
      ? ` ${destroyed.length} ship(s) lost.`
      : ''
  const totalDamaged = shipOutcomes.filter(
    (o) => o.conditionAfter < o.conditionBefore && !o.destroyed,
  ).length
  const damage =
    totalDamaged > 0 ? ` ${totalDamaged} ship(s) damaged.` : ''
  return `${result} — ${missionType} engagement concluded.${losses}${damage}`
}

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Resolves combat for a mission's execution phase.
 *
 * Algorithm:
 *  1. Sum task force Fight scores.
 *  2. Apply commander experience modifier.
 *  3. Calculate difficulty = base × sector.threatModifier.
 *  4. Roll: win if effectiveFight × random(0.85, 1.15) > difficulty.
 *  5. Apply condition losses per ship (winner: 5-20%, loser: 30-60%).
 *  6. Mark ships with condition 0 as destroyed.
 *
 * @returns CombatResult with win/loss, per-ship outcomes, destroyed IDs, narrative.
 */
export function resolveCombat(input: CombatResolverInput): CombatResult {
  const { ships, commanderExperience, targetSector, missionType, turn } = input
  const rand = input.randFn ?? Math.random

  // ── 1. Sum task force Fight scores ─────────────────────────────────────────
  const rawFight = ships.reduce((sum, s) => sum + s.abilities.fight, 0)

  // ── 2. Apply commander modifier ────────────────────────────────────────────
  const effectiveFight = applyCommanderModifier(rawFight, commanderExperience)

  // ── 3. Calculate difficulty ────────────────────────────────────────────────
  const baseDifficulty = MISSION_BASE_DIFFICULTY[missionType]
  const difficulty = baseDifficulty * targetSector.threatModifier

  // ── 4. Roll outcome ────────────────────────────────────────────────────────
  const won = resolveCombatRoll(effectiveFight, difficulty, rand())

  // ── 5. Apply condition losses per ship ─────────────────────────────────────
  const shipOutcomes: ShipCombatOutcome[] = ships.map((ship) => {
    const lossFraction = won
      ? sampleWinConditionLoss(rand())
      : sampleLoseConditionLoss(rand())
    const conditionBefore = ship.condition
    const conditionAfter = applyConditionDamage(conditionBefore, lossFraction)
    const destroyed = conditionAfter <= 0

    return {
      shipId: ship.id,
      conditionBefore,
      conditionAfter,
      destroyed,
      disabledAndRecovered: false, // post-prototype feature
    }
  })

  // ── 6. Collect destroyed ship IDs ──────────────────────────────────────────
  const destroyedIds = shipOutcomes
    .filter((o) => o.destroyed)
    .map((o) => o.shipId)

  const narrative = buildNarrative(won, missionType, destroyedIds, shipOutcomes)

  return {
    outcome: won ? 'victory' : 'defeat',
    rounds: [], // post-prototype: per-round exchange data
    shipOutcomes,
    narrative,
    turn,
  }
}
