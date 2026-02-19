/**
 * science-sim.ts — Science point accumulation and domain advancement.
 *
 * Calculates empire science output, distributes it across 9 domains,
 * applies focus doubling, and checks level-up thresholds.
 *
 * Formulas (Specs.md § 8, Features.md Story 14.1):
 *   empire_science_per_turn = sum of all science infrastructure levels across all colonies
 *   per_domain_base = floor(empire_science_per_turn / 9)
 *   focused domain allocation = per_domain_base × 2
 *   threshold_to_next_level = current_level × 15
 *   On level up: unlocks discovery pool for that domain
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 14.2): Discovery rolling for science corps.
 * TODO (Story 14.4): Integration into science-phase.ts.
 */

import type { Colony } from '../../types/colony'
import type { ScienceDomainState } from '../../types/science'
import type { GameEvent } from '../../types/event'
import { InfraDomain, ScienceSectorType, EventPriority } from '../../types/common'
import type { TurnNumber } from '../../types/common'
import { getTotalLevels } from '../../types/infrastructure'
import { getScienceLevelThreshold } from '../../data/science-sectors'
import { generateEventId } from '../../utils/id'

// ─── Science Output Calculation ──────────────────────────────────────────────

/**
 * Calculates total empire science output per turn.
 * Simply sums all science infrastructure levels across all colonies.
 */
export function calculateEmpireSciencePerTurn(colonies: Colony[]): number {
  let total = 0
  for (const colony of colonies) {
    const scienceInfra = colony.infrastructure[InfraDomain.Science]
    if (scienceInfra) {
      total += getTotalLevels(scienceInfra)
    }
  }
  return total
}

// ─── Science Distribution ────────────────────────────────────────────────────

/**
 * Result of distributing science points across domains for one turn.
 */
export interface ScienceDistributionResult {
  /** Updated domain states after accumulation and level checks. */
  updatedDomains: Map<string, ScienceDomainState>
  /** Events generated (level-up announcements). */
  events: GameEvent[]
}

/**
 * Distributes science points across all 9 domains and checks for level-ups.
 *
 * 1. Calculate per_domain_base = floor(empire_science / 9)
 * 2. For the focused domain (if any), allocation = per_domain_base × 2
 * 3. Accumulate points on each domain
 * 4. Check if accumulated points >= threshold (current_level × 15)
 * 5. On level-up: increment level, subtract threshold, set new threshold
 */
export function distributeScience(
  domains: Map<string, ScienceDomainState>,
  empireSciencePerTurn: number,
  turn: TurnNumber,
): ScienceDistributionResult {
  const updatedDomains = new Map<string, ScienceDomainState>()
  const events: GameEvent[] = []

  // Calculate base allocation per domain
  const perDomainBase = Math.floor(empireSciencePerTurn / 9)

  for (const [key, domain] of domains) {
    // Determine allocation: doubled if focused
    const allocation = domain.focused ? perDomainBase * 2 : perDomainBase

    // Accumulate points
    let accumulatedPoints = domain.accumulatedPoints + allocation
    let level = domain.level
    let threshold = domain.thresholdToNextLevel

    // Check for level-up (can level up multiple times in one turn if enough points)
    // threshold is always for the *next* level: getScienceLevelThreshold(level + 1)
    while (threshold > 0 && accumulatedPoints >= threshold) {
      accumulatedPoints -= threshold
      level += 1
      // Next threshold: points needed to reach level+1
      threshold = getScienceLevelThreshold(level + 1)

      events.push({
        id: generateEventId(),
        turn,
        priority: EventPriority.Positive,
        category: 'science',
        title: `${domain.type} advances to level ${level}`,
        description: `The ${domain.type} domain has reached level ${level}. New discoveries may become available.`,
        relatedEntityIds: [],
        dismissed: false,
      })
    }

    updatedDomains.set(key, {
      ...domain,
      level,
      accumulatedPoints,
      // threshold is for the next level after current
      thresholdToNextLevel: threshold,
    })
  }

  return { updatedDomains, events }
}

// ─── Domain Initialization ───────────────────────────────────────────────────

/**
 * Creates initial science domain states (all at level 0) for a new game.
 * Used by game.store.ts during initializeGame().
 */
export function createInitialScienceDomains(): Map<string, ScienceDomainState> {
  const domains = new Map<string, ScienceDomainState>()

  for (const domainType of Object.values(ScienceSectorType)) {
    domains.set(domainType, {
      type: domainType,
      level: 0,
      accumulatedPoints: 0,
      // Threshold to reach level 1 from level 0
      thresholdToNextLevel: getScienceLevelThreshold(1),
      focused: false,
      discoveredIds: [],
      unlockedSchematicCategories: [],
    })
  }

  return domains
}

/**
 * Sets the focused domain. Only one domain can be focused at a time.
 * Pass null to clear focus.
 *
 * Returns a new map with updated focus state.
 */
export function setDomainFocus(
  domains: Map<string, ScienceDomainState>,
  focusDomain: ScienceSectorType | null,
): Map<string, ScienceDomainState> {
  const updated = new Map<string, ScienceDomainState>()

  for (const [key, domain] of domains) {
    updated.set(key, {
      ...domain,
      focused: focusDomain !== null && domain.type === focusDomain,
    })
  }

  return updated
}
