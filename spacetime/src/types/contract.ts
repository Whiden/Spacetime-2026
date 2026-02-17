/**
 * contract.ts — Contract, ContractTarget, and related types.
 *
 * Contracts are the player's primary interaction with the economy.
 * Every non-military action is performed through a contract awarded to a corporation.
 *
 * TODO (Story 7.1): create-contract.ts validates and creates Contract objects.
 * TODO (Story 7.2): contract.store.ts manages active/completed contracts.
 * TODO (Story 7.3): contract-phase.ts advances contracts each turn.
 */

import type {
  ContractId,
  CorpId,
  ColonyId,
  SectorId,
  PlanetId,
  TurnNumber,
  BPAmount,
  ContractType,
  ContractStatus,
  ColonyType,
  ShipRole,
  SizeVariant,
} from './common'

// ─── Contract Target ──────────────────────────────────────────────────────────

/**
 * The target of a contract depends on its type:
 * - Exploration: a sector
 * - Ground Survey: a planet
 * - Colonization: a planet (accepted, ground surveyed)
 * - Ship Commission: a colony with sufficient space infrastructure
 * - Trade Route: a pair of adjacent sectors
 */
export type ContractTarget =
  | { type: 'sector'; sectorId: SectorId }
  | { type: 'planet'; planetId: PlanetId }
  | { type: 'colony'; colonyId: ColonyId }
  | { type: 'sector_pair'; sectorIdA: SectorId; sectorIdB: SectorId }

// ─── Contract Params ──────────────────────────────────────────────────────────

/**
 * Extra parameters specific to certain contract types.
 */
export interface ColonizationParams {
  /** The colony type to establish on completion. */
  colonyType: ColonyType
}

export interface ShipCommissionParams {
  role: ShipRole
  sizeVariant: SizeVariant
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * An active or completed contract between the empire and a corporation.
 *
 * Contracts are guaranteed to succeed (no failure mechanic in prototype).
 * Quality scales with corporation level:
 *   - Level 1-3: base result
 *   - Level 4-6: +1 to outputs (infrastructure, scan quality, etc.)
 *   - Level 7+:  +2 to outputs
 */
export interface Contract {
  id: ContractId
  type: ContractType
  status: ContractStatus
  target: ContractTarget
  assignedCorpId: CorpId

  /** Budget Points spent per turn for the duration of this contract. */
  bpPerTurn: BPAmount

  /** Total duration in turns. */
  durationTurns: number

  /** Turns remaining until completion. Decrements each turn. */
  turnsRemaining: number

  /** Turn this contract was created. */
  startTurn: TurnNumber

  /** Turn this contract completed. Null while active. */
  completedTurn: TurnNumber | null

  /** Extra params for colonization or ship commission contracts. */
  colonizationParams?: ColonizationParams
  shipCommissionParams?: ShipCommissionParams
}

// ─── Contract Summary ─────────────────────────────────────────────────────────

/**
 * Lightweight summary for display in contract lists.
 * Used by the UI to show progress without loading the full contract.
 */
export interface ContractSummary {
  id: ContractId
  type: ContractType
  status: ContractStatus
  assignedCorpId: CorpId
  bpPerTurn: BPAmount
  progressPercent: number
  turnsRemaining: number
}
