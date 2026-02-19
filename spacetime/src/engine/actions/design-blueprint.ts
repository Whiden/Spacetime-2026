/**
 * design-blueprint.ts — Ship stat generation from role, tech, corp, schematics, and size variant.
 *
 * Story 15.1 — Blueprint System.
 *
 * Formulas (see Features.md Story 15.1 and Specs.md § 10 Ships):
 *
 *   effective_base    = role_base_stat + empire_tech_bonus[stat]
 *   corp_modifier     = 0.7 + (corp_level × 0.06)
 *   final_stat        = floor((floor(effective_base × corp_modifier) + schematic_bonuses) × random(0.8, 1.2))
 *
 * Size variant multiplier applied to `size` stat and to `bp_per_turn` / `base_build_time`:
 *   Light ×0.75 | Standard ×1.0 | Heavy ×1.25 (floored)
 *
 * Secondary stats:
 *   hull_points       = size × 5 + armor × 10 + schematic_bonuses + role_bonuses
 *   power_projection  = floor(size × 1.5) + schematic_bonuses + role_bonuses
 *   bp_per_turn       = max(1, floor(size / 3)) + schematic_bonuses + role_bonuses  [then size-variant scaled]
 *   base_build_time   = max(3, floor(size × 1)) + schematic_bonuses + role_bonuses  [then size-variant scaled]
 *
 * Abilities:
 *   Fight         = floor((Firepower + floor(Armor × 0.75) + floor(Evasion × 0.5)) × Size / 2)
 *   Investigation = floor((floor(Speed × 0.75) + Sensors) × Size / 2)
 *   Support       = floor((floor(Firepower × 0.5) + floor(Sensors × 0.75)) × Size / 2)
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 15.2): Called from contract-phase.ts on ShipCommission completion to produce
 *   the actual Ship object (with generated name, captain, homeSectorId, etc.).
 * TODO (Story 15.4): fleet.store.ts holds the completed ships from this blueprint.
 */

import type { Ship, ShipPrimaryStats, ShipDerivedStats, ShipAbilities } from '../../types/ship'
import type { Schematic } from '../../types/science'
import type { Corporation } from '../../types/corporation'
import type { EmpireBonuses } from '../../types/empire'
import type { ShipId, CaptainId, SectorId, TurnNumber, CorpId } from '../../types/common'
import { ShipRole, SizeVariant, ShipStatus, CaptainExperience } from '../../types/common'
import { SHIP_ROLE_DEFINITIONS, SIZE_VARIANT_MULTIPLIERS } from '../../data/ship-roles'

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * All inputs needed to design a ship blueprint and generate a Ship object.
 */
export interface DesignBlueprintInput {
  /** Unique ID to assign to the ship. */
  shipId: ShipId
  /** Procedurally generated ship name. */
  shipName: string
  role: ShipRole
  sizeVariant: SizeVariant
  /** Corporation commissioning the ship. Level drives corp_modifier. */
  buildingCorp: Corporation
  /** Empire-wide cumulative tech bonuses (from discoveries). */
  empireBonuses: EmpireBonuses
  /**
   * Schematics owned by the building corp that will be applied to this ship.
   * Only schematics belonging to the building corp should be passed here.
   */
  corpSchematics: Schematic[]
  /** Sector where the ship will be stationed on completion. */
  homeSectorId: SectorId
  /** Turn the ship was commissioned/built. */
  builtTurn: TurnNumber
  /**
   * Random number generator — injectable for deterministic tests.
   * Must return values in [0, 1).
   */
  randFn?: () => number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sums schematic bonuses targeting a specific stat key.
 * e.g., statKey = 'armor' sums all schematics where statTarget === 'armor'.
 */
function sumSchematicBonuses(schematics: Schematic[], statKey: string): number {
  return schematics.reduce((sum, s) => (s.statTarget === statKey ? sum + s.bonusAmount : sum), 0)
}

/**
 * Generates a random multiplier uniformly in [0.8, 1.2].
 * Used per-stat so each stat varies independently.
 */
function randomMultiplier(randFn: () => number): number {
  // 0.8 + rand * 0.4 gives uniform [0.8, 1.2)
  return 0.8 + randFn() * 0.4
}

// ─── Primary Stat Generation ──────────────────────────────────────────────────

/**
 * Generates a single primary stat value.
 *
 * Formula:
 *   effective_base = role_base_stat + empire_tech_bonus[stat]
 *   corp_modifier  = 0.7 + (corp_level × 0.06)
 *   final_stat     = floor((floor(effective_base × corp_modifier) + schematic_bonuses) × random(0.8, 1.2))
 */
function generateStat(
  roleBaseStat: number,
  techBonus: number,
  corpLevel: number,
  schematicBonus: number,
  randFn: () => number,
): number {
  const effectiveBase = roleBaseStat + techBonus
  const corpModifier = 0.7 + corpLevel * 0.06
  const afterCorp = Math.floor(effectiveBase * corpModifier)
  const withSchematics = afterCorp + schematicBonus
  return Math.floor(withSchematics * randomMultiplier(randFn))
}

// ─── Ability Score Calculation ─────────────────────────────────────────────────

/**
 * Derives the three mission-fitness ability scores from primary stats.
 *
 * Fight         = floor((Firepower + floor(Armor × 0.75) + floor(Evasion × 0.5)) × Size / 2)
 * Investigation = floor((floor(Speed × 0.75) + Sensors) × Size / 2)
 * Support       = floor((floor(Firepower × 0.5) + floor(Sensors × 0.75)) × Size / 2)
 */
export function calculateShipAbilities(stats: ShipPrimaryStats): ShipAbilities {
  const { size, speed, firepower, armor, sensors, evasion } = stats
  return {
    fight: Math.floor((firepower + Math.floor(armor * 0.75) + Math.floor(evasion * 0.5)) * size / 2),
    investigation: Math.floor((Math.floor(speed * 0.75) + sensors) * size / 2),
    support: Math.floor((Math.floor(firepower * 0.5) + Math.floor(sensors * 0.75)) * size / 2),
  }
}

// ─── Main Action ──────────────────────────────────────────────────────────────

/**
 * Designs a ship blueprint and returns a fully typed Ship object.
 *
 * Steps:
 * 1. Look up role base stats and size variant multiplier.
 * 2. Generate each primary stat with empire tech, corp scaling, schematics, and random.
 * 3. Apply size variant multiplier to the `size` stat (floor).
 * 4. Calculate secondary stats from final primary stats + schematic/role bonuses.
 * 5. Apply size variant multiplier to `bp_per_turn` and `base_build_time` (floor).
 * 6. Calculate ability scores from final primary stats.
 * 7. Assemble and return the complete Ship object.
 */
export function designBlueprint(input: DesignBlueprintInput): Ship {
  const {
    shipId,
    shipName,
    role,
    sizeVariant,
    buildingCorp,
    empireBonuses,
    corpSchematics,
    homeSectorId,
    builtTurn,
    randFn = Math.random,
  } = input

  const roleDef = SHIP_ROLE_DEFINITIONS[role]
  const sizeMultipliers = SIZE_VARIANT_MULTIPLIERS[sizeVariant]
  const corpLevel = buildingCorp.level
  const techBonuses = empireBonuses.shipStats

  // ── Step 1: Generate each primary stat (before size variant on 'size') ──────
  // All stats except 'size' are generated identically. 'size' gets the variant multiplier.

  const rawSize = generateStat(
    roleDef.baseStats.size,
    techBonuses.size,
    corpLevel,
    sumSchematicBonuses(corpSchematics, 'size'),
    randFn,
  )

  const speed = generateStat(
    roleDef.baseStats.speed,
    techBonuses.speed,
    corpLevel,
    sumSchematicBonuses(corpSchematics, 'speed'),
    randFn,
  )

  const firepower = generateStat(
    roleDef.baseStats.firepower,
    techBonuses.firepower,
    corpLevel,
    sumSchematicBonuses(corpSchematics, 'firepower'),
    randFn,
  )

  const armor = generateStat(
    roleDef.baseStats.armor,
    techBonuses.armor,
    corpLevel,
    sumSchematicBonuses(corpSchematics, 'armor'),
    randFn,
  )

  const sensors = generateStat(
    roleDef.baseStats.sensors,
    techBonuses.sensors,
    corpLevel,
    sumSchematicBonuses(corpSchematics, 'sensors'),
    randFn,
  )

  const evasion = generateStat(
    roleDef.baseStats.evasion,
    techBonuses.evasion,
    corpLevel,
    sumSchematicBonuses(corpSchematics, 'evasion'),
    randFn,
  )

  // ── Step 2: Apply size variant multiplier to the size stat ──────────────────
  const size = Math.floor(rawSize * sizeMultipliers.sizeMultiplier)

  const primaryStats: ShipPrimaryStats = { size, speed, firepower, armor, sensors, evasion }

  // ── Step 3: Calculate secondary stats ──────────────────────────────────────
  const roleBonuses = roleDef.derivedStatBonuses

  const hullPoints =
    size * 5 +
    armor * 10 +
    sumSchematicBonuses(corpSchematics, 'hullPoints') +
    (roleBonuses.hullPoints ?? 0)

  const powerProjection =
    Math.floor(size * 1.5) +
    sumSchematicBonuses(corpSchematics, 'powerProjection') +
    (roleBonuses.powerProjection ?? 0)

  // bp_per_turn and base_build_time are computed from the raw (pre-variant) size stat,
  // then the variant multiplier is applied and floored.
  const baseBpPerTurn =
    Math.max(1, Math.floor(rawSize / 3)) +
    sumSchematicBonuses(corpSchematics, 'bpPerTurn') +
    (roleBonuses.bpPerTurn ?? 0)
  const bpPerTurn = Math.max(1, Math.floor(baseBpPerTurn * sizeMultipliers.costMultiplier))

  const baseBuildTime =
    Math.max(3, Math.floor(rawSize * 1)) +
    sumSchematicBonuses(corpSchematics, 'buildTimeTurns') +
    (roleBonuses.buildTimeTurns ?? 0)
  const buildTimeTurns = Math.max(1, Math.floor(baseBuildTime * sizeMultipliers.buildTimeMultiplier))

  const derivedStats: ShipDerivedStats = { hullPoints, powerProjection, bpPerTurn, buildTimeTurns }

  // ── Step 4: Ability scores ─────────────────────────────────────────────────
  const abilities: ShipAbilities = calculateShipAbilities(primaryStats)

  // ── Step 5: Build modifiers list from applied schematics ───────────────────
  // Schematics are stored as Modifier[] on the Ship so the UI can show attribution.
  // We generate one modifier per schematic that targets a primary stat.
  const modifiers = corpSchematics
    .filter((s) => s.bonusAmount > 0)
    .map((s) => ({
      id: `mod_sch_${s.id}` as any,
      target: s.statTarget,
      operation: 'add' as const,
      value: s.bonusAmount,
      sourceType: 'schematic' as const,
      sourceId: s.id,
    }))

  const appliedSchematicIds = corpSchematics.map((s) => s.id)

  // ── Step 6: Assemble Ship ──────────────────────────────────────────────────
  const ship: Ship = {
    id: shipId,
    name: shipName,
    role,
    sizeVariant,
    primaryStats,
    derivedStats,
    abilities,
    condition: 100,
    captain: {
      id: `cpt_blueprint_${shipId}` as CaptainId,
      name: 'Unassigned',
      experience: CaptainExperience.Green,
      missionsCompleted: 0,
      battlesCount: 0,
    },
    serviceRecord: {
      shipId,
      builtTurn,
      builtByCorpId: buildingCorp.id,
      missionsCompleted: 0,
      battlesCount: 0,
      destroyed: false,
      destroyedTurn: null,
    },
    status: ShipStatus.UnderConstruction,
    homeSectorId,
    ownerCorpId: 'government' as CorpId | 'government',
    modifiers,
    appliedSchematicIds,
    builtTurn,
  }

  return ship
}
