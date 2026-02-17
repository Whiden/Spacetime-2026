/**
 * ship-roles.ts — Ship role definitions with base stats, size ranges, and derived stat formulas.
 * See Data.md § 11 Ship Roles and Specs.md § 10 Ships.
 */

import { ShipRole, SizeVariant } from '../types/common'

export interface ShipRoleBaseStats {
  size: number
  speed: number
  firepower: number
  armor: number
  sensors: number
  evasion: number
}

export interface SizeVariantMultipliers {
  sizeMultiplier: number
  costMultiplier: number
  buildTimeMultiplier: number
}

export interface ShipRoleDefinition {
  role: ShipRole
  name: string
  description: string
  baseStats: ShipRoleBaseStats
  /** Derived stat bonuses applied on top of the formula (role-specific). */
  derivedStatBonuses: {
    hullPoints?: number
    powerProjection?: number
    bpPerTurn?: number
    buildTimeTurns?: number
  }
}

export const SHIP_ROLE_DEFINITIONS: Record<ShipRole, ShipRoleDefinition> = {
  [ShipRole.SystemPatrol]: {
    role: ShipRole.SystemPatrol,
    name: 'System Patrol',
    description: 'Local security vessel. Anti-piracy, deterrence, colony defense.',
    baseStats: { size: 3, speed: 5, firepower: 3, armor: 3, sensors: 4, evasion: 5 },
    derivedStatBonuses: {},
  },
  [ShipRole.Escort]: {
    role: ShipRole.Escort,
    name: 'Escort',
    description: 'Protects convoys and contracts from threats.',
    baseStats: { size: 4, speed: 4, firepower: 4, armor: 5, sensors: 3, evasion: 3 },
    derivedStatBonuses: { hullPoints: 5 },
  },
  [ShipRole.Recon]: {
    role: ShipRole.Recon,
    name: 'Recon',
    description: 'Fast scout for intelligence gathering and exploration support.',
    baseStats: { size: 2, speed: 6, firepower: 1, armor: 2, sensors: 7, evasion: 6 },
    derivedStatBonuses: { powerProjection: 2 },
  },
  [ShipRole.Assault]: {
    role: ShipRole.Assault,
    name: 'Assault',
    description: 'Heavy offensive combatant. The core of any attack force.',
    baseStats: { size: 6, speed: 3, firepower: 7, armor: 6, sensors: 3, evasion: 2 },
    derivedStatBonuses: { hullPoints: 10, powerProjection: 3 },
  },
  [ShipRole.Carrier]: {
    role: ShipRole.Carrier,
    name: 'Carrier',
    description: 'Fleet support vessel. Launches fighters and provides logistical backbone.',
    baseStats: { size: 7, speed: 2, firepower: 3, armor: 5, sensors: 4, evasion: 1 },
    derivedStatBonuses: { hullPoints: 15, powerProjection: 5 },
  },
  [ShipRole.Flagship]: {
    role: ShipRole.Flagship,
    name: 'Flagship',
    description: 'Command vessel. Projects authority and leads fleet operations.',
    baseStats: { size: 9, speed: 2, firepower: 6, armor: 8, sensors: 5, evasion: 1 },
    derivedStatBonuses: { hullPoints: 20, powerProjection: 8, bpPerTurn: 2 },
  },
  [ShipRole.Transport]: {
    role: ShipRole.Transport,
    name: 'Transport',
    description: 'Non-combat cargo and colonist vessel.',
    baseStats: { size: 4, speed: 3, firepower: 0, armor: 2, sensors: 2, evasion: 2 },
    derivedStatBonuses: {},
  },
}

/** Size variant multipliers applied to size, cost, and build time. */
export const SIZE_VARIANT_MULTIPLIERS: Record<SizeVariant, SizeVariantMultipliers> = {
  [SizeVariant.Light]: {
    sizeMultiplier: 0.75,
    costMultiplier: 0.75,
    buildTimeMultiplier: 0.75,
  },
  [SizeVariant.Standard]: {
    sizeMultiplier: 1.0,
    costMultiplier: 1.0,
    buildTimeMultiplier: 1.0,
  },
  [SizeVariant.Heavy]: {
    sizeMultiplier: 1.25,
    costMultiplier: 1.25,
    buildTimeMultiplier: 1.25,
  },
}

/** Captain experience combat modifiers. */
export const CAPTAIN_EXPERIENCE_MODIFIERS = {
  Green: 0.8,
  Regular: 1.0,
  Veteran: 1.1,
  Elite: 1.2,
} as const

/** Mission thresholds for captain experience advancement. */
export const CAPTAIN_EXPERIENCE_THRESHOLDS = {
  Regular: 2,  // After 2 missions
  Veteran: 5,  // After 5 missions
  Elite: 10,   // After 10 missions
} as const
