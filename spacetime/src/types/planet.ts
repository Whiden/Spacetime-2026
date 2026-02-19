/**
 * planet.ts — Planet and deposit type definitions.
 *
 * Planets are discovered through exploration contracts and exist in two states:
 * pre-colonization (tracked in planet store) and post-colonization (a Colony).
 */

import type {
  PlanetId,
  SectorId,
  DepositType,
  RichnessLevel,
  PlanetType,
  PlanetSize,
  PlanetStatus,
} from './common'
import type { Modifier } from './modifier'

// ─── Deposit ──────────────────────────────────────────────────────────────────

/**
 * A natural resource deposit present on a planet.
 * Multiple deposits of the same type can exist on a single planet.
 */
export interface Deposit {
  type: DepositType
  richness: RichnessLevel
  /** Whether the richness level has been revealed (requires ground survey). */
  richnessRevealed: boolean
}

// ─── Planet Feature ───────────────────────────────────────────────────────────

/**
 * A special planetary trait that modifies colony attributes and infrastructure caps.
 * Features are registered as modifiers on a colony when it is founded.
 */
export interface PlanetFeature {
  /** Matches a key in the planet-features data file (e.g., "TemperateClimate"). */
  featureId: string
  /** Whether this feature is visible from orbit scan (vs. ground survey only). */
  orbitVisible: boolean
  /** Whether the feature has been revealed to the player. */
  revealed: boolean
}

// ─── Planet ───────────────────────────────────────────────────────────────────

/**
 * A discovered or undiscovered planet in the game world.
 * Planets progress through status tiers via contracts and player decisions.
 *
 * TODO (Story 13.2): Exploration contract completion populates orbit scan data. ✓
 * TODO (Story 13.4): Ground survey contract reveals full data. ✓
 */
export interface Planet {
  id: PlanetId
  name: string
  sectorId: SectorId
  type: PlanetType
  size: PlanetSize
  status: PlanetStatus

  /** Base habitability set by planet type (before feature modifiers). */
  baseHabitability: number

  /** Deposits present on this planet. Only fully revealed after ground survey. */
  deposits: Deposit[]

  /** Special features. Orbit-visible ones are revealed by exploration; ground ones by survey. */
  features: PlanetFeature[]

  /**
   * Modifiers from planet features, to be applied when a colony is founded here.
   * Populated on discovery; registered onto colony.modifiers at colonization time.
   */
  featureModifiers: Modifier[]

  /** Turn this planet was orbit-scanned. Null if not yet discovered. */
  orbitScanTurn: number | null

  /** Turn this planet was ground-surveyed. Null if not yet surveyed. */
  groundSurveyTurn: number | null
}
