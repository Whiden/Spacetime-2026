/**
 * schematics.ts — Schematic category definitions, stat affinities, level scaling, and name pools.
 * See Data.md § 12 Schematics.
 *
 * TODO (Story 14.3): schematic-generator.ts uses these definitions to generate corp schematics.
 * TODO: Schematic bonus-per-level values are placeholder — to be tuned during playtesting.
 */

import { SchematicCategory } from '../types/common'

export interface SchematicCategoryDefinition {
  category: SchematicCategory
  name: string
  description: string
  /** Which ship stat this schematic type primarily affects. */
  primaryStatTarget: string
  /** Base bonus value at level 1. Scales with science domain level. */
  baseBonusPerLevel: number
}

export const SCHEMATIC_CATEGORY_DEFINITIONS: Record<SchematicCategory, SchematicCategoryDefinition> = {
  [SchematicCategory.Hull]: {
    category: SchematicCategory.Hull,
    name: 'Hull',
    description: 'Structural reinforcement. Increases hull points.',
    primaryStatTarget: 'hullPoints',
    baseBonusPerLevel: 10,
  },
  [SchematicCategory.Sensor]: {
    category: SchematicCategory.Sensor,
    name: 'Sensor',
    description: 'Detection array. Increases sensor rating.',
    primaryStatTarget: 'sensors',
    baseBonusPerLevel: 1,
  },
  [SchematicCategory.Armor]: {
    category: SchematicCategory.Armor,
    name: 'Armor',
    description: 'Protective plating. Increases armor rating.',
    primaryStatTarget: 'armor',
    baseBonusPerLevel: 1,
  },
  [SchematicCategory.Shield]: {
    category: SchematicCategory.Shield,
    name: 'Shield',
    description: 'Energy shielding system. Increases effective armor.',
    primaryStatTarget: 'armor',
    baseBonusPerLevel: 2,
  },
  [SchematicCategory.Turret]: {
    category: SchematicCategory.Turret,
    name: 'Turret',
    description: 'Defensive weapon emplacement. Increases firepower.',
    primaryStatTarget: 'firepower',
    baseBonusPerLevel: 1,
  },
  [SchematicCategory.Missile]: {
    category: SchematicCategory.Missile,
    name: 'Missile',
    description: 'Long-range strike system. Significantly increases firepower.',
    primaryStatTarget: 'firepower',
    baseBonusPerLevel: 2,
  },
  [SchematicCategory.Reactor]: {
    category: SchematicCategory.Reactor,
    name: 'Reactor',
    description: 'Power generation system. Increases overall combat effectiveness.',
    primaryStatTarget: 'powerProjection',
    baseBonusPerLevel: 3,
  },
  [SchematicCategory.Engine]: {
    category: SchematicCategory.Engine,
    name: 'Engine',
    description: 'Propulsion system. Increases speed and evasion.',
    primaryStatTarget: 'speed',
    baseBonusPerLevel: 1,
  },
  [SchematicCategory.TargetingSystem]: {
    category: SchematicCategory.TargetingSystem,
    name: 'Targeting System',
    description: 'Fire control computer. Increases firepower and sensors.',
    primaryStatTarget: 'firepower',
    baseBonusPerLevel: 1,
  },
  [SchematicCategory.Fighter]: {
    category: SchematicCategory.Fighter,
    name: 'Fighter Bay',
    description: 'Fighter complement. Increases power projection for carrier-class ships.',
    primaryStatTarget: 'powerProjection',
    baseBonusPerLevel: 2,
  },
  [SchematicCategory.Bomber]: {
    category: SchematicCategory.Bomber,
    name: 'Bomber Bay',
    description: 'Heavy strike craft. Increases firepower for carrier-class ships.',
    primaryStatTarget: 'firepower',
    baseBonusPerLevel: 3,
  },
  [SchematicCategory.Gunship]: {
    category: SchematicCategory.Gunship,
    name: 'Gunship Bay',
    description: 'Combat support craft. Increases armor and firepower.',
    primaryStatTarget: 'armor',
    baseBonusPerLevel: 2,
  },
  [SchematicCategory.ElectronicSystems]: {
    category: SchematicCategory.ElectronicSystems,
    name: 'Electronic Systems',
    description: 'ECM and signals intelligence. Increases sensors and evasion.',
    primaryStatTarget: 'sensors',
    baseBonusPerLevel: 2,
  },
}

// ─── Schematic Name Generation Pools ─────────────────────────────────────────

export const SCHEMATIC_NAME_PREFIXES: string[] = [
  'Aegis', 'Apex', 'Arc', 'Atlas',
  'Banshee', 'Bastion',
  'Centauri', 'Chimera', 'Citadel', 'Cobra', 'Condor',
  'Delta', 'Dominus', 'Drake',
  'Eclipse', 'Ember', 'Epoch',
  'Falcon', 'Fenrir', 'Ferrum', 'Forge',
  'Gorgon', 'Gryphon',
  'Harbinger', 'Hellfire', 'Helix', 'Hydra',
  'Ignition', 'Ironclad',
  'Javelin',
  'Kraken',
  'Lance', 'Leviathan', 'Lynx',
  'Maelstrom', 'Magnus', 'Mantis', 'Meridian',
  'Nemesis', 'Nova',
  'Obsidian', 'Omega',
  'Paladin', 'Phantom', 'Phoenix', 'Predator',
  'Quantum',
  'Raptor', 'Rift', 'Rogue',
  'Sentinel', 'Serpent', 'Shadow', 'Shrike', 'Specter',
  'Stalker', 'Storm', 'Striker',
  'Tempest', 'Titan', 'Torch', 'Typhoon',
  'Umbra',
  'Valkyrie', 'Vanguard', 'Vengeance', 'Vortex', 'Vulture',
  'Warlock', 'Warlord', 'Wrath',
]

export const SCHEMATIC_NAME_SUFFIXES: string[] = [
  'Array', 'Armor',
  'Battery',
  'Cannon', 'Chassis', 'Coil', 'Core',
  'Drive',
  'Engine',
  'Frame',
  'Grid',
  'Lance', 'Launcher',
  'Matrix', 'Module',
  'Network',
  'Plate', 'Plating',
  'Reactor',
  'Shield', 'Shielding',
  'System', 'Suite',
  'Thruster',
  'Unit',
  'Warhead',
]

/** Level naming prefixes for schematic upgrades (e.g., "Typhoon Missile Mk2"). */
export const SCHEMATIC_LEVEL_LABEL = (level: number): string =>
  level === 1 ? '' : ` Mk${level}`
