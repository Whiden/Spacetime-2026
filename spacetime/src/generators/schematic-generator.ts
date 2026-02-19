/**
 * schematic-generator.ts — Schematic development for shipbuilding corporations.
 *
 * Formulas (Features.md Story 14.3, Data.md § 12):
 *   schematic_chance = corp_level × 2 (%)
 *   max_schematics_for_corp = floor(corp_level / 2)
 *   bonusAmount = level × baseBonusPerLevel + randomModifier
 *
 * Schematics are unique equipment blueprints owned by shipbuilding corps.
 * They modify the stats of every ship that corp builds.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 14.4): Called from science-phase.ts each turn.
 * TODO (Story 15.1): design-blueprint.ts applies schematics when building ships.
 */

import type { Schematic, ScienceDomainState, Discovery } from '../types/science'
import type { Corporation } from '../types/corporation'
import type { GameEvent } from '../types/event'
import type { TurnNumber, SchematicCategory, ScienceSectorType, DiscoveryId } from '../types/common'
import { CorpType, EventPriority } from '../types/common'
import {
  SCHEMATIC_CATEGORY_DEFINITIONS,
  SCHEMATIC_NAME_PREFIXES,
  SCHEMATIC_NAME_SUFFIXES,
  SCHEMATIC_LEVEL_LABEL,
} from '../data/schematics'
import { generateSchematicId, generateEventId } from '../utils/id'

// ─── Chance & Cap Calculations ──────────────────────────────────────────────

/**
 * Calculates schematic development chance for a shipbuilding corp.
 * Formula: corp_level × 2 (%)
 */
export function calculateSchematicChance(corpLevel: number): number {
  return corpLevel * 2
}

/**
 * Maximum number of schematics a corp can hold.
 * Formula: floor(corp_level / 2)
 */
export function getMaxSchematics(corpLevel: number): number {
  return Math.floor(corpLevel / 2)
}

// ─── Category & Domain Helpers ──────────────────────────────────────────────

/**
 * Info about an unlocked schematic category: which domain unlocked it and that domain's level.
 */
export interface UnlockedCategoryInfo {
  category: SchematicCategory
  domain: ScienceSectorType
  domainLevel: number
}

/**
 * Collects all schematic categories unlocked across all science domains,
 * paired with the domain that unlocked them and its current level.
 *
 * If a category appears in multiple domains, the one with the higher level is used.
 */
export function getAllUnlockedCategories(
  scienceDomains: Map<string, ScienceDomainState>,
): UnlockedCategoryInfo[] {
  const bestByCategory = new Map<SchematicCategory, UnlockedCategoryInfo>()

  for (const domain of scienceDomains.values()) {
    for (const cat of domain.unlockedSchematicCategories) {
      const existing = bestByCategory.get(cat)
      if (!existing || domain.level > existing.domainLevel) {
        bestByCategory.set(cat, {
          category: cat,
          domain: domain.type,
          domainLevel: domain.level,
        })
      }
    }
  }

  return Array.from(bestByCategory.values())
}

/**
 * Finds the science domain that unlocked a given schematic category.
 * Returns the domain type and level, or null if not found.
 */
export function findDomainForCategory(
  category: SchematicCategory,
  scienceDomains: Map<string, ScienceDomainState>,
): { domain: ScienceSectorType; level: number } | null {
  for (const domainState of scienceDomains.values()) {
    if (domainState.unlockedSchematicCategories.includes(category)) {
      return { domain: domainState.type, level: domainState.level }
    }
  }
  return null
}

/**
 * Finds the discovery that unlocked a given schematic category.
 * Searches the discoveries list for one whose unlocksSchematicCategories includes the category.
 */
export function findDiscoveryForCategory(
  category: SchematicCategory,
  discoveries: Discovery[],
): DiscoveryId | null {
  for (const disc of discoveries) {
    if (disc.unlocksSchematicCategories.includes(category)) {
      return disc.id
    }
  }
  return null
}

// ─── Name Generation ────────────────────────────────────────────────────────

/**
 * Generates a schematic name from prefix + suffix pools + iteration label.
 * Format: "Hydra Missile" or "Hydra Missile Mk2"
 */
export function generateSchematicName(
  category: SchematicCategory,
  iteration: number,
  randFn: () => number = Math.random,
): string {
  const prefix = SCHEMATIC_NAME_PREFIXES[Math.floor(randFn() * SCHEMATIC_NAME_PREFIXES.length)]!
  const catDef = SCHEMATIC_CATEGORY_DEFINITIONS[category]
  const levelLabel = SCHEMATIC_LEVEL_LABEL(iteration)
  return `${prefix} ${catDef.name}${levelLabel}`
}

// ─── Schematic Generation ───────────────────────────────────────────────────

/**
 * Creates a new Schematic object for a given category, domain, and level.
 * The random modifier is a small variation applied once and preserved across updates.
 */
export function generateSchematic(
  category: SchematicCategory,
  domain: ScienceSectorType,
  domainLevel: number,
  ownerCorpId: string,
  sourceDiscoveryId: string,
  randFn: () => number = Math.random,
): Schematic {
  const catDef = SCHEMATIC_CATEGORY_DEFINITIONS[category]

  // Random modifier: -1, 0, or +1 (generated once, preserved across version updates)
  const randomModifier = Math.floor(randFn() * 3) - 1

  // Level is at least 1 (domain must be level 1+ for discoveries to exist)
  const level = Math.max(1, domainLevel)
  const bonusAmount = level * catDef.baseBonusPerLevel + randomModifier

  const name = generateSchematicName(category, 1, randFn)

  return {
    id: generateSchematicId(),
    name,
    category,
    scienceDomain: domain,
    level,
    statTarget: catDef.primaryStatTarget,
    bonusAmount: Math.max(0, bonusAmount),
    randomModifier,
    iteration: 1,
    ownerCorpId: ownerCorpId as any,
    sourceDiscoveryId: sourceDiscoveryId as any,
  }
}

// ─── Schematic Roll ─────────────────────────────────────────────────────────

/**
 * Result of a schematic development roll for a shipbuilding corporation.
 */
export interface SchematicRollResult {
  /** Newly generated schematic, or null if the roll failed or corp is at cap. */
  newSchematic: Schematic | null
  /** ID of the schematic replaced by the new one (same category), or null. */
  replacedSchematicId: string | null
  /** Events generated (new schematic announcement). */
  events: GameEvent[]
}

/**
 * Rolls for schematic development for a single shipbuilding corporation.
 *
 * Process:
 * 1. Check if corp is at schematic cap → skip if so
 * 2. Get unlocked categories from science domains
 * 3. Roll against schematic_chance = corp_level × 2 (%)
 * 4. Pick random category from unlocked set
 * 5. Same-category schematic replaces the older version
 * 6. Generate schematic with level = science domain's current level
 */
export function rollForSchematic(
  corp: Corporation,
  scienceDomains: Map<string, ScienceDomainState>,
  existingSchematics: Schematic[],
  discoveries: Discovery[],
  turn: TurnNumber,
  randFn: () => number = Math.random,
): SchematicRollResult {
  const noChange: SchematicRollResult = {
    newSchematic: null,
    replacedSchematicId: null,
    events: [],
  }

  // Only shipbuilding corps develop schematics
  if (corp.type !== CorpType.Shipbuilding) return noChange

  // Get all unlocked categories
  const unlockedCategories = getAllUnlockedCategories(scienceDomains)
  if (unlockedCategories.length === 0) return noChange

  // Check schematic cap: corp can't develop if already at max unique categories
  const maxSchematics = getMaxSchematics(corp.level)
  const corpSchematics = existingSchematics.filter((s) => s.ownerCorpId === corp.id)

  // Count unique categories the corp already has schematics for
  const ownedCategories = new Set(corpSchematics.map((s) => s.category))

  // Corp is at cap if it has schematics in max distinct categories
  // (same-category replacement doesn't count toward the cap)
  if (ownedCategories.size >= maxSchematics) return noChange

  // Roll against schematic chance
  const chance = calculateSchematicChance(corp.level)
  if (randFn() * 100 >= chance) return noChange

  // Pick a random unlocked category
  const chosen = unlockedCategories[Math.floor(randFn() * unlockedCategories.length)]!

  // Find the discovery that unlocked this category
  const discoveryId = findDiscoveryForCategory(chosen.category, discoveries)
  if (!discoveryId) return noChange

  // Check if the corp already has a schematic in this category (replacement)
  const existing = corpSchematics.find((s) => s.category === chosen.category)
  let replacedSchematicId: string | null = null
  if (existing) {
    replacedSchematicId = existing.id
  }

  // Generate the new schematic
  const newSchematic = generateSchematic(
    chosen.category,
    chosen.domain,
    chosen.domainLevel,
    corp.id,
    discoveryId,
    randFn,
  )

  const events: GameEvent[] = [
    {
      id: generateEventId(),
      turn,
      priority: EventPriority.Positive,
      category: 'science',
      title: `New Schematic: ${newSchematic.name}`,
      description: `${corp.name} has developed a new ${SCHEMATIC_CATEGORY_DEFINITIONS[chosen.category].name} schematic: ${newSchematic.name} (+${newSchematic.bonusAmount} ${newSchematic.statTarget}).`,
      relatedEntityIds: [corp.id],
      dismissed: false,
    },
  ]

  return { newSchematic, replacedSchematicId, events }
}

// ─── Schematic Versioning ───────────────────────────────────────────────────

/**
 * Result of updating schematics when a science domain levels up.
 */
export interface SchematicVersionUpdateResult {
  /** Updated schematics (only those that changed). */
  updatedSchematics: Schematic[]
  /** Events generated for each updated schematic. */
  events: GameEvent[]
}

/**
 * Updates all schematics tied to a science domain when that domain levels up.
 *
 * For each affected schematic:
 * - Level is set to the new domain level
 * - bonusAmount is recalculated: newLevel × baseBonusPerLevel + randomModifier (preserved)
 * - Iteration counter increments
 * - Name gains "Mk{iteration}" suffix
 */
export function updateSchematicsOnDomainLevelUp(
  allSchematics: Schematic[],
  domain: ScienceSectorType,
  newDomainLevel: number,
  turn: TurnNumber,
): SchematicVersionUpdateResult {
  const updatedSchematics: Schematic[] = []
  const events: GameEvent[] = []

  for (const schematic of allSchematics) {
    if (schematic.scienceDomain !== domain) continue
    // Only update if the domain actually advanced past the schematic's current level
    if (newDomainLevel <= schematic.level) continue

    const catDef = SCHEMATIC_CATEGORY_DEFINITIONS[schematic.category]
    const newIteration = schematic.iteration + 1
    const newBonusAmount = Math.max(0, newDomainLevel * catDef.baseBonusPerLevel + schematic.randomModifier)

    // Rebuild name with new iteration: strip any existing Mk suffix, add new one
    const baseName = schematic.name.replace(/ Mk\d+$/, '')
    const newName = `${baseName}${SCHEMATIC_LEVEL_LABEL(newIteration)}`

    updatedSchematics.push({
      ...schematic,
      level: newDomainLevel,
      bonusAmount: newBonusAmount,
      iteration: newIteration,
      name: newName,
    })

    events.push({
      id: generateEventId(),
      turn,
      priority: EventPriority.Info,
      category: 'science',
      title: `Schematic Updated: ${newName}`,
      description: `${schematic.category} schematic upgraded to level ${newDomainLevel} (+${newBonusAmount} ${schematic.statTarget}).`,
      relatedEntityIds: [schematic.ownerCorpId],
      dismissed: false,
    })
  }

  return { updatedSchematics, events }
}
