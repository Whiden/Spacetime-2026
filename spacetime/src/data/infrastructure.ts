/**
 * infrastructure.ts — Infrastructure domain definitions with production/consumption rules.
 * See Data.md § 7 Infrastructure Domains.
 */

import { InfraDomain, ResourceType } from '../types/common'

export type InfraCapRule =
  | { type: 'uncapped' }
  | { type: 'population_based' }           // pop_level × 2
  | { type: 'deposit_based' }               // richness cap from deposit

export interface InfraDomainDefinition {
  domain: InfraDomain
  name: string
  description: string
  produces: ResourceType | null
  consumes: ResourceType[]
  capRule: InfraCapRule
}

export const INFRA_DOMAIN_DEFINITIONS: Record<InfraDomain, InfraDomainDefinition> = {
  [InfraDomain.Civilian]: {
    domain: InfraDomain.Civilian,
    name: 'Civilian',
    description: 'Housing and general colony infrastructure. Supports population growth. Uncapped.',
    produces: null,
    consumes: [],
    capRule: { type: 'uncapped' },
  },
  [InfraDomain.Mining]: {
    domain: InfraDomain.Mining,
    name: 'Mining',
    description: 'Extracts Common Materials. Capped by ore deposit richness.',
    produces: ResourceType.CommonMaterials,
    consumes: [],
    capRule: { type: 'deposit_based' },
  },
  [InfraDomain.DeepMining]: {
    domain: InfraDomain.DeepMining,
    name: 'Deep Mining',
    description: 'Extracts Rare Materials. Capped by rare ore deposit richness.',
    produces: ResourceType.RareMaterials,
    consumes: [],
    capRule: { type: 'deposit_based' },
  },
  [InfraDomain.GasExtraction]: {
    domain: InfraDomain.GasExtraction,
    name: 'Gas Extraction',
    description: 'Extracts Volatiles. Capped by gas deposit richness.',
    produces: ResourceType.Volatiles,
    consumes: [],
    capRule: { type: 'deposit_based' },
  },
  [InfraDomain.Agricultural]: {
    domain: InfraDomain.Agricultural,
    name: 'Agricultural',
    description: 'Produces Food. Capped by fertile deposit richness.',
    produces: ResourceType.Food,
    consumes: [],
    capRule: { type: 'deposit_based' },
  },
  [InfraDomain.LowIndustry]: {
    domain: InfraDomain.LowIndustry,
    name: 'Low Industry',
    description: 'Manufactures Consumer Goods from Common Materials.',
    produces: ResourceType.ConsumerGoods,
    consumes: [ResourceType.CommonMaterials],
    capRule: { type: 'population_based' },
  },
  [InfraDomain.HeavyIndustry]: {
    domain: InfraDomain.HeavyIndustry,
    name: 'Heavy Industry',
    description: 'Manufactures Heavy Machinery from Common and Rare Materials.',
    produces: ResourceType.HeavyMachinery,
    consumes: [ResourceType.CommonMaterials, ResourceType.RareMaterials],
    capRule: { type: 'population_based' },
  },
  [InfraDomain.HighTechIndustry]: {
    domain: InfraDomain.HighTechIndustry,
    name: 'High-Tech Industry',
    description: 'Manufactures High-Tech Goods from Rare Materials and Volatiles.',
    produces: ResourceType.HighTechGoods,
    consumes: [ResourceType.RareMaterials, ResourceType.Volatiles],
    capRule: { type: 'population_based' },
  },
  [InfraDomain.SpaceIndustry]: {
    domain: InfraDomain.SpaceIndustry,
    name: 'Space Industry',
    description: 'Manufactures Ship Parts from High-Tech Goods and Heavy Machinery. Required for ship construction.',
    produces: ResourceType.ShipParts,
    consumes: [ResourceType.HighTechGoods, ResourceType.HeavyMachinery],
    capRule: { type: 'population_based' },
  },
  [InfraDomain.Transport]: {
    domain: InfraDomain.Transport,
    name: 'Transport',
    description: 'Produces Transport Capacity consumed locally by population. Drives accessibility.',
    produces: ResourceType.TransportCapacity,
    consumes: [],
    capRule: { type: 'population_based' },
  },
  [InfraDomain.Science]: {
    domain: InfraDomain.Science,
    name: 'Science',
    description: 'Generates Research Points that advance empire science domains.',
    produces: null, // RP is not a tradeable resource
    consumes: [],
    capRule: { type: 'population_based' },
  },
  [InfraDomain.Military]: {
    domain: InfraDomain.Military,
    name: 'Military',
    description: 'Generates Security Points that contribute to colony stability.',
    produces: null, // SP is not a tradeable resource
    consumes: [],
    capRule: { type: 'population_based' },
  },
}

/** Extraction domains (capped by deposit, produce from natural resources). */
export const EXTRACTION_DOMAINS: InfraDomain[] = [
  InfraDomain.Mining,
  InfraDomain.DeepMining,
  InfraDomain.GasExtraction,
  InfraDomain.Agricultural,
]

/** Manufacturing domains (capped by population, consume inputs). */
export const MANUFACTURING_DOMAINS: InfraDomain[] = [
  InfraDomain.LowIndustry,
  InfraDomain.HeavyIndustry,
  InfraDomain.HighTechIndustry,
  InfraDomain.SpaceIndustry,
]
