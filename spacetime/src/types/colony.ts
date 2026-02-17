/**
 * colony.ts — Colony, ColonyAttributes, and related types.
 *
 * A colony is a settled planet. Its type is determined at founding by the colonization
 * contract. All attributes are recalculated each turn in the colony phase.
 */

import type {
  ColonyId,
  PlanetId,
  SectorId,
  CorpId,
  TurnNumber,
  ColonyType,
} from './common'
import type { ColonyInfrastructure } from './infrastructure'
import type { Modifier } from './modifier'

// ─── Colony Attributes ────────────────────────────────────────────────────────

/**
 * The six core attributes of a colony. All clamped 0–10.
 * Recalculated every turn in colony-phase.ts using formulas from Specs.md § 5.
 *
 * TODO (Story 10.1): Calculated by functions in engine/formulas/attributes.ts.
 */
export interface ColonyAttributes {
  /** Mostly static; set by planet type and feature modifiers. */
  habitability: number
  /** Driven by transport infrastructure. */
  accessibility: number
  /** Economic energy; driven by access, population, and corporate activity. */
  dynamism: number
  /** Quality of life; degrades with low habitability and resource shortages. */
  qualityOfLife: number
  /** Political stability; affected by QoL, debt tokens, and military infrastructure. */
  stability: number
  /**
   * Growth progress toward next population level (not clamped to 0–10;
   * this is a progress accumulator that triggers transitions at -1 and +10).
   */
  growth: number
}

// ─── Colony ───────────────────────────────────────────────────────────────────

/**
 * A settled colony. The core economic and social unit of the game.
 *
 * TODO (Story 4.2): colony-generator.ts creates colonies from planet + colony type.
 * TODO (Story 10.3): colony-phase.ts recalculates attributes and growth each turn.
 */
export interface Colony {
  id: ColonyId
  planetId: PlanetId
  sectorId: SectorId

  /** Player-visible name. Can be renamed (cosmetic). */
  name: string

  /**
   * Colony type determines the passive bonus and starting infrastructure.
   * The type label is cosmetic after founding, but the passive bonus persists.
   */
  type: ColonyType

  /** Current population level (1-10). Capped by planet size. */
  populationLevel: number

  /** Current colony attributes. Recalculated each turn. */
  attributes: ColonyAttributes

  /** Infrastructure state per domain. */
  infrastructure: ColonyInfrastructure

  /**
   * Corporations currently active on this colony (presence, not ownership).
   * A corp is present if it owns infrastructure here.
   */
  corporationsPresent: CorpId[]

  /**
   * Permanent and transient modifiers affecting this colony's attribute calculations.
   *
   * Permanent modifiers (planet features, colony type bonus):
   *   - Registered at colony founding by colony-generator.ts
   *   - Persisted in save files
   *
   * Transient modifiers (shortage maluses):
   *   - Cleared at the start of market-phase.ts
   *   - Reapplied based on current market state each turn
   *   - NOT saved to file (recalculated on load)
   *
   * TODO (Story 4.2): Permanent modifiers registered in colony-generator.ts.
   * TODO (Story 9.2): Shortage modifiers applied in market-phase.ts.
   */
  modifiers: Modifier[]

  /** Turn this colony was founded. */
  foundedTurn: TurnNumber
}
