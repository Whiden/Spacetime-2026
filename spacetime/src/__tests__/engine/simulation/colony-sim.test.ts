/**
 * colony-sim.test.ts — Unit tests for the colony simulation subsystem.
 *
 * Covers (Story 8.2): Resource flow calculator
 * - Extraction production (deposit-gated, with and without output modifiers)
 * - Manufacturing production (tier-1 and tier-2 with full inputs)
 * - Population consumption (Food × 2, Consumer Goods × 1, TC × 1)
 * - Full production chain: extraction → tier-1 → tier-2 → surplus/deficit
 * - Shortage cascading: Common Materials short → Low Industry halved
 * - Shortage cascading: tier-1 output reduced → tier-2 (Space Industry) halved
 * - No deposits → extraction domains produce nothing
 * - Output modifiers from colony modifiers (e.g., Metallic Core +0.5)
 * - Transport Capacity produced locally and not treated as tradeable surplus
 *
 * Covers (Story 10.2): Growth tick and organic infrastructure growth
 * - Growth accumulation (positive and negative deltas)
 * - Level-up trigger: growth >= 10 + civilian infra requirement met + not at max pop
 * - Level-up blocked: insufficient civilian infra or at max pop
 * - Level-down trigger: growth <= -1 and pop > 1
 * - Level-down blocked: pop already at 1
 * - Growth reset after transitions (0 on level-up, 9 on level-down)
 * - Organic growth probability: ~dynamism × 5% trigger rate
 * - Organic growth domain selection: shortage domains get 3× weight
 * - Organic growth does not trigger when no infrastructure exists
 * - Organic growth does not select Civilian domain
 * - Organic growth does not select domains at cap
 */

import { describe, it, expect } from 'vitest'
import {
  calculateColonyResourceFlow,
  applyGrowthTick,
  applyOrganicInfraGrowth,
} from '../../../engine/simulation/colony-sim'
import type { Colony } from '../../../types/colony'
import type { Deposit } from '../../../types/planet'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { Modifier } from '../../../types/modifier'
import type { ColonyId, PlanetId, SectorId, TurnNumber } from '../../../types/common'
import {
  InfraDomain,
  ResourceType,
  DepositType,
  RichnessLevel,
  ColonyType,
} from '../../../types/common'

// ─── Test Constants ───────────────────────────────────────────────────────────

const COLONY_ID = 'col_test01' as ColonyId
const PLANET_ID = 'pln_test01' as PlanetId
const SECTOR_ID = 'sec_test01' as SectorId
const TURN_1 = 1 as TurnNumber

// ─── Test Fixture Helpers ─────────────────────────────────────────────────────

/** Creates a single InfraState with the given public levels. */
function makeInfraState(domain: InfraDomain, publicLevels: number): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: Infinity,
  }
}

/** Builds a full ColonyInfrastructure with all domains at 0 except the overrides. */
function makeInfra(overrides: Partial<Record<InfraDomain, number>> = {}): ColonyInfrastructure {
  const domains = Object.values(InfraDomain)
  const result = {} as ColonyInfrastructure
  for (const domain of domains) {
    result[domain] = makeInfraState(domain, overrides[domain] ?? 0)
  }
  return result
}

/** Builds a minimal Colony with given infrastructure and population. */
function makeColony(
  infra: ColonyInfrastructure,
  populationLevel: number,
  modifiers: Modifier[] = [],
): Colony {
  return {
    id: COLONY_ID,
    planetId: PLANET_ID,
    sectorId: SECTOR_ID,
    name: 'Test Colony',
    type: ColonyType.FrontierColony,
    populationLevel,
    attributes: {
      habitability: 8,
      accessibility: 5,
      dynamism: 5,
      qualityOfLife: 8,
      stability: 8,
      growth: 0,
    },
    infrastructure: infra,
    corporationsPresent: [],
    modifiers,
    foundedTurn: TURN_1,
  }
}

/** Creates a food deposit (Fertile Ground). */
function makeFoodDeposit(richness = RichnessLevel.Rich): Deposit {
  return { type: DepositType.FertileGround, richness, richnessRevealed: true }
}

/** Creates a common materials deposit (Common Ore Vein). */
function makeOreDeposit(richness = RichnessLevel.Moderate): Deposit {
  return { type: DepositType.CommonOreVein, richness, richnessRevealed: true }
}

/** Creates a rare materials deposit (Rare Ore Vein). */
function makeRareDeposit(richness = RichnessLevel.Moderate): Deposit {
  return { type: DepositType.RareOreVein, richness, richnessRevealed: true }
}

/** Creates a volatiles deposit (Gas Pocket). */
function makeGasDeposit(richness = RichnessLevel.Moderate): Deposit {
  return { type: DepositType.GasPocket, richness, richnessRevealed: true }
}

/** Makes an additive modifier on a production target. */
function makeOutputModifier(target: string, value: number): Modifier {
  return {
    id: 'mod_test01' as import('../../../types/common').ModifierId,
    target,
    operation: 'add',
    value,
    sourceType: 'feature',
    sourceId: 'test_feature',
    sourceName: 'Test Feature',
  }
}

// ─── Extraction Production ────────────────────────────────────────────────────

describe('calculateColonyResourceFlow — extraction', () => {
  it('produces food from agricultural infrastructure + deposit', () => {
    const infra = makeInfra({ [InfraDomain.Agricultural]: 3 })
    const colony = makeColony(infra, 1) // pop 1: consumes 2 food
    const result = calculateColonyResourceFlow(colony, [makeFoodDeposit()])

    // produced = 3 levels × 1.0 modifier = 3
    expect(result[ResourceType.Food].produced).toBe(3)
  })

  it('produces 0 food when no agricultural deposit exists', () => {
    const infra = makeInfra({ [InfraDomain.Agricultural]: 5 })
    const colony = makeColony(infra, 1)
    const result = calculateColonyResourceFlow(colony, []) // no deposit

    expect(result[ResourceType.Food].produced).toBe(0)
  })

  it('produces common materials from mining + ore deposit', () => {
    const infra = makeInfra({ [InfraDomain.Mining]: 4 })
    const colony = makeColony(infra, 1)
    const result = calculateColonyResourceFlow(colony, [makeOreDeposit()])

    expect(result[ResourceType.CommonMaterials].produced).toBe(4)
  })

  it('produces rare materials from deep mining + rare deposit', () => {
    const infra = makeInfra({ [InfraDomain.DeepMining]: 2 })
    const colony = makeColony(infra, 1)
    const result = calculateColonyResourceFlow(colony, [makeRareDeposit()])

    expect(result[ResourceType.RareMaterials].produced).toBe(2)
  })

  it('produces volatiles from gas extraction + gas deposit', () => {
    const infra = makeInfra({ [InfraDomain.GasExtraction]: 3 })
    const colony = makeColony(infra, 1)
    const result = calculateColonyResourceFlow(colony, [makeGasDeposit()])

    expect(result[ResourceType.Volatiles].produced).toBe(3)
  })

  it('applies miningOutput modifier from planet features (e.g., Metallic Core +0.5)', () => {
    const infra = makeInfra({ [InfraDomain.Mining]: 4 })
    const mod = makeOutputModifier('miningOutput', 0.5)
    const colony = makeColony(infra, 1, [mod])
    const result = calculateColonyResourceFlow(colony, [makeOreDeposit()])

    // modifier makes base 1.0 → 1.5; 4 levels × 1.5 = 6
    expect(result[ResourceType.CommonMaterials].produced).toBe(4 * 1.5)
  })

  it('applies deepMiningOutput modifier', () => {
    const infra = makeInfra({ [InfraDomain.DeepMining]: 4 })
    const mod = makeOutputModifier('deepMiningOutput', 0.5)
    const colony = makeColony(infra, 1, [mod])
    const result = calculateColonyResourceFlow(colony, [makeRareDeposit()])

    expect(result[ResourceType.RareMaterials].produced).toBe(4 * 1.5)
  })
})

// ─── Population Consumption ───────────────────────────────────────────────────

describe('calculateColonyResourceFlow — population consumption', () => {
  it('consumes food = popLevel × 1', () => {
    const colony = makeColony(makeInfra(), 5)
    const result = calculateColonyResourceFlow(colony, [])

    expect(result[ResourceType.Food].consumed).toBe(5) // 5 × 1
  })

  it('consumes consumer goods = popLevel × 1', () => {
    const colony = makeColony(makeInfra(), 7)
    const result = calculateColonyResourceFlow(colony, [])

    expect(result[ResourceType.ConsumerGoods].consumed).toBe(7)
  })

  it('consumes transport capacity = popLevel', () => {
    const colony = makeColony(makeInfra(), 4)
    const result = calculateColonyResourceFlow(colony, [])

    expect(result[ResourceType.TransportCapacity].consumed).toBe(4)
  })

  it('produces transport capacity = transport infra level', () => {
    const infra = makeInfra({ [InfraDomain.Transport]: 5 })
    const colony = makeColony(infra, 4)
    const result = calculateColonyResourceFlow(colony, [])

    expect(result[ResourceType.TransportCapacity].produced).toBe(5)
    // surplus = 5 produced - 4 consumed = +1
    expect(result[ResourceType.TransportCapacity].surplus).toBe(1)
  })
})

// ─── Full Production Chain ────────────────────────────────────────────────────

describe('calculateColonyResourceFlow — full production chain', () => {
  it('full chain: extraction → tier-1 manufacturing, no shortages', () => {
    // Mining 5 → 5 Common Materials
    // LowIndustry 3 → needs 3 Common, produces 3 Consumer Goods
    // HeavyIndustry 2 → needs 2 Common + 2 Rare, produces 2 Heavy Machinery
    // Total Common demand = 3 + 2 = 5 (exactly meets supply)
    // Rare demand = 2 (but we have 0 rare produced → shortage for Heavy)
    const infra = makeInfra({
      [InfraDomain.Mining]: 5,
      [InfraDomain.LowIndustry]: 3,
    })
    const colony = makeColony(infra, 2) // pop 2: consumes 4 food, 2 CG, 2 TC

    const result = calculateColonyResourceFlow(colony, [makeOreDeposit()])

    // Common Materials: produced=5, consumed=3 (only LowIndustry), surplus=2
    expect(result[ResourceType.CommonMaterials].produced).toBe(5)
    expect(result[ResourceType.CommonMaterials].consumed).toBe(3) // only LowIndustry input
    expect(result[ResourceType.CommonMaterials].surplus).toBe(2)

    // Consumer Goods: produced=3 (full — inputs available), consumed=2 (pop), surplus=1
    expect(result[ResourceType.ConsumerGoods].produced).toBe(3)
    expect(result[ResourceType.ConsumerGoods].consumed).toBe(2)
    expect(result[ResourceType.ConsumerGoods].surplus).toBe(1)
  })

  it('full chain through tier-2: High-Tech → Space Industry', () => {
    // Rare 3 → 3 Rare Materials
    // Volatiles 3 → 3 Volatiles
    // HighTechIndustry 3 → needs 3 Rare + 3 Vol, produces 3 HighTechGoods
    // HeavyIndustry 2 → needs 2 Common + 2 Rare → Rare demand = 3+2=5 > 3 → rareShortage!
    // Actually let's keep it simple: only HighTech + Space, no heavy
    // Mining 0, Rare 4, Gas 3
    // HighTech 2: needs 2 Rare + 2 Volatiles → both available → full output = 2 HighTechGoods
    // Space 2: needs 2 HighTechGoods + 2 HeavyMachinery
    // HeavyMachinery = 0 → shortage for Space → ShipParts halved = floor(2/2) = 1
    const infra = makeInfra({
      [InfraDomain.DeepMining]: 4,
      [InfraDomain.GasExtraction]: 3,
      [InfraDomain.HighTechIndustry]: 2,
      [InfraDomain.SpaceIndustry]: 2,
    })
    const colony = makeColony(infra, 1)
    const deposits = [makeRareDeposit(), makeGasDeposit()]
    const result = calculateColonyResourceFlow(colony, deposits)

    // RareMaterials: produced=4, demanded by HighTech=2, surplus=2
    expect(result[ResourceType.RareMaterials].produced).toBe(4)
    expect(result[ResourceType.RareMaterials].consumed).toBe(2)

    // Volatiles: produced=3, demanded=2, surplus=1
    expect(result[ResourceType.Volatiles].produced).toBe(3)
    expect(result[ResourceType.Volatiles].consumed).toBe(2)

    // HighTechGoods: produced=2 (full), demanded by Space=2, surplus=0
    expect(result[ResourceType.HighTechGoods].produced).toBe(2)
    expect(result[ResourceType.HighTechGoods].consumed).toBe(2)
    expect(result[ResourceType.HighTechGoods].surplus).toBe(0)

    // HeavyMachinery: produced=0, demanded by Space=2, deficit=-2
    expect(result[ResourceType.HeavyMachinery].produced).toBe(0)
    expect(result[ResourceType.HeavyMachinery].consumed).toBe(2)
    expect(result[ResourceType.HeavyMachinery].surplus).toBe(-2)

    // ShipParts: Space has shortage (0 HeavyMachinery < 2 needed) → halved = floor(2/2) = 1
    expect(result[ResourceType.ShipParts].produced).toBe(1)
    expect(result[ResourceType.ShipParts].consumed).toBe(0) // no colony consumer
    expect(result[ResourceType.ShipParts].surplus).toBe(1)
  })
})

// ─── Shortage Cascading ───────────────────────────────────────────────────────

describe('calculateColonyResourceFlow — shortage cascading', () => {
  it('Common Materials shortage → Low Industry output halved', () => {
    // Mining produces 2 Common Materials
    // LowIndustry at 6 demands 6 Common Materials → shortage (2 < 6)
    // Consumer Goods = floor(6 / 2) = 3 (halved)
    const infra = makeInfra({
      [InfraDomain.Mining]: 2,
      [InfraDomain.LowIndustry]: 6,
    })
    const colony = makeColony(infra, 1)
    const result = calculateColonyResourceFlow(colony, [makeOreDeposit()])

    // Common Materials: produced=2, demand=6, deficit=-4
    expect(result[ResourceType.CommonMaterials].produced).toBe(2)
    expect(result[ResourceType.CommonMaterials].consumed).toBe(6)
    expect(result[ResourceType.CommonMaterials].surplus).toBe(-4)

    // Consumer Goods: halved from 6 → floor(6/2) = 3
    expect(result[ResourceType.ConsumerGoods].produced).toBe(3)
  })

  it('Common Materials shortage halves both Low Industry and Heavy Industry', () => {
    // Mining 2, LowIndustry 3 (needs 3), HeavyIndustry 3 (needs 3 common + 3 rare)
    // Total common demand = 3 + 3 = 6 > 2 → shortage
    // Both LowIndustry and HeavyIndustry are halved
    const infra = makeInfra({
      [InfraDomain.Mining]: 2,
      [InfraDomain.DeepMining]: 5, // enough Rare Materials
      [InfraDomain.LowIndustry]: 3,
      [InfraDomain.HeavyIndustry]: 3,
    })
    const colony = makeColony(infra, 1)
    const deposits = [makeOreDeposit(), makeRareDeposit()]
    const result = calculateColonyResourceFlow(colony, deposits)

    // Common shortage: 2 < (3 + 3) = 6
    expect(result[ResourceType.CommonMaterials].surplus).toBeLessThan(0)

    // Consumer Goods (LowIndustry) halved: floor(3/2) = 1
    expect(result[ResourceType.ConsumerGoods].produced).toBe(1)

    // Heavy Machinery (HeavyIndustry) halved: floor(3/2) = 1
    expect(result[ResourceType.HeavyMachinery].produced).toBe(1)
  })

  it('Rare Materials shortage halves High-Tech Industry only (not Low Industry)', () => {
    // Mining 10 (enough Common), DeepMining 1 (1 Rare)
    // LowIndustry 3 (needs 3 Common), HeavyIndustry 3 (needs 3 Common + 3 Rare)
    // HighTechIndustry 4 (needs 4 Rare)
    // Rare demand = 3 + 4 = 7 > 1 → rare shortage
    // Common demand = 3 + 3 = 6 ≤ 10 → no common shortage
    const infra = makeInfra({
      [InfraDomain.Mining]: 10,
      [InfraDomain.DeepMining]: 1,
      [InfraDomain.GasExtraction]: 10,
      [InfraDomain.LowIndustry]: 3,
      [InfraDomain.HeavyIndustry]: 3,
      [InfraDomain.HighTechIndustry]: 4,
    })
    const colony = makeColony(infra, 1)
    const deposits = [makeOreDeposit(), makeRareDeposit(), makeGasDeposit()]
    const result = calculateColonyResourceFlow(colony, deposits)

    // LowIndustry unaffected (no rare needed): produced = 3
    expect(result[ResourceType.ConsumerGoods].produced).toBe(3)

    // HeavyIndustry affected (needs Rare): halved = floor(3/2) = 1
    expect(result[ResourceType.HeavyMachinery].produced).toBe(1)

    // HighTechIndustry affected (needs Rare): halved = floor(4/2) = 2
    expect(result[ResourceType.HighTechGoods].produced).toBe(2)
  })

  it('cascade: Rare shortage → HighTech halved → Space Industry halved', () => {
    // Rare 1, Gas 10
    // HighTechIndustry 4 (needs 4 Rare + 4 Gas) → Rare shortage → halved → produces 2 HighTechGoods
    // HeavyIndustry 4 (needs 4 Rare + 4 Common) → Rare shortage → halved → produces 2 HeavyMachinery
    //   But wait, if HeavyIndustry also needs Rare and there's Rare shortage, it too gets halved.
    // SpaceIndustry 4 (needs 4 HighTechGoods + 4 HeavyMachinery)
    //   HighTechGoods available = 2 < 4 needed → shortage for Space
    //   HeavyMachinery available = 2 < 4 needed → shortage for Space
    //   SpaceIndustry halved → floor(4/2) = 2 ShipParts
    const infra = makeInfra({
      [InfraDomain.Mining]: 10,      // enough common
      [InfraDomain.DeepMining]: 1,   // only 1 rare
      [InfraDomain.GasExtraction]: 10, // enough gas
      [InfraDomain.HeavyIndustry]: 4,
      [InfraDomain.HighTechIndustry]: 4,
      [InfraDomain.SpaceIndustry]: 4,
    })
    const colony = makeColony(infra, 1)
    const deposits = [makeOreDeposit(), makeRareDeposit(), makeGasDeposit()]
    const result = calculateColonyResourceFlow(colony, deposits)

    // Rare: produced=1, demand=4+4=8, deficit
    expect(result[ResourceType.RareMaterials].produced).toBe(1)
    expect(result[ResourceType.RareMaterials].surplus).toBeLessThan(0)

    // HighTechGoods: halved from 4 → 2
    expect(result[ResourceType.HighTechGoods].produced).toBe(2)

    // HeavyMachinery: halved from 4 → 2 (also needs Rare, which is short)
    expect(result[ResourceType.HeavyMachinery].produced).toBe(2)

    // ShipParts: Space has shortage (2 < 4 for both inputs) → halved = floor(4/2) = 2
    expect(result[ResourceType.ShipParts].produced).toBe(2)
  })

  it('Space Industry not halved when tier-1 output meets its full demand', () => {
    // HighTech 2 → 2 HighTechGoods (no shortage, enough Rare + Gas)
    // Heavy 2 → 2 HeavyMachinery (no shortage, enough Common + Rare)
    // SpaceIndustry 2 → needs exactly 2 HighTechGoods + 2 HeavyMachinery → full output = 2
    const infra = makeInfra({
      [InfraDomain.Mining]: 10,
      [InfraDomain.DeepMining]: 10,
      [InfraDomain.GasExtraction]: 10,
      [InfraDomain.HeavyIndustry]: 2,
      [InfraDomain.HighTechIndustry]: 2,
      [InfraDomain.SpaceIndustry]: 2,
    })
    const colony = makeColony(infra, 1)
    const deposits = [makeOreDeposit(), makeRareDeposit(), makeGasDeposit()]
    const result = calculateColonyResourceFlow(colony, deposits)

    expect(result[ResourceType.HighTechGoods].produced).toBe(2)
    expect(result[ResourceType.HeavyMachinery].produced).toBe(2)
    expect(result[ResourceType.ShipParts].produced).toBe(2) // full output, no cascade
  })
})

// ─── Surplus / Deficit ────────────────────────────────────────────────────────

describe('calculateColonyResourceFlow — surplus and deficit', () => {
  it('food surplus when production exceeds population consumption', () => {
    // Agricultural 10 → 10 food; pop 3 → consumes 3; surplus = +7
    const infra = makeInfra({ [InfraDomain.Agricultural]: 10 })
    const colony = makeColony(infra, 3)
    const result = calculateColonyResourceFlow(colony, [makeFoodDeposit()])

    expect(result[ResourceType.Food].produced).toBe(10)
    expect(result[ResourceType.Food].consumed).toBe(3)
    expect(result[ResourceType.Food].surplus).toBe(7)
  })

  it('food deficit when population exceeds production', () => {
    // Agricultural 2 → 2 food; pop 5 → consumes 5; deficit = -3
    const infra = makeInfra({ [InfraDomain.Agricultural]: 2 })
    const colony = makeColony(infra, 5)
    const result = calculateColonyResourceFlow(colony, [makeFoodDeposit()])

    expect(result[ResourceType.Food].surplus).toBe(-3)
  })

  it('surplus = produced - consumed (contract)', () => {
    const infra = makeInfra({ [InfraDomain.Agricultural]: 7 })
    const colony = makeColony(infra, 2) // consumes 4 food
    const result = calculateColonyResourceFlow(colony, [makeFoodDeposit()])

    expect(result[ResourceType.Food].surplus).toBe(
      result[ResourceType.Food].produced - result[ResourceType.Food].consumed,
    )
  })

  it('imported is always 0 before market resolution', () => {
    const colony = makeColony(makeInfra(), 3)
    const result = calculateColonyResourceFlow(colony, [])

    for (const rt of Object.values(ResourceType)) {
      expect(result[rt].imported).toBe(0)
    }
  })

  it('inShortage is always false before market resolution', () => {
    const colony = makeColony(makeInfra(), 3)
    const result = calculateColonyResourceFlow(colony, [])

    for (const rt of Object.values(ResourceType)) {
      expect(result[rt].inShortage).toBe(false)
    }
  })
})

// ─── Resource map completeness ────────────────────────────────────────────────

describe('calculateColonyResourceFlow — output shape', () => {
  it('returns a ResourceFlow entry for every ResourceType', () => {
    const colony = makeColony(makeInfra(), 1)
    const result = calculateColonyResourceFlow(colony, [])

    for (const rt of Object.values(ResourceType)) {
      expect(result[rt]).toBeDefined()
      expect(result[rt].resource).toBe(rt)
    }
  })

  it('each flow entry has correct resource label', () => {
    const colony = makeColony(makeInfra(), 1)
    const result = calculateColonyResourceFlow(colony, [])

    expect(result[ResourceType.Food].resource).toBe(ResourceType.Food)
    expect(result[ResourceType.ShipParts].resource).toBe(ResourceType.ShipParts)
    expect(result[ResourceType.TransportCapacity].resource).toBe(ResourceType.TransportCapacity)
  })
})

// ─── Growth Tick Helpers ──────────────────────────────────────────────────────

/**
 * Creates a colony with a specific growth accumulator value.
 * Spreads on top of the base makeColony fixture.
 */
function makeColonyWithGrowth(
  infra: ColonyInfrastructure,
  populationLevel: number,
  growth: number,
): Colony {
  const base = makeColony(infra, populationLevel)
  return { ...base, attributes: { ...base.attributes, growth } }
}

/**
 * Creates an InfraState with a specific currentCap (for cap-limit tests).
 */
function makeInfraStateCapped(
  domain: InfraDomain,
  publicLevels: number,
  cap: number,
): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: cap,
  }
}

// ─── applyGrowthTick — accumulation ──────────────────────────────────────────

describe('applyGrowthTick — growth accumulation', () => {
  it('adds positive growthPerTurn to the growth accumulator', () => {
    const infra = makeInfra({ [InfraDomain.Civilian]: 10 })
    const colony = makeColonyWithGrowth(infra, 5, 3)

    const { updatedColony, changeType } = applyGrowthTick(colony, 2, 9)

    expect(updatedColony.attributes.growth).toBe(5) // 3 + 2
    expect(changeType).toBeNull()
    expect(updatedColony.populationLevel).toBe(5)
  })

  it('adds negative growthPerTurn (decline scenario)', () => {
    const infra = makeInfra({ [InfraDomain.Civilian]: 10 })
    const colony = makeColonyWithGrowth(infra, 5, 5)

    const { updatedColony, changeType } = applyGrowthTick(colony, -2, 9)

    expect(updatedColony.attributes.growth).toBe(3) // 5 - 2
    expect(changeType).toBeNull()
  })

  it('does not mutate the original colony', () => {
    const infra = makeInfra({ [InfraDomain.Civilian]: 10 })
    const colony = makeColonyWithGrowth(infra, 5, 4)

    applyGrowthTick(colony, 3, 9)

    expect(colony.attributes.growth).toBe(4) // unchanged
  })
})

// ─── applyGrowthTick — level up ──────────────────────────────────────────────

describe('applyGrowthTick — level up', () => {
  it('levels up when growth reaches 10 and civilian infra is sufficient', () => {
    // nextPop = 6, needs 6×2 = 12 civilian, have 14
    const infra = makeInfra({ [InfraDomain.Civilian]: 14 })
    const colony = makeColonyWithGrowth(infra, 5, 9) // +1 tick reaches 10

    const { updatedColony, changeType, populationChanged } = applyGrowthTick(colony, 1, 9)

    expect(changeType).toBe('levelUp')
    expect(populationChanged).toBe(true)
    expect(updatedColony.populationLevel).toBe(6)
    expect(updatedColony.attributes.growth).toBe(0) // resets to 0
  })

  it('levels up when growth jumps past 10 in one tick', () => {
    // growth was 7, delta +4 → new growth 11 (≥ 10 triggers level-up)
    const infra = makeInfra({ [InfraDomain.Civilian]: 14 })
    const colony = makeColonyWithGrowth(infra, 5, 7)

    const { updatedColony, changeType } = applyGrowthTick(colony, 4, 9)

    expect(changeType).toBe('levelUp')
    expect(updatedColony.populationLevel).toBe(6)
    expect(updatedColony.attributes.growth).toBe(0)
  })

  it('does NOT level up when civilian infra is insufficient (stays at growth ≥ 10)', () => {
    // nextPop = 6, needs 12 civilian, only have 11
    const infra = makeInfra({ [InfraDomain.Civilian]: 11 })
    const colony = makeColonyWithGrowth(infra, 5, 9)

    const { updatedColony, changeType } = applyGrowthTick(colony, 1, 9)

    expect(changeType).toBeNull()
    expect(updatedColony.populationLevel).toBe(5) // unchanged
    expect(updatedColony.attributes.growth).toBe(10) // growth stays at 10
  })

  it('does NOT level up when population is already at the planet size cap', () => {
    // maxPopLevel = 9, already at 9
    const infra = makeInfra({ [InfraDomain.Civilian]: 25 })
    const colony = makeColonyWithGrowth(infra, 9, 9)

    const { updatedColony, changeType } = applyGrowthTick(colony, 1, 9)

    expect(changeType).toBeNull()
    expect(updatedColony.populationLevel).toBe(9) // capped
    expect(updatedColony.attributes.growth).toBe(10) // accumulates past 10
  })
})

// ─── applyGrowthTick — level down ────────────────────────────────────────────

describe('applyGrowthTick — level down', () => {
  it('levels down when growth reaches -1', () => {
    const infra = makeInfra({ [InfraDomain.Civilian]: 10 })
    const colony = makeColonyWithGrowth(infra, 4, 0) // +(-1) → -1

    const { updatedColony, changeType, populationChanged } = applyGrowthTick(colony, -1, 9)

    expect(changeType).toBe('levelDown')
    expect(populationChanged).toBe(true)
    expect(updatedColony.populationLevel).toBe(3)
    expect(updatedColony.attributes.growth).toBe(9) // resets to 9
  })

  it('levels down when growth drops below -1 in one tick', () => {
    const infra = makeInfra({ [InfraDomain.Civilian]: 10 })
    const colony = makeColonyWithGrowth(infra, 4, 0)

    const { updatedColony, changeType } = applyGrowthTick(colony, -3, 9)

    expect(changeType).toBe('levelDown')
    expect(updatedColony.populationLevel).toBe(3)
    expect(updatedColony.attributes.growth).toBe(9)
  })

  it('does NOT level down when pop is already at minimum (level 1)', () => {
    const infra = makeInfra({ [InfraDomain.Civilian]: 10 })
    const colony = makeColonyWithGrowth(infra, 1, 0)

    const { updatedColony, changeType } = applyGrowthTick(colony, -1, 9)

    expect(changeType).toBeNull()
    expect(updatedColony.populationLevel).toBe(1) // unchanged
    expect(updatedColony.attributes.growth).toBe(-1) // accumulates negative
  })

  it('does not level down when growth is exactly 0', () => {
    const infra = makeInfra({ [InfraDomain.Civilian]: 10 })
    const colony = makeColonyWithGrowth(infra, 4, 1)

    const { updatedColony, changeType } = applyGrowthTick(colony, -1, 9) // 1-1=0

    expect(changeType).toBeNull()
    expect(updatedColony.attributes.growth).toBe(0)
  })
})

// ─── applyOrganicInfraGrowth — trigger probability ───────────────────────────

describe('applyOrganicInfraGrowth — trigger probability', () => {
  it('never triggers when dynamism is 0', () => {
    const infra = makeInfra({ [InfraDomain.Agricultural]: 3 })
    const colony = makeColony(infra, 5)

    for (let i = 0; i < 100; i++) {
      // Even with rng() always returning 0 (lowest roll), chance is 0%
      const result = applyOrganicInfraGrowth(colony, 0, [], () => 0)
      expect(result.triggered).toBe(false)
    }
  })

  it('always triggers when rng returns below chance threshold', () => {
    // dynamism 10 → 50% chance; rng returning 0.0 → roll = 0.0 * 100 = 0 < 50 → triggers
    const infra = makeInfra({ [InfraDomain.Agricultural]: 3 })
    const colony = makeColony(infra, 5)

    // First rng call = trigger roll (0.0 → always triggers), second = domain pick
    let callIndex = 0
    const mockRng = () => (callIndex++ === 0 ? 0.0 : 0.5)

    const result = applyOrganicInfraGrowth(colony, 10, [], mockRng)
    expect(result.triggered).toBe(true)
  })

  it('never triggers when rng returns at or above chance threshold', () => {
    // dynamism 10 → 50%; rng() = 0.5 → roll = 50.0, which is NOT < 50 → no trigger
    const infra = makeInfra({ [InfraDomain.Agricultural]: 3 })
    const colony = makeColony(infra, 5)

    const result = applyOrganicInfraGrowth(colony, 10, [], () => 0.5)
    expect(result.triggered).toBe(false)
  })

  it('triggers approximately dynamism × 5% of the time over 1000 runs', () => {
    // dynamism 8 → 40% expected; allow ±8% tolerance
    const infra = makeInfra({ [InfraDomain.Agricultural]: 3 })
    const colony = makeColony(infra, 5)

    let triggered = 0
    const RUNS = 1000
    for (let i = 0; i < RUNS; i++) {
      if (applyOrganicInfraGrowth(colony, 8, [], Math.random).triggered) triggered++
    }
    const rate = triggered / RUNS
    expect(rate).toBeGreaterThan(0.32)  // 40% - 8%
    expect(rate).toBeLessThan(0.48)     // 40% + 8%
  })

  it('never triggers when colony has no infrastructure', () => {
    const infra = makeInfra() // all zeros
    const colony = makeColony(infra, 5)

    const result = applyOrganicInfraGrowth(colony, 10, [], () => 0.0)
    expect(result.triggered).toBe(false)
    expect(result.domain).toBeNull()
  })
})

// ─── applyOrganicInfraGrowth — domain selection ──────────────────────────────

describe('applyOrganicInfraGrowth — domain selection and effects', () => {
  it('adds +1 public level to the selected domain', () => {
    const infra = makeInfra({ [InfraDomain.Agricultural]: 3 })
    const colony = makeColony(infra, 5)
    let callIndex = 0
    const mockRng = () => (callIndex++ === 0 ? 0.0 : 0.0) // trigger + pick first domain

    const { triggered, domain, updatedColony } = applyOrganicInfraGrowth(colony, 10, [], mockRng)

    expect(triggered).toBe(true)
    expect(domain).not.toBeNull()
    // The selected domain's public level increased by 1
    const before = infra[domain!].ownership.publicLevels
    expect(updatedColony.infrastructure[domain!].ownership.publicLevels).toBe(before + 1)
  })

  it('does not mutate the original colony', () => {
    const infra = makeInfra({ [InfraDomain.Agricultural]: 3 })
    const colony = makeColony(infra, 5)
    let callIndex = 0
    const mockRng = () => (callIndex++ === 0 ? 0.0 : 0.0)

    applyOrganicInfraGrowth(colony, 10, [], mockRng)

    // Original colony unchanged
    expect(colony.infrastructure[InfraDomain.Agricultural].ownership.publicLevels).toBe(3)
  })

  it('never selects Civilian domain', () => {
    // Only Civilian has levels — no eligible production domains
    const infra = makeInfra({ [InfraDomain.Civilian]: 10 })
    const colony = makeColony(infra, 5)

    // Always-trigger rng
    const result = applyOrganicInfraGrowth(colony, 10, [], () => 0.0)

    // No eligible domains → should not trigger (or trigger=false if no eligible)
    expect(result.domain).not.toBe(InfraDomain.Civilian)
    // triggered is false since no eligible non-Civilian domains have infra
    expect(result.triggered).toBe(false)
  })

  it('does not grow a domain that is already at its currentCap', () => {
    // Agricultural has 5 levels and cap is 5 → at cap, ineligible
    // Mining has 3 levels with Infinity cap → eligible
    const infraRaw = makeInfra({ [InfraDomain.Agricultural]: 5, [InfraDomain.Mining]: 3 })
    // Override Agricultural to be at cap
    const infra: ColonyInfrastructure = {
      ...infraRaw,
      [InfraDomain.Agricultural]: makeInfraStateCapped(InfraDomain.Agricultural, 5, 5),
    }
    const colony = makeColony(infra, 5)

    // Always triggers, pick first domain alphabetically (whichever it is, not Agricultural)
    let callIndex = 0
    const mockRng = () => (callIndex++ === 0 ? 0.0 : 0.0)

    const { triggered, domain } = applyOrganicInfraGrowth(colony, 10, [], mockRng)

    expect(triggered).toBe(true)
    expect(domain).not.toBe(InfraDomain.Agricultural) // capped domain excluded
    expect(domain).toBe(InfraDomain.Mining) // only eligible domain
  })

  it('shortage domains are selected more often than non-shortage domains (statistical)', () => {
    // Agricultural (Food) and Mining (CommonMaterials) both have 3 levels
    // Food is in shortage → Agricultural gets 3× weight
    // Expected: Agricultural ~75% of selections, Mining ~25%
    const infra = makeInfra({ [InfraDomain.Agricultural]: 3, [InfraDomain.Mining]: 3 })
    const colony = makeColony(infra, 5)
    const shortages = [ResourceType.Food] // Agricultural produces Food → 3× weight

    const RUNS = 1000
    let agriCount = 0
    let miningCount = 0

    for (let i = 0; i < RUNS; i++) {
      let callIndex = 0
      // First call triggers (always), second call picks domain
      const mockRng = () => (callIndex++ === 0 ? 0.0 : Math.random())
      const { domain } = applyOrganicInfraGrowth(colony, 10, shortages, mockRng)
      if (domain === InfraDomain.Agricultural) agriCount++
      if (domain === InfraDomain.Mining) miningCount++
    }

    // Agricultural (3× weight) should be selected ~75% of the time
    // Allow ±8% tolerance
    const agriRate = agriCount / RUNS
    expect(agriRate).toBeGreaterThan(0.67)
    expect(agriRate).toBeLessThan(0.83)
  })

  it('returns triggered=false when all eligible domains are at cap', () => {
    // Both Agricultural and Mining are at their caps
    const infra: ColonyInfrastructure = {
      ...makeInfra(),
      [InfraDomain.Agricultural]: makeInfraStateCapped(InfraDomain.Agricultural, 5, 5),
      [InfraDomain.Mining]: makeInfraStateCapped(InfraDomain.Mining, 4, 4),
    }
    const colony = makeColony(infra, 5)

    const result = applyOrganicInfraGrowth(colony, 10, [], () => 0.0)
    expect(result.triggered).toBe(false)
    expect(result.domain).toBeNull()
  })
})
