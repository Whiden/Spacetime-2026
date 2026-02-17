/**
 * resource.ts — Resource flow, production, consumption, and shortage types.
 *
 * Resources circulate through the empire via the sector market system.
 * Trade is automatic within sectors (gated by accessibility) and between sectors
 * via trade route contracts. There is no stockpiling — each turn is a clean flow.
 */

import type { ResourceType, ColonyId, SectorId } from './common'

// ─── Resource Flow ────────────────────────────────────────────────────────────

/**
 * A single resource's production/consumption snapshot for one colony in one turn.
 * Positive surplus means excess exported to sector market.
 * Negative surplus (deficit) means the colony needs to import.
 */
export interface ResourceFlow {
  resource: ResourceType
  /** Units produced locally this turn. */
  produced: number
  /** Units consumed locally this turn (population + industrial input). */
  consumed: number
  /**
   * produced - consumed.
   * Positive: surplus available for sector market.
   * Negative: deficit to be filled from sector market.
   */
  surplus: number
  /**
   * Units received from sector market this turn.
   * Zero if the colony had no deficit or market was empty.
   */
  imported: number
  /**
   * Whether this resource is in shortage after market resolution.
   * Shortage = deficit that could not be filled from the sector market.
   */
  inShortage: boolean
}

// ─── Colony Resource Summary ──────────────────────────────────────────────────

/**
 * Complete resource flow summary for a single colony after market resolution.
 * One entry per ResourceType.
 *
 * TODO (Story 8.2): Calculated by colony-sim.ts production section.
 * TODO (Story 9.1): Market resolution fills imports and sets inShortage.
 */
export type ColonyResourceSummary = Record<ResourceType, ResourceFlow>

// ─── Shortage ─────────────────────────────────────────────────────────────────

/**
 * A shortage record for a specific resource on a specific colony.
 * Used by market-phase.ts to apply shortage modifier penalties.
 *
 * Shortage maluses (from Specs.md § 7):
 * - Food shortage: -2 QoL modifier
 * - ConsumerGoods shortage: -1 QoL modifier
 * - TransportCapacity shortage: -1 Accessibility modifier
 * - Industrial input shortage: -50% output from affected industry
 */
export interface Shortage {
  colonyId: ColonyId
  resource: ResourceType
  /** The deficit amount that could not be filled (in units). */
  deficitAmount: number
}

// ─── Sector Market State ──────────────────────────────────────────────────────

/**
 * The aggregated market state for a single sector after turn resolution.
 * Tracks totals across all colonies in the sector.
 *
 * TODO (Story 9.1): Populated by market-resolver.ts.
 * TODO (Story 9.3): Stored in market.store.ts.
 */
export interface SectorMarketSummary {
  sectorId: SectorId
  /** Total production per resource across all colonies in the sector. */
  totalProduction: Record<ResourceType, number>
  /** Total consumption per resource across all colonies in the sector. */
  totalConsumption: Record<ResourceType, number>
  /**
   * Net surplus per resource (positive = sector can export, negative = sector imports).
   * Used for cross-sector trade route resolution.
   */
  netSurplus: Record<ResourceType, number>
  /** All shortages detected in this sector this turn. */
  shortages: Shortage[]
}

// ─── Export Bonus ─────────────────────────────────────────────────────────────

/**
 * Attribute bonus granted to a colony for successfully exporting to the sector market.
 * Applied by market-phase.ts after market resolution.
 *
 * TODO (Story 9.2): Export bonuses defined in data/resources.ts and applied in market-phase.
 */
export interface ExportBonus {
  colonyId: ColonyId
  resource: ResourceType
  /** The attribute target (e.g., 'dynamism', 'qualityOfLife'). */
  attributeTarget: string
  bonusAmount: number
}
