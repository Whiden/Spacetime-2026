/**
 * create-trade-route.ts — Trade route contract creation engine action.
 *
 * A trade route is an ongoing contract between two adjacent sectors,
 * operated by a Transport corporation, costing 2 BP/turn with no fixed end date.
 *
 * This is a thin wrapper around createContract() specialised for TradeRoute contracts.
 *
 * Pure function: no side effects, no store access.
 *
 * TODO (Story 17.2): market-resolver.ts reads active trade routes during market phase
 *   to share surplus between connected sectors at 50% efficiency.
 */

import type { CorpId, SectorId, TurnNumber } from '../../types/common'
import { ContractType } from '../../types/common'
import type { Contract } from '../../types/contract'
import type { Corporation } from '../../types/corporation'
import type { Sector } from '../../types/sector'
import { createContract } from './create-contract'
import type { ContractValidationError } from './create-contract'

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface TradeRouteCreationSuccess {
  success: true
  contract: Contract
}

export interface TradeRouteCreationFailure {
  success: false
  error: ContractValidationError
  message: string
}

export type TradeRouteCreationResult = TradeRouteCreationSuccess | TradeRouteCreationFailure

// ─── Input Parameters ─────────────────────────────────────────────────────────

export interface CreateTradeRouteParams {
  /** The sector providing one end of the trade route. */
  sectorIdA: SectorId
  /** The sector providing the other end of the trade route. */
  sectorIdB: SectorId
  /** ID of the Transport corporation operating the route. */
  assignedCorpId: CorpId
  /** Current game turn. */
  currentTurn: TurnNumber
  /** All available sectors (must contain both sectorIdA and sectorIdB). */
  sectors: Map<string, Sector>
  /** Adjacency map from Galaxy: sectorId → adjacent sector IDs. */
  sectorAdjacency: Map<string, string[]>
  /** All corporations (must contain assignedCorpId, which must be Transport type). */
  corporations: Map<string, Corporation>
}

// ─── Main Creation Function ───────────────────────────────────────────────────

/**
 * Creates a new trade route contract between two adjacent sectors.
 *
 * Validation rules:
 * - Both sectors must exist.
 * - Sectors must be adjacent (checked via sectorAdjacency).
 * - Assigned corporation must be of Transport type (or Megacorp level 6+).
 *
 * The trade route is ongoing: duration is set to 9999 (sentinel for "no end").
 * The player cancels it via cancelTradeRoute() in the contract store.
 *
 * @param params - Trade route creation parameters
 * @returns Success with the new Contract, or failure with a validation error
 */
export function createTradeRoute(params: CreateTradeRouteParams): TradeRouteCreationResult {
  return createContract({
    type: ContractType.TradeRoute,
    target: { type: 'sector_pair', sectorIdA: params.sectorIdA, sectorIdB: params.sectorIdB },
    assignedCorpId: params.assignedCorpId,
    currentTurn: params.currentTurn,
    sectors: params.sectors,
    sectorAdjacency: params.sectorAdjacency,
    // Trade routes don't involve planets, colonies, or colony sectors
    colonySectorIds: new Set(),
    colonies: new Map(),
    planets: new Map(),
    corporations: params.corporations,
  })
}
