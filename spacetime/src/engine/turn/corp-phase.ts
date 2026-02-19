/**
 * corp-phase.ts — Corporation AI integration into the turn resolution pipeline.
 *
 * Story 11.2: Integrates corp-ai.ts decisions into the full turn pipeline.
 * Story 11.3: Adds organic corporation emergence on high-dynamism colonies.
 *
 * Responsibilities each turn:
 *   1. Sort all corporations by level descending (biggest corps act first).
 *   2. For each corp (skipping any absorbed mid-turn):
 *      a. Calculate passive capital gain (random(0,1) + floor(ownedInfra / 10)).
 *      b. Apply capital gain to the corporation.
 *      c. Run corporation AI (runCorpInvestmentAI from corp-ai.ts).
 *      d. Merge AI results back into the running state:
 *         - Update the corporation's capital, level, and asset holdings.
 *         - Update any colonies where infrastructure ownership changed.
 *         - Remove absorbed corporations from the corporation map.
 *   3. Check each colony for organic corporation emergence (Story 11.3):
 *      a. Dynamism >= 6: roll (dynamism - 5) × 10% chance.
 *      b. If triggered: spawn a new corp of the type matching the most prominent domain.
 *      c. Transfer one public infra level to corporate ownership.
 *      d. Max one emergence per colony per turn.
 *   4. Return updated GameState + all events (investments, acquisitions, emergences).
 *
 * Turn order context:
 *   Corp-phase (#7) runs AFTER science-phase (#6) and BEFORE colony-phase (#8).
 *   The colony state the AI sees is from the start of this turn (pre-colony-phase).
 *   Infrastructure caps may not be fully recalculated yet; the AI uses currentCap
 *   as set by the previous colony-phase — this is intentional and matches the spec.
 *
 * Ordering rationale: highest-level corps act first so megacorps have first pick
 * of investment targets before smaller corps can react. This mirrors real-world
 * corporate dynamics where larger players have structural advantages.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 12.1): turn-resolver.ts calls resolveCorpPhase() in the correct order
 *   (after science-phase, before colony-phase).
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { Corporation, CorpInfrastructureHoldings } from '../../types/corporation'
import type { Colony } from '../../types/colony'
import type { GameEvent } from '../../types/event'
import type { ColonyId, CorpId, TurnNumber } from '../../types/common'
import { CorpType, InfraDomain, EventPriority } from '../../types/common'
import { getTotalOwnedInfra, calculateCapitalGain } from '../formulas/growth'
import { runCorpInvestmentAI } from '../simulation/corp-ai'
import { generateCorporation } from '../../generators/corp-generator'
import { chance } from '../../utils/random'
import { generateEventId } from '../../utils/id'

// ─── Domain → Corp Type Mapping ───────────────────────────────────────────────

/**
 * Maps infrastructure domains to the corporation type that naturally emerges from them.
 *
 * When a colony spawns an organic corporation, its type is determined by the domain
 * with the most public (independent) infrastructure levels.
 *
 * Exploration corps cannot emerge organically — they have no primary infrastructure domain.
 */
const DOMAIN_TO_CORP_TYPE: Partial<Record<InfraDomain, CorpType>> = {
  [InfraDomain.Agricultural]: CorpType.Agriculture,
  [InfraDomain.Mining]: CorpType.Exploitation,
  [InfraDomain.DeepMining]: CorpType.Exploitation,
  [InfraDomain.GasExtraction]: CorpType.Exploitation,
  [InfraDomain.Civilian]: CorpType.Construction,
  [InfraDomain.LowIndustry]: CorpType.Industrial,
  [InfraDomain.HeavyIndustry]: CorpType.Industrial,
  [InfraDomain.HighTechIndustry]: CorpType.Industrial,
  [InfraDomain.SpaceIndustry]: CorpType.Shipbuilding,
  [InfraDomain.Science]: CorpType.Science,
  [InfraDomain.Transport]: CorpType.Transport,
  [InfraDomain.Military]: CorpType.Military,
}

// ─── Organic Emergence Helpers (exported for unit testing) ───────────────────

/**
 * Returns the emergence chance (0–100, as a percentage) for a colony dynamism value.
 *
 * Formula (Specs.md § 3 — Organic Emergence):
 *   emergence_chance = (dynamism - 5) × 10%
 *
 * Dynamism < 6 → 0% (no chance).
 * Dynamism 6 → 10%, Dynamism 10 → 50%.
 */
export function calculateEmergenceChance(dynamism: number): number {
  if (dynamism < 6) return 0
  return (dynamism - 5) * 10
}

/**
 * Maps an infrastructure domain to the corporation type that should emerge from it.
 * Returns null if no corp type is defined for the domain (e.g., no-primary-domain types).
 */
export function determineCorpTypeFromDomain(domain: InfraDomain): CorpType | null {
  return DOMAIN_TO_CORP_TYPE[domain] ?? null
}

/**
 * Finds the infrastructure domain with the most public (independent) levels on a colony,
 * among domains that can produce a corporation type.
 *
 * "Public" levels are those funded by direct player investment or organic colony growth —
 * the independent economy that a new corporation can emerge from.
 *
 * Civilian is excluded: it has no corp type mapping and is always inflated by population
 * requirements (e.g., Terra Nova starts with 14 public Civilian levels), which would make
 * Construction the only corp type ever to emerge organically.
 *
 * Returns null if no eligible domain has any public levels.
 */
export function findMostProminentPublicDomain(colony: Colony): InfraDomain | null {
  let bestDomain: InfraDomain | null = null
  let bestLevels = 0

  for (const domain of Object.values(InfraDomain)) {
    // Civilian excluded: it does not map to any corp type and dominates all other domains.
    if (domain === InfraDomain.Civilian) continue

    const infraState = colony.infrastructure[domain]
    if (!infraState) continue

    const publicLevels = infraState.ownership.publicLevels
    if (publicLevels > bestLevels) {
      bestLevels = publicLevels
      bestDomain = domain
    }
  }

  return bestDomain
}

// ─── Organic Emergence Logic ──────────────────────────────────────────────────

/** Internal result of a successful organic corp emergence. */
interface EmergenceResult {
  newCorp: Corporation
  updatedColony: Colony
  event: GameEvent
}

/**
 * Attempts organic corporation emergence on a single colony.
 *
 * Conditions for emergence (all must pass):
 *   1. Colony dynamism >= 6 (emergence_chance would be 0 otherwise).
 *   2. Probability roll: (dynamism - 5) × 10%.
 *   3. Colony must have at least one domain with public infrastructure levels.
 *   4. The most prominent domain must map to a valid corp type.
 *
 * On emergence:
 *   - A new level 1 corporation is generated with the domain-appropriate type.
 *   - One public level in the most prominent domain transfers to corporate ownership.
 *   - The new corp's first asset is that one infrastructure level on this colony.
 *
 * @param colony - The colony to check for emergence.
 * @param turn   - Current turn number (for corp foundedTurn and event).
 * @returns EmergenceResult if a new corp emerges; null otherwise.
 */
function tryOrganicEmergence(colony: Colony, turn: TurnNumber): EmergenceResult | null {
  // Check dynamism threshold — any lower gives 0% chance
  const emergenceChance = calculateEmergenceChance(colony.attributes.dynamism)
  if (emergenceChance === 0) return null

  // Roll for emergence (percentage-based)
  if (!chance(emergenceChance)) return null

  // Find the domain with the most independent (public) infrastructure levels
  const domain = findMostProminentPublicDomain(colony)
  if (!domain) return null

  // Resolve the corporation type from the dominant domain
  const corpType = determineCorpTypeFromDomain(domain)
  if (!corpType) return null

  // Generate the new level 1 corporation
  const baseNewCorp = generateCorporation({
    type: corpType,
    homePlanetId: colony.planetId,
    foundedTurn: turn,
  })

  // Set up the new corp's first infrastructure holding (the transferred level)
  const initialHoldings = new Map<ColonyId, CorpInfrastructureHoldings>()
  initialHoldings.set(colony.id, { [domain]: 1 })

  const newCorp: Corporation = {
    ...baseNewCorp,
    assets: {
      ...baseNewCorp.assets,
      infrastructureByColony: initialHoldings,
    },
  }

  // Transfer one public level from the colony to the new corp's corporate ownership
  const infraState = colony.infrastructure[domain]
  const updatedCorporateLevels = new Map(infraState.ownership.corporateLevels)
  updatedCorporateLevels.set(newCorp.id as CorpId, 1)

  const updatedInfraState = {
    ...infraState,
    ownership: {
      publicLevels: infraState.ownership.publicLevels - 1,
      corporateLevels: updatedCorporateLevels,
    },
  }

  const updatedColony: Colony = {
    ...colony,
    infrastructure: {
      ...colony.infrastructure,
      [domain]: updatedInfraState,
    },
    // Register the new corp as present on this colony
    corporationsPresent: [...colony.corporationsPresent, newCorp.id as CorpId],
  }

  const event: GameEvent = {
    id: generateEventId(),
    turn,
    priority: EventPriority.Positive,
    category: 'corporation',
    title: `${newCorp.name} emerged on ${colony.name}`,
    description:
      `A new ${corpType} corporation, ${newCorp.name}, emerged organically on ${colony.name}` +
      ` from its thriving ${domain} activity. One ${domain} infrastructure level` +
      ` transferred to corporate ownership.`,
    relatedEntityIds: [newCorp.id, colony.id],
    dismissed: false,
  }

  return { newCorp, updatedColony, event }
}

// ─── Phase Entry Point ────────────────────────────────────────────────────────

/**
 * Runs the full corporation AI phase for all corporations in one turn.
 *
 * Processing order: highest level first. This ensures megacorps have first
 * pick of investment opportunities, mirroring their real-world structural advantage.
 *
 * Each corporation:
 *   1. Gains passive capital (based on total owned infrastructure).
 *   2. Runs AI decision-making (investment and/or acquisition).
 *
 * State is updated after each corp so subsequent corps see accurate colony
 * infrastructure counts and correct corporation levels when evaluating targets.
 *
 * @param state - Full GameState at this point in the turn pipeline.
 * @returns PhaseResult with updated corporations, colonies, and generated events.
 */
export function resolveCorpPhase(state: GameState): PhaseResult {
  const events: GameEvent[] = []

  // Working copies — mutated incrementally as each corp is processed
  let updatedCorporations = new Map<string, Corporation>(state.corporations)
  let updatedColonies = new Map<string, Colony>(state.colonies)

  // Track corporations absorbed mid-turn so we skip processing them if they
  // appear later in the sorted order (sorted by original level; absorbed corps
  // were smaller, so they appear later).
  const absorbedCorpIds = new Set<CorpId>()

  // Sort by level descending: a copy of IDs ordered by original level.
  // We snapshot the sort order at the start of the turn — level changes from
  // acquisitions during this turn do not reorder the queue.
  const processingOrder = [...state.corporations.values()]
    .sort((a, b) => b.level - a.level)
    .map((corp) => corp.id)

  for (const corpId of processingOrder) {
    // Skip corps absorbed earlier this turn (acquired by another corp)
    if (absorbedCorpIds.has(corpId as CorpId)) continue

    const currentCorp = updatedCorporations.get(corpId)
    if (!currentCorp) continue // Defensive guard

    // ── Step 1: Apply passive capital gain ────────────────────────────────
    // Capital gain = random(0,1) + floor(totalOwnedInfra / 10)
    const totalOwned = getTotalOwnedInfra(currentCorp.assets.infrastructureByColony)
    const capitalGain = calculateCapitalGain(totalOwned)

    const corpWithNewCapital: Corporation = {
      ...currentCorp,
      capital: currentCorp.capital + capitalGain,
    }

    // ── Step 2: Run AI with the most up-to-date state ─────────────────────
    // Build a view of the current state with the running colony and corp maps,
    // so each corp's AI sees investments made by previously-processed corps.
    const currentState: GameState = {
      ...state,
      corporations: updatedCorporations,
      colonies: updatedColonies,
    }

    const aiResult = runCorpInvestmentAI(corpWithNewCapital, currentState)

    // ── Step 3: Merge AI results back into running state ──────────────────

    // Update the corporation (new capital, possibly new level from acquisition)
    updatedCorporations.set(aiResult.updatedCorp.id, aiResult.updatedCorp)

    // Update any colonies where this corp added infrastructure
    for (const [colonyId, updatedColony] of aiResult.updatedColonies) {
      updatedColonies.set(colonyId, updatedColony)
    }

    // Handle acquisition: remove absorbed corporation from the active map
    if (aiResult.absorbedCorpId) {
      absorbedCorpIds.add(aiResult.absorbedCorpId)
      updatedCorporations.delete(aiResult.absorbedCorpId)
    }

    events.push(...aiResult.events)
  }

  // ── Step 4: Organic corporation emergence ──────────────────────────────────
  // After all existing corps have acted, check every colony for natural corp
  // emergence. Colonies with dynamism >= 6 roll (dynamism - 5) × 10% each turn.
  // Max one emergence per colony per turn (the colony loop enforces this).
  for (const colony of updatedColonies.values()) {
    const emergenceResult = tryOrganicEmergence(colony, state.turn)
    if (!emergenceResult) continue

    const { newCorp, updatedColony, event } = emergenceResult
    updatedCorporations.set(newCorp.id, newCorp)
    updatedColonies.set(colony.id, updatedColony)
    events.push(event)
  }

  return {
    updatedState: {
      ...state,
      corporations: updatedCorporations,
      colonies: updatedColonies,
    },
    events,
  }
}
