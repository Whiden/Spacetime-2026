/**
 * colony-generator.ts — Initializes a colony from a planet and colony type selection.
 *
 * Creates a Colony with:
 * - Population level 1 (or as overridden, e.g., Terra Nova starts at 7)
 * - Starting infrastructure from colony type definition
 * - Planet feature modifiers registered onto colony.modifiers
 * - Colony type passive bonus registered onto colony.modifiers
 * - Initial attribute calculation (simplified — full recalc in Story 10.1)
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 10.1): Replace initial attribute calculation with full formulas from attributes.ts.
 * TODO (Story 10.3): Colony-phase recalculates attributes each turn.
 */

import type { ColonyType, InfraDomain, TurnNumber } from '../types/common'
import type { Colony, ColonyAttributes } from '../types/colony'
import type { ColonyInfrastructure, InfraState } from '../types/infrastructure'
import type { Planet } from '../types/planet'
import type { Modifier } from '../types/modifier'
import { COLONY_TYPE_DEFINITIONS } from '../data/colony-types'
import type { StartingInfraEntry } from '../data/colony-types'
import { DEPOSIT_DEFINITIONS } from '../data/planet-deposits'
import { generateColonyId, generateModifierId } from '../utils/id'
import { resolveModifiers } from '../engine/formulas/modifiers'
import { InfraDomain as InfraDomainEnum } from '../types/common'

// ─── All Infrastructure Domains ─────────────────────────────────────────────

/** All 12 infrastructure domains for initializing a colony's infrastructure map. */
const ALL_INFRA_DOMAINS: InfraDomain[] = Object.values(InfraDomainEnum)

// ─── Generation Options ─────────────────────────────────────────────────────

export interface GenerateColonyOptions {
  /** The planet being colonized. */
  planet: Planet
  /** The colony type chosen during the colonization contract. */
  colonyType: ColonyType
  /** Override starting population level (e.g., Terra Nova at 7). Defaults to colony type's value. */
  populationLevel?: number
  /** Override colony name. Defaults to planet name. */
  name?: string
  /** Turn when the colony was founded. */
  foundedTurn: TurnNumber
  /** Override starting infrastructure (e.g., for Terra Nova). */
  overrideInfrastructure?: { domain: InfraDomain; publicLevels: number }[]
}

// ─── Colony Generator ───────────────────────────────────────────────────────

/**
 * Creates a new colony from a planet and colony type.
 *
 * Algorithm:
 * 1. Build infrastructure map: empty for all domains, then apply starting infra from colony type
 * 2. Register planet feature modifiers onto colony.modifiers
 * 3. Register colony type passive bonus as modifiers onto colony.modifiers
 * 4. Calculate initial attributes using modifiers
 *
 * @param options - Colony generation configuration
 * @returns A fully typed Colony object
 */
export function generateColony(options: GenerateColonyOptions): Colony {
  const {
    planet,
    colonyType,
    name = planet.name,
    foundedTurn,
    overrideInfrastructure,
  } = options

  const colonyTypeDef = COLONY_TYPE_DEFINITIONS[colonyType]
  const populationLevel = options.populationLevel ?? colonyTypeDef.startingPopulationLevel

  // 1. Build infrastructure
  const infrastructure = overrideInfrastructure
    ? buildInfrastructureFromOverride(overrideInfrastructure)
    : buildStartingInfrastructure(colonyTypeDef.startingInfrastructure, planet)

  // 2. Register modifiers: planet features + colony type passive bonus
  const modifiers: Modifier[] = [
    ...registerFeatureModifiers(planet),
    ...registerColonyTypeModifiers(colonyType, colonyTypeDef.name),
  ]

  // 3. Calculate initial attributes
  const attributes = calculateInitialAttributes(planet, modifiers, populationLevel, infrastructure)

  return {
    id: generateColonyId(),
    planetId: planet.id,
    sectorId: planet.sectorId,
    name,
    type: colonyType,
    populationLevel,
    attributes,
    infrastructure,
    corporationsPresent: [],
    modifiers,
    foundedTurn,
  }
}

// ─── Infrastructure Building ────────────────────────────────────────────────

/**
 * Builds the starting infrastructure map from a colony type's starting infra entries.
 * Deposit-requiring entries are only included if the planet has a matching deposit.
 */
function buildStartingInfrastructure(
  entries: StartingInfraEntry[],
  planet: Planet,
): ColonyInfrastructure {
  // Initialize all domains to zero
  const infra = buildEmptyInfrastructure()

  for (const entry of entries) {
    // If this entry requires a deposit, check if the planet has one
    if (entry.requiresDeposit && !planetHasDepositForDomain(planet, entry.domain)) {
      continue
    }

    infra[entry.domain] = {
      domain: entry.domain,
      ownership: {
        publicLevels: entry.publicLevels,
        corporateLevels: new Map(),
      },
      currentCap: Infinity, // TODO (Story 10.1): Calculated by calculateInfraCap()
    }
  }

  return infra
}

/**
 * Builds infrastructure from an explicit override list (e.g., for Terra Nova).
 */
function buildInfrastructureFromOverride(
  entries: { domain: InfraDomain; publicLevels: number }[],
): ColonyInfrastructure {
  const infra = buildEmptyInfrastructure()

  for (const entry of entries) {
    infra[entry.domain] = {
      domain: entry.domain,
      ownership: {
        publicLevels: entry.publicLevels,
        corporateLevels: new Map(),
      },
      currentCap: Infinity, // TODO (Story 10.1): Calculated by calculateInfraCap()
    }
  }

  return infra
}

/**
 * Creates an empty infrastructure map with all domains at zero.
 */
function buildEmptyInfrastructure(): ColonyInfrastructure {
  const infra = {} as ColonyInfrastructure

  for (const domain of ALL_INFRA_DOMAINS) {
    infra[domain] = {
      domain,
      ownership: {
        publicLevels: 0,
        corporateLevels: new Map(),
      },
      currentCap: Infinity, // TODO (Story 10.1): Calculated by calculateInfraCap()
    }
  }

  return infra
}

/**
 * Checks if a planet has a deposit that matches the extraction domain.
 * Used for colony types that only add infrastructure if a relevant deposit exists.
 */
function planetHasDepositForDomain(planet: Planet, domain: InfraDomain): boolean {
  return planet.deposits.some((deposit) => {
    const depositDef = DEPOSIT_DEFINITIONS[deposit.type]
    return depositDef.extractedBy === domain
  })
}

// ─── Modifier Registration ──────────────────────────────────────────────────

/**
 * Copies planet feature modifiers onto the colony.
 * Each modifier already has sourceType 'feature' and sourceId from the feature.
 */
function registerFeatureModifiers(planet: Planet): Modifier[] {
  // Clone modifiers with fresh IDs so they're independent of the planet object
  return planet.featureModifiers.map((mod) => ({
    ...mod,
    id: generateModifierId(),
  }))
}

/**
 * Creates modifiers from the colony type's passive bonus templates.
 * Each modifier has sourceType 'colonyType' and sourceId = colony type string.
 */
function registerColonyTypeModifiers(colonyType: ColonyType, typeName: string): Modifier[] {
  const colonyTypeDef = COLONY_TYPE_DEFINITIONS[colonyType]

  return colonyTypeDef.passiveBonusModifiers.map((template) => ({
    id: generateModifierId(),
    target: template.target,
    operation: template.operation,
    value: template.value,
    sourceType: 'colonyType' as const,
    sourceId: colonyType,
    sourceName: typeName,
  }))
}

// ─── Initial Attribute Calculation ──────────────────────────────────────────

/**
 * Calculates initial colony attributes using the modifier system.
 * This is a simplified version — full attribute calculation will use the
 * dedicated formulas in engine/formulas/attributes.ts (Story 10.1).
 *
 * For now, we apply modifiers to base values from Specs.md:
 * - Habitability: base from planet type + modifiers
 * - Accessibility: 3 + floor(transport/2) + modifiers
 * - Dynamism: floor((accessibility + popLevel) / 2) + modifiers
 * - QoL: 10 - hab malus + modifiers
 * - Stability: 10 + modifiers
 * - Growth: 0 (starting value)
 */
function calculateInitialAttributes(
  planet: Planet,
  modifiers: Modifier[],
  populationLevel: number,
  infrastructure: ColonyInfrastructure,
): ColonyAttributes {
  const transportLevel = infrastructure[InfraDomainEnum.Transport].ownership.publicLevels

  // Habitability: base from planet type + feature/colony type modifiers
  const habitability = resolveModifiers(
    planet.baseHabitability,
    'habitability',
    modifiers,
    0,
    10,
  )

  // Accessibility: 3 + floor(transport/2) + modifiers
  const accessibilityBase = 3 + Math.floor(transportLevel / 2)
  const accessibility = resolveModifiers(
    accessibilityBase,
    'accessibility',
    modifiers,
    0,
    10,
  )

  // Dynamism: floor((accessibility + popLevel) / 2) + modifiers
  const dynamismBase = Math.floor((accessibility + populationLevel) / 2)
  const dynamism = resolveModifiers(
    dynamismBase,
    'dynamism',
    modifiers,
    0,
    10,
  )

  // QoL: 10 - hab malus - shortage malus + modifiers
  // At colony founding, no shortages exist yet
  const qolHabMalus = Math.floor(Math.max(0, 10 - habitability) / 3)
  const qolBase = 10 - qolHabMalus
  const qualityOfLife = resolveModifiers(
    qolBase,
    'qualityOfLife',
    modifiers,
    0,
    10,
  )

  // Stability: 10 - qol malus - debt malus - shortage malus + military bonus + modifiers
  // At colony founding, no debt or shortages
  const militaryLevel = infrastructure[InfraDomainEnum.Military].ownership.publicLevels
  const stabilityQolMalus = Math.max(0, 5 - qualityOfLife)
  const stabilityMilitaryBonus = Math.min(3, Math.floor(militaryLevel / 3))
  const stabilityBase = 10 - stabilityQolMalus + stabilityMilitaryBonus
  const stability = resolveModifiers(
    stabilityBase,
    'stability',
    modifiers,
    0,
    10,
  )

  return {
    habitability,
    accessibility,
    dynamism,
    qualityOfLife,
    stability,
    growth: 0,
  }
}
