/**
 * trade.ts — Trade route and cross-sector trade flow types.
 *
 * Trade is automatic within sectors (via sector market) and between adjacent sectors
 * via trade route contracts. Cross-sector surplus sharing occurs at 50% efficiency.
 *
 * TODO (Story 17.1): create-trade-route.ts implements trade route contracts.
 * TODO (Story 17.2): market-resolver.ts handles cross-sector trade flow.
 */

import type { ContractId, SectorId, ResourceType } from './common'

// ─── Trade Route ──────────────────────────────────────────────────────────────

/**
 * An active trade route between two adjacent sectors.
 * Created as an ongoing contract (no end date) with a Transport corporation.
 *
 * Without a trade route, sectors are economically isolated.
 * Cross-sector efficiency: 50% (only half the surplus is available to the other sector).
 */
export interface TradeRoute {
  contractId: ContractId
  sectorIdA: SectorId
  sectorIdB: SectorId
  /** Whether this trade route is currently active (contract not cancelled). */
  active: boolean
}

// ─── Trade Flow ───────────────────────────────────────────────────────────────

/**
 * Cross-sector trade flow for a single resource in one turn direction.
 * Flows from the surplus sector to the deficit sector.
 */
export interface TradeFlow {
  fromSectorId: SectorId
  toSectorId: SectorId
  resource: ResourceType
  /** Amount of surplus available from the exporting sector. */
  surplusAvailable: number
  /**
   * Actual amount transferred after 50% efficiency.
   * transferred = floor(surplusAvailable × 0.5)
   */
  transferred: number
  /** Amount actually received by deficit colonies in the importing sector. */
  received: number
}

// ─── Sector Market State ──────────────────────────────────────────────────────

/**
 * Complete market state for a sector after a turn's market resolution.
 * Includes internal resolution and cross-sector flows.
 *
 * TODO (Story 9.3): Stored in market.store.ts.
 */
export interface SectorMarketState {
  sectorId: SectorId
  /** Total production per resource across all colonies. */
  totalProduction: Record<ResourceType, number>
  /** Total consumption per resource across all colonies. */
  totalConsumption: Record<ResourceType, number>
  /** Net surplus after internal consumption (positive = export available). */
  netSurplus: Record<ResourceType, number>
  /** Inbound trade flows from adjacent sectors via trade routes. */
  inboundFlows: TradeFlow[]
  /** Outbound trade flows to adjacent sectors via trade routes. */
  outboundFlows: TradeFlow[]
}
