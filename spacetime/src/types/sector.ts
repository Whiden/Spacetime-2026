/**
 * sector.ts — Sector and galaxy adjacency types.
 *
 * Sectors are the top-level geographic containers. The galaxy is a network graph
 * of 10-15 sectors connected by adjacency edges. There is no visual map — sectors
 * are text entries in a list.
 *
 * TODO (Story 3.1): sector-generator.ts creates Sector objects.
 * TODO (Story 3.2): galaxy-generator.ts builds the adjacency graph.
 * TODO (Story 3.3): galaxy.store.ts manages the galaxy state.
 */

import type { SectorId, ColonyId, ShipId, TurnNumber, SectorDensity } from './common'

// ─── Sector ───────────────────────────────────────────────────────────────────

/**
 * A single sector in the galaxy network.
 *
 * Adjacency is stored in the Galaxy type (not on the sector itself) to keep
 * the graph representation centralized and avoid circular references.
 */
export interface Sector {
  id: SectorId
  name: string
  density: SectorDensity
  /**
   * Exploration percentage (0-100).
   * Each exploration contract adds random(5,15)%.
   * At 100%, no more exploration contracts can be run.
   */
  explorationPercent: number
  /**
   * Threat modifier applied to future threat events (future feature).
   * Range: 0.5-1.5.
   * TODO (Story 13): Used by threat system once implemented.
   */
  threatModifier: number
  /** Turn this sector was first entered by the player (colonized or military presence). */
  firstEnteredTurn: TurnNumber | null
}

// ─── Galaxy ───────────────────────────────────────────────────────────────────

/**
 * The complete galaxy state: all sectors and their adjacency connections.
 * The adjacency list is the canonical source for "which sectors are connected".
 */
export interface Galaxy {
  sectors: Map<SectorId, Sector>
  /**
   * Adjacency list. Each entry: sectorId → array of adjacent sector IDs.
   * Connections are bidirectional (if A→B exists, B→A also exists).
   */
  adjacency: Map<SectorId, SectorId[]>
  /** ID of the starting sector (where Terra Nova is located). */
  startingSectorId: SectorId
}

// ─── Sector Presence ──────────────────────────────────────────────────────────

/**
 * Player presence in a sector. Determines exploration range.
 * A sector is "reachable" for exploration if the player has colony or military presence
 * in an adjacent sector.
 */
export interface SectorPresence {
  sectorId: SectorId
  /** Colonies in this sector. */
  colonyIds: ColonyId[]
  /** Player-owned ships stationed in this sector. */
  shipIds: ShipId[]
  /** Whether the player has any presence (colony or ships) in this sector. */
  hasPresence: boolean
}
