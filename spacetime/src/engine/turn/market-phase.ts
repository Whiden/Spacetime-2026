/**
 * market-phase.ts — Sector market resolution during turn resolution.
 *
 * Integrates the market resolver into the turn pipeline for Story 9.2.
 *
 * Responsibilities:
 *   1. Clear all transient market-phase modifiers (sourceType === 'shortage') from
 *      every colony at the start of the phase, so last turn's shortages don't persist.
 *   2. For each sector, run `resolveMarket()` to get colony flows, shortages, and
 *      export bonuses.
 *   3. Apply cross-sector trade from active trade routes (Story 17.2):
 *      After all sectors resolve internally, for each active trade route:
 *        - A→B pass: exporter=A, importer=B
 *        - B→A pass: exporter=B, importer=A
 *      Both passes evaluated simultaneously (pre-trade internal flows).
 *      Surplus shared at 50% efficiency; dynamism-priority within importer sector.
 *   4. Apply new shortage malus modifiers onto affected colonies:
 *        - Food shortage        → 'qualityOfLife'  −2 (additive)
 *        - ConsumerGoods sh.    → 'qualityOfLife'  −1 (additive)
 *        - TransportCapacity sh.→ 'accessibility'  −1 (additive)
 *      (Industrial input shortages reduce manufacturing output via colony-sim, not here.)
 *   5. Apply export bonus modifiers onto exporting colonies:
 *        - Per exported resource type → 'dynamism' +1 (additive)
 *   6. Update `state.sectorMarkets` with the new SectorMarketState for each sector,
 *      including inbound/outbound trade flows.
 *   7. Generate Warning events for colonies that have shortages (after cross-sector trade).
 *
 * The shortage modifiers written here are consumed by colony-phase in the NEXT turn
 * (turn order: colony-phase 8 → market-phase 9). They persist on `colony.modifiers`
 * but are cleared at the start of each market-phase, so they are always up to date.
 *
 * TODO (Story 10.3): colony-phase.ts reads the shortage/export modifiers set here
 *   when recalculating colony attributes each turn.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { GameEvent } from '../../types/event'
import type { Colony } from '../../types/colony'
import type { Modifier } from '../../types/modifier'
import type { Shortage, ExportBonus, ColonyResourceSummary } from '../../types/resource'
import type { SectorMarketState, TradeFlow } from '../../types/trade'
import type { ColonyId, TurnNumber } from '../../types/common'
import { ResourceType, EventPriority, ContractType, ContractStatus } from '../../types/common'
import { resolveMarket, applyCrossSectorTradePass } from '../simulation/market-resolver'
import { generateModifierId, generateEventId } from '../../utils/id'

// ─── Shortage Malus Table ─────────────────────────────────────────────────────

/**
 * Maps resource types to the colony attribute modifier they produce when in shortage.
 * Only resources that directly affect colony attributes are listed here.
 * Industrial input shortages halve manufacturing output — handled in colony-sim, not here.
 */
const SHORTAGE_MALUS: Partial<Record<ResourceType, { target: string; value: number }>> = {
  [ResourceType.Food]:             { target: 'qualityOfLife', value: -2 },
  [ResourceType.ConsumerGoods]:    { target: 'qualityOfLife', value: -1 },
  [ResourceType.TransportCapacity]: { target: 'accessibility', value: -1 },
}

// ─── Phase Entry Point ────────────────────────────────────────────────────────

/**
 * Resolves the sector market for every sector in the galaxy.
 *
 * @param state - Full GameState at this point in turn resolution.
 * @returns PhaseResult with updated colony modifiers, updated sectorMarkets, and shortage events.
 */
export function resolveMarketPhase(state: GameState): PhaseResult {
  const events: GameEvent[] = []

  // Step 1: Clear all transient market-phase modifiers from every colony.
  // This removes shortage maluses and export bonuses from the previous turn so
  // they don't stack with the new values computed below.
  const updatedColonies = clearMarketModifiers(state.colonies)

  // ── Internal Market Resolution (Step 2) ─────────────────────────────────────
  // Resolve each sector's internal market first. Collect results keyed by sectorId.

  // Per-sector resolved colony flows after internal resolution.
  const sectorColonyFlows = new Map<string, Map<string, ColonyResourceSummary>>()
  // Per-sector export bonuses.
  const sectorExportBonuses = new Map<string, ExportBonus[]>()
  // Colonies per sector (after modifier clearing).
  const coloniesBySector = new Map<string, Colony[]>()

  for (const [sectorId] of state.galaxy.sectors) {
    const sectorColonies = [...updatedColonies.values()].filter(
      (c) => c.sectorId === sectorId,
    )
    coloniesBySector.set(sectorId, sectorColonies)

    if (sectorColonies.length === 0) continue

    // Build deposits map: colonyId → planet deposits.
    const depositsMap = new Map<string, import('../../types/planet').Deposit[]>()
    for (const colony of sectorColonies) {
      const planet = state.planets.get(colony.planetId)
      depositsMap.set(colony.id, planet?.deposits ?? [])
    }

    const result = resolveMarket(sectorId, sectorColonies, depositsMap)
    sectorColonyFlows.set(sectorId, result.colonyFlows)
    sectorExportBonuses.set(sectorId, result.exportBonuses)
  }

  // ── Cross-Sector Trade (Step 3, Story 17.2) ──────────────────────────────────
  // For each active trade route, evaluate surplus sharing between the two sectors.
  // Both passes (A→B and B→A) use pre-trade flows (snapshot from internal resolution).
  // This prevents one direction's imports from affecting the other direction this turn.

  // Collect active trade route contracts.
  const activeTradeRoutes = [...state.contracts.values()].filter(
    (c) =>
      c.type === ContractType.TradeRoute &&
      c.status === ContractStatus.Active,
  )

  // Per-sector accumulated trade flows for recording in SectorMarketState.
  const inboundFlowsBySector = new Map<string, TradeFlow[]>()
  const outboundFlowsBySector = new Map<string, TradeFlow[]>()

  for (const contract of activeTradeRoutes) {
    if (contract.target.type !== 'sector_pair') continue

    const { sectorIdA, sectorIdB } = contract.target

    // Take snapshot of flows BEFORE this trade route's passes run.
    const flowsA = sectorColonyFlows.get(sectorIdA)
    const flowsB = sectorColonyFlows.get(sectorIdB)
    const coloniesA = coloniesBySector.get(sectorIdA) ?? []
    const coloniesB = coloniesBySector.get(sectorIdB) ?? []

    if (!flowsA || !flowsB) continue

    // A → B pass (A exports to B).
    const passAtoB = applyCrossSectorTradePass({
      exporter: { sectorId: sectorIdA, colonyFlows: flowsA, colonies: coloniesA },
      importer: { sectorId: sectorIdB, colonyFlows: flowsB, colonies: coloniesB },
    })

    // B → A pass (B exports to A). Uses original flowsA/flowsB (pre-trade snapshot).
    const passBtoA = applyCrossSectorTradePass({
      exporter: { sectorId: sectorIdB, colonyFlows: flowsB, colonies: coloniesB },
      importer: { sectorId: sectorIdA, colonyFlows: flowsA, colonies: coloniesA },
    })

    // Merge updated importer flows back.
    // A's imports come from the B→A pass; B's imports come from the A→B pass.
    if (passBtoA.tradeFlows.length > 0 || passAtoB.tradeFlows.length > 0) {
      // Update sector A flows with what A received from B.
      sectorColonyFlows.set(sectorIdA, passBtoA.importerFlows)
      // Update sector B flows with what B received from A.
      sectorColonyFlows.set(sectorIdB, passAtoB.importerFlows)
    }

    // Accumulate trade flow records for both sectors.
    for (const [sectorId, flows] of [
      [sectorIdA, outboundFlowsBySector],
      [sectorIdB, outboundFlowsBySector],
    ] as [string, Map<string, TradeFlow[]>][]) {
      if (!flows.has(sectorId)) flows.set(sectorId, [])
    }
    for (const [sectorId, flows] of [
      [sectorIdA, inboundFlowsBySector],
      [sectorIdB, inboundFlowsBySector],
    ] as [string, Map<string, TradeFlow[]>][]) {
      if (!flows.has(sectorId)) flows.set(sectorId, [])
    }

    // A→B: outbound from A, inbound to B.
    for (const tf of passAtoB.tradeFlows) {
      outboundFlowsBySector.get(sectorIdA)!.push(tf)
      inboundFlowsBySector.get(sectorIdB)!.push(tf)
    }
    // B→A: outbound from B, inbound to A.
    for (const tf of passBtoA.tradeFlows) {
      outboundFlowsBySector.get(sectorIdB)!.push(tf)
      inboundFlowsBySector.get(sectorIdA)!.push(tf)
    }
  }

  // ── Apply Modifiers & Events (Steps 4-7) ─────────────────────────────────────
  // Re-derive shortages from the final (post-trade) colony flows, then apply modifiers.

  const updatedSectorMarkets = new Map<string, SectorMarketState>(state.sectorMarkets)

  for (const [sectorId, sector] of state.galaxy.sectors) {
    const sectorColonies = coloniesBySector.get(sectorId) ?? []
    if (sectorColonies.length === 0) continue

    const finalFlows = sectorColonyFlows.get(sectorId)!
    const exportBonuses = sectorExportBonuses.get(sectorId) ?? []

    // Derive shortages from the final resolved flows.
    const finalShortages = deriveFinalShortages(finalFlows)

    // Apply shortage modifiers onto affected colonies.
    for (const shortage of finalShortages) {
      const colony = updatedColonies.get(shortage.colonyId)
      if (!colony) continue

      const newModifiers = buildShortageModifiers(shortage)
      if (newModifiers.length > 0) {
        updatedColonies.set(shortage.colonyId, {
          ...colony,
          modifiers: [...colony.modifiers, ...newModifiers],
        })
      }
    }

    // Apply export bonus modifiers onto exporting colonies.
    for (const bonus of exportBonuses) {
      const colony = updatedColonies.get(bonus.colonyId)
      if (!colony) continue

      const bonusModifier = buildExportBonusModifier(bonus)
      updatedColonies.set(bonus.colonyId, {
        ...colony,
        modifiers: [...colony.modifiers, bonusModifier],
      })
    }

    // Store the updated sector market state (including cross-sector flows).
    updatedSectorMarkets.set(sectorId, {
      sectorId,
      totalProduction: computeTotalProduction(finalFlows),
      totalConsumption: computeTotalConsumption(finalFlows),
      netSurplus: computeNetSurplus(finalFlows),
      inboundFlows: inboundFlowsBySector.get(sectorId) ?? [],
      outboundFlows: outboundFlowsBySector.get(sectorId) ?? [],
    })

    // Generate shortage warning events after cross-sector trade.
    const shortageEvents = buildShortageEvents(
      finalShortages,
      updatedColonies,
      sector.name,
      state.turn,
    )
    events.push(...shortageEvents)
  }

  return {
    updatedState: {
      ...state,
      colonies: updatedColonies,
      sectorMarkets: updatedSectorMarkets,
    },
    events,
  }
}

// ─── Shortage Derivation ──────────────────────────────────────────────────────

/**
 * Derives the list of shortages from final resolved colony flows.
 * A shortage exists when inShortage is true in the flow.
 */
function deriveFinalShortages(
  colonyFlows: Map<string, ColonyResourceSummary>,
): Shortage[] {
  const shortages: Shortage[] = []
  for (const [colonyId, flow] of colonyFlows) {
    for (const resource of Object.values(ResourceType)) {
      if (flow[resource].inShortage) {
        const deficit = flow[resource].consumed - flow[resource].produced - flow[resource].imported
        shortages.push({
          colonyId: colonyId as ColonyId,
          resource,
          deficitAmount: Math.max(0, deficit),
        })
      }
    }
  }
  return shortages
}

// ─── Sector Summary Helpers ───────────────────────────────────────────────────

function computeTotalProduction(colonyFlows: Map<string, ColonyResourceSummary>): Record<ResourceType, number> {
  const totals = zeroRecord()
  for (const flow of colonyFlows.values()) {
    for (const r of Object.values(ResourceType)) {
      totals[r] += flow[r].produced
    }
  }
  return totals
}

function computeTotalConsumption(colonyFlows: Map<string, ColonyResourceSummary>): Record<ResourceType, number> {
  const totals = zeroRecord()
  for (const flow of colonyFlows.values()) {
    for (const r of Object.values(ResourceType)) {
      totals[r] += flow[r].consumed
    }
  }
  return totals
}

function computeNetSurplus(colonyFlows: Map<string, ColonyResourceSummary>): Record<ResourceType, number> {
  const prod = computeTotalProduction(colonyFlows)
  const cons = computeTotalConsumption(colonyFlows)
  const net = zeroRecord()
  for (const r of Object.values(ResourceType)) {
    net[r] = prod[r] - cons[r]
  }
  return net
}

function zeroRecord(): Record<ResourceType, number> {
  const record = {} as Record<ResourceType, number>
  for (const r of Object.values(ResourceType)) {
    record[r] = 0
  }
  return record
}

// ─── Modifier Clearing ────────────────────────────────────────────────────────

/**
 * Returns a new Map of colonies with all market-phase transient modifiers removed.
 * Transient market modifiers use `sourceType === 'shortage'` — this covers both
 * shortage maluses and export bonus modifiers applied by this phase each turn.
 */
function clearMarketModifiers(
  colonies: Map<string, Colony>,
): Map<string, Colony> {
  const cleared = new Map<string, Colony>()
  for (const [id, colony] of colonies) {
    cleared.set(id, {
      ...colony,
      modifiers: colony.modifiers.filter((m) => m.sourceType !== 'shortage'),
    })
  }
  return cleared
}

// ─── Modifier Builders ────────────────────────────────────────────────────────

/**
 * Builds shortage malus modifier(s) for a colony based on a single shortage record.
 * Only resources that directly affect colony attributes produce modifiers here.
 * Returns an empty array for industrial input shortages (handled by colony-sim).
 */
function buildShortageModifiers(shortage: Shortage): Modifier[] {
  const malus = SHORTAGE_MALUS[shortage.resource]
  if (!malus) return []

  return [
    {
      id: generateModifierId(),
      target: malus.target,
      operation: 'add',
      value: malus.value,
      sourceType: 'shortage',
      sourceId: `shortage_${shortage.resource}`,
      sourceName: `${shortage.resource} Shortage`,
    },
  ]
}

/**
 * Builds an export bonus modifier for a colony that successfully exported
 * a resource to the sector market (i.e., another colony consumed it).
 * Uses `sourceType: 'shortage'` so it is cleared each turn like shortage maluses.
 */
function buildExportBonusModifier(bonus: ExportBonus): Modifier {
  return {
    id: generateModifierId(),
    target: bonus.attributeTarget,
    operation: 'add',
    value: bonus.bonusAmount,
    sourceType: 'shortage',
    sourceId: `export_${bonus.resource}`,
    sourceName: `${bonus.resource} Export Bonus`,
  }
}

// ─── Event Builders ───────────────────────────────────────────────────────────

/**
 * Generates Warning events for colonies that have at least one shortage after
 * market resolution. One event per colony (not per resource) to avoid event spam.
 *
 * @param shortages   - All shortages in this sector from the resolver.
 * @param colonies    - Updated colony map (to look up colony names).
 * @param sectorName  - Human-readable sector name for the event description.
 * @param turn        - Current turn number.
 */
function buildShortageEvents(
  shortages: Shortage[],
  colonies: Map<string, Colony>,
  sectorName: string,
  turn: TurnNumber,
): GameEvent[] {
  if (shortages.length === 0) return []

  // Group shortages by colony to emit one event per colony.
  const byColony = new Map<string, Shortage[]>()
  for (const shortage of shortages) {
    const list = byColony.get(shortage.colonyId) ?? []
    list.push(shortage)
    byColony.set(shortage.colonyId, list)
  }

  const events: GameEvent[] = []
  for (const [colonyId, colonyShortages] of byColony) {
    const colony = colonies.get(colonyId)
    const colonyName = colony?.name ?? colonyId

    const resourceList = colonyShortages.map((s) => s.resource).join(', ')
    const hasFoodShortage = colonyShortages.some(
      (s) => s.resource === ResourceType.Food,
    )
    // Food shortage is Critical — population decline risk; others are Warning.
    const priority = hasFoodShortage ? EventPriority.Critical : EventPriority.Warning

    events.push({
      id: generateEventId(),
      turn,
      priority,
      category: 'colony',
      title: `Resource Shortage — ${colonyName}`,
      description: `${colonyName} (${sectorName}) is experiencing shortages: ${resourceList}. Colony attributes will be penalised next turn.`,
      relatedEntityIds: [colonyId],
      dismissed: false,
    })
  }

  return events
}
