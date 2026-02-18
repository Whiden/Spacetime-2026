/**
 * corp-ai.ts — Corporation autonomous investment decision-making.
 *
 * Story 11.1: Implements corporation AI for capital spending each turn.
 *
 * Each turn, corporations with capital >= 2 consider investing:
 *   1. Check all sector markets for resource deficits (negative netSurplus).
 *   2. Select a deficit randomly, weighted by severity (deeper = more likely).
 *   3. Find the highest-dynamism colony in that sector with available infrastructure
 *      slots and required manufacturing inputs not in deficit.
 *   4. If found: buy one infrastructure level (cost: 2 capital).
 *
 * Domain restrictions:
 *   - Level 1-2 corps invest only in their specialty (primaryDomains from corp type).
 *   - Level 3+ corps can invest in any domain.
 *
 * Acquisitions (level 6+ only):
 *   - Corp may acquire another corp if capital >= target_level × 5.
 *   - Target must be 3+ levels below buyer (target cannot refuse at this gap).
 *   - On acquisition: buyer inherits all assets and gains 1 level.
 *
 * Called per-corp by corp-phase.ts (Story 11.2) after capital gain calculation.
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 11.2): corp-phase.ts integrates this into the full turn pipeline,
 *   processing corps highest-level-first, collecting all events.
 * TODO (Story 11.3): Organic corp emergence added to corp-phase or colony-phase.
 */

import type { GameState } from '../../types/game'
import type { Corporation, CorpInfrastructureHoldings } from '../../types/corporation'
import type { Colony } from '../../types/colony'
import type { GameEvent } from '../../types/event'
import type { ColonyId, CorpId, PlanetId } from '../../types/common'
import { InfraDomain, ResourceType, EventPriority } from '../../types/common'
import { getTotalLevels } from '../../types/infrastructure'
import { getTotalOwnedInfra, calculateMaxInfra } from '../formulas/growth'
import { generateEventId } from '../../utils/id'
import { weightedRandom } from '../../utils/random'
import { CORP_TYPE_DEFINITIONS } from '../../data/corporation-types'
import { DEPOSIT_DEFINITIONS } from '../../data/planet-deposits'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Capital cost to buy one infrastructure level (Specs.md § 3). */
const INVEST_CAPITAL_COST = 2

/** Capital cost per target level for acquisition (Specs.md § 3). */
const ACQUISITION_COST_PER_LEVEL = 5

/** Minimum capital required to attempt investment. */
const MIN_CAPITAL_TO_INVEST = 2

/** Corp level threshold to unlock acquisitions (Specs.md § 3 — "Megacorp"). */
const MEGACORP_LEVEL = 6

/** Minimum level gap required for a successful acquisition (target cannot refuse). */
const ACQUISITION_LEVEL_GAP = 3

// ─── Resource → Domain Mapping ────────────────────────────────────────────────

/**
 * Maps resource types to the infrastructure domain that produces them.
 * Only resources that appear in sector market deficits are listed.
 */
const RESOURCE_TO_DOMAIN: Partial<Record<ResourceType, InfraDomain>> = {
  [ResourceType.Food]: InfraDomain.Agricultural,
  [ResourceType.CommonMaterials]: InfraDomain.Mining,
  [ResourceType.RareMaterials]: InfraDomain.DeepMining,
  [ResourceType.Volatiles]: InfraDomain.GasExtraction,
  [ResourceType.ConsumerGoods]: InfraDomain.LowIndustry,
  [ResourceType.HeavyMachinery]: InfraDomain.HeavyIndustry,
  [ResourceType.HighTechGoods]: InfraDomain.HighTechIndustry,
  [ResourceType.ShipParts]: InfraDomain.SpaceIndustry,
  [ResourceType.TransportCapacity]: InfraDomain.Transport,
}

/**
 * Manufacturing inputs required by each domain.
 * If a required input is also in deficit, we skip this domain as an investment target
 * (building more capacity that can't be fed would just add to another shortage).
 */
const DOMAIN_REQUIRED_INPUTS: Partial<Record<InfraDomain, ResourceType[]>> = {
  [InfraDomain.LowIndustry]: [ResourceType.CommonMaterials],
  [InfraDomain.HeavyIndustry]: [ResourceType.CommonMaterials, ResourceType.RareMaterials],
  [InfraDomain.HighTechIndustry]: [ResourceType.RareMaterials, ResourceType.Volatiles],
  [InfraDomain.SpaceIndustry]: [ResourceType.HighTechGoods, ResourceType.HeavyMachinery],
}

/**
 * Extraction domains that require a matching deposit on the planet.
 * Checked via DEPOSIT_DEFINITIONS[depositType].extractedBy === domain.
 */
const EXTRACTION_DOMAINS = new Set<InfraDomain>([
  InfraDomain.Mining,
  InfraDomain.DeepMining,
  InfraDomain.GasExtraction,
  InfraDomain.Agricultural,
])

// ─── Result Type ──────────────────────────────────────────────────────────────

/**
 * Result of running the corporation AI for a single corporation one turn.
 *
 * The caller (corp-phase.ts) merges these partial updates into the full game state.
 * Colonies not touched by this corp are not included in updatedColonies.
 */
export interface CorpAIResult {
  /** Corporation with updated capital, level, and asset holdings after decisions. */
  updatedCorp: Corporation
  /**
   * Colonies where corporate infrastructure was added this turn.
   * Empty Map if no investment occurred.
   */
  updatedColonies: Map<ColonyId, Colony>
  /**
   * ID of a corporation fully absorbed in an acquisition.
   * Undefined if no acquisition occurred.
   * The caller is responsible for removing this corp from game state.
   */
  absorbedCorpId?: CorpId
  /** Events describing all actions taken (investments, acquisitions). */
  events: GameEvent[]
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Runs the investment AI for a single corporation for one turn.
 *
 * Steps:
 *   1. If capital >= 2: attempt one infrastructure investment.
 *   2. If level 6+ and capital >= target_level × 5: attempt one acquisition.
 *
 * @param corp - The corporation making decisions this turn.
 * @param state - Full GameState at this point in the turn pipeline.
 * @returns CorpAIResult with updated corp, touched colonies, and events.
 */
export function runCorpInvestmentAI(corp: Corporation, state: GameState): CorpAIResult {
  let updatedCorp = corp
  const updatedColonies = new Map<ColonyId, Colony>()
  const events: GameEvent[] = []
  let absorbedCorpId: CorpId | undefined

  // ── Step 1: Infrastructure Investment ──────────────────────────────────────
  if (updatedCorp.capital >= MIN_CAPITAL_TO_INVEST) {
    const investResult = attemptInvestment(updatedCorp, state)
    if (investResult) {
      updatedCorp = investResult.updatedCorp
      updatedColonies.set(investResult.colonyId, investResult.updatedColony)
      events.push(investResult.event)
    }
  }

  // ── Step 2: Acquisition (Level 6+ only) ────────────────────────────────────
  if (
    updatedCorp.level >= MEGACORP_LEVEL &&
    updatedCorp.capital >= ACQUISITION_COST_PER_LEVEL
  ) {
    const acquisitionResult = attemptAcquisition(updatedCorp, state)
    if (acquisitionResult) {
      updatedCorp = acquisitionResult.updatedBuyer
      absorbedCorpId = acquisitionResult.absorbedCorpId
      events.push(acquisitionResult.event)
    }
  }

  return { updatedCorp, updatedColonies, absorbedCorpId, events }
}

// ─── Investment Logic ─────────────────────────────────────────────────────────

/** Internal result of a successful infrastructure investment. */
interface InvestmentTarget {
  colonyId: ColonyId
  domain: InfraDomain
  updatedCorp: Corporation
  updatedColony: Colony
  event: GameEvent
}

/**
 * Attempts to find and execute one infrastructure investment for a corporation.
 *
 * Process:
 *   1. Determine allowed domains (specialty-only below level 3; any domain at level 3+).
 *   2. Verify corp has not reached its total infrastructure ownership cap.
 *   3. Collect resource deficits from all sector markets, filtered to allowed domains.
 *      Skip manufacturing domains whose required inputs are also in deficit.
 *   4. Select one deficit weighted by severity (deeper shortage = more weight).
 *   5. Find the highest-dynamism eligible colony in that sector.
 *   6. Update colony corporate ownership and corp capital.
 *
 * @returns InvestmentTarget if investment succeeded, null otherwise.
 */
function attemptInvestment(corp: Corporation, state: GameState): InvestmentTarget | null {
  const allowedDomains = getAllowedInvestmentDomains(corp)
  if (allowedDomains.length === 0) return null // e.g. Exploration corp below level 3

  const maxInfra = calculateMaxInfra(corp.level)
  const totalOwned = getTotalOwnedInfra(corp.assets.infrastructureByColony)
  if (totalOwned >= maxInfra) return null // Corp at infrastructure ownership cap

  // Collect deficits across all sector markets
  interface DeficitEntry {
    sectorId: string
    domain: InfraDomain
    severity: number // absolute deficit magnitude (always > 0)
  }

  const deficits: DeficitEntry[] = []

  for (const [sectorId, market] of state.sectorMarkets) {
    for (const [resource, surplus] of Object.entries(market.netSurplus) as [
      ResourceType,
      number,
    ][]) {
      if (surplus >= 0) continue // Not a deficit

      const domain = RESOURCE_TO_DOMAIN[resource]
      if (!domain) continue
      if (!allowedDomains.includes(domain)) continue

      // Skip manufacturing domains whose required inputs are also in deficit
      // (building capacity that can't be fed just creates a different shortage)
      const requiredInputs = DOMAIN_REQUIRED_INPUTS[domain] ?? []
      const inputsAvailable = requiredInputs.every(
        (input) => (market.netSurplus[input] ?? 0) >= 0,
      )
      if (!inputsAvailable) continue

      deficits.push({ sectorId, domain, severity: Math.abs(surplus) })
    }
  }

  if (deficits.length === 0) return null

  // Select deficit weighted by severity — corps chase the worst shortages
  const selected = weightedRandom(deficits.map((d) => ({ value: d, weight: d.severity })))

  // Find the best eligible colony in that sector for this domain
  const colonyTarget = findBestInvestableColony(corp, selected.sectorId, selected.domain, state)
  if (!colonyTarget) return null

  const { colonyId, planetId, updatedColony } = colonyTarget

  // Update corp's infrastructure holdings
  const updatedHoldings = new Map(corp.assets.infrastructureByColony)
  const existingHoldings: CorpInfrastructureHoldings = {
    ...(updatedHoldings.get(colonyId) ?? {}),
  }
  existingHoldings[selected.domain] = (existingHoldings[selected.domain] ?? 0) + 1
  updatedHoldings.set(colonyId, existingHoldings)

  const updatedCorp: Corporation = {
    ...corp,
    capital: corp.capital - INVEST_CAPITAL_COST,
    assets: {
      ...corp.assets,
      infrastructureByColony: updatedHoldings,
    },
    // Register this planet in planetsPresent if corp wasn't already there
    planetsPresent: corp.planetsPresent.includes(planetId)
      ? corp.planetsPresent
      : [...corp.planetsPresent, planetId],
  }

  const event: GameEvent = {
    id: generateEventId(),
    turn: state.turn,
    priority: EventPriority.Info,
    category: 'corporation',
    title: `${corp.name}: ${selected.domain} investment`,
    description: `${corp.name} spent ${INVEST_CAPITAL_COST} capital to build ${selected.domain} infrastructure on ${colonyTarget.colonyName}.`,
    relatedEntityIds: [corp.id, colonyId],
    dismissed: false,
  }

  return { colonyId, domain: selected.domain, updatedCorp, updatedColony, event }
}

// ─── Colony Selection ─────────────────────────────────────────────────────────

/** Internal representation of a colony eligible for investment. */
interface ColonyTarget {
  colonyId: ColonyId
  planetId: PlanetId
  colonyName: string
  updatedColony: Colony
}

/**
 * Finds the highest-dynamism colony in a sector eligible for corporate investment
 * in a given infrastructure domain.
 *
 * Eligibility criteria:
 *   - Colony is in the given sector.
 *   - Domain's total levels (public + corporate) is below its current cap.
 *   - For extraction/agricultural domains: planet has a deposit matching this domain
 *     (checked via DEPOSIT_DEFINITIONS[depositType].extractedBy).
 *
 * Note: currentCap of 0 (set by colony-phase for extraction domains with no deposit)
 *   correctly blocks investment via the totalLevels < cap check.
 *   The deposit check provides an additional safety net before colony-phase has run.
 *
 * @param corp - The investing corporation (used to update corporateLevels Map).
 * @param sectorId - The sector to search.
 * @param domain - The infrastructure domain to invest in.
 * @param state - Full game state.
 * @returns The best eligible colony target, or null if none found.
 */
function findBestInvestableColony(
  corp: Corporation,
  sectorId: string,
  domain: InfraDomain,
  state: GameState,
): ColonyTarget | null {
  const candidates: Array<{ colony: Colony; dynamism: number }> = []

  for (const colony of state.colonies.values()) {
    if (colony.sectorId !== sectorId) continue

    const infraState = colony.infrastructure[domain]
    if (!infraState) continue

    const totalLevels = getTotalLevels(infraState)
    const cap = infraState.currentCap

    // Domain is at capacity (handles cap = 0 for extraction with no deposit)
    if (totalLevels >= cap) continue

    // For extraction domains: verify the planet has a matching deposit
    if (EXTRACTION_DOMAINS.has(domain)) {
      const planet = state.planets.get(colony.planetId)
      if (!planet) continue
      const hasMatchingDeposit = planet.deposits.some(
        (d) => DEPOSIT_DEFINITIONS[d.type].extractedBy === domain,
      )
      if (!hasMatchingDeposit) continue
    }

    candidates.push({ colony, dynamism: colony.attributes.dynamism })
  }

  if (candidates.length === 0) return null

  // Highest dynamism first — invest where economic activity is highest
  candidates.sort((a, b) => b.dynamism - a.dynamism)
  const best = candidates[0].colony

  // Update colony's corporate ownership: increment this corp's level count
  const updatedCorporateLevels = new Map(best.infrastructure[domain].ownership.corporateLevels)
  const existingCorpLevels = updatedCorporateLevels.get(corp.id as CorpId) ?? 0
  updatedCorporateLevels.set(corp.id as CorpId, existingCorpLevels + 1)

  const updatedInfraState = {
    ...best.infrastructure[domain],
    ownership: {
      ...best.infrastructure[domain].ownership,
      corporateLevels: updatedCorporateLevels,
    },
  }

  const updatedColony: Colony = {
    ...best,
    infrastructure: {
      ...best.infrastructure,
      [domain]: updatedInfraState,
    },
  }

  return {
    colonyId: best.id,
    planetId: best.planetId,
    colonyName: best.name,
    updatedColony,
  }
}

// ─── Acquisition Logic ────────────────────────────────────────────────────────

/** Internal result of a successful acquisition. */
interface AcquisitionResult {
  updatedBuyer: Corporation
  absorbedCorpId: CorpId
  event: GameEvent
}

/**
 * Attempts to find and execute a corporate acquisition for a level 6+ corporation.
 *
 * Rules (Specs.md § 3):
 *   - Target must be at least 3 levels below buyer (level gap >= 3).
 *     At this gap, the target cannot refuse (refusal only applies within 2 levels).
 *   - Buyer must have capital >= target_level × 5.
 *   - Prefers the target with the most infrastructure (most assets to absorb).
 *
 * On success:
 *   - Buyer gains all target infrastructure holdings, schematics, and patents.
 *   - Buyer gains 1 level (capped at level 10).
 *   - Buyer's planetsPresent expands to the union of both corps' planets.
 *   - Target is dissolved (absorbedCorpId returned for caller to remove from state).
 *
 * @param corp - The buying corporation (already updated with capital from investment step).
 * @param state - Full game state.
 * @returns AcquisitionResult if acquisition succeeded, null otherwise.
 */
function attemptAcquisition(corp: Corporation, state: GameState): AcquisitionResult | null {
  const candidates: Corporation[] = []

  for (const candidate of state.corporations.values()) {
    if (candidate.id === corp.id) continue // Cannot acquire self

    const levelGap = corp.level - candidate.level
    if (levelGap < ACQUISITION_LEVEL_GAP) continue // Too close in level (target can refuse)

    const acquisitionCost = candidate.level * ACQUISITION_COST_PER_LEVEL
    if (corp.capital < acquisitionCost) continue // Insufficient capital

    candidates.push(candidate)
  }

  if (candidates.length === 0) return null

  // Pick the most asset-rich target (most infrastructure = most value gained)
  candidates.sort(
    (a, b) =>
      getTotalOwnedInfra(b.assets.infrastructureByColony) -
      getTotalOwnedInfra(a.assets.infrastructureByColony),
  )
  const target = candidates[0]
  const acquisitionCost = target.level * ACQUISITION_COST_PER_LEVEL

  // Merge target's infrastructure holdings into buyer
  const mergedHoldings = new Map(corp.assets.infrastructureByColony)
  for (const [colonyId, targetHoldings] of target.assets.infrastructureByColony) {
    const existingHoldings = mergedHoldings.get(colonyId) ?? {}
    const merged: CorpInfrastructureHoldings = { ...existingHoldings }
    for (const [domain, levels] of Object.entries(targetHoldings) as [InfraDomain, number][]) {
      merged[domain] = (merged[domain] ?? 0) + levels
    }
    mergedHoldings.set(colonyId, merged)
  }

  const updatedBuyer: Corporation = {
    ...corp,
    capital: corp.capital - acquisitionCost,
    level: Math.min(10, corp.level + 1), // Gain 1 level, cap at 10
    assets: {
      ...corp.assets,
      infrastructureByColony: mergedHoldings,
      schematics: [...corp.assets.schematics, ...target.assets.schematics],
      patents: [...corp.assets.patents, ...target.assets.patents],
    },
    // Union of both corps' planets
    planetsPresent: [...new Set([...corp.planetsPresent, ...target.planetsPresent])],
  }

  const event: GameEvent = {
    id: generateEventId(),
    turn: state.turn,
    priority: EventPriority.Info,
    category: 'corporation',
    title: `${corp.name} acquired ${target.name}`,
    description:
      `${corp.name} (Level ${corp.level}) acquired ${target.name} (Level ${target.level})` +
      ` for ${acquisitionCost} capital. ${corp.name} gained all assets and leveled up` +
      ` to Level ${updatedBuyer.level}.`,
    relatedEntityIds: [corp.id, target.id],
    dismissed: false,
  }

  return {
    updatedBuyer,
    absorbedCorpId: target.id,
    event,
  }
}

// ─── Domain Helpers ───────────────────────────────────────────────────────────

/**
 * Returns the infrastructure domains a corporation is allowed to invest in.
 *
 * Level 1-2: specialty domains only (CORP_TYPE_DEFINITIONS.primaryDomains for this type).
 * Level 3+: any infrastructure domain.
 *
 * Edge case: Exploration corps have no primary domains — they skip investment below level 3.
 */
function getAllowedInvestmentDomains(corp: Corporation): InfraDomain[] {
  if (corp.level >= 3) {
    return Object.values(InfraDomain)
  }
  return CORP_TYPE_DEFINITIONS[corp.type]?.primaryDomains ?? []
}
