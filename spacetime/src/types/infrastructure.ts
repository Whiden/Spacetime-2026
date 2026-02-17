/**
 * infrastructure.ts — Infrastructure level, ownership, and domain state types.
 *
 * Infrastructure is built capacity across 12 domains on a colony.
 * Each domain has levels that can be public (permanent) or corporate-owned (fragile).
 */

import type { InfraDomain, CorpId } from './common'

// ─── Infrastructure Ownership ─────────────────────────────────────────────────

/**
 * Tracks the ownership split of infrastructure levels within a single domain.
 * Public levels are permanent. Corporate levels are lost if the corp leaves or dissolves.
 */
export interface InfraOwnership {
  /** Levels funded by direct player investment or organic colony growth. Permanent. */
  publicLevels: number
  /**
   * Levels owned by corporations, keyed by CorpId.
   * Lost if the owning corp dissolves or exits the planet.
   */
  corporateLevels: Map<CorpId, number>
}

// ─── Infrastructure Domain State ──────────────────────────────────────────────

/**
 * The full state of a single infrastructure domain on a colony.
 */
export interface InfraState {
  domain: InfraDomain
  ownership: InfraOwnership
  /**
   * The current cap for this domain on this colony.
   * For most domains: pop_level × 2 + empire bonus + local modifiers.
   * For extraction/agricultural: deposit richness cap (5/10/15/20 per richness level).
   * For Civilian: uncapped (stored as Infinity or a large sentinel value).
   *
   * TODO (Story 10.1): Recalculated each turn by calculateInfraCap() in attributes.ts.
   */
  currentCap: number
}

// ─── Colony Infrastructure Map ────────────────────────────────────────────────

/**
 * Complete infrastructure state for a colony: one InfraState per domain.
 * Stored as a Record for O(1) lookup by domain key.
 */
export type ColonyInfrastructure = Record<InfraDomain, InfraState>

// ─── Helper: total levels ─────────────────────────────────────────────────────

/**
 * Returns the total infrastructure levels (public + all corporate) for a domain.
 */
export function getTotalLevels(state: InfraState): number {
  let total = state.ownership.publicLevels
  for (const levels of state.ownership.corporateLevels.values()) {
    total += levels
  }
  return total
}

/**
 * Returns the total corporate-owned levels for a domain.
 */
export function getCorporateLevels(state: InfraState): number {
  let total = 0
  for (const levels of state.ownership.corporateLevels.values()) {
    total += levels
  }
  return total
}
