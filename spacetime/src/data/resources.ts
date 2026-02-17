/**
 * resources.ts — Resource type definitions and categories.
 * See Data.md § 1 Resources for the full resource list.
 */

import { ResourceType } from '../types/common'

export type ResourceCategory = 'extracted' | 'manufactured' | 'service'

export interface ResourceDefinition {
  type: ResourceType
  name: string
  category: ResourceCategory
  description: string
}

export const RESOURCES: Record<ResourceType, ResourceDefinition> = {
  [ResourceType.Food]: {
    type: ResourceType.Food,
    name: 'Food',
    category: 'extracted',
    description: 'Basic nutrition. Produced by agricultural infrastructure. Consumed by population.',
  },
  [ResourceType.CommonMaterials]: {
    type: ResourceType.CommonMaterials,
    name: 'Common Materials',
    category: 'extracted',
    description: 'Ore and raw materials. Produced by mining. Used as input by Low and Heavy Industry.',
  },
  [ResourceType.RareMaterials]: {
    type: ResourceType.RareMaterials,
    name: 'Rare Materials',
    category: 'extracted',
    description: 'High-value ore and minerals. Produced by deep mining. Used by Heavy and High-Tech Industry.',
  },
  [ResourceType.Volatiles]: {
    type: ResourceType.Volatiles,
    name: 'Volatiles',
    category: 'extracted',
    description: 'Gases and reactive compounds. Produced by gas extraction. Used by High-Tech Industry.',
  },
  [ResourceType.ConsumerGoods]: {
    type: ResourceType.ConsumerGoods,
    name: 'Consumer Goods',
    category: 'manufactured',
    description: 'Manufactured goods for daily life. Produced by Low Industry. Consumed by population.',
  },
  [ResourceType.HeavyMachinery]: {
    type: ResourceType.HeavyMachinery,
    name: 'Heavy Machinery',
    category: 'manufactured',
    description: 'Industrial equipment. Produced by Heavy Industry. Used by Space Industry.',
  },
  [ResourceType.HighTechGoods]: {
    type: ResourceType.HighTechGoods,
    name: 'High-Tech Goods',
    category: 'manufactured',
    description: 'Advanced technology products. Produced by High-Tech Industry. Used by Space Industry.',
  },
  [ResourceType.ShipParts]: {
    type: ResourceType.ShipParts,
    name: 'Ship Parts',
    category: 'manufactured',
    description: 'Components for ship construction and repair. Produced by Space Industry.',
  },
  [ResourceType.TransportCapacity]: {
    type: ResourceType.TransportCapacity,
    name: 'Transport Capacity',
    category: 'service',
    description: 'Logistical capacity. Produced by Transport infrastructure. Consumed locally by population.',
  },
}
