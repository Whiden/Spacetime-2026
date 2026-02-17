/**
 * planet-types.ts — Planet type definitions with base habitability, deposit pools, and spawn weights.
 * See Data.md § 3 Planet Types and § 3 Deposit Pools by Planet Type.
 */

import { PlanetType, DepositType } from '../types/common'

// ─── Deposit Pool Entry ───────────────────────────────────────────────────────

/** A deposit that can spawn on a planet type with a given probability tier. */
export interface DepositPoolEntry {
  type: DepositType
  /** 'guaranteed' = always spawns (1 minimum), chance = probability of spawning */
  tier: 'guaranteed' | 'common' | 'uncommon' | 'rare'
}

/** Tier chance mappings (used by planet-generator.ts) */
export const DEPOSIT_TIER_CHANCES = {
  guaranteed: 100, // Always spawns at least once
  common: 70,
  uncommon: 30,
  rare: 10,
} as const

// ─── Planet Type Definition ───────────────────────────────────────────────────

export interface PlanetTypeDefinition {
  type: PlanetType
  name: string
  baseHabitability: number
  spawnWeight: number
  depositPool: DepositPoolEntry[]
}

// ─── Planet Type Definitions ──────────────────────────────────────────────────

export const PLANET_TYPE_DEFINITIONS: Record<PlanetType, PlanetTypeDefinition> = {
  [PlanetType.Continental]: {
    type: PlanetType.Continental,
    name: 'Continental',
    baseHabitability: 8,
    spawnWeight: 8,
    depositPool: [
      { type: DepositType.FertileGround, tier: 'common' },
      { type: DepositType.CommonOreVein, tier: 'common' },
      { type: DepositType.CarbonBasedLand, tier: 'uncommon' },
      { type: DepositType.RichOcean, tier: 'uncommon' },
      { type: DepositType.AncientSeabed, tier: 'uncommon' },
      { type: DepositType.RareOreVein, tier: 'rare' },
    ],
  },
  [PlanetType.Jungle]: {
    type: PlanetType.Jungle,
    name: 'Jungle',
    baseHabitability: 6,
    spawnWeight: 7,
    depositPool: [
      { type: DepositType.FertileGround, tier: 'guaranteed' },
      { type: DepositType.CarbonBasedLand, tier: 'common' },
      { type: DepositType.CommonOreVein, tier: 'uncommon' },
      { type: DepositType.RareOreVein, tier: 'rare' },
    ],
  },
  [PlanetType.Water]: {
    type: PlanetType.Water,
    name: 'Water',
    baseHabitability: 5,
    spawnWeight: 6,
    depositPool: [
      { type: DepositType.RichOcean, tier: 'guaranteed' },
      { type: DepositType.FertileGround, tier: 'common' },
      { type: DepositType.ThermalVentEcosystem, tier: 'common' },
      { type: DepositType.GlacialDeposits, tier: 'uncommon' },
      { type: DepositType.CommonOreVein, tier: 'rare' },
    ],
  },
  [PlanetType.Swamp]: {
    type: PlanetType.Swamp,
    name: 'Swamp',
    baseHabitability: 4,
    spawnWeight: 8,
    depositPool: [
      { type: DepositType.FertileGround, tier: 'common' },
      { type: DepositType.CarbonBasedLand, tier: 'common' },
      { type: DepositType.RichOcean, tier: 'uncommon' },
      { type: DepositType.CommonOreVein, tier: 'rare' },
    ],
  },
  [PlanetType.Arid]: {
    type: PlanetType.Arid,
    name: 'Arid',
    baseHabitability: 4,
    spawnWeight: 10,
    depositPool: [
      { type: DepositType.SurfaceMetalFields, tier: 'guaranteed' },
      { type: DepositType.RareOreVein, tier: 'common' },
      { type: DepositType.CrystalFormations, tier: 'uncommon' },
      { type: DepositType.AncientSeabed, tier: 'uncommon' },
      { type: DepositType.GasPocket, tier: 'rare' },
    ],
  },
  [PlanetType.Tundra]: {
    type: PlanetType.Tundra,
    name: 'Tundra',
    baseHabitability: 3,
    spawnWeight: 10,
    depositPool: [
      { type: DepositType.CommonOreVein, tier: 'common' },
      { type: DepositType.GasPocket, tier: 'common' },
      { type: DepositType.SurfaceMetalFields, tier: 'uncommon' },
      { type: DepositType.SubsurfaceIceReserves, tier: 'uncommon' },
      { type: DepositType.GlacialDeposits, tier: 'uncommon' },
      { type: DepositType.FungalNetworks, tier: 'rare' },
      { type: DepositType.RareOreVein, tier: 'rare' },
    ],
  },
  [PlanetType.Rocky]: {
    type: PlanetType.Rocky,
    name: 'Rocky',
    baseHabitability: 2,
    spawnWeight: 15,
    depositPool: [
      { type: DepositType.CommonOreVein, tier: 'guaranteed' },
      { type: DepositType.RareOreVein, tier: 'common' },
      { type: DepositType.CrystalFormations, tier: 'uncommon' },
      { type: DepositType.TectonicSeams, tier: 'uncommon' },
      { type: DepositType.SubsurfaceIceReserves, tier: 'uncommon' },
      { type: DepositType.FungalNetworks, tier: 'rare' },
    ],
  },
  [PlanetType.Volcanic]: {
    type: PlanetType.Volcanic,
    name: 'Volcanic',
    baseHabitability: 2,
    spawnWeight: 10,
    depositPool: [
      { type: DepositType.RareOreVein, tier: 'common' },
      { type: DepositType.GasPocket, tier: 'common' },
      { type: DepositType.VolcanicFumaroles, tier: 'common' },
      { type: DepositType.CommonOreVein, tier: 'uncommon' },
      { type: DepositType.TectonicSeams, tier: 'uncommon' },
      { type: DepositType.CrystalFormations, tier: 'uncommon' },
      { type: DepositType.ThermalVentEcosystem, tier: 'rare' },
      { type: DepositType.CarbonBasedLand, tier: 'rare' },
    ],
  },
  [PlanetType.Barren]: {
    type: PlanetType.Barren,
    name: 'Barren',
    baseHabitability: 1,
    spawnWeight: 20,
    depositPool: [
      { type: DepositType.CommonOreVein, tier: 'common' },
      { type: DepositType.SurfaceMetalFields, tier: 'uncommon' },
      { type: DepositType.RareOreVein, tier: 'uncommon' },
      { type: DepositType.SubsurfaceIceReserves, tier: 'uncommon' },
      { type: DepositType.FungalNetworks, tier: 'rare' },
      { type: DepositType.AncientSeabed, tier: 'rare' },
    ],
  },
  [PlanetType.GasGiant]: {
    type: PlanetType.GasGiant,
    name: 'Gas Giant',
    baseHabitability: 0,
    spawnWeight: 6,
    depositPool: [
      { type: DepositType.AtmosphericLayers, tier: 'guaranteed' },
      { type: DepositType.GasPocket, tier: 'common' },
      { type: DepositType.RareOreVein, tier: 'rare' },
    ],
  },
}

/** Spawn weight array for weighted random planet type selection. */
export const PLANET_TYPE_SPAWN_WEIGHTS = Object.values(PLANET_TYPE_DEFINITIONS).map((def) => ({
  value: def.type,
  weight: def.spawnWeight,
}))
