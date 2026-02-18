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
 *   3. Apply new shortage malus modifiers onto affected colonies:
 *        - Food shortage       → 'qualityOfLife'  −2 (additive)
 *        - ConsumerGoods sh.   → 'qualityOfLife'  −1 (additive)
 *        - TransportCapacity sh.→ 'accessibility' −1 (additive)
 *      (Industrial input shortages reduce manufacturing output via colony-sim, not here.)
 *   4. Apply export bonus modifiers onto exporting colonies:
 *        - Per exported resource type → 'dynamism' +1 (additive)
 *   5. Update `state.sectorMarkets` with the new SectorMarketState for each sector.
 *   6. Generate Warning events for colonies that have shortages.
 *
 * The shortage modifiers written here are consumed by colony-phase in the NEXT turn
 * (turn order: colony-phase 8 → market-phase 9). They persist on `colony.modifiers`
 * but are cleared at the start of each market-phase, so they are always up to date.
 *
 * TODO (Story 17.2): After internal resolution, apply cross-sector surplus sharing
 *   from active trade routes at 50% efficiency.
 * TODO (Story 10.3): colony-phase.ts reads the shortage/export modifiers set here
 *   when recalculating colony attributes each turn.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { GameEvent } from '../../types/event'
import type { Colony } from '../../types/colony'
import type { Modifier } from '../../types/modifier'
import type { Shortage, ExportBonus } from '../../types/resource'
import type { SectorMarketState } from '../../types/trade'
import type { ColonyId, TurnNumber } from '../../types/common'
import { ResourceType, EventPriority } from '../../types/common'
import { resolveMarket } from '../simulation/market-resolver'
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

  // Step 2-5: Resolve the market for each sector.
  const updatedSectorMarkets = new Map<string, SectorMarketState>(state.sectorMarkets)

  for (const [sectorId, sector] of state.galaxy.sectors) {
    // Collect colonies in this sector using the already-cleared map.
    const sectorColonies = [...updatedColonies.values()].filter(
      (c) => c.sectorId === sectorId,
    )
    if (sectorColonies.length === 0) continue

    // Build deposits map: colonyId → planet deposits.
    const depositsMap = new Map<string, import('../../types/planet').Deposit[]>()
    for (const colony of sectorColonies) {
      const planet = state.planets.get(colony.planetId)
      depositsMap.set(colony.id, planet?.deposits ?? [])
    }

    // Run the five-phase market resolution for this sector.
    const result = resolveMarket(sectorId, sectorColonies, depositsMap)

    // Step 3: Apply shortage modifiers onto affected colonies.
    for (const shortage of result.sectorSummary.shortages) {
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

    // Step 4: Apply export bonus modifiers onto exporting colonies.
    for (const bonus of result.exportBonuses) {
      const colony = updatedColonies.get(bonus.colonyId)
      if (!colony) continue

      const bonusModifier = buildExportBonusModifier(bonus)
      updatedColonies.set(bonus.colonyId, {
        ...colony,
        modifiers: [...colony.modifiers, bonusModifier],
      })
    }

    // Step 5: Store the updated sector market state.
    updatedSectorMarkets.set(sectorId, buildSectorMarketState(result.sectorSummary))

    // Step 6: Generate Warning events for colonies with shortages in this sector.
    const shortageEvents = buildShortageEvents(
      result.sectorSummary.shortages,
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

// ─── Sector Market State Builder ──────────────────────────────────────────────

/**
 * Converts a SectorMarketSummary from the resolver into a SectorMarketState
 * suitable for storage in GameState.sectorMarkets.
 *
 * Cross-sector trade flows are empty at this stage.
 * TODO (Story 17.2): Populate inboundFlows and outboundFlows from active trade routes.
 */
function buildSectorMarketState(
  summary: import('../../types/resource').SectorMarketSummary,
): SectorMarketState {
  return {
    sectorId: summary.sectorId,
    totalProduction: summary.totalProduction,
    totalConsumption: summary.totalConsumption,
    netSurplus: summary.netSurplus,
    inboundFlows: [],
    outboundFlows: [],
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
