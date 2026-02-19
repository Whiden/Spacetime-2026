/**
 * science-sim.ts — Science point accumulation, domain advancement, and discovery rolling.
 *
 * Formulas (Specs.md § 8, Features.md Stories 14.1–14.2):
 *   empire_science_per_turn = sum of all science infrastructure levels across all colonies
 *   per_domain_base = floor(empire_science_per_turn / 9)
 *   focused domain allocation = per_domain_base × 2
 *   threshold_to_next_level = current_level × 15
 *   discovery_chance = (corp_level × 5) + (corp_science_infrastructure × 2) %
 *   focus bonus on discovery: if the drawn domain is focused, discovery_chance × 2
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 14.4): Integration into science-phase.ts.
 */

import type { Colony } from '../../types/colony'
import type { ScienceDomainState, Discovery } from '../../types/science'
import type { GameEvent } from '../../types/event'
import { InfraDomain, ScienceSectorType, EventPriority } from '../../types/common'
import type { TurnNumber } from '../../types/common'
import { getTotalLevels } from '../../types/infrastructure'
import { getScienceLevelThreshold } from '../../data/science-sectors'
import { generateEventId, generateDiscoveryId } from '../../utils/id'
import type { Corporation } from '../../types/corporation'
import type { EmpireBonuses } from '../../types/empire'
import type { DiscoveryDefinition } from '../../data/discoveries'
import { DISCOVERY_DEFINITIONS } from '../../data/discoveries'

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

  // Calculate base allocation per domain and remainder
  // Remainder points (empire_science % 9) are distributed one-each to the first N domains
  // in insertion order, so even small science values (< 9) still produce progress.
  const perDomainBase = Math.floor(empireSciencePerTurn / 9)
  let remainderPoints = empireSciencePerTurn % 9

  for (const [key, domain] of domains) {
    // Give 1 bonus point to the first (empire_science % 9) domains
    const remainderBonus = remainderPoints > 0 ? 1 : 0
    if (remainderPoints > 0) remainderPoints--

    // Total base for this domain (including remainder); doubled if focused
    const baseWithRemainder = perDomainBase + remainderBonus
    const allocation = domain.focused ? baseWithRemainder * 2 : baseWithRemainder

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

// ─── Discovery System (Story 14.2) ───────────────────────────────────────────

/**
 * Sums all science infrastructure levels owned by a corporation across all colonies.
 */
export function getCorporationScienceInfra(corp: Corporation): number {
  let total = 0
  for (const holdings of corp.assets.infrastructureByColony.values()) {
    total += holdings[InfraDomain.Science] ?? 0
  }
  return total
}

/**
 * Calculates discovery chance % for a science corp.
 *   discovery_chance = (corp_level × 5) + (corp_science_infrastructure × 2)
 * Focus bonus: if the domain is focused, the chance is doubled.
 */
export function calculateDiscoveryChance(
  corpLevel: number,
  corpScienceInfra: number,
  focused: boolean,
): number {
  const base = corpLevel * 5 + corpScienceInfra * 2
  return focused ? base * 2 : base
}

/**
 * Returns all discovery definitions available to draw this turn:
 * - Domain level >= discovery's poolLevel (domain must be unlocked)
 * - Not already in alreadyDiscoveredDefinitionIds (empire-wide)
 */
export function getAvailableDiscoveries(
  scienceDomains: Map<string, ScienceDomainState>,
  alreadyDiscoveredDefinitionIds: string[],
): DiscoveryDefinition[] {
  return DISCOVERY_DEFINITIONS.filter((def) => {
    const domain = scienceDomains.get(def.domain)
    if (!domain || domain.level < def.poolLevel) return false
    return !alreadyDiscoveredDefinitionIds.includes(def.definitionId)
  })
}

/**
 * Applies a discovery definition's bonus effects to EmpireBonuses.
 * Key format: "shipStats.speed", "infraCaps.maxMining", etc.
 * Returns a new EmpireBonuses object; does not mutate the original.
 */
export function applyDiscoveryEffects(
  def: DiscoveryDefinition,
  empireBonuses: EmpireBonuses,
): EmpireBonuses {
  const updated: EmpireBonuses = {
    shipStats: { ...empireBonuses.shipStats },
    infraCaps: { ...empireBonuses.infraCaps },
  }

  for (const effect of def.empireBonusEffects) {
    const dotIdx = effect.key.indexOf('.')
    if (dotIdx === -1) continue
    const category = effect.key.slice(0, dotIdx)
    const stat = effect.key.slice(dotIdx + 1)
    if (category === 'shipStats') {
      ;(updated.shipStats as Record<string, number>)[stat] =
        ((updated.shipStats as Record<string, number>)[stat] ?? 0) + effect.amount
    } else if (category === 'infraCaps') {
      ;(updated.infraCaps as Record<string, number>)[stat] =
        ((updated.infraCaps as Record<string, number>)[stat] ?? 0) + effect.amount
    }
  }

  return updated
}

/**
 * Result of a discovery roll for a single science corporation.
 */
export interface DiscoveryRollResult {
  /** The discovery made, or null if the roll failed or no pool is available. */
  discovery: Discovery | null
  /** Empire bonuses with discovery effects applied (unchanged if no discovery). */
  updatedEmpireBonuses: EmpireBonuses
  /** Science domain states with discoveredIds / unlockedSchematicCategories updated. */
  updatedScienceDomains: Map<string, ScienceDomainState>
  /** Events generated (one discovery event if successful). */
  events: GameEvent[]
}

/**
 * Rolls for a discovery for a science corporation.
 *
 * Process:
 * 1. Collect all available definitions (domain level ≥ poolLevel, not yet discovered).
 * 2. If pool is empty, return null immediately.
 * 3. Pick a random definition from the pool.
 * 4. Calculate discovery_chance; doubled if the definition's domain is focused.
 * 5. Roll — if successful, create Discovery, apply empire bonus effects, update domains.
 *
 * @param randFn - Injectable RNG for deterministic tests (defaults to Math.random).
 */
export function rollForDiscovery(
  corp: Corporation,
  scienceDomains: Map<string, ScienceDomainState>,
  alreadyDiscoveredDefinitionIds: string[],
  empireBonuses: EmpireBonuses,
  turn: TurnNumber,
  randFn: () => number = Math.random,
): DiscoveryRollResult {
  const noChange: DiscoveryRollResult = {
    discovery: null,
    updatedEmpireBonuses: empireBonuses,
    updatedScienceDomains: scienceDomains,
    events: [],
  }

  const available = getAvailableDiscoveries(scienceDomains, alreadyDiscoveredDefinitionIds)
  if (available.length === 0) return noChange

  // Pick a random definition from the available pool
  const def = available[Math.floor(randFn() * available.length)]!

  // Check domain focus for the selected definition
  const domain = scienceDomains.get(def.domain)!
  const scienceInfra = getCorporationScienceInfra(corp)
  const discoveryChance = calculateDiscoveryChance(corp.level, scienceInfra, domain.focused)

  // Roll against the chance (second call to randFn)
  if (randFn() * 100 >= discoveryChance) return noChange

  // Create the Discovery record
  const discovery: Discovery = {
    id: generateDiscoveryId(),
    sourceDefinitionId: def.definitionId,
    name: def.name,
    description: def.description,
    domain: def.domain,
    poolLevel: def.poolLevel,
    discoveredByCorpId: corp.id,
    discoveredTurn: turn,
    empireBonusEffects: def.empireBonusEffects,
    unlocksSchematicCategories: def.unlocksSchematicCategories,
  }

  // Apply effects to empire bonuses
  const updatedEmpireBonuses = applyDiscoveryEffects(def, empireBonuses)

  // Update the domain: record discovery ID, unlock schematic categories
  const updatedScienceDomains = new Map(scienceDomains)
  const updatedDomain: ScienceDomainState = {
    ...domain,
    discoveredIds: [...domain.discoveredIds, discovery.id],
    unlockedSchematicCategories: [
      ...new Set([...domain.unlockedSchematicCategories, ...def.unlocksSchematicCategories]),
    ],
  }
  updatedScienceDomains.set(def.domain, updatedDomain)

  const events: GameEvent[] = [
    {
      id: generateEventId(),
      turn,
      priority: EventPriority.Positive,
      category: 'science',
      title: `Discovery: ${def.name}`,
      description: `${corp.name} has made a breakthrough in ${def.domain}: ${def.description}`,
      relatedEntityIds: [corp.id],
      dismissed: false,
    },
  ]

  return { discovery, updatedEmpireBonuses, updatedScienceDomains, events }
}
