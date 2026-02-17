/**
 * corp-generator.ts — Corporation generation.
 *
 * Generates a new Corporation with a unique name, type, personality traits,
 * and starting stats. Used when the player kickstarts a corp via a contract
 * or when organic emergence triggers on a high-dynamism colony.
 *
 * No Vue or Pinia imports. Pure TypeScript.
 */

import type { PlanetId, TurnNumber } from '../types/common'
import { CorpType, CorpPersonalityTrait } from '../types/common'
import type { Corporation, CorpAssets } from '../types/corporation'
import { generateCorpId } from '../utils/id'
import { chance, weightedRandom } from '../utils/random'
import { generateCorpName } from './name-generator'
import {
  CORP_NAME_PREFIXES,
  CORP_NAME_SUFFIXES,
  CORP_NAME_CONNECTORS,
  CORP_NAME_CONNECTOR_CHANCE,
} from '../data/corporation-names'
import {
  TRAIT_SPAWN_WEIGHTS,
  CONFLICTING_TRAIT_PAIRS,
  DUAL_TRAIT_CHANCE,
} from '../data/personality-traits'

// ─── Trait Generation ────────────────────────────────────────────────────────

/**
 * Checks if two traits conflict with each other.
 * Conflicting pairs: Cautious/Aggressive, Innovative/Conservative, Ethical/Ruthless.
 */
function areTraitsConflicting(
  trait1: CorpPersonalityTrait,
  trait2: CorpPersonalityTrait,
): boolean {
  return CONFLICTING_TRAIT_PAIRS.some(
    ([a, b]) => (trait1 === a && trait2 === b) || (trait1 === b && trait2 === a),
  )
}

/**
 * Generates 1 or 2 personality traits, ensuring no conflicting pairs.
 * 70% chance of 1 trait, 30% chance of 2 traits.
 */
function generateTraits(): CorpPersonalityTrait[] {
  const firstTrait = weightedRandom(TRAIT_SPAWN_WEIGHTS)
  const traits: CorpPersonalityTrait[] = [firstTrait]

  if (chance(DUAL_TRAIT_CHANCE)) {
    // Filter out the first trait and any conflicting traits
    const eligibleWeights = TRAIT_SPAWN_WEIGHTS.filter(
      (entry) =>
        entry.value !== firstTrait && !areTraitsConflicting(firstTrait, entry.value),
    )

    if (eligibleWeights.length > 0) {
      const secondTrait = weightedRandom(eligibleWeights)
      traits.push(secondTrait)
    }
  }

  return traits
}

// ─── Corporation Generation ──────────────────────────────────────────────────

/**
 * Parameters for generating a new corporation.
 */
export interface GenerateCorpParams {
  /** Corporation type. If omitted, a random type is assigned. */
  type?: CorpType
  /** The colony's planet where this corporation is founded. */
  homePlanetId: PlanetId
  /** The turn this corporation is founded. */
  foundedTurn: TurnNumber
}

/**
 * Generates a new level 1 corporation with unique name, type, traits, and empty assets.
 *
 * @param params - Generation parameters (type, home planet, founding turn)
 * @returns A fully initialized Corporation object
 */
export function generateCorporation(params: GenerateCorpParams): Corporation {
  const { homePlanetId, foundedTurn } = params

  // Resolve type: use parameter or pick a random one
  const corpType: CorpType = params.type ?? randomCorpType()

  // Generate unique name
  const name = generateCorpName(
    CORP_NAME_PREFIXES,
    CORP_NAME_SUFFIXES,
    CORP_NAME_CONNECTORS,
    CORP_NAME_CONNECTOR_CHANCE,
  )

  // Generate personality traits (1 or 2, no conflicts)
  const traits = generateTraits()

  // Empty starting assets
  const assets: CorpAssets = {
    infrastructureByColony: new Map(),
    schematics: [],
    patents: [],
  }

  return {
    id: generateCorpId(),
    name,
    type: corpType,
    level: 1,
    capital: 0,
    traits,
    homePlanetId,
    planetsPresent: [homePlanetId],
    assets,
    activeContractIds: [],
    foundedTurn,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** All corp types as an array for random selection. */
const ALL_CORP_TYPES: CorpType[] = Object.values(CorpType)

/**
 * Picks a random CorpType from all available types (uniform distribution).
 * Used when no specific type is requested (e.g., organic emergence fallback).
 *
 * TODO (Story 11.3): Organic emergence determines type from colony's most prominent infra domain.
 */
function randomCorpType(): CorpType {
  return ALL_CORP_TYPES[Math.floor(Math.random() * ALL_CORP_TYPES.length)]!
}
