/**
 * sector-generator.ts — Generates individual sectors for the galaxy.
 *
 * Each sector has a unique name, density, threat modifier, and exploration percentage.
 * The generator picks from name/density pools using weighted random selection.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * Called by galaxy-generator.ts to build the full galaxy.
 */

import type { SectorId } from '../types/common'
import { SectorDensity } from '../types/common'
import type { Sector } from '../types/sector'
import { SECTOR_NAMES } from '../data/sector-names'
import { GALAXY_GENERATION_PARAMS } from '../data/start-conditions'
import { generateSectorId } from '../utils/id'
import { weightedRandom, randomFloat } from '../utils/random'

// ─── Density Spawn Weights ───────────────────────────────────────────────────

/** Spawn weights for sector density. */
export const DENSITY_SPAWN_WEIGHTS: { value: SectorDensity; weight: number }[] = [
  { value: SectorDensity.Sparse, weight: 30 },
  { value: SectorDensity.Moderate, weight: 50 },
  { value: SectorDensity.Dense, weight: 20 },
]

// ─── Threat Modifier Range ───────────────────────────────────────────────────

/** Threat modifier minimum (inclusive). */
const THREAT_MODIFIER_MIN = 0.5

/** Threat modifier maximum (inclusive). */
const THREAT_MODIFIER_MAX = 1.5

// ─── Sector Generator ────────────────────────────────────────────────────────

/**
 * Options for generating a single sector.
 */
export interface GenerateSectorOptions {
  /** Names already used by other sectors (to ensure uniqueness). */
  usedNames?: Set<string>
  /** Whether this is the starting sector (sets exploration to starting value). */
  isStartingSector?: boolean
}

/**
 * Generates a single sector with a unique name, density, threat modifier,
 * and exploration percentage.
 *
 * @param options - Generation options
 * @returns A fully typed Sector object
 */
export function generateSector(options: GenerateSectorOptions = {}): Sector {
  const { usedNames = new Set(), isStartingSector = false } = options

  const name = pickUniqueName(usedNames)
  const density = weightedRandom(DENSITY_SPAWN_WEIGHTS)
  // Round to 2 decimal places for clean display
  const threatModifier = Math.round(randomFloat(THREAT_MODIFIER_MIN, THREAT_MODIFIER_MAX) * 100) / 100
  const explorationPercent = isStartingSector
    ? GALAXY_GENERATION_PARAMS.startingSectorExplorationPercent
    : 0

  return {
    id: generateSectorId(),
    name,
    density,
    explorationPercent,
    threatModifier,
    firstEnteredTurn: null,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Picks a unique name from the sector name pool.
 * Throws if the pool is exhausted.
 *
 * @param usedNames - Set of names already in use
 * @returns A name not yet in the usedNames set
 */
function pickUniqueName(usedNames: Set<string>): string {
  const available = SECTOR_NAMES.filter((n) => !usedNames.has(n))

  if (available.length === 0) {
    throw new Error('sector-generator: All sector names exhausted')
  }

  // Pick a random index from the available names
  const index = Math.floor(Math.random() * available.length)
  const name = available[index]!
  usedNames.add(name)
  return name
}
