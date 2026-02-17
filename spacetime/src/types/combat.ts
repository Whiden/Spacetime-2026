/**
 * combat.ts — Combat resolution types.
 *
 * Combat is semi-abstracted. The player never directly controls combat.
 * The game resolves phases and rounds, then surfaces a summary report.
 *
 * TODO (Story 16.2): combat-resolver.ts implements the full resolution logic.
 *
 * NOTE: Full combat resolution is deferred from the prototype.
 * This module defines the types needed once combat is implemented.
 */

import type { ShipId, TurnNumber } from './common'

// ─── Combat Phase ─────────────────────────────────────────────────────────────

/** The phase of a single combat encounter. */
export enum CombatPhase {
  Initiative = 'Initiative',
  Targeting = 'Targeting',
  Exchange = 'Exchange',
  Retreat = 'Retreat',
  Aftermath = 'Aftermath',
}

// ─── Combat Round ─────────────────────────────────────────────────────────────

/**
 * The outcome of a single exchange round in combat.
 * Between 3-5 exchange rounds per combat encounter.
 */
export interface CombatRound {
  roundNumber: number
  /** Damage dealt to each ship this round. Key: ShipId, Value: damage amount. */
  damageDealt: Map<ShipId, number>
  /** Whether any ship retreated this round. */
  retreatOccurred: boolean
}

// ─── Ship Combat Outcome ──────────────────────────────────────────────────────

/**
 * What happened to a specific ship during a combat encounter.
 */
export interface ShipCombatOutcome {
  shipId: ShipId
  conditionBefore: number
  conditionAfter: number
  destroyed: boolean
  /** Whether this ship was disabled (condition < 20%) but recovered. */
  disabledAndRecovered: boolean
}

// ─── Combat Result ────────────────────────────────────────────────────────────

/**
 * The complete result of a combat encounter.
 * Returned by combat-resolver.ts and embedded in mission reports.
 *
 * TODO (Story 16.2): Full implementation in combat-resolver.ts.
 */
export interface CombatResult {
  /** Whether the player task force won, lost, or drew. */
  outcome: 'victory' | 'defeat' | 'draw' | 'retreat'
  rounds: CombatRound[]
  shipOutcomes: ShipCombatOutcome[]
  /** Human-readable summary of the engagement. */
  narrative: string
  turn: TurnNumber
}
