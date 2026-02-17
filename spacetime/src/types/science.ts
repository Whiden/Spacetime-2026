/**
 * science.ts — Science sector, discovery, schematic, and patent types.
 *
 * Science is fully organic. The player does not direct research.
 * Science output from colonies advances domain levels, which unlock discovery pools,
 * which science corps draw from each turn.
 *
 * TODO (Story 14.1): science-sim.ts implements accumulation and level advancement.
 * TODO (Story 14.2): Discovery rolling for science corps.
 * TODO (Story 14.3): schematic-generator.ts creates Schematic objects.
 * TODO (Story 14.5): science.store.ts holds domain state and discoveries.
 */

import type {
  DiscoveryId,
  SchematicId,
  PatentId,
  CorpId,
  TurnNumber,
  ScienceSectorType,
  SchematicCategory,
} from './common'

// ─── Science Domain State ─────────────────────────────────────────────────────

/**
 * The current state of one science domain (sector).
 * Advances organically based on empire science output.
 */
export interface ScienceDomainState {
  type: ScienceSectorType
  /** Current level. Starts at 0. Threshold to next: current_level × 15. */
  level: number
  /** Accumulated science points toward next level. */
  accumulatedPoints: number
  /** Science points needed to reach the next level (current_level × 15). */
  thresholdToNextLevel: number
  /** Whether this domain is currently focused (doubles output and discovery chance). */
  focused: boolean
  /** IDs of discoveries already made in this domain. */
  discoveredIds: DiscoveryId[]
  /** IDs of schematic categories unlocked by discoveries in this domain. */
  unlockedSchematicCategories: SchematicCategory[]
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * A science discovery made by a science corporation from a discovery pool.
 * Discoveries are permanent and empire-wide.
 *
 * Effects can include:
 * - Incrementing EmpireBonuses values (shipStats, infraCaps)
 * - Unlocking schematic categories for shipbuilding corps
 * - Improving colony management (future features)
 */
export interface Discovery {
  id: DiscoveryId
  name: string
  description: string
  domain: ScienceSectorType
  /** Level of the domain pool this discovery belongs to. */
  poolLevel: number
  /** The corp that made this discovery. */
  discoveredByCorpId: CorpId
  /** Turn this discovery was made. */
  discoveredTurn: TurnNumber
  /**
   * EmpireBonuses keys to increment and their amounts.
   * Example: [{ key: 'shipStats.speed', amount: 1 }]
   * Applied to gameState.empireBonuses when discovery is made.
   *
   * TODO (Story 14.2): Discovery effect application in science-phase.ts.
   */
  empireBonusEffects: { key: string; amount: number }[]
  /** Schematic categories this discovery unlocks for shipbuilding corps. */
  unlocksSchematicCategories: SchematicCategory[]
}

// ─── Schematic ────────────────────────────────────────────────────────────────

/**
 * A unique equipment blueprint owned by a shipbuilding corporation.
 * Schematics are applied to every ship that corp builds.
 * When the parent science domain levels up, all schematics update their base stats.
 *
 * TODO (Story 14.3): schematic-generator.ts creates these objects.
 * TODO (Story 15.1): design-blueprint.ts applies schematics when commissioning a ship.
 */
export interface Schematic {
  id: SchematicId
  name: string
  category: SchematicCategory
  /** Domain that drove this schematic's unlock. */
  scienceDomain: ScienceSectorType
  /** Current level of this schematic (tracks the parent science domain level). */
  level: number
  /** The ship stat this schematic modifies (e.g., 'firepower', 'armor'). */
  statTarget: string
  /** Base bonus amount for this level. */
  bonusAmount: number
  /** The corp that owns and applies this schematic. */
  ownerCorpId: CorpId
  /** The discovery that enabled this schematic's category. */
  sourceDiscoveryId: DiscoveryId
}

// ─── Patent ───────────────────────────────────────────────────────────────────

/**
 * A technological advantage owned by any corporation type.
 * Improves how the corp operates (contract speed, extraction efficiency, etc.).
 *
 * TODO (Story 14.4): Patent development rolls in science-phase.ts.
 * TODO: Patent effects are placeholders until full implementation.
 */
export interface Patent {
  id: PatentId
  name: string
  /** The operational bonus this patent provides (e.g., 'contractSpeed', 'extractionEfficiency'). */
  bonusTarget: string
  bonusAmount: number
  /** The corp that owns this patent. */
  ownerCorpId: CorpId
  /** The discovery that enabled this patent. */
  sourceDiscoveryId: DiscoveryId
  level: number
}
