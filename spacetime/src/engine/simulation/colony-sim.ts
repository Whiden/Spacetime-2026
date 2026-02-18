/**
 * colony-sim.ts — Colony simulation subsystem.
 *
 * Currently implemented:
 *   - Production section (Story 8.2): calculateColonyResourceFlow
 *
 * TODO (Story 10.2): Growth and population section — growth accumulation,
 *   level-up/level-down triggers, organic infrastructure growth.
 * TODO (Story 10.3): Full turn integration via colony-phase.ts.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 */

import type { Colony } from '../../types/colony'
import type { Deposit } from '../../types/planet'
import type { ColonyResourceSummary, ResourceFlow } from '../../types/resource'
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
