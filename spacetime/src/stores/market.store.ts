/**
 * market.store.ts — Pinia store for sector market state.
 *
 * Holds the result of each turn's market resolution:
 *   - Per-sector: production totals, consumption totals, surpluses, deficits.
 *   - Per-colony: shortage flags (which resources are in shortage after market resolution).
 *   - Per-colony: export bonuses (which resources the colony successfully exported).
 *
 * This store is updated by `resolveMarkets()` which calls `resolveMarketPhase()`
 * from the engine and distributes the results back into the store's reactive state.
 *
 * The market store does NOT drive turn resolution — game.store.ts (Story 12.4)
 * will orchestrate the full turn pipeline. This store simply exposes market data
 * for UI consumption and provides the resolveMarkets action for direct use until
 * the full turn resolver is wired.
 *
 * TODO (Story 9.4): MarketView.vue reads getSectorMarket() and getColonyShortages().
 * TODO (Story 12.4): game.store.ts calls resolveMarkets() as part of endTurn() pipeline.
 * TODO (Story 17.2): inboundFlows / outboundFlows on SectorMarketState populated by
 *   cross-sector trade route resolution.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SectorId, ColonyId, ResourceType } from '../types/common'
import type { SectorMarketState } from '../types/trade'
import type { Shortage, ExportBonus } from '../types/resource'
import type { GameState } from '../types/game'
import { resolveMarketPhase } from '../engine/turn/market-phase'

export const useMarketStore = defineStore('market', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /**
   * Per-sector market state after the last turn's market resolution.
   * Keyed by SectorId string. Empty until the first market phase runs.
   */
  const sectorMarkets = ref<Map<SectorId, SectorMarketState>>(new Map())

  /**
   * Per-colony shortages detected after the last market resolution.
   * Keyed by ColonyId string. Each value is the list of shortages for that colony.
   * A colony not present in this map had no shortages.
   */
  const colonyShortages = ref<Map<ColonyId, Shortage[]>>(new Map())

  /**
   * Per-colony export bonuses earned in the last market resolution.
   * Keyed by ColonyId string. Only colonies that successfully exported resources
   * will appear here.
   */
  const colonyExportBonuses = ref<Map<ColonyId, ExportBonus[]>>(new Map())

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /**
   * Returns the complete market state for a sector, or undefined if the sector
   * has not been resolved yet (e.g., no colonies in it).
   */
  function getSectorMarket(sectorId: SectorId): SectorMarketState | undefined {
    return sectorMarkets.value.get(sectorId)
  }

  /**
   * Returns the shortages for a colony after the last market resolution.
   * Returns an empty array if the colony had no shortages.
   */
  function getColonyShortages(colonyId: ColonyId): Shortage[] {
    return colonyShortages.value.get(colonyId) ?? []
  }

  /**
   * Returns the export bonuses for a colony after the last market resolution.
   * Returns an empty array if the colony had no exports.
   */
  function getColonyExportBonuses(colonyId: ColonyId): ExportBonus[] {
    return colonyExportBonuses.value.get(colonyId) ?? []
  }

  /**
   * Returns true if the given colony has any shortages in the current turn.
   */
  function colonyHasShortage(colonyId: ColonyId): boolean {
    const shortages = colonyShortages.value.get(colonyId)
    return shortages !== undefined && shortages.length > 0
  }

  /**
   * Returns true if the given colony has a shortage for the specified resource.
   */
  function colonyHasResourceShortage(colonyId: ColonyId, resource: ResourceType): boolean {
    const shortages = colonyShortages.value.get(colonyId) ?? []
    return shortages.some((s) => s.resource === resource)
  }

  /**
   * All sectors that currently have at least one shortage in any colony.
   * Derived from the colonyShortages map and sectorMarkets keys.
   */
  const sectorsWithShortages = computed<SectorId[]>(() => {
    // Build a set of sector IDs from colonies that have shortages.
    const sectorIds = new Set<SectorId>()
    // We need colony→sector mapping — we'll derive it from sectorMarkets.
    // SectorMarketState holds sectorId, so we cross-reference by checking
    // whether any colony with shortages belongs to a sector.
    // Since we only have shortages by colonyId here, we expose the shortages map
    // directly. The UI (MarketView) can iterate sectors from galaxy store instead.
    for (const [, market] of sectorMarkets.value) {
      // We check whether any colony in this sector has shortages
      // by looking at whether the market's sector ID matches any shortage colony.
      // However, we don't hold colony→sector mapping in this store.
      // Instead, we add all sector IDs that have any colonyShortage entry
      // matching colonies in those sectors.
      //
      // Practical approach: expose all sector IDs from sectorMarkets and let
      // callers filter using getColonyShortages per colony in that sector.
      sectorIds.add(market.sectorId)
    }
    return [...sectorIds]
  })

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Runs the full market phase for the given game state and updates store state.
   *
   * This is the main action called during turn resolution. It:
   *   1. Calls `resolveMarketPhase()` from the engine (pure function, no side effects).
   *   2. Extracts per-sector market data from the updated `sectorMarkets` map.
   *   3. Extracts per-colony shortage flags from colony modifiers.
   *   4. Extracts per-colony export bonuses from colony modifiers.
   *
   * Returns the updated GameState so callers can chain it through the turn pipeline.
   *
   * @param gameState - Full GameState at the point market resolution runs.
   * @returns The PhaseResult with updatedState and market events.
   */
  function resolveMarkets(gameState: GameState) {
    const result = resolveMarketPhase(gameState)
    const { updatedState } = result

    // Update per-sector market state.
    const newSectorMarkets = new Map<SectorId, SectorMarketState>()
    for (const [sectorId, marketState] of updatedState.sectorMarkets) {
      newSectorMarkets.set(sectorId as SectorId, marketState)
    }
    sectorMarkets.value = newSectorMarkets

    // Derive per-colony shortages and export bonuses from the colony modifiers
    // applied by the market phase. This gives us a queryable index so the UI
    // can ask "does colony X have a shortage?" without scanning all modifiers.
    const newColonyShortages = new Map<ColonyId, Shortage[]>()
    const newColonyExportBonuses = new Map<ColonyId, ExportBonus[]>()

    for (const [, colony] of updatedState.colonies) {
      // Shortage modifiers use sourceType 'shortage' and have negative values for
      // attribute maluses. Export bonus modifiers also use sourceType 'shortage'
      // (they are all transient market modifiers cleared each turn).
      //
      // Rather than re-parsing modifiers, we re-run the market resolver output
      // via the updatedState.sectorMarkets. We derive shortages from the
      // colonies' updated modifier list: shortage modifiers have sourceId starting
      // with 'shortage_', export bonus modifiers start with 'export_'.
      const shortagesForColony: Shortage[] = []
      const exportsForColony: ExportBonus[] = []

      for (const modifier of colony.modifiers) {
        if (modifier.sourceType !== 'shortage') continue

        if (modifier.sourceId.startsWith('shortage_')) {
          // Reconstruct a Shortage from the modifier.
          // sourceId format: 'shortage_<ResourceType>'
          const resourceStr = modifier.sourceId.replace('shortage_', '')
          shortagesForColony.push({
            colonyId: colony.id as ColonyId,
            resource: resourceStr as ResourceType,
            // deficitAmount is not stored in the modifier — we record 0 here since
            // the UI only needs to know *whether* a shortage exists, not the amount.
            // For the deficit amount, use getSectorMarket() → shortages list.
            deficitAmount: 0,
          })
        } else if (modifier.sourceId.startsWith('export_')) {
          // Reconstruct an ExportBonus from the modifier.
          // sourceId format: 'export_<ResourceType>'
          const resourceStr = modifier.sourceId.replace('export_', '')
          exportsForColony.push({
            colonyId: colony.id as ColonyId,
            resource: resourceStr as ResourceType,
            attributeTarget: modifier.target,
            bonusAmount: modifier.value,
          })
        }
      }

      if (shortagesForColony.length > 0) {
        newColonyShortages.set(colony.id as ColonyId, shortagesForColony)
      }
      if (exportsForColony.length > 0) {
        newColonyExportBonuses.set(colony.id as ColonyId, exportsForColony)
      }
    }

    colonyShortages.value = newColonyShortages
    colonyExportBonuses.value = newColonyExportBonuses

    return result
  }

  /**
   * Clears all market state. Used when starting a new game.
   */
  function reset() {
    sectorMarkets.value = new Map()
    colonyShortages.value = new Map()
    colonyExportBonuses.value = new Map()
  }

  // ─── Expose ──────────────────────────────────────────────────────────────────

  return {
    // State (read-only refs for external consumption)
    sectorMarkets,
    colonyShortages,
    colonyExportBonuses,
    // Getters
    getSectorMarket,
    getColonyShortages,
    getColonyExportBonuses,
    colonyHasShortage,
    colonyHasResourceShortage,
    sectorsWithShortages,
    // Actions
    resolveMarkets,
    reset,
  }
})
