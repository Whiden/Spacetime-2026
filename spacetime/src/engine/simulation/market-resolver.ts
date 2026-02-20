/**
 * market-resolver.ts — Sector market resolution logic.
 *
 * Implements the five-phase sector market resolution from Specs.md § 7:
 *   Phase 1: Collect production from all colonies in the sector.
 *   Phase 2: Each colony consumes its own production first (internal consumption).
 *   Phase 3: Remaining production (surplus) goes to the sector market pool.
 *   Phase 4: Colonies sorted by dynamism (highest first) fill deficits from the pool.
 *   Phase 5: Unfilled deficits become shortages.
 *
 * Transport Capacity is a special case: it is produced and consumed locally and is
 * never traded. TC shortages are detected immediately (no market resolution phase).
 *
 * Export Bonuses: A colony that contributes surplus that is actually consumed by
 * another colony receives +1 Dynamism. Applied by market-phase.ts (Story 9.2).
 *
 * Cross-Sector Trade (Story 17.2):
 *   After all sectors resolve internally, `applyCrossSectorTrade()` flows surplus
 *   between connected sectors via active trade routes at 50% efficiency.
 *   Dynamism-priority purchasing still applies within the importing sector.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 */

import type { Colony } from '../../types/colony'
import type { Deposit } from '../../types/planet'
import type { ColonyResourceSummary, ResourceFlow, Shortage, SectorMarketSummary, ExportBonus } from '../../types/resource'
import type { SectorId, ColonyId } from '../../types/common'
import type { TradeFlow } from '../../types/trade'
import { ResourceType } from '../../types/common'
import { calculateColonyResourceFlow } from './colony-sim'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Resources that can be traded on the sector market.
 * Transport Capacity is excluded — it is consumed locally and never enters the market pool.
 */
const TRADEABLE_RESOURCES: ResourceType[] = [
  ResourceType.Food,
  ResourceType.CommonMaterials,
  ResourceType.RareMaterials,
  ResourceType.Volatiles,
  ResourceType.ConsumerGoods,
  ResourceType.HeavyMachinery,
  ResourceType.HighTechGoods,
  ResourceType.ShipParts,
]

/**
 * Export bonus granted to a colony that contributes surplus goods to the sector
 * market that are actually consumed by another colony.
 *
 * One bonus per exported resource type per colony, targeting 'dynamism'.
 * Applied by market-phase.ts (Story 9.2).
 *
 * TODO (Story 9.4): Define a proper export bonus table in Data.md when
 *   market display is implemented. Currently a flat +1 Dynamism per resource type.
 */
const EXPORT_BONUS_ATTRIBUTE = 'dynamism'
const EXPORT_BONUS_AMOUNT = 1

// ─── Result Type ──────────────────────────────────────────────────────────────

/**
 * The full output of a single sector's market resolution for one turn.
 */
export interface MarketResolverResult {
  /**
   * Updated resource summaries per colony.
   * `imported` and `inShortage` fields are filled in (they are zero/false from colony-sim).
   * Key is the ColonyId string.
   */
  colonyFlows: Map<string, ColonyResourceSummary>

  /** Aggregate market statistics for this sector. */
  sectorSummary: SectorMarketSummary

  /**
   * Export bonuses for colonies that successfully exported to the market.
   * Applied by market-phase.ts (Story 9.2).
   */
  exportBonuses: ExportBonus[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a zero-initialised per-resource record. */
function zeroRecord(): Record<ResourceType, number> {
  const record = {} as Record<ResourceType, number>
  for (const r of Object.values(ResourceType)) {
    record[r] = 0
  }
  return record
}

// ─── Market Resolver ──────────────────────────────────────────────────────────

/**
 * Resolves the sector market for one turn for a single sector.
 *
 * @param sectorId    The sector being resolved (for the summary record).
 * @param colonies    All colonies in the sector.
 * @param depositsMap Map of ColonyId string → Deposit[] for that colony's planet.
 * @returns           MarketResolverResult with updated flows, summary, and bonuses.
 */
export function resolveMarket(
  sectorId: SectorId,
  colonies: Colony[],
  depositsMap: Map<string, Deposit[]>,
): MarketResolverResult {

  // ── Phase 1: Calculate raw resource flows for all colonies ─────────────────
  // colony-sim.ts computes produced, consumed, surplus for each resource.
  // At this point, imported=0 and inShortage=false (pre-market defaults).

  const rawFlows = new Map<string, ColonyResourceSummary>()
  for (const colony of colonies) {
    const deposits = depositsMap.get(colony.id) ?? []
    rawFlows.set(colony.id, calculateColonyResourceFlow(colony, deposits))
  }

  // ── Phase 2 & 3: Internal consumption already captured in raw flows ─────────
  // colony-sim sets surplus = produced - consumed.
  // Positive surplus → colony has excess → goes to sector pool.
  // Negative surplus → colony has deficit → needs to draw from pool.

  // ── Build the sector market pool ───────────────────────────────────────────
  // Pool[resource] = sum of all positive surpluses across colonies.
  // Track initial pool size to detect whether surplus was consumed later.

  const pool = new Map<ResourceType, number>()
  for (const resource of TRADEABLE_RESOURCES) {
    let total = 0
    for (const colony of colonies) {
      const flow = rawFlows.get(colony.id)![resource]
      if (flow.surplus > 0) {
        total += flow.surplus
      }
    }
    pool.set(resource, total)
  }

  // Snapshot pool before deficit purchasing — used to detect export activity.
  const initialPool = new Map<ResourceType, number>(pool)

  // ── Phase 4: Deficit purchasing — dynamism priority ───────────────────────
  // Colonies sorted highest dynamism first get first access to the pool.

  const sortedColonies = [...colonies].sort(
    (a, b) => b.attributes.dynamism - a.attributes.dynamism,
  )

  // imported[colonyId][resource] = units received from the market pool.
  const imported = new Map<string, Map<ResourceType, number>>()
  for (const colony of colonies) {
    imported.set(colony.id, new Map())
  }

  for (const colony of sortedColonies) {
    const colonyImports = imported.get(colony.id)!
    for (const resource of TRADEABLE_RESOURCES) {
      const flow = rawFlows.get(colony.id)![resource]
      // Only colonies with a deficit draw from the pool.
      if (flow.surplus < 0) {
        const deficit = -flow.surplus
        const available = pool.get(resource) ?? 0
        const received = Math.min(deficit, available)
        pool.set(resource, available - received)
        colonyImports.set(resource, received)
      }
    }
  }

  // ── Phase 5: Assemble updated flows, detect shortages ──────────────────────

  const colonyFlows = new Map<string, ColonyResourceSummary>()
  const sectorShortages: Shortage[] = []

  for (const colony of colonies) {
    const raw = rawFlows.get(colony.id)!
    const colonyImports = imported.get(colony.id)!

    // Build an updated copy of the resource summary for this colony.
    const updated: Partial<Record<ResourceType, ResourceFlow>> = {}

    // Tradeable resources: fill imports and check for remaining deficits.
    for (const resource of TRADEABLE_RESOURCES) {
      const flow = raw[resource]
      const recv = colonyImports.get(resource) ?? 0
      // Remaining deficit after importing from the market.
      const remainingDeficit = Math.max(0, -flow.surplus - recv)
      const inShortage = remainingDeficit > 0

      updated[resource] = {
        ...flow,
        imported: recv,
        inShortage,
      }

      if (inShortage) {
        sectorShortages.push({
          colonyId: colony.id as ColonyId,
          resource,
          deficitAmount: remainingDeficit,
        })
      }
    }

    // Transport Capacity: local-only, never traded.
    // Shortage = produced < consumed; no import possible.
    {
      const tcFlow = raw[ResourceType.TransportCapacity]
      const tcInShortage = tcFlow.surplus < 0
      updated[ResourceType.TransportCapacity] = {
        ...tcFlow,
        imported: 0,
        inShortage: tcInShortage,
      }
      if (tcInShortage) {
        sectorShortages.push({
          colonyId: colony.id as ColonyId,
          resource: ResourceType.TransportCapacity,
          deficitAmount: -tcFlow.surplus,
        })
      }
    }

    colonyFlows.set(colony.id, updated as ColonyResourceSummary)
  }

  // ── Export Bonuses ─────────────────────────────────────────────────────────
  // A colony earns an export bonus for resource R if:
  //   1. It had surplus > 0 for R (contributed to the pool).
  //   2. At least some of the pool for R was consumed (pool shrank).
  // One bonus entry per (colony, resource) pair — applied by market-phase (Story 9.2).

  const exportBonuses: ExportBonus[] = []
  for (const colony of colonies) {
    const raw = rawFlows.get(colony.id)!
    for (const resource of TRADEABLE_RESOURCES) {
      const flow = raw[resource]
      if (flow.surplus > 0) {
        const initial = initialPool.get(resource) ?? 0
        const remaining = pool.get(resource) ?? 0
        const wasConsumed = initial > remaining
        if (wasConsumed) {
          exportBonuses.push({
            colonyId: colony.id as ColonyId,
            resource,
            attributeTarget: EXPORT_BONUS_ATTRIBUTE,
            bonusAmount: EXPORT_BONUS_AMOUNT,
          })
        }
      }
    }
  }

  // ── Sector Market Summary ──────────────────────────────────────────────────

  const totalProduction = zeroRecord()
  const totalConsumption = zeroRecord()
  const netSurplus = zeroRecord()

  for (const resource of Object.values(ResourceType)) {
    for (const colony of colonies) {
      const flow = rawFlows.get(colony.id)![resource]
      totalProduction[resource] += flow.produced
      totalConsumption[resource] += flow.consumed
    }
    netSurplus[resource] = totalProduction[resource] - totalConsumption[resource]
  }

  const sectorSummary: SectorMarketSummary = {
    sectorId,
    totalProduction,
    totalConsumption,
    netSurplus,
    shortages: sectorShortages,
  }

  return {
    colonyFlows,
    sectorSummary,
    exportBonuses,
  }
}

// ─── Cross-Sector Trade ────────────────────────────────────────────────────────

/**
 * Input for a single cross-sector trade pass between two sectors.
 * Called once per trade route (bidirectional — A→B and B→A evaluated simultaneously).
 */
export interface CrossSectorTradeInput {
  /** Sector that has surplus to offer (the exporter this pass). */
  exporter: {
    sectorId: SectorId
    /** Resolved colony flows after internal market resolution for this sector. */
    colonyFlows: Map<string, ColonyResourceSummary>
    /** All colonies in this sector (for dynamism-priority sorting). */
    colonies: Colony[]
  }
  /** Sector that has deficits to fill (the importer this pass). */
  importer: {
    sectorId: SectorId
    colonyFlows: Map<string, ColonyResourceSummary>
    colonies: Colony[]
  }
}

/** Updated flows and trade flows for one directional pass of cross-sector trade. */
export interface CrossSectorTradePassResult {
  /** Updated importer colony flows (some deficits may be resolved). */
  importerFlows: Map<string, ColonyResourceSummary>
  /** Trade flow records for each resource that was actually transferred. */
  tradeFlows: TradeFlow[]
}

/**
 * CROSS_SECTOR_EFFICIENCY — fraction of exporting sector's surplus shared.
 * Per Specs.md § 7: cross-sector surplus shared at 50% efficiency.
 * Only floor(surplus × 0.5) units are available to the importing sector.
 */
const CROSS_SECTOR_EFFICIENCY = 0.5

/**
 * Applies one directional pass of cross-sector trade from exporter → importer.
 *
 * Algorithm:
 *   For each tradeable resource:
 *     1. Sum net surplus remaining in the exporter's pool (colonies with positive remaining surplus).
 *     2. Apply 50% efficiency: available = floor(netSurplus × 0.5)
 *     3. Distribute available units to importer deficit colonies in dynamism order.
 *     4. Record TradeFlow if any units were actually transferred.
 *
 * Returns updated importer colony flows and the trade flow records generated.
 * Does NOT mutate exporter flows (exporter surplus is not reduced — it's a copy, not a deduction).
 * The exporting sector keeps its surplus; we only lend 50% of it cross-sector.
 *
 * @param input - Exporter and importer sector data after internal resolution.
 * @returns Updated importer flows and trade flow records.
 */
export function applyCrossSectorTradePass(input: CrossSectorTradeInput): CrossSectorTradePassResult {
  const { exporter, importer } = input

  // Work on a mutable copy of importer flows so we can update them per resource.
  const updatedImporterFlows = new Map<string, ColonyResourceSummary>(importer.colonyFlows)

  const tradeFlows: TradeFlow[] = []

  // Importer colonies sorted by dynamism descending — highest gets first access to cross-sector imports.
  const sortedImporterColonies = [...importer.colonies].sort(
    (a, b) => b.attributes.dynamism - a.attributes.dynamism,
  )

  for (const resource of TRADEABLE_RESOURCES) {
    // Step 1: Calculate net surplus of the exporting sector.
    // A colony's net surplus is its final remaining surplus after imports were applied.
    // We use: netSurplus = produced - consumed + imported  (from its resolved flow).
    // However, the simplest approach: sum positive remainders.
    // surplus in resolved flow = produced - consumed + imported - deficit_remaining.
    // After internal resolution: flow.surplus = produced - consumed, flow.imported = what was received.
    // Remaining surplus = flow.surplus + flow.imported  (positive means genuinely surplus).

    let exporterNetSurplus = 0
    for (const flow of exporter.colonyFlows.values()) {
      const resourceFlow = flow[resource]
      // net = produced - consumed + imported. Surplus is positive if colony still has excess.
      const net = resourceFlow.produced - resourceFlow.consumed + resourceFlow.imported
      if (net > 0) {
        exporterNetSurplus += net
      }
    }

    if (exporterNetSurplus <= 0) continue // nothing to export

    // Step 2: Apply 50% efficiency.
    const available = Math.floor(exporterNetSurplus * CROSS_SECTOR_EFFICIENCY)
    if (available <= 0) continue

    // Step 3: Distribute to importer colonies in dynamism priority order.
    let remaining = available
    let totalReceived = 0

    for (const colony of sortedImporterColonies) {
      if (remaining <= 0) break

      const currentFlow = updatedImporterFlows.get(colony.id)!
      const resourceFlow = currentFlow[resource]

      // Only colonies still in deficit benefit from cross-sector imports.
      // Deficit = consumed - produced - imported (positive means unmet need).
      const deficit = resourceFlow.consumed - resourceFlow.produced - resourceFlow.imported
      if (deficit <= 0) continue

      const received = Math.min(deficit, remaining)
      remaining -= received
      totalReceived += received

      // Update the importer colony's flow: increase imported, clear shortage if deficit resolved.
      const newImported = resourceFlow.imported + received
      const remainingDeficit = Math.max(0, deficit - received)

      updatedImporterFlows.set(colony.id, {
        ...currentFlow,
        [resource]: {
          ...resourceFlow,
          imported: newImported,
          inShortage: remainingDeficit > 0,
        },
      })
    }

    // Step 4: Record a TradeFlow if any units were actually received by the importer.
    if (totalReceived > 0) {
      tradeFlows.push({
        fromSectorId: exporter.sectorId,
        toSectorId: importer.sectorId,
        resource,
        surplusAvailable: exporterNetSurplus,
        transferred: available,
        received: totalReceived,
      })
    }
  }

  return { importerFlows: updatedImporterFlows, tradeFlows }
}
