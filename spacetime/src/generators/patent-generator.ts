/**
 * patent-generator.ts — Patent development for corporations.
 *
 * Formulas (Features.md Story 14.4, Data.md § 14):
 *   patent_chance = corp_level × 2 (%)
 *   max_patents_for_corp = floor(corp_level / 2)
 *   Combat patent: +1 fight bonus per level
 *   All other patents: +1 capital per turn per level
 *
 * Patents are technological advantages owned by any corporation type.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 */

import type { Patent } from '../types/science'
import type { Corporation } from '../types/corporation'
import type { GameEvent } from '../types/event'
import type { TurnNumber, DiscoveryId } from '../types/common'
import { EventPriority } from '../types/common'
import { PATENT_DEFINITIONS } from '../data/patents'
import { generatePatentId, generateEventId } from '../utils/id'

// ─── Chance & Cap Calculations ──────────────────────────────────────────────

/**
 * Calculates patent development chance for a corporation.
 * Formula: corp_level × 2 (%)
 */
export function calculatePatentChance(corpLevel: number): number {
  return corpLevel * 2
}

/**
 * Maximum number of patents a corp can hold.
 * Formula: floor(corp_level / 2)
 */
export function getMaxPatents(corpLevel: number): number {
  return Math.floor(corpLevel / 2)
}

// ─── Patent Roll ─────────────────────────────────────────────────────────────

/**
 * Result of a patent development roll for a corporation.
 */
export interface PatentRollResult {
  /** Newly generated patent, or null if the roll failed or corp is at cap. */
  newPatent: Patent | null
  /** Events generated (new patent announcement). */
  events: GameEvent[]
}

/**
 * Rolls for patent development for a single corporation.
 *
 * Process:
 * 1. Check if corp is at patent cap → skip if so
 * 2. Roll against patent_chance = corp_level × 2 (%)
 * 3. Pick a random available patent definition the corp doesn't already own
 * 4. Create the patent with level 1 and the appropriate bonus
 *
 * @param randFn - Injectable RNG for deterministic tests (defaults to Math.random).
 */
export function rollForPatent(
  corp: Corporation,
  existingPatents: Patent[],
  sourceDiscoveryId: DiscoveryId | null,
  turn: TurnNumber,
  randFn: () => number = Math.random,
): PatentRollResult {
  const noChange: PatentRollResult = { newPatent: null, events: [] }

  if (PATENT_DEFINITIONS.length === 0) return noChange

  // Check patent cap
  const maxPatents = getMaxPatents(corp.level)
  const corpPatents = existingPatents.filter((p) => p.ownerCorpId === corp.id)
  if (corpPatents.size !== undefined ? corpPatents.size >= maxPatents : corpPatents.length >= maxPatents) return noChange

  // Roll against chance
  const chance = calculatePatentChance(corp.level)
  if (randFn() * 100 >= chance) return noChange

  // Find patent definitions not already owned by this corp
  const ownedDefinitionIds = new Set(corpPatents.map((p) => p.bonusTarget))
  const available = PATENT_DEFINITIONS.filter((def) => !ownedDefinitionIds.has(def.bonusTarget))
  if (available.length === 0) return noChange

  // Pick a random patent definition
  const def = available[Math.floor(randFn() * available.length)]!

  // Determine bonus amount per Data.md § 14 (all give 1 per level)
  const bonusAmount = def.bonusPerLevel * 1 // level 1 patent

  const newPatent: Patent = {
    id: generatePatentId(),
    name: def.name,
    bonusTarget: def.bonusTarget,
    bonusAmount,
    ownerCorpId: corp.id,
    sourceDiscoveryId: (sourceDiscoveryId ?? ('' as DiscoveryId)),
    level: 1,
  }

  const events: GameEvent[] = [
    {
      id: generateEventId(),
      turn,
      priority: EventPriority.Positive,
      category: 'science',
      title: `New Patent: ${def.name}`,
      description: `${corp.name} has developed a new patent: ${def.name} (${def.description})`,
      relatedEntityIds: [corp.id],
      dismissed: false,
    },
  ]

  return { newPatent, events }
}
