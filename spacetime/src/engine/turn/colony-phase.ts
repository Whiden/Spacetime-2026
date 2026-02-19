/**
 * colony-phase.ts — Colony simulation during turn resolution.
 *
 * Story 10.3: Integrates colony simulation into the turn pipeline.
 *
 * Responsibilities for each colony each turn:
 *   1. Recalculate infrastructure caps using calculateInfraCap() from attributes.ts.
 *   2. Recalculate all six colony attributes using attribute formulas from attributes.ts.
 *   3. Apply one growth tick: accumulate growth, check population level transitions.
 *   4. Check organic infrastructure growth.
 *   5. Emit events for population milestones (level up/down) and attribute warnings
 *      (critically low stability or quality of life).
 *
 * Turn order context:
 *   Colony-phase (#8) runs AFTER corp-phase (#7) and BEFORE market-phase (#9).
 *   Shortage modifiers from the PREVIOUS market-phase are already on colony.modifiers
 *   when this phase runs — they are cleared by market-phase at the start of the next turn.
 *   Sector market data available in state.sectorMarkets is therefore from last turn,
 *   which is intentional: organic growth weights off the previous turn's shortage signals.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 11.3): Organic corporation emergence is handled in corp-phase.ts.
 * TODO (Story 10.4): Colony UI updates consume the fresh attribute values set here.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { Colony } from '../../types/colony'
import type { Deposit } from '../../types/planet'
import type { GameEvent } from '../../types/event'
import type { ColonyInfrastructure } from '../../types/infrastructure'
import type { Modifier } from '../../types/modifier'
import type { EmpireInfraCapBonuses } from '../../types/empire'
import type { PlanetSize, TurnNumber } from '../../types/common'
import type { SectorMarketState } from '../../types/trade'
import { InfraDomain, ResourceType, EventPriority } from '../../types/common'
import { getTotalLevels, getCorporateLevels } from '../../types/infrastructure'
import { PLANET_SIZE_DEFINITIONS } from '../../data/planet-sizes'
import { DEPOSIT_DEFINITIONS } from '../../data/planet-deposits'
// calculateExtractionCap removed — extraction cap now derived from deposit maxInfraBonus,
// not from richness level. See getBestDepositCap() below.
import {
  calculateHabitability,
  calculateAccessibility,
  calculateDynamism,
  calculateQualityOfLife,
  calculateStability,
  calculateGrowthPerTurn,
  calculateInfraCap,
} from '../formulas/attributes'
import {
  applyGrowthTick,
  applyOrganicInfraGrowth,
} from '../simulation/colony-sim'
import { generateEventId } from '../../utils/id'

// ─── Extraction Domains ───────────────────────────────────────────────────────

/**
 * Extraction and agricultural domains whose infrastructure cap is constrained by
 * deposit richness in addition to population level.
 * For these domains: effective cap = min(pop_cap_with_modifiers, richness_cap).
 * If no matching deposit exists, cap = 0.
 */
const EXTRACTION_DOMAINS = new Set<InfraDomain>([
  InfraDomain.Mining,
  InfraDomain.DeepMining,
  InfraDomain.GasExtraction,
  InfraDomain.Agricultural,
])

// ─── Low-Attribute Warning Thresholds ────────────────────────────────────────

/**
 * Thresholds below which colony attributes trigger Warning events.
 * Values are inclusive (≤ threshold = warning emitted).
 */
const LOW_STABILITY_THRESHOLD = 2
const LOW_QOL_THRESHOLD = 2

// ─── Phase Entry Point ────────────────────────────────────────────────────────

/**
 * Runs the full colony simulation for all colonies in one turn.
 *
 * For each colony: recalculates infra caps and all attributes, applies a growth
 * tick (population level transitions), checks organic infra growth, and emits
 * events for population changes and critically low attributes.
 *
 * @param state - Full GameState at this point in the turn pipeline.
 * @returns PhaseResult with updated colonies and generated events.
 */
export function resolveColonyPhase(state: GameState): PhaseResult {
  const events: GameEvent[] = []
  const updatedColonies = new Map<string, Colony>(state.colonies)

  for (const [colonyId, colony] of state.colonies) {
    const planet = state.planets.get(colony.planetId)
    if (!planet) continue // Orphaned colony — skip gracefully

    // Derive shortage resources from the previous turn's sector market state.
    // colony-phase runs before market-phase, so sectorMarkets is last turn's data.
    const sectorMarket = state.sectorMarkets.get(colony.sectorId)
    const shortageResources = getShortageResources(sectorMarket)

    const { updatedColony, colonyEvents } = processColony(
      colony,
      planet.baseHabitability,
      planet.size,
      planet.deposits,
      shortageResources,
      state.debtTokens,
      state.empireBonuses.infraCaps,
      state.turn,
    )

    updatedColonies.set(colonyId, updatedColony)
    events.push(...colonyEvents)
  }

  return {
    updatedState: {
      ...state,
      colonies: updatedColonies,
    },
    events,
  }
}

// ─── Per-Colony Processing ────────────────────────────────────────────────────

/**
 * Runs the full simulation cycle for a single colony in one turn.
 *
 * Processing order:
 *   1. Recalculate infrastructure caps for all domains.
 *   2. Calculate attribute inputs (infra totals: transport, military, corp).
 *   3. Recalculate all six colony attributes.
 *   4. Apply growth tick (adds growthPerTurn to growth accumulator, checks transitions).
 *   5. Apply organic infrastructure growth.
 *   6. Emit events: population changes + critically low attribute warnings.
 *
 * @param colony           - Current colony state (not mutated).
 * @param basePlanetHab    - Base habitability from planet type (0-10).
 * @param planetSize       - Planet size (determines max population level).
 * @param planetDeposits   - Deposits on the planet (gates extraction caps).
 * @param shortageResources - Resources in sector shortage (last turn's market data).
 * @param debtTokens       - Current empire debt token count.
 * @param empireBonuses    - Empire-wide infrastructure cap bonuses from discoveries.
 * @param currentTurn      - Current turn number, used for event timestamps.
 */
function processColony(
  colony: Colony,
  basePlanetHab: number,
  planetSize: PlanetSize,
  planetDeposits: Deposit[],
  shortageResources: ResourceType[],
  debtTokens: number,
  empireBonuses: EmpireInfraCapBonuses,
  currentTurn: TurnNumber,
): { updatedColony: Colony; colonyEvents: GameEvent[] } {
  const colonyEvents: GameEvent[] = []

  // ── Step 1: Recalculate infrastructure caps ──────────────────────────────
  // Must happen before attribute calculation so organic growth cap checks are accurate.
  const updatedInfra = recalculateInfraCaps(
    colony.infrastructure,
    colony.populationLevel,
    planetDeposits,
    empireBonuses,
    colony.modifiers,
  )

  // ── Step 2: Infrastructure level totals for attribute calculation ────────
  const transportInfra = getTotalLevels(updatedInfra[InfraDomain.Transport])
  const militaryInfra  = getTotalLevels(updatedInfra[InfraDomain.Military])

  // Total corporate-owned levels across all domains — used for dynamism calculation.
  let totalCorporateInfra = 0
  for (const domain of Object.values(InfraDomain)) {
    totalCorporateInfra += getCorporateLevels(updatedInfra[domain as InfraDomain])
  }

  // ── Step 3: Recalculate colony attributes ────────────────────────────────
  // Attributes cascade: accessibility → dynamism; habitability + QoL → stability;
  // QoL + stability + accessibility + habitability → growthPerTurn.
  // Shortage modifiers from the previous market-phase are already on colony.modifiers.
  const habitability   = calculateHabitability(basePlanetHab, colony.modifiers)
  const accessibility  = calculateAccessibility(transportInfra, colony.modifiers)
  const dynamism       = calculateDynamism(accessibility, colony.populationLevel, totalCorporateInfra, colony.modifiers)
  const qualityOfLife  = calculateQualityOfLife(habitability, colony.modifiers)
  const stability      = calculateStability(qualityOfLife, militaryInfra, debtTokens, colony.modifiers)
  const growthPerTurn  = calculateGrowthPerTurn(qualityOfLife, stability, accessibility, habitability, colony.modifiers)

  // ── Step 4: Build colony with fresh attributes ───────────────────────────
  // Snapshot current attributes as previousAttributes before overwriting them.
  // This lets the UI show trend arrows (up/down/stable) by comparing turns.
  // The growth field is a turn-accumulator — we preserve the existing value here
  // and let applyGrowthTick handle adding growthPerTurn and checking transitions.
  const colonyWithAttrs: Colony = {
    ...colony,
    infrastructure: updatedInfra,
    previousAttributes: colony.attributes,
    attributes: {
      habitability,
      accessibility,
      dynamism,
      qualityOfLife,
      stability,
      growth: colony.attributes.growth, // Preserve accumulator; applyGrowthTick adds delta
    },
  }

  // ── Step 5: Apply growth tick ────────────────────────────────────────────
  const maxPopLevel = PLANET_SIZE_DEFINITIONS[planetSize].maxPopulationLevel
  const growthResult = applyGrowthTick(colonyWithAttrs, growthPerTurn, maxPopLevel)
  let currentColony = growthResult.updatedColony

  if (growthResult.changeType === 'levelUp') {
    colonyEvents.push(buildPopLevelUpEvent(colony.name, colony.id, currentColony.populationLevel, currentTurn))
  } else if (growthResult.changeType === 'levelDown') {
    colonyEvents.push(buildPopLevelDownEvent(colony.name, colony.id, currentColony.populationLevel, currentTurn))
  }

  // ── Step 6: Apply organic infrastructure growth ──────────────────────────
  const organicResult = applyOrganicInfraGrowth(currentColony, dynamism, shortageResources)
  currentColony = organicResult.updatedColony

  // ── Step 7: Attribute warning events ────────────────────────────────────
  const warningEvents = buildAttributeWarningEvents(currentColony, currentTurn)
  colonyEvents.push(...warningEvents)

  return { updatedColony: currentColony, colonyEvents }
}

// ─── Infrastructure Cap Recalculation ────────────────────────────────────────

/**
 * Returns a new ColonyInfrastructure with currentCap recalculated for every domain.
 *
 * Cap calculation per domain:
 *   - Civilian:             Infinity (uncapped, from calculateInfraCap).
 *   - Extraction domains:   min(pop_cap, deposit.maxInfraBonus). If no matching deposit → cap = 0.
 *   - All other domains:    pop_level × 2 + empire bonus + local modifiers.
 *
 * @param infra          - Current infrastructure state.
 * @param popLevel       - Current population level.
 * @param deposits       - Planet deposits (gates extraction richness cap).
 * @param empireBonuses  - Empire-wide cap bonuses from discoveries.
 * @param colonyModifiers - Colony modifiers (feature bonuses on 'max*' targets).
 */
function recalculateInfraCaps(
  infra: ColonyInfrastructure,
  popLevel: number,
  deposits: Deposit[],
  empireBonuses: EmpireInfraCapBonuses,
  colonyModifiers: Modifier[],
): ColonyInfrastructure {
  const updated = { ...infra } as ColonyInfrastructure

  for (const domain of Object.values(InfraDomain)) {
    const d = domain as InfraDomain

    // Pop-derived cap (includes empire bonus and local modifiers from attributes.ts)
    let cap = calculateInfraCap(popLevel, d, empireBonuses, colonyModifiers)

    // Extraction domains: also cap at deposit type's maxInfraBonus (tighter of the two limits).
    // Deposit richness is display-only — the cap comes from the deposit type definition.
    if (EXTRACTION_DOMAINS.has(d)) {
      const depositCap = getBestDepositCap(d, deposits)
      if (depositCap !== null) {
        cap = Math.min(cap, depositCap)
      } else {
        // No matching deposit on this planet: extraction infra cannot be built here
        cap = 0
      }
    }

    updated[d] = { ...infra[d], currentCap: cap }
  }

  return updated
}

/**
 * Returns the highest infrastructure cap among deposits extracted by the given domain.
 * The cap is derived from the deposit type's maxInfraBonus (Data.md § 2), NOT from
 * richness level. Richness is display-only after the spec change.
 *
 * When multiple deposits of the same domain type exist (e.g., two Fertile Ground
 * deposits), we use the best (highest maxInfraBonus) — reflecting the best available source.
 *
 * Returns null if the planet has no deposit matching this domain.
 */
function getBestDepositCap(domain: InfraDomain, deposits: Deposit[]): number | null {
  let bestCap: number | null = null

  for (const deposit of deposits) {
    const def = DEPOSIT_DEFINITIONS[deposit.type]
    if (def.extractedBy === domain) {
      const depositCap = def.maxInfraBonus
      if (bestCap === null || depositCap > bestCap) {
        bestCap = depositCap
      }
    }
  }

  return bestCap
}

// ─── Shortage Resource Derivation ─────────────────────────────────────────────

/**
 * Returns the list of resources currently in shortage in the sector, derived from
 * last turn's sector market state (state.sectorMarkets at colony-phase run time).
 *
 * A resource is in shortage if its net surplus is negative (demand exceeded supply).
 * Used to weight organic growth domain selection toward deficit resolution.
 *
 * @param sectorMarket - Sector market state from last turn's resolution, or undefined
 *   if this colony's sector has no market data yet (e.g., turn 1 before market phase runs).
 */
function getShortageResources(sectorMarket: SectorMarketState | undefined): ResourceType[] {
  if (!sectorMarket) return []

  const shortages: ResourceType[] = []
  for (const [resource, surplus] of Object.entries(sectorMarket.netSurplus)) {
    if ((surplus as number) < 0) {
      shortages.push(resource as ResourceType)
    }
  }
  return shortages
}

// ─── Event Builders ───────────────────────────────────────────────────────────

/**
 * Positive event emitted when a colony reaches a new (higher) population level.
 * This is a milestone — the player should see this and feel rewarded.
 */
function buildPopLevelUpEvent(
  colonyName: string,
  colonyId: string,
  newPopLevel: number,
  turn: TurnNumber,
): GameEvent {
  return {
    id: generateEventId(),
    turn,
    priority: EventPriority.Positive,
    category: 'colony',
    title: `Population Growth — ${colonyName}`,
    description: `${colonyName} has grown to population level ${newPopLevel}. The colony is thriving.`,
    relatedEntityIds: [colonyId],
    dismissed: false,
  }
}

/**
 * Warning event emitted when a colony drops to a lower population level.
 * Signals that the player needs to improve living conditions.
 */
function buildPopLevelDownEvent(
  colonyName: string,
  colonyId: string,
  newPopLevel: number,
  turn: TurnNumber,
): GameEvent {
  return {
    id: generateEventId(),
    turn,
    priority: EventPriority.Warning,
    category: 'colony',
    title: `Population Decline — ${colonyName}`,
    description: `${colonyName} has declined to population level ${newPopLevel}. Improve quality of life and stability to stop the decline.`,
    relatedEntityIds: [colonyId],
    dismissed: false,
  }
}

/**
 * Emits Warning events for colonies with critically low stability or quality of life.
 *
 * Thresholds: stability ≤ 2 or qualityOfLife ≤ 2.
 * One event per attribute per turn — separate events for stability and QoL
 * so the player understands each distinct problem.
 *
 * NOTE: Shortage warnings are emitted by market-phase.ts (which runs AFTER colony-phase).
 * These warnings are for structural issues (low habitability, debt, no military) that
 * persist independently of resource availability.
 */
function buildAttributeWarningEvents(colony: Colony, turn: TurnNumber): GameEvent[] {
  const events: GameEvent[] = []
  const { stability, qualityOfLife } = colony.attributes

  if (stability <= LOW_STABILITY_THRESHOLD) {
    events.push({
      id: generateEventId(),
      turn,
      priority: EventPriority.Warning,
      category: 'colony',
      title: `Low Stability — ${colony.name}`,
      description: `${colony.name} has critically low stability (${stability}/10). Unrest is a growing risk — consider military infrastructure or addressing debt.`,
      relatedEntityIds: [colony.id],
      dismissed: false,
    })
  }

  if (qualityOfLife <= LOW_QOL_THRESHOLD) {
    events.push({
      id: generateEventId(),
      turn,
      priority: EventPriority.Warning,
      category: 'colony',
      title: `Low Quality of Life — ${colony.name}`,
      description: `${colony.name} has critically low quality of life (${qualityOfLife}/10). Population decline is imminent without intervention.`,
      relatedEntityIds: [colony.id],
      dismissed: false,
    })
  }

  return events
}
