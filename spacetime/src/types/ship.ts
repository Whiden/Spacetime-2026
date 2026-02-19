/**
 * ship.ts — Ship, Captain, ServiceRecord, blueprint, and abilities types.
 *
 * Ships are rare, named, and precious. Each ship is a unique entity built by a
 * specific corp for a specific role, shaped by empire tech and builder's schematics.
 *
 * TODO (Story 15.2): Ship commission contract creates ships via ship-generator.ts.
 * TODO (Story 15.3): captain-generator.ts generates Captain objects.
 * TODO (Story 15.4): fleet.store.ts manages the ship roster.
 */

import type {
  ShipId,
  CaptainId,
  CorpId,
  SectorId,
  SchematicId,
  TurnNumber,
  ShipRole,
  SizeVariant,
  ShipStatus,
  CaptainExperience,
} from './common'
import type { Modifier } from './modifier'

// ─── Captain ──────────────────────────────────────────────────────────────────

/**
 * A ship captain with experience tracking.
 * Experience increases with completed missions, improving the combat modifier.
 */
export interface Captain {
  id: CaptainId
  name: string
  experience: CaptainExperience
  /**
   * Total missions completed. Drives experience level:
   * 0-1: Green, 2-4: Regular, 5-9: Veteran, 10+: Elite
   */
  missionsCompleted: number
  /** Total battles fought (across all missions). */
  battlesCount: number
}

// ─── Service Record ───────────────────────────────────────────────────────────

/**
 * Historical record of a ship's service life.
 * Preserved even after the ship is lost ("ship memorial").
 */
export interface ServiceRecord {
  shipId: ShipId
  /** Turn the ship was commissioned. */
  builtTurn: TurnNumber
  /** Corp that built the ship. */
  builtByCorpId: CorpId
  /** Missions this ship completed. */
  missionsCompleted: number
  /** Total battles this ship fought. */
  battlesCount: number
  /** Whether this ship was destroyed (lost in combat or incident). */
  destroyed: boolean
  /** Turn destroyed, if applicable. */
  destroyedTurn: TurnNumber | null
}

// ─── Ship Abilities ───────────────────────────────────────────────────────────

/**
 * Derived mission-fitness scores calculated from primary stats.
 * Used during mission planning and resolution to assess task force capability.
 *
 * See Specs.md § 10 Ships Abilities for formulas.
 *
 * Fight         → Assault / Defense missions
 * Investigation → Investigation / Rescue missions
 * Support       → Escort missions
 */
export interface ShipAbilities {
  /** floor((Firepower + floor(Armor × 0.75) + floor(Evasion × 0.5)) × Size / 2) */
  fight: number
  /** floor((floor(Speed × 0.75) + Sensors) × Size / 2) */
  investigation: number
  /** floor((floor(Firepower × 0.5) + floor(Sensors × 0.75)) × Size / 2) */
  support: number
}

// ─── Ship Stats ───────────────────────────────────────────────────────────────

/**
 * Primary ship stats. All derived from role base + empire tech + corp scaling + schematics + random.
 * See Specs.md § 10 Ship Stats for the generation formula.
 */
export interface ShipPrimaryStats {
  /** Drives hull points and power projection; scales with size variant. */
  size: number
  speed: number
  firepower: number
  /** Armor rating; drives hull point calculation. */
  armor: number
  sensors: number
  evasion: number
}

/**
 * Secondary (derived) stats calculated from primary stats, role bonuses, and schematics.
 * See Specs.md § 10 Secondary Stats.
 */
export interface ShipDerivedStats {
  /** hit points. Formula: size × 5 + armor × 10 + schematic bonuses + role bonuses */
  hullPoints: number
  /** Threat radius. Formula: floor(size × 1.5) + schematic bonuses + role bonuses */
  powerProjection: number
  /** BP cost per turn while on mission. Formula: max(1, floor(size / 3)) + bonuses */
  bpPerTurn: number
  /** Build time in turns. Formula: max(3, floor(size × 1)) + bonuses */
  buildTimeTurns: number
}

// ─── Ship ─────────────────────────────────────────────────────────────────────

/**
 * A commissioned ship in the game world.
 *
 * Ships carry schematics as local modifiers (applied at build time, permanent on the ship).
 * Empire tech bonuses are NOT stored as modifiers — they were baked in at build time
 * and reflected in the primary stats.
 */
export interface Ship {
  id: ShipId
  name: string
  role: ShipRole
  sizeVariant: SizeVariant
  primaryStats: ShipPrimaryStats
  derivedStats: ShipDerivedStats
  /** Mission-fitness scores derived from primary stats. Recalculated at build time. */
  abilities: ShipAbilities
  /** Current condition as a percentage (0-100). Degrades from damage. */
  condition: number
  captain: Captain
  serviceRecord: ServiceRecord
  status: ShipStatus
  /** Sector where this ship is currently stationed or returning to. */
  homeSectorId: SectorId
  /** Corporation or government ('government' for player-owned ships). */
  ownerCorpId: CorpId | 'government'
  /**
   * Schematics applied at build time as local modifiers.
   * These are permanent on this ship instance. If the corp develops better
   * schematics later, existing ships are not updated.
   *
   * Each modifier here targets a ship stat (e.g., 'firepower', 'armor').
   */
  modifiers: Modifier[]
  /**
   * IDs of schematics applied at build time (for display/history purposes).
   * Parallel to the modifiers but preserves the original schematic identity.
   */
  appliedSchematicIds: SchematicId[]
  /** Turn this ship was commissioned. */
  builtTurn: TurnNumber
}
