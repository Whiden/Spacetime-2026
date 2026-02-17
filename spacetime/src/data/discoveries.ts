/**
 * discoveries.ts — Discovery pool definitions per science domain per level.
 * See Data.md § 13 Science Domains & Discoveries.
 *
 * Discoveries are revealed to the player when a science corp achieves them.
 * Each discovery increments empireBonuses, unlocks schematic categories, or
 * improves empire-wide capabilities.
 *
 * TODO (Story 14.2): science-sim.ts draws from these pools when discoveries are made.
 * TODO: This is a placeholder structure. Full discovery tables to be expanded during implementation.
 */

import { ScienceSectorType, SchematicCategory } from '../types/common'

export interface DiscoveryDefinition {
  definitionId: string
  name: string
  domain: ScienceSectorType
  poolLevel: number
  description: string
  /** EmpireBonuses keys to increment and by how much. */
  empireBonusEffects: { key: string; amount: number }[]
  /** Schematic categories this discovery makes available to shipbuilding corps. */
  unlocksSchematicCategories: SchematicCategory[]
}

/**
 * Discovery pool organized by domain then level.
 * All level 1 discoveries (Space Age → New Age transition).
 *
 * TODO: Expand this table with full discovery effects during Story 14 implementation.
 * The entries below are stubs with placeholder effects.
 */
export const DISCOVERY_DEFINITIONS: DiscoveryDefinition[] = [
  // ─── Society Level 1 ───────────────────────────────────────────────────────
  {
    definitionId: 'society_1_administration',
    name: 'New Age Administration',
    domain: ScienceSectorType.Society,
    poolLevel: 1,
    description: 'Modern administrative techniques adapted for interstellar governance.',
    empireBonusEffects: [],
    unlocksSchematicCategories: [],
  },

  // ─── Energy Level 1 ────────────────────────────────────────────────────────
  {
    definitionId: 'energy_1_fusion',
    name: 'Fusion Technology',
    domain: ScienceSectorType.Energy,
    poolLevel: 1,
    description: 'Compact fusion reactors unlock new possibilities in power generation.',
    empireBonusEffects: [],
    unlocksSchematicCategories: [SchematicCategory.Reactor],
  },

  // ─── Applied Sciences Level 1 ──────────────────────────────────────────────
  {
    definitionId: 'applied_1_prefab',
    name: 'Prefab Systems',
    domain: ScienceSectorType.AppliedSciences,
    poolLevel: 1,
    description: 'Modular construction components reduce colony setup time.',
    empireBonusEffects: [],
    unlocksSchematicCategories: [],
  },

  // ─── Weaponry Level 1 ──────────────────────────────────────────────────────
  {
    definitionId: 'weaponry_1_railgun',
    name: 'Space-Compatible Railgun',
    domain: ScienceSectorType.Weaponry,
    poolLevel: 1,
    description: 'Electromagnetic accelerators adapted for zero-gravity combat.',
    empireBonusEffects: [{ key: 'shipStats.firepower', amount: 1 }],
    unlocksSchematicCategories: [SchematicCategory.Turret, SchematicCategory.Missile],
  },

  // ─── Propulsion Level 1 ────────────────────────────────────────────────────
  {
    definitionId: 'propulsion_1_ion',
    name: 'Ion Drives',
    domain: ScienceSectorType.Propulsion,
    poolLevel: 1,
    description: 'High-efficiency ion propulsion reduces travel times across sectors.',
    empireBonusEffects: [{ key: 'shipStats.speed', amount: 1 }],
    unlocksSchematicCategories: [SchematicCategory.Engine],
  },

  // ─── Construction Level 1 ──────────────────────────────────────────────────
  {
    definitionId: 'construction_1_autonomous',
    name: 'Autonomous Systems',
    domain: ScienceSectorType.Construction,
    poolLevel: 1,
    description: 'Automated construction drones expand colony building capacity.',
    empireBonusEffects: [],
    unlocksSchematicCategories: [],
  },

  // ─── Life Sciences Level 1 ─────────────────────────────────────────────────
  {
    definitionId: 'lifesciences_1_treatments',
    name: 'Space Treatments',
    domain: ScienceSectorType.LifeSciences,
    poolLevel: 1,
    description: 'Medical advances counter the health effects of space travel and alien environments.',
    empireBonusEffects: [],
    unlocksSchematicCategories: [],
  },

  // ─── Materials Level 1 ─────────────────────────────────────────────────────
  {
    definitionId: 'materials_1_composite',
    name: 'Composite Armor',
    domain: ScienceSectorType.Materials,
    poolLevel: 1,
    description: 'Layered composite materials vastly improve ship and colony structural resilience.',
    empireBonusEffects: [{ key: 'shipStats.armor', amount: 1 }],
    unlocksSchematicCategories: [SchematicCategory.Armor, SchematicCategory.Hull],
  },

  // ─── Computing Level 1 ─────────────────────────────────────────────────────
  {
    definitionId: 'computing_1_basic_ai',
    name: 'Basic AI',
    domain: ScienceSectorType.Computing,
    poolLevel: 1,
    description: 'Primitive artificial intelligence enhances sensor resolution and targeting.',
    empireBonusEffects: [{ key: 'shipStats.sensors', amount: 1 }],
    unlocksSchematicCategories: [SchematicCategory.Sensor, SchematicCategory.TargetingSystem, SchematicCategory.ElectronicSystems],
  },
]

/** Lookup map: get all discoveries for a specific domain at a specific level. */
export function getDiscoveryPool(domain: ScienceSectorType, level: number): DiscoveryDefinition[] {
  return DISCOVERY_DEFINITIONS.filter((d) => d.domain === domain && d.poolLevel === level)
}
