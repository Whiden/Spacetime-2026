/**
 * planet-deposits.ts — Deposit type definitions, resource mappings, and richness levels.
 * See Data.md § 2 Deposits for the full deposit table.
 */

import { DepositType, ResourceType, RichnessLevel, InfraDomain, PlanetType } from '../types/common'

// ─── Richness Level Caps ──────────────────────────────────────────────────────

/** Infrastructure extraction cap per richness level. */
export const RICHNESS_CAPS: Record<RichnessLevel, number> = {
  [RichnessLevel.Poor]: 5,
  [RichnessLevel.Moderate]: 10,
  [RichnessLevel.Rich]: 15,
  [RichnessLevel.Exceptional]: 20,
}

/** Richness level spawn weights (relative). Used when generating a deposit's richness. */
export const RICHNESS_SPAWN_WEIGHTS: { richness: RichnessLevel; weight: number }[] = [
  { richness: RichnessLevel.Poor, weight: 30 },
  { richness: RichnessLevel.Moderate, weight: 40 },
  { richness: RichnessLevel.Rich, weight: 20 },
  { richness: RichnessLevel.Exceptional, weight: 10 },
]

// ─── Deposit Definition ───────────────────────────────────────────────────────

export interface DepositDefinition {
  type: DepositType
  name: string
  produces: ResourceType
  extractedBy: InfraDomain
  /** Max infrastructure bonus from this deposit (added to base richness cap). */
  maxInfraBonus: number
  /** Planet types this deposit can spawn on. */
  foundOn: PlanetType[]
}

// ─── Deposit Definitions ──────────────────────────────────────────────────────

export const DEPOSIT_DEFINITIONS: Record<DepositType, DepositDefinition> = {
  [DepositType.FertileGround]: {
    type: DepositType.FertileGround,
    name: 'Fertile Ground',
    produces: ResourceType.Food,
    extractedBy: InfraDomain.Agricultural,
    maxInfraBonus: 6,
    foundOn: [PlanetType.Continental, PlanetType.Jungle, PlanetType.Swamp, PlanetType.Water],
  },
  [DepositType.RichOcean]: {
    type: DepositType.RichOcean,
    name: 'Rich Ocean',
    produces: ResourceType.Food,
    extractedBy: InfraDomain.Agricultural,
    maxInfraBonus: 4,
    foundOn: [PlanetType.Water, PlanetType.Continental, PlanetType.Swamp],
  },
  [DepositType.FungalNetworks]: {
    type: DepositType.FungalNetworks,
    name: 'Fungal Networks',
    produces: ResourceType.Food,
    extractedBy: InfraDomain.Agricultural,
    maxInfraBonus: 3,
    foundOn: [PlanetType.Tundra, PlanetType.Rocky, PlanetType.Barren],
  },
  [DepositType.ThermalVentEcosystem]: {
    type: DepositType.ThermalVentEcosystem,
    name: 'Thermal Vent Ecosystem',
    produces: ResourceType.Food,
    extractedBy: InfraDomain.Agricultural,
    maxInfraBonus: 3,
    foundOn: [PlanetType.Volcanic, PlanetType.Water],
  },
  [DepositType.CommonOreVein]: {
    type: DepositType.CommonOreVein,
    name: 'Common Ore Vein',
    produces: ResourceType.CommonMaterials,
    extractedBy: InfraDomain.Mining,
    maxInfraBonus: 5,
    foundOn: [PlanetType.Continental, PlanetType.Rocky, PlanetType.Barren, PlanetType.Volcanic, PlanetType.Tundra],
  },
  [DepositType.CarbonBasedLand]: {
    type: DepositType.CarbonBasedLand,
    name: 'Carbon-Based Land',
    produces: ResourceType.CommonMaterials,
    extractedBy: InfraDomain.Mining,
    maxInfraBonus: 4,
    foundOn: [PlanetType.Continental, PlanetType.Jungle, PlanetType.Swamp],
  },
  [DepositType.SurfaceMetalFields]: {
    type: DepositType.SurfaceMetalFields,
    name: 'Surface Metal Fields',
    produces: ResourceType.CommonMaterials,
    extractedBy: InfraDomain.Mining,
    maxInfraBonus: 3,
    foundOn: [PlanetType.Arid, PlanetType.Barren, PlanetType.Tundra],
  },
  [DepositType.GlacialDeposits]: {
    type: DepositType.GlacialDeposits,
    name: 'Glacial Deposits',
    produces: ResourceType.CommonMaterials,
    extractedBy: InfraDomain.Mining,
    maxInfraBonus: 3,
    foundOn: [PlanetType.Tundra, PlanetType.Water],
  },
  [DepositType.RareOreVein]: {
    type: DepositType.RareOreVein,
    name: 'Rare Ore Vein',
    produces: ResourceType.RareMaterials,
    extractedBy: InfraDomain.DeepMining,
    maxInfraBonus: 4,
    foundOn: [PlanetType.Rocky, PlanetType.Volcanic, PlanetType.Barren, PlanetType.Arid],
  },
  [DepositType.CrystalFormations]: {
    type: DepositType.CrystalFormations,
    name: 'Crystal Formations',
    produces: ResourceType.RareMaterials,
    extractedBy: InfraDomain.DeepMining,
    maxInfraBonus: 3,
    foundOn: [PlanetType.Rocky, PlanetType.Volcanic, PlanetType.Arid],
  },
  [DepositType.TectonicSeams]: {
    type: DepositType.TectonicSeams,
    name: 'Tectonic Seams',
    produces: ResourceType.RareMaterials,
    extractedBy: InfraDomain.DeepMining,
    maxInfraBonus: 5,
    foundOn: [PlanetType.Volcanic, PlanetType.Rocky],
  },
  [DepositType.AncientSeabed]: {
    type: DepositType.AncientSeabed,
    name: 'Ancient Seabed',
    produces: ResourceType.RareMaterials,
    extractedBy: InfraDomain.DeepMining,
    maxInfraBonus: 3,
    foundOn: [PlanetType.Arid, PlanetType.Barren, PlanetType.Continental],
  },
  [DepositType.GasPocket]: {
    type: DepositType.GasPocket,
    name: 'Gas Pocket',
    produces: ResourceType.Volatiles,
    extractedBy: InfraDomain.GasExtraction,
    maxInfraBonus: 4,
    foundOn: [PlanetType.GasGiant, PlanetType.Volcanic, PlanetType.Tundra],
  },
  [DepositType.SubsurfaceIceReserves]: {
    type: DepositType.SubsurfaceIceReserves,
    name: 'Subsurface Ice Reserves',
    produces: ResourceType.Volatiles,
    extractedBy: InfraDomain.GasExtraction,
    maxInfraBonus: 3,
    foundOn: [PlanetType.Tundra, PlanetType.Barren, PlanetType.Rocky],
  },
  [DepositType.VolcanicFumaroles]: {
    type: DepositType.VolcanicFumaroles,
    name: 'Volcanic Fumaroles',
    produces: ResourceType.Volatiles,
    extractedBy: InfraDomain.GasExtraction,
    maxInfraBonus: 5,
    foundOn: [PlanetType.Volcanic],
  },
  [DepositType.AtmosphericLayers]: {
    type: DepositType.AtmosphericLayers,
    name: 'Atmospheric Layers',
    produces: ResourceType.Volatiles,
    extractedBy: InfraDomain.GasExtraction,
    maxInfraBonus: 6,
    foundOn: [PlanetType.GasGiant],
  },
}
