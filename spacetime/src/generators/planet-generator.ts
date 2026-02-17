/**
 * planet-generator.ts — Generates planets with type, size, features, and deposits.
 *
 * Uses Data.md rules:
 * - Planet type selected by spawn weight (Data.md § 3)
 * - Planet size selected by spawn weight (Data.md § 4)
 * - Features rolled from eligible pool up to feature slot count (Data.md § 5)
 * - Deposits rolled from type's deposit pool with tier chances (Data.md § 2–3)
 * - Each deposit gets random richness by spawn weight (Data.md § 2)
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 13.1): Orbit scan reveals partial data based on corp level.
 * TODO (Story 13.2): Called from exploration contract completion to generate discovered planets.
 * TODO (Story 13.4): Ground survey reveals full data (all features + exact richness).
 */

import type { PlanetId, SectorId } from '../types/common'
import { PlanetStatus } from '../types/common'
import type { Planet, Deposit, PlanetFeature } from '../types/planet'
import type { Modifier } from '../types/modifier'
import { PLANET_TYPE_DEFINITIONS, PLANET_TYPE_SPAWN_WEIGHTS } from '../data/planet-types'
import type { DepositPoolEntry } from '../data/planet-types'
import { DEPOSIT_TIER_CHANCES, } from '../data/planet-types'
import { PLANET_SIZE_DEFINITIONS, PLANET_SIZE_SPAWN_WEIGHTS } from '../data/planet-sizes'
import { PLANET_FEATURE_DEFINITIONS } from '../data/planet-features'
import type { PlanetFeatureDefinition } from '../data/planet-features'
import { RICHNESS_SPAWN_WEIGHTS } from '../data/planet-deposits'
import { generatePlanetId, generateModifierId } from '../utils/id'
import { weightedRandom, randomInt, chance } from '../utils/random'
import type { PlanetType, PlanetSize, RichnessLevel } from '../types/common'

// ─── Planet Name Pool ───────────────────────────────────────────────────────

/** Name prefixes for procedural planet name generation. */
const PLANET_NAME_PREFIXES = [
  'Nova', 'Kepler', 'Gliese', 'Proxima', 'Tau', 'Alpha', 'Beta', 'Gamma',
  'Delta', 'Epsilon', 'Zeta', 'Theta', 'Sigma', 'Omega', 'Vega', 'Rigel',
  'Altair', 'Deneb', 'Sirius', 'Lyra', 'Orion', 'Cygnus', 'Draco', 'Hydra',
  'Centauri', 'Aquila', 'Corvus', 'Pavo', 'Dorado', 'Fornax',
]

/** Name suffixes for procedural planet name generation. */
const PLANET_NAME_SUFFIXES = [
  'Prime', 'Major', 'Minor', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII',
  'VIII', 'IX', 'X', 'b', 'c', 'd', 'e', 'f',
]

// ─── Generation Options ─────────────────────────────────────────────────────

export interface GeneratePlanetOptions {
  /** Sector this planet belongs to. */
  sectorId: SectorId
  /** Force a specific planet type (e.g., for Terra Nova). */
  forcedType?: PlanetType
  /** Force a specific planet size (e.g., for Terra Nova). */
  forcedSize?: PlanetSize
  /** Names already used (to ensure uniqueness). */
  usedNames?: Set<string>
  /** Initial status for the planet. Defaults to OrbitScanned. */
  initialStatus?: PlanetStatus
}

// ─── Planet Generator ───────────────────────────────────────────────────────

/**
 * Generates a fully typed Planet object with type, size, features, and deposits.
 *
 * Algorithm:
 * 1. Select planet type by spawn weight (or use forced type)
 * 2. Select planet size by spawn weight (or use forced size)
 * 3. Roll features from eligible pool, up to the size's feature slot count
 * 4. Roll deposits from the type's deposit pool with tier likelihood chances
 * 5. Each deposit gets a random richness by spawn weight
 * 6. Build feature modifiers for future colony application
 *
 * @param options - Generation configuration
 * @returns A fully typed Planet object
 */
export function generatePlanet(options: GeneratePlanetOptions): Planet {
  const {
    sectorId,
    forcedType,
    forcedSize,
    usedNames = new Set(),
    initialStatus = PlanetStatus.OrbitScanned,
  } = options

  // 1. Select type and size
  const planetType = forcedType ?? weightedRandom(PLANET_TYPE_SPAWN_WEIGHTS)
  const planetSize = forcedSize ?? weightedRandom(PLANET_SIZE_SPAWN_WEIGHTS)

  const typeDef = PLANET_TYPE_DEFINITIONS[planetType]
  const sizeDef = PLANET_SIZE_DEFINITIONS[planetSize]

  // 2. Generate name
  const name = generatePlanetName(usedNames)

  // 3. Roll features
  const featureSlotCount = randomInt(sizeDef.featureSlots.min, sizeDef.featureSlots.max)
  const rolledFeatures = rollFeatures(planetType, planetSize, featureSlotCount)

  // 4. Roll deposits
  const depositSlotCount = randomInt(sizeDef.depositSlots.min, sizeDef.depositSlots.max)
  const rolledDeposits = rollDeposits(typeDef.depositPool, depositSlotCount)

  // 5. Build feature modifiers (to be applied when a colony is founded)
  const featureModifiers = buildFeatureModifiers(rolledFeatures)

  // 6. Build PlanetFeature objects
  const features: PlanetFeature[] = rolledFeatures.map((def) => ({
    featureId: def.featureId,
    orbitVisible: def.orbitVisible,
    revealed: false, // Revealed based on scan type (orbit vs. ground)
  }))

  return {
    id: generatePlanetId(),
    name,
    sectorId,
    type: planetType,
    size: planetSize,
    status: initialStatus,
    baseHabitability: typeDef.baseHabitability,
    deposits: rolledDeposits,
    features,
    featureModifiers,
    orbitScanTurn: null,
    groundSurveyTurn: null,
  }
}

// ─── Feature Rolling ────────────────────────────────────────────────────────

/**
 * Rolls features from the eligible pool up to the given slot count.
 * Each eligible feature rolls against its spawn chance independently.
 * Features are shuffled first to avoid bias toward early-defined features.
 *
 * @param planetType - The planet's type
 * @param planetSize - The planet's size
 * @param maxFeatures - Maximum number of features to roll
 * @returns Array of selected feature definitions
 */
function rollFeatures(
  planetType: PlanetType,
  planetSize: PlanetSize,
  maxFeatures: number,
): PlanetFeatureDefinition[] {
  // Find eligible features for this planet type and size
  const eligible = PLANET_FEATURE_DEFINITIONS.filter((f) =>
    isFeatureEligible(f, planetType, planetSize),
  )

  // Shuffle to avoid ordering bias
  const shuffled = shuffleArray([...eligible])

  const selected: PlanetFeatureDefinition[] = []
  for (const feature of shuffled) {
    if (selected.length >= maxFeatures) break
    if (chance(feature.spawnChance)) {
      selected.push(feature)
    }
  }

  return selected
}

/**
 * Checks if a feature is eligible for a given planet type and size.
 */
function isFeatureEligible(
  feature: PlanetFeatureDefinition,
  planetType: PlanetType,
  planetSize: PlanetSize,
): boolean {
  const { spawnCondition } = feature

  // If feature can spawn on any planet type, it's always eligible (type-wise)
  if (spawnCondition.anyPlanetType) return true

  // Check planet type constraint
  if (spawnCondition.allowedPlanetTypes && spawnCondition.allowedPlanetTypes.includes(planetType)) {
    return true
  }

  // Check planet size constraint (e.g., High Gravity only on Large/Huge)
  if (spawnCondition.allowedPlanetSizes && spawnCondition.allowedPlanetSizes.includes(planetSize)) {
    return true
  }

  return false
}

// ─── Deposit Rolling ────────────────────────────────────────────────────────

/**
 * Rolls deposits from the planet type's deposit pool.
 *
 * Algorithm:
 * 1. Guaranteed deposits always spawn (at least one)
 * 2. Other deposits roll against their tier chance
 * 3. Total deposits capped at the slot count
 * 4. Each deposit gets a random richness by spawn weight
 *
 * @param depositPool - The deposit pool for this planet type
 * @param maxDeposits - Maximum number of deposit slots
 * @returns Array of generated deposits
 */
function rollDeposits(depositPool: DepositPoolEntry[], maxDeposits: number): Deposit[] {
  const deposits: Deposit[] = []

  // First pass: add guaranteed deposits
  for (const entry of depositPool) {
    if (deposits.length >= maxDeposits) break
    if (entry.tier === 'guaranteed') {
      deposits.push(createDeposit(entry))
    }
  }

  // Second pass: roll non-guaranteed deposits
  // Shuffle to avoid ordering bias
  const nonGuaranteed = shuffleArray(
    depositPool.filter((e) => e.tier !== 'guaranteed'),
  )

  for (const entry of nonGuaranteed) {
    if (deposits.length >= maxDeposits) break
    const tierChance = DEPOSIT_TIER_CHANCES[entry.tier]
    if (chance(tierChance)) {
      deposits.push(createDeposit(entry))
    }
  }

  return deposits
}

/**
 * Creates a single Deposit from a pool entry with random richness.
 */
function createDeposit(entry: DepositPoolEntry): Deposit {
  const richness = weightedRandom(
    RICHNESS_SPAWN_WEIGHTS.map((r) => ({ value: r.richness, weight: r.weight })),
  )

  return {
    type: entry.type,
    richness,
    richnessRevealed: false,
  }
}

// ─── Feature Modifier Building ──────────────────────────────────────────────

/**
 * Converts rolled feature definitions into Modifier objects.
 * These are stored on the Planet and registered onto the Colony when founded.
 *
 * @param features - The rolled feature definitions
 * @returns Array of Modifier objects
 */
function buildFeatureModifiers(features: PlanetFeatureDefinition[]): Modifier[] {
  const modifiers: Modifier[] = []

  for (const feature of features) {
    for (const template of feature.modifierTemplates) {
      modifiers.push({
        id: generateModifierId(),
        target: template.target,
        operation: template.operation,
        value: template.value,
        sourceType: 'feature',
        sourceId: feature.featureId,
        sourceName: feature.name,
      })
    }
  }

  return modifiers
}

// ─── Planet Name Generation ─────────────────────────────────────────────────

/**
 * Generates a unique planet name from prefix + suffix pools.
 * Falls back to prefix + random number if all combinations are taken.
 */
function generatePlanetName(usedNames: Set<string>): string {
  // Try prefix + suffix combination
  const shuffledPrefixes = shuffleArray([...PLANET_NAME_PREFIXES])
  const shuffledSuffixes = shuffleArray([...PLANET_NAME_SUFFIXES])

  for (const prefix of shuffledPrefixes) {
    for (const suffix of shuffledSuffixes) {
      const name = `${prefix} ${suffix}`
      if (!usedNames.has(name)) {
        usedNames.add(name)
        return name
      }
    }
  }

  // Fallback: prefix + random number (practically unreachable)
  const fallbackName = `Planet-${randomInt(1000, 9999)}`
  usedNames.add(fallbackName)
  return fallbackName
}

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle. Returns a new shuffled array.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}
