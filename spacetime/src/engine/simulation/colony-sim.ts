/**
 * colony-sim.ts — Colony simulation subsystem.
 *
 * Currently implemented:
 *   - Production section (Story 8.2): calculateColonyResourceFlow
 *   - Growth section (Story 10.2): applyGrowthTick, applyOrganicInfraGrowth
 *
 * TODO (Story 10.3): Full turn integration via colony-phase.ts.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 */

import type { Colony } from '../../types/colony'
import type { Deposit } from '../../types/planet'
import type { ColonyResourceSummary, ResourceFlow } from '../../types/resource'
import type { InfraState } from '../../types/infrastructure'
import { ResourceType, InfraDomain } from '../../types/common'
import { getTotalLevels } from '../../types/infrastructure'
import { DEPOSIT_DEFINITIONS } from '../../data/planet-deposits'
import {
  calculateExtraction,
  calculateManufacturing,
  calculateIndustrialInput,
  calculateFoodConsumption,
  calculateConsumerGoodsConsumption,
  calculateTCConsumption,
} from '../formulas/production'
import { resolveModifiers } from '../formulas/modifiers'
import {
  shouldPopLevelUp,
  shouldPopLevelDown,
  calculateOrganicInfraChance,
} from '../formulas/growth'

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if the planet has at least one deposit that is extracted by
 * the given infrastructure domain. Used to gate extraction production:
 * a domain with levels but no matching deposit produces nothing.
 *
 * In practice this should always be true for a well-formed colony (the generator
 * only assigns extraction infrastructure when a deposit exists), but we guard
 * defensively in case of edge-case data.
 */
function hasDepositFor(domain: InfraDomain, deposits: Deposit[]): boolean {
  return deposits.some((d) => DEPOSIT_DEFINITIONS[d.type].extractedBy === domain)
}

/**
 * Builds a ResourceFlow entry for a given resource.
 * `surplus` = produced − consumed (positive = exportable, negative = needs import).
 * `imported` and `inShortage` are filled in later by the market resolver (Story 9.1).
 */
function makeFlow(resource: ResourceType, produced: number, consumed: number): ResourceFlow {
  return {
    resource,
    produced,
    consumed,
    surplus: produced - consumed,
    imported: 0,
    inShortage: false, // TODO (Story 9.2): set by market-phase.ts after market resolution
  }
}

// ─── Colony Resource Flow ─────────────────────────────────────────────────────

/**
 * Calculates the complete resource production and consumption flow for a
 * single colony in one turn, BEFORE sector market trade.
 *
 * Processing order:
 *   1. Extraction production (Agricultural, Mining, DeepMining, GasExtraction)
 *      - Output gated by deposit presence; modifiers applied via resolveModifiers()
 *   2. Tier-1 manufacturing: LowIndustry, HeavyIndustry, HighTechIndustry
 *      - Input shortage detection from extracted supply vs. total demand
 *      - Shortage → output halved (cascades to tier-2)
 *   3. Tier-2 manufacturing: SpaceIndustry
 *      - Input shortage from tier-1 outputs (cascade)
 *   4. Transport production (1 TC per level, no inputs)
 *   5. Population consumption (Food, ConsumerGoods, TransportCapacity)
 *   6. Assemble a ResourceFlow for every ResourceType
 *
 * Shortage cascade example:
 *   Common Materials short → LowIndustry halved (needs Common Materials)
 *                          → HeavyIndustry halved (also needs Common Materials)
 *   HeavyMachinery reduced → SpaceIndustry halved (needs HeavyMachinery)
 *
 * @param colony    Colony to calculate for (provides infrastructure + modifiers).
 * @param deposits  Planet's deposits — gates extraction production per domain.
 * @returns         ColonyResourceSummary: one ResourceFlow per ResourceType.
 *
 * TODO (Story 8.2 → 9.1): market-resolver.ts fills `imported` and `inShortage`
 *   after sector market resolution.
 * TODO (Story 10.1): Empire infra cap bonuses and attribute formulas live in
 *   attributes.ts; they do not affect this production calculation.
 */
export function calculateColonyResourceFlow(
  colony: Colony,
  deposits: Deposit[],
): ColonyResourceSummary {
  const infra = colony.infrastructure
  const mods = colony.modifiers
  const pop = colony.populationLevel

  // ── Infrastructure level totals (public + all corporate) ──────────────────

  const agriLevel      = getTotalLevels(infra[InfraDomain.Agricultural])
  const miningLevel    = getTotalLevels(infra[InfraDomain.Mining])
  const deepLevel      = getTotalLevels(infra[InfraDomain.DeepMining])
  const gasLevel       = getTotalLevels(infra[InfraDomain.GasExtraction])
  const lowLevel       = getTotalLevels(infra[InfraDomain.LowIndustry])
  const heavyLevel     = getTotalLevels(infra[InfraDomain.HeavyIndustry])
  const highTechLevel  = getTotalLevels(infra[InfraDomain.HighTechIndustry])
  const spaceLevel     = getTotalLevels(infra[InfraDomain.SpaceIndustry])
  const transportLevel = getTotalLevels(infra[InfraDomain.Transport])

  // ── Output modifiers for extraction domains ────────────────────────────────
  // Base value is 1.0 (1 unit per level). Planet features like "Metallic Core"
  // register additive modifiers (+0.5) on targets such as 'miningOutput'.
  // resolveModifiers() applies all additive + multiplicative modifiers in order.

  const agriMod   = resolveModifiers(1.0, 'agriculturalOutput', mods)
  const miningMod = resolveModifiers(1.0, 'miningOutput', mods)
  const deepMod   = resolveModifiers(1.0, 'deepMiningOutput', mods)
  const gasMod    = resolveModifiers(1.0, 'gasExtractionOutput', mods)

  // ── Step 1: Extraction production ─────────────────────────────────────────
  // Without a matching deposit, the domain produces nothing even with infrastructure.

  const foodProduced      = hasDepositFor(InfraDomain.Agricultural, deposits)
    ? calculateExtraction(agriLevel, agriMod) : 0
  const commonMatProduced = hasDepositFor(InfraDomain.Mining, deposits)
    ? calculateExtraction(miningLevel, miningMod) : 0
  const rareMatProduced   = hasDepositFor(InfraDomain.DeepMining, deposits)
    ? calculateExtraction(deepLevel, deepMod) : 0
  const volatilesProduced = hasDepositFor(InfraDomain.GasExtraction, deposits)
    ? calculateExtraction(gasLevel, gasMod) : 0

  // ── Step 2: Tier-1 manufacturing input demands ────────────────────────────
  // Each infrastructure level consumes exactly 1 unit of each required input.

  const lowCommonInput      = calculateIndustrialInput(lowLevel)       // Common Materials
  const heavyCommonInput    = calculateIndustrialInput(heavyLevel)     // Common Materials
  const heavyRareInput      = calculateIndustrialInput(heavyLevel)     // Rare Materials
  const highTechRareInput   = calculateIndustrialInput(highTechLevel)  // Rare Materials
  const highTechVolInput    = calculateIndustrialInput(highTechLevel)  // Volatiles

  // Total extracted-resource demand from all tier-1 industries combined.
  const totalCommonDemand = lowCommonInput + heavyCommonInput
  const totalRareDemand   = heavyRareInput + highTechRareInput
  const totalVolDemand    = highTechVolInput

  // ── Step 3: Tier-1 shortage detection ─────────────────────────────────────
  // Shortage = extracted supply cannot fully meet manufacturing demand.
  // All industries that share a shorted input resource are halved together.

  const commonShortage = commonMatProduced < totalCommonDemand
  const rareShortage   = rareMatProduced   < totalRareDemand
  const volShortage    = volatilesProduced < totalVolDemand

  // ── Step 4: Tier-1 manufacturing outputs ──────────────────────────────────
  // LowIndustry    → Consumer Goods    (needs Common Materials)
  // HeavyIndustry  → Heavy Machinery   (needs Common + Rare Materials)
  // HighTechIndustry → High-Tech Goods (needs Rare Materials + Volatiles)

  const consumerGoodsProduced  = calculateManufacturing(lowLevel,      !commonShortage)
  const heavyMachineryProduced = calculateManufacturing(heavyLevel,    !commonShortage && !rareShortage)
  const highTechGoodsProduced  = calculateManufacturing(highTechLevel, !rareShortage && !volShortage)

  // ── Step 5: Tier-2 manufacturing (SpaceIndustry) — cascade ────────────────
  // SpaceIndustry → Ship Parts (needs High-Tech Goods + Heavy Machinery).
  // If tier-1 outputs are reduced by shortage, the cascade propagates here.

  const spaceHighTechInput = calculateIndustrialInput(spaceLevel)  // High-Tech Goods
  const spaceHeavyInput    = calculateIndustrialInput(spaceLevel)  // Heavy Machinery

  const highTechGoodsShortage  = highTechGoodsProduced  < spaceHighTechInput
  const heavyMachineryShortage = heavyMachineryProduced < spaceHeavyInput
  const spaceHasInputs         = !highTechGoodsShortage && !heavyMachineryShortage

  const shipPartsProduced = calculateManufacturing(spaceLevel, spaceHasInputs)

  // ── Step 6: Transport production ──────────────────────────────────────────
  // Transport produces 1 TC per level. TC is consumed locally (not traded on
  // the sector market). No input resources needed.

  const tcProduced = transportLevel

  // ── Step 7: Population consumption ────────────────────────────────────────

  const foodConsumed          = calculateFoodConsumption(pop)
  const consumerGoodsConsumed = calculateConsumerGoodsConsumption(pop)
  const tcConsumed            = calculateTCConsumption(pop)

  // ── Step 8: Assemble ResourceFlow for all nine resource types ─────────────
  // `consumed` tracks demand (industrial input + population), even under shortage.
  // `surplus`  = produced − consumed (negative → colony needs import from market).
  // `imported` / `inShortage` filled later by market-resolver.ts (Story 9.1).

  return {
    [ResourceType.Food]: makeFlow(
      ResourceType.Food,
      foodProduced,
      foodConsumed,
    ),
    [ResourceType.CommonMaterials]: makeFlow(
      ResourceType.CommonMaterials,
      commonMatProduced,
      totalCommonDemand,
    ),
    [ResourceType.RareMaterials]: makeFlow(
      ResourceType.RareMaterials,
      rareMatProduced,
      totalRareDemand,
    ),
    [ResourceType.Volatiles]: makeFlow(
      ResourceType.Volatiles,
      volatilesProduced,
      totalVolDemand,
    ),
    [ResourceType.ConsumerGoods]: makeFlow(
      ResourceType.ConsumerGoods,
      consumerGoodsProduced,
      consumerGoodsConsumed,
    ),
    [ResourceType.HeavyMachinery]: makeFlow(
      ResourceType.HeavyMachinery,
      heavyMachineryProduced,
      spaceHeavyInput,
    ),
    [ResourceType.HighTechGoods]: makeFlow(
      ResourceType.HighTechGoods,
      highTechGoodsProduced,
      spaceHighTechInput,
    ),
    [ResourceType.ShipParts]: makeFlow(
      ResourceType.ShipParts,
      shipPartsProduced,
      0, // No colony-level consumer of Ship Parts
    ),
    [ResourceType.TransportCapacity]: makeFlow(
      ResourceType.TransportCapacity,
      tcProduced,
      tcConsumed,
    ),
  }
}

// ─── Growth Tick ──────────────────────────────────────────────────────────────

/**
 * Outcome of applying one growth tick to a colony.
 * Returned by applyGrowthTick — callers use this to generate events and update stores.
 */
export interface GrowthTickResult {
  /** Updated colony state. The original colony is not mutated. */
  updatedColony: Colony
  /** True if the population level changed this turn. */
  populationChanged: boolean
  /** 'levelUp' if pop increased, 'levelDown' if decreased, null if no change. */
  changeType: 'levelUp' | 'levelDown' | null
}

/**
 * Applies one turn of growth accumulation to a colony.
 *
 * Processing sequence (Specs.md § 5):
 *   1. Add growthPerTurn to the current growth accumulator.
 *   2. Level-up check: growth >= 10 AND civilian infra >= (next pop) × 2 AND not at max:
 *        → populationLevel +1, growth resets to 0.
 *   3. Level-down check: growth <= -1 AND popLevel > 1:
 *        → populationLevel -1, growth resets to 9.
 *   4. Otherwise growth accumulates unchanged for next turn.
 *
 * Level-up and level-down are mutually exclusive per tick. If growth hits 10 but
 * civilian infra is insufficient, growth stays at 10+ until infra catches up.
 *
 * @param colony - Current colony state (not mutated).
 * @param growthPerTurn - Growth delta this turn (from calculateGrowthPerTurn in attributes.ts).
 * @param maxPopLevel - Maximum population level allowed by the planet size.
 * @returns GrowthTickResult containing the updated colony and transition metadata.
 *
 * TODO (Story 10.3): Called each turn by colony-phase.ts after attribute recalculation.
 */
export function applyGrowthTick(
  colony: Colony,
  growthPerTurn: number,
  maxPopLevel: number,
): GrowthTickResult {
  const civilianInfra = getTotalLevels(colony.infrastructure[InfraDomain.Civilian])

  // Growth accumulator is clamped at 10 (max, per Specs.md § 5).
  // It can still go negative — the level-down threshold is -1.
  let newGrowth = Math.min(10, colony.attributes.growth + growthPerTurn)
  let newPop = colony.populationLevel
  let changeType: 'levelUp' | 'levelDown' | null = null

  if (shouldPopLevelUp(newGrowth, newPop, maxPopLevel, civilianInfra)) {
    newPop += 1
    newGrowth = 0
    changeType = 'levelUp'
  } else if (shouldPopLevelDown(newGrowth, newPop)) {
    newPop -= 1
    newGrowth = 9
    changeType = 'levelDown'
  }

  const updatedColony: Colony = {
    ...colony,
    populationLevel: newPop,
    attributes: {
      ...colony.attributes,
      growth: newGrowth,
    },
  }

  return { updatedColony, populationChanged: changeType !== null, changeType }
}

// ─── Organic Infrastructure Growth ────────────────────────────────────────────

/**
 * Outcome of one organic infrastructure growth attempt.
 * Returned by applyOrganicInfraGrowth — callers use this to generate events.
 */
export interface OrganicGrowthResult {
  /** True if the chance roll succeeded and a level was added. */
  triggered: boolean
  /** Domain that received +1 public level, or null if not triggered. */
  domain: InfraDomain | null
  /** Updated colony state. The original colony is not mutated. */
  updatedColony: Colony
}

/**
 * Maps each infrastructure domain to the tradeable resource it produces.
 * Domains whose resource is in shortage receive SHORTAGE_WEIGHT_MULTIPLIER × weight
 * during organic growth domain selection, directing growth toward deficit resolution.
 *
 * Civilian, Science, and Military are omitted: Civilian grows via population
 * mechanics; Science/Military do not produce tradeable resources with shortages.
 */
const DOMAIN_TO_RESOURCE: Partial<Record<InfraDomain, ResourceType>> = {
  [InfraDomain.Agricultural]: ResourceType.Food,
  [InfraDomain.Mining]: ResourceType.CommonMaterials,
  [InfraDomain.DeepMining]: ResourceType.RareMaterials,
  [InfraDomain.GasExtraction]: ResourceType.Volatiles,
  [InfraDomain.LowIndustry]: ResourceType.ConsumerGoods,
  [InfraDomain.HeavyIndustry]: ResourceType.HeavyMachinery,
  [InfraDomain.HighTechIndustry]: ResourceType.HighTechGoods,
  [InfraDomain.SpaceIndustry]: ResourceType.ShipParts,
  [InfraDomain.Transport]: ResourceType.TransportCapacity,
}

/** Domains in shortage get this weight multiplier for organic growth selection. */
const SHORTAGE_WEIGHT_MULTIPLIER = 3

/**
 * Attempts organic infrastructure growth for a colony this turn.
 *
 * Each turn, colonies with at least 1 infrastructure level roll:
 *   organic_growth_chance = dynamism × 5 (%)   (Specs.md § 6)
 *
 * If triggered, +1 public infrastructure level goes to a randomly selected eligible
 * domain. Domains whose resource is currently in shortage receive 3× selection weight,
 * directing organic growth toward resolving market deficits. Science and Military
 * domains participate at base weight 1 (no shortage applies).
 *
 * A domain is eligible if:
 *   - It is not Civilian (Civilian grows via population mechanics, not organic growth)
 *   - It currently has at least 1 total infrastructure level (organic growth expands
 *     existing capacity — it does not create new domain types from scratch)
 *   - Its total levels are below the domain's currentCap
 *
 * @param colony - Current colony state (not mutated).
 * @param dynamism - Current colony dynamism (0-10), pre-calculated for this turn.
 * @param shortageResources - Resources currently in shortage in this colony's sector.
 *   Domains producing a shortage resource get 3× selection weight.
 * @param rng - Returns a number in [0, 1). Defaults to Math.random.
 *   Pass a deterministic function in tests for reproducibility.
 * @returns OrganicGrowthResult.
 *
 * TODO (Story 10.3): Called by colony-phase.ts with live shortage data from market state.
 */
export function applyOrganicInfraGrowth(
  colony: Colony,
  dynamism: number,
  shortageResources: ResourceType[],
  rng: () => number = Math.random,
): OrganicGrowthResult {
  const noGrowth: OrganicGrowthResult = { triggered: false, domain: null, updatedColony: colony }

  // Prerequisite: colony must have at least 1 infrastructure level anywhere
  const hasAnyInfra = (Object.values(colony.infrastructure) as InfraState[]).some(
    (state) => getTotalLevels(state) > 0,
  )
  if (!hasAnyInfra) return noGrowth

  // Chance roll
  const chance = calculateOrganicInfraChance(dynamism)
  if (chance <= 0) return noGrowth
  if (rng() * 100 >= chance) return noGrowth

  // Build weighted list of eligible domains
  const shortageSet = new Set(shortageResources)
  type WeightedDomain = { domain: InfraDomain; weight: number }
  const eligible: WeightedDomain[] = []

  for (const domain of Object.keys(colony.infrastructure) as InfraDomain[]) {
    if (domain === InfraDomain.Civilian) continue // Civilian excluded

    const state = colony.infrastructure[domain]
    const totalLevels = getTotalLevels(state)
    if (totalLevels === 0) continue         // must have existing levels
    if (totalLevels >= state.currentCap) continue // must not be at cap

    const resource = DOMAIN_TO_RESOURCE[domain]
    const weight = resource && shortageSet.has(resource) ? SHORTAGE_WEIGHT_MULTIPLIER : 1
    eligible.push({ domain, weight })
  }

  if (eligible.length === 0) return noGrowth

  // Weighted random domain selection
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0)
  let pick = rng() * totalWeight
  let selectedDomain = eligible[0]!.domain
  for (const entry of eligible) {
    pick -= entry.weight
    if (pick <= 0) {
      selectedDomain = entry.domain
      break
    }
  }

  // Apply +1 public level to selected domain
  const domainState = colony.infrastructure[selectedDomain]
  const updatedColony: Colony = {
    ...colony,
    infrastructure: {
      ...colony.infrastructure,
      [selectedDomain]: {
        ...domainState,
        ownership: {
          ...domainState.ownership,
          publicLevels: domainState.ownership.publicLevels + 1,
        },
      },
    },
  }

  return { triggered: true, domain: selectedDomain, updatedColony }
}
