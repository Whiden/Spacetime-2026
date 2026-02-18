/**
 * attributes.test.ts — Unit tests for colony attribute formulas.
 *
 * Covers all six core attributes (Habitability, Accessibility, Dynamism,
 * Quality of Life, Stability, Growth) and infrastructure cap calculation.
 *
 * Test strategy:
 * - Verify each formula matches Specs.md § 5 exactly
 * - Verify that local modifiers (planet features) combine correctly
 * - Verify that empire bonuses combine correctly in calculateInfraCap
 * - Verify that debtTokens is read directly from state (not from modifiers) in Stability
 * - Verify that results are properly clamped (0-10 for all except Growth)
 * - Edge cases: extreme values, zero infrastructure, no modifiers
 */

import { describe, it, expect } from 'vitest'
import {
  calculateHabitability,
  calculateAccessibility,
  calculateDynamism,
  calculateQualityOfLife,
  calculateStability,
  calculateGrowthPerTurn,
  calculateInfraCap,
} from '../../../engine/formulas/attributes'
import { InfraDomain } from '../../../types/common'
import type { Modifier } from '../../../types/modifier'
import type { EmpireInfraCapBonuses } from '../../../types/empire'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a simple additive modifier for testing. */
function makeModifier(target: string, value: number, sourceType: Modifier['sourceType'] = 'feature'): Modifier {
  return {
    id: `mod_test_${target}_${value}` as Modifier['id'] & string,
    target,
    operation: 'add',
    value,
    sourceType,
    sourceId: `src_${target}`,
    sourceName: `Test ${target} modifier (${value > 0 ? '+' : ''}${value})`,
  }
}

/** Creates a multiplicative modifier for testing. */
function makeMultModifier(target: string, value: number): Modifier {
  return {
    id: `mod_mult_${target}` as Modifier['id'] & string,
    target,
    operation: 'multiply',
    value,
    sourceType: 'feature',
    sourceId: `src_mult_${target}`,
    sourceName: `Test multiply ${target} ×${value}`,
  }
}

/** Empty empire cap bonuses (all zero). */
function zeroCaps(): EmpireInfraCapBonuses {
  return {
    maxMining: 0,
    maxDeepMining: 0,
    maxGasExtraction: 0,
    maxAgricultural: 0,
    maxScience: 0,
    maxSpaceIndustry: 0,
    maxLowIndustry: 0,
    maxHeavyIndustry: 0,
    maxHighTechIndustry: 0,
  }
}

// ─── calculateHabitability ────────────────────────────────────────────────────

describe('calculateHabitability', () => {
  it('returns base planet habitability when no modifiers', () => {
    expect(calculateHabitability(8, [])).toBe(8)
    expect(calculateHabitability(2, [])).toBe(2)
    expect(calculateHabitability(0, [])).toBe(0)
  })

  it('applies feature bonus correctly', () => {
    // Temperate Climate: +1 habitability
    const mods = [makeModifier('habitability', 1)]
    expect(calculateHabitability(8, mods)).toBe(9)
  })

  it('applies feature malus correctly', () => {
    // Harsh Radiation: -2 habitability
    const mods = [makeModifier('habitability', -2)]
    expect(calculateHabitability(8, mods)).toBe(6)
  })

  it('stacks multiple feature modifiers', () => {
    // Continental base 8, Temperate Climate +1, Breathable Atmosphere +2, Toxic -2
    const mods = [
      makeModifier('habitability', 1),
      makeModifier('habitability', 2),
      makeModifier('habitability', -2),
    ]
    expect(calculateHabitability(8, mods)).toBe(9) // 8 + 1 + 2 - 2 = 9
  })

  it('clamps to 10 maximum', () => {
    const mods = [makeModifier('habitability', 5)]
    expect(calculateHabitability(8, mods)).toBe(10) // 8 + 5 = 13 → clamped to 10
  })

  it('clamps to 0 minimum', () => {
    const mods = [makeModifier('habitability', -5)]
    expect(calculateHabitability(1, mods)).toBe(0) // 1 - 5 = -4 → clamped to 0
  })

  it('ignores modifiers targeting other stats', () => {
    const mods = [
      makeModifier('accessibility', 3),
      makeModifier('stability', -1),
      makeModifier('habitability', 1),
    ]
    expect(calculateHabitability(8, mods)).toBe(9) // Only habitability modifier applies
  })

  it('returns 0 for Gas Giant base (0) with no modifiers', () => {
    expect(calculateHabitability(0, [])).toBe(0)
  })
})

// ─── calculateAccessibility ───────────────────────────────────────────────────

describe('calculateAccessibility', () => {
  it('returns 3 base with 0 transport infra and no modifiers', () => {
    // 3 + floor(0 / 2) = 3
    expect(calculateAccessibility(0, [])).toBe(3)
  })

  it('adds floor(transport / 2) to base 3', () => {
    // 3 + floor(2 / 2) = 4
    expect(calculateAccessibility(2, [])).toBe(4)
    // 3 + floor(4 / 2) = 5
    expect(calculateAccessibility(4, [])).toBe(5)
    // 3 + floor(6 / 2) = 6
    expect(calculateAccessibility(6, [])).toBe(6)
  })

  it('floors odd transport values correctly', () => {
    // 3 + floor(1 / 2) = 3 + 0 = 3
    expect(calculateAccessibility(1, [])).toBe(3)
    // 3 + floor(3 / 2) = 3 + 1 = 4
    expect(calculateAccessibility(3, [])).toBe(4)
    // 3 + floor(5 / 2) = 3 + 2 = 5
    expect(calculateAccessibility(5, [])).toBe(5)
  })

  it('applies Strategic Location modifier (+2)', () => {
    const mods = [makeModifier('accessibility', 2)]
    // 3 + floor(2 / 2) + 2 = 6
    expect(calculateAccessibility(2, mods)).toBe(6)
  })

  it('applies Remote Location modifier (-2)', () => {
    const mods = [makeModifier('accessibility', -2)]
    // 3 + floor(4 / 2) - 2 = 3
    expect(calculateAccessibility(4, mods)).toBe(3)
  })

  it('clamps to 10 maximum', () => {
    const mods = [makeModifier('accessibility', 5)]
    // 3 + floor(14 / 2) + 5 = 3 + 7 + 5 = 15 → clamped to 10
    expect(calculateAccessibility(14, mods)).toBe(10)
  })

  it('clamps to 0 minimum (Remote Location + low transport)', () => {
    const mods = [makeModifier('accessibility', -5)]
    // 3 + floor(0 / 2) - 5 = -2 → clamped to 0
    expect(calculateAccessibility(0, mods)).toBe(0)
  })

  it('matches formula: 3 + floor(transport/2) + modifiers for starting colony transport=2', () => {
    // Terra Nova starts with 2 transport → 3 + 1 = 4 (no feature modifiers on transport)
    expect(calculateAccessibility(2, [])).toBe(4)
  })
})

// ─── calculateDynamism ────────────────────────────────────────────────────────

describe('calculateDynamism', () => {
  it('computes base with no corporate infra and no modifiers', () => {
    // floor((4 + 7) / 2) + min(3, floor(0 / 10)) = 5 + 0 = 5
    expect(calculateDynamism(4, 7, 0, [])).toBe(5)
  })

  it('adds corporate infra bonus (capped at 3)', () => {
    // floor((4 + 7) / 2) + min(3, floor(10 / 10)) = 5 + 1 = 6
    expect(calculateDynamism(4, 7, 10, [])).toBe(6)

    // floor((4 + 7) / 2) + min(3, floor(20 / 10)) = 5 + 2 = 7
    expect(calculateDynamism(4, 7, 20, [])).toBe(7)

    // floor((4 + 7) / 2) + min(3, floor(30 / 10)) = 5 + 3 = 8
    expect(calculateDynamism(4, 7, 30, [])).toBe(8)
  })

  it('caps corporate infra bonus at 3 regardless of total infra', () => {
    // 100 corporate infra → min(3, floor(100/10)) = min(3, 10) = 3
    const result100 = calculateDynamism(4, 7, 100, [])
    const result30 = calculateDynamism(4, 7, 30, [])
    expect(result100).toBe(result30) // Both should be 8
    expect(result100).toBe(8)
  })

  it('applies feature modifiers (Geothermal Activity +1)', () => {
    const mods = [makeModifier('dynamism', 1)]
    // floor((4 + 7) / 2) + 0 + 1 = 6
    expect(calculateDynamism(4, 7, 0, mods)).toBe(6)
  })

  it('applies Ancient Ruins modifier (+2 dynamism)', () => {
    const mods = [makeModifier('dynamism', 2)]
    // floor((6 + 5) / 2) + 1 + 2 = 5 + 1 + 2 = 8
    expect(calculateDynamism(6, 5, 10, mods)).toBe(8)
  })

  it('floors the (accessibility + population) / 2 division', () => {
    // floor((3 + 4) / 2) = floor(3.5) = 3
    expect(calculateDynamism(3, 4, 0, [])).toBe(3)
    // floor((5 + 6) / 2) = floor(5.5) = 5
    expect(calculateDynamism(5, 6, 0, [])).toBe(5)
  })

  it('clamps to 10 maximum', () => {
    const mods = [makeModifier('dynamism', 5)]
    // floor((8 + 9) / 2) + 3 + 5 = 8 + 3 + 5 = 16 → clamped to 10
    expect(calculateDynamism(8, 9, 30, mods)).toBe(10)
  })

  it('clamps to 0 minimum', () => {
    const mods = [makeModifier('dynamism', -10)]
    expect(calculateDynamism(0, 1, 0, mods)).toBe(0)
  })
})

// ─── calculateQualityOfLife ───────────────────────────────────────────────────

describe('calculateQualityOfLife', () => {
  it('returns 10 with high habitability and no modifiers', () => {
    // qol_hab_malus = floor(max(0, 10-10)/3) = 0 → qol = 10 - 0 = 10
    expect(calculateQualityOfLife(10, [])).toBe(10)
  })

  it('applies habitability malus: floor(max(0, 10-hab)/3)', () => {
    // hab=7: floor(max(0,3)/3) = 1 → qol = 10 - 1 = 9
    expect(calculateQualityOfLife(7, [])).toBe(9)

    // hab=4: floor(max(0,6)/3) = 2 → qol = 10 - 2 = 8
    expect(calculateQualityOfLife(4, [])).toBe(8)

    // hab=1: floor(max(0,9)/3) = 3 → qol = 10 - 3 = 7
    expect(calculateQualityOfLife(1, [])).toBe(7)

    // hab=0: floor(max(0,10)/3) = floor(3.33) = 3 → qol = 10 - 3 = 7
    expect(calculateQualityOfLife(0, [])).toBe(7)
  })

  it('applies food shortage malus (-2 QoL) from modifier', () => {
    // Shortage modifiers are applied via colony modifiers (sourceType 'shortage')
    const mods = [makeModifier('qualityOfLife', -2, 'shortage')]
    // hab=8: malus=floor(2/3)=0 → base=10. Modifier -2 → 8
    expect(calculateQualityOfLife(8, mods)).toBe(8)
  })

  it('applies consumer goods shortage malus (-1 QoL) from modifier', () => {
    const mods = [makeModifier('qualityOfLife', -1, 'shortage')]
    // hab=10: base=10. Modifier -1 → 9
    expect(calculateQualityOfLife(10, mods)).toBe(9)
  })

  it('stacks multiple shortage and feature modifiers', () => {
    const mods = [
      makeModifier('qualityOfLife', -2, 'shortage'), // food shortage
      makeModifier('qualityOfLife', -1, 'shortage'), // consumer goods shortage
      makeModifier('qualityOfLife', 1, 'feature'),   // Rich Biosphere
    ]
    // hab=8: malus=0 → base=10. -2 -1 +1 = -2 → 8
    expect(calculateQualityOfLife(8, mods)).toBe(8)
  })

  it('applies Pristine Environment modifier (+2 QoL)', () => {
    const mods = [makeModifier('qualityOfLife', 2)]
    // hab=10: base=10, +2 = 12 → clamped to 10
    expect(calculateQualityOfLife(10, mods)).toBe(10)

    // hab=4: base=8, +2 = 10 → 10
    expect(calculateQualityOfLife(4, mods)).toBe(10)
  })

  it('clamps to 0 minimum', () => {
    const mods = [makeModifier('qualityOfLife', -10, 'shortage')]
    expect(calculateQualityOfLife(0, mods)).toBe(0)
  })

  it('clamps to 10 maximum', () => {
    const mods = [makeModifier('qualityOfLife', 5)]
    expect(calculateQualityOfLife(10, mods)).toBe(10)
  })

  it('ignores modifiers targeting other attributes', () => {
    const mods = [
      makeModifier('stability', -3),
      makeModifier('qualityOfLife', 1),
    ]
    // Only qualityOfLife modifier applies; +1 on hab=8 base → 10+1=11 → clamped to 10
    expect(calculateQualityOfLife(8, mods)).toBe(10)  // 10 - 0 + 1 = 11 → clamped to 10
    expect(calculateQualityOfLife(4, mods)).toBe(9)   // 10 - 2 + 1 = 9
  })
})

// ─── calculateStability ───────────────────────────────────────────────────────

describe('calculateStability', () => {
  it('returns 10 with ideal conditions (high QoL, military, no debt)', () => {
    // qol=10: qol_malus=max(0,5-10)=0
    // debtTokens=0: debt_malus=0
    // military=3: military_bonus=min(3,floor(3/3))=1
    // base = 10 - 0 - 0 + 1 = 11 → clamped to 10
    expect(calculateStability(10, 3, 0, [])).toBe(10)
  })

  it('applies QoL malus: max(0, 5 - qol)', () => {
    // qol=5: malus=max(0,5-5)=0 → base=10-0-0+0=10
    expect(calculateStability(5, 0, 0, [])).toBe(10)

    // qol=4: malus=max(0,5-4)=1 → base=10-1-0+0=9
    expect(calculateStability(4, 0, 0, [])).toBe(9)

    // qol=1: malus=max(0,5-1)=4 → base=10-4-0+0=6
    expect(calculateStability(1, 0, 0, [])).toBe(6)

    // qol=0: malus=max(0,5-0)=5 → base=10-5-0+0=5
    expect(calculateStability(0, 0, 0, [])).toBe(5)
  })

  it('applies debt malus: floor(debtTokens / 2)', () => {
    // qol=10, no military, debtTokens=2 → debt_malus=1 → base=10-0-1+0=9
    expect(calculateStability(10, 0, 2, [])).toBe(9)

    // debtTokens=4 → debt_malus=2 → base=8
    expect(calculateStability(10, 0, 4, [])).toBe(8)

    // debtTokens=10 → debt_malus=5 → base=5
    expect(calculateStability(10, 0, 10, [])).toBe(5)
  })

  it('debt malus is read from direct state parameter, not from modifiers', () => {
    // A stability modifier exists but debtTokens must still be applied from the direct param
    const mods = [makeModifier('stability', -1)]
    // debtTokens=4 → debt_malus=2 → base=10-0-2+0=8, then -1 modifier → 7
    expect(calculateStability(10, 0, 4, mods)).toBe(7)

    // Same modifier, different debt level → different results
    expect(calculateStability(10, 0, 2, mods)).toBe(8) // base=9-1=8
    expect(calculateStability(10, 0, 0, mods)).toBe(9) // base=10-1=9
  })

  it('applies military infrastructure bonus: min(3, floor(military/3))', () => {
    // military=0: bonus=0
    expect(calculateStability(10, 0, 0, [])).toBe(10)

    // military=3: bonus=min(3,1)=1 → base=10+1=11 → clamped to 10
    expect(calculateStability(10, 3, 0, [])).toBe(10)

    // military=6: bonus=min(3,2)=2 → useful when qol is low
    // qol=4: qol_malus=1 → base=10-1+2=11 → clamped to 10
    expect(calculateStability(4, 6, 0, [])).toBe(10)

    // military=9: bonus=min(3,3)=3
    expect(calculateStability(5, 9, 0, [])).toBe(10) // 10-0+3=13 → clamped

    // military=12 still caps at 3
    expect(calculateStability(4, 12, 0, [])).toBe(10) // 10-1+3=12 → clamped
    expect(calculateStability(4, 9, 0, [])).toBe(10)  // same result
  })

  it('applies feature modifiers (Unstable Tectonics -1 stability)', () => {
    const mods = [makeModifier('stability', -1)]
    expect(calculateStability(10, 0, 0, mods)).toBe(9)
  })

  it('stacks all maluses: qol, debt, shortage modifier, and feature', () => {
    const mods = [makeModifier('stability', -1)] // e.g., Extreme Seasons
    // qol=4 → qol_malus=1, debtTokens=4 → debt_malus=2, military=0 → bonus=0
    // base = 10 - 1 - 2 + 0 = 7, then modifier -1 → 6
    expect(calculateStability(4, 0, 4, mods)).toBe(6)
  })

  it('clamps to 0 minimum', () => {
    const mods = [makeModifier('stability', -10)]
    expect(calculateStability(0, 0, 10, mods)).toBe(0)
  })

  it('clamps to 10 maximum', () => {
    const mods = [makeModifier('stability', 5)]
    expect(calculateStability(10, 9, 0, mods)).toBe(10)
  })

  it('matches full formula: qol=8, military=6, debt=2, Unstable Tectonics', () => {
    const mods = [makeModifier('stability', -1)] // Unstable Tectonics
    // qol_malus = max(0, 5-8) = 0
    // debt_malus = floor(2/2) = 1
    // military_bonus = min(3, floor(6/3)) = 2
    // base = 10 - 0 - 1 + 2 = 11
    // after modifier: 11 - 1 = 10 → clamped to 10
    expect(calculateStability(8, 6, 2, mods)).toBe(10)
  })
})

// ─── calculateGrowthPerTurn ───────────────────────────────────────────────────

describe('calculateGrowthPerTurn', () => {
  it('computes growth with balanced attributes', () => {
    // qol=8, stab=8, access=6, hab=8
    // hab_malus = floor(max(0, 10-8)/3) = floor(2/3) = 0
    // growth = floor((8+8+6)/3) - 3 - 0 = floor(22/3) - 3 = 7 - 3 = 4
    expect(calculateGrowthPerTurn(8, 8, 6, 8, [])).toBe(4)
  })

  it('applies habitability malus: floor(max(0, 10-hab)/3)', () => {
    // qol=7, stab=7, access=4, hab=4
    // hab_malus = floor(max(0,6)/3) = 2
    // growth = floor((7+7+4)/3) - 3 - 2 = floor(18/3) - 3 - 2 = 6 - 5 = 1
    expect(calculateGrowthPerTurn(7, 7, 4, 4, [])).toBe(1)
  })

  it('can be negative (population decline condition)', () => {
    // Low everything: qol=3, stab=3, access=3, hab=2
    // hab_malus = floor(max(0,8)/3) = floor(2.67) = 2
    // growth = floor((3+3+3)/3) - 3 - 2 = 3 - 3 - 2 = -2
    expect(calculateGrowthPerTurn(3, 3, 3, 2, [])).toBe(-2)
  })

  it('is NOT clamped (can be negative or large positive)', () => {
    // Very high attributes should give large positive growth
    // qol=10, stab=10, access=10, hab=10
    // hab_malus=0, growth=floor(30/3)-3-0=10-3=7
    const result = calculateGrowthPerTurn(10, 10, 10, 10, [])
    expect(result).toBe(7)
    expect(result).toBeGreaterThan(0)

    // Very low attributes → negative
    const negResult = calculateGrowthPerTurn(0, 0, 0, 0, [])
    // hab_malus=floor(10/3)=3, growth=floor(0/3)-3-3=0-6=-6
    expect(negResult).toBeLessThan(0)
  })

  it('floors the (qol+stab+access)/3 division', () => {
    // qol=7, stab=7, access=7, hab=10
    // floor((7+7+7)/3) = floor(7) = 7 → 7 - 3 - 0 = 4
    expect(calculateGrowthPerTurn(7, 7, 7, 10, [])).toBe(4)

    // qol=8, stab=7, access=6, hab=10
    // floor((8+7+6)/3) = floor(21/3) = 7 → 7 - 3 - 0 = 4
    expect(calculateGrowthPerTurn(8, 7, 6, 10, [])).toBe(4)
  })

  it('applies feature modifiers targeting growth', () => {
    const mods = [makeModifier('growth', 1)]
    // qol=7, stab=7, access=7, hab=10 → base=4, +1 modifier = 5
    expect(calculateGrowthPerTurn(7, 7, 7, 10, mods)).toBe(5)
  })

  it('applies negative growth modifiers', () => {
    const mods = [makeModifier('growth', -2)]
    // qol=7, stab=7, access=7, hab=10 → base=4, -2 → 2
    expect(calculateGrowthPerTurn(7, 7, 7, 10, mods)).toBe(2)
  })

  it('matches formula for Terra Nova starting conditions', () => {
    // Terra Nova: hab=9 (base 8 + Temperate Climate +1), access=4, pop=7
    // After game start, typical attributes around: qol≈9, stab≈10, access=4
    // hab_malus = floor(max(0,10-9)/3) = floor(1/3) = 0
    // growth = floor((9+10+4)/3) - 3 - 0 = floor(7.67) - 3 = 7 - 3 = 4
    expect(calculateGrowthPerTurn(9, 10, 4, 9, [])).toBe(4)
  })
})

// ─── calculateInfraCap ────────────────────────────────────────────────────────

describe('calculateInfraCap', () => {
  // Base formula (Civilian=Infinity, pop×2) is covered in production.test.ts.
  // These tests focus on empire bonuses and local feature modifiers.

  it('adds empire bonus from EmpireInfraCapBonuses', () => {
    const caps: EmpireInfraCapBonuses = { ...zeroCaps(), maxMining: 5 }
    // pop=5: base=10, empireBonus=5 → cap=15
    expect(calculateInfraCap(5, InfraDomain.Mining, caps, [])).toBe(15)
  })

  it('empire bonuses combine correctly for different domains', () => {
    const caps: EmpireInfraCapBonuses = {
      ...zeroCaps(),
      maxScience: 3,
      maxHighTechIndustry: 2,
    }
    // pop=4: base=8
    expect(calculateInfraCap(4, InfraDomain.Science, caps, [])).toBe(11)      // 8 + 3
    expect(calculateInfraCap(4, InfraDomain.HighTechIndustry, caps, [])).toBe(10) // 8 + 2
    expect(calculateInfraCap(4, InfraDomain.LowIndustry, caps, [])).toBe(8)   // 8 + 0
  })

  it('applies local feature modifiers (Mineral Veins +5 max Mining)', () => {
    const mods = [makeModifier('maxMining', 5)]
    // pop=5: base=10 + 0 empire bonus + 5 modifier = 15
    expect(calculateInfraCap(5, InfraDomain.Mining, zeroCaps(), mods)).toBe(15)
  })

  it('stacks empire bonus and local feature modifier', () => {
    const caps: EmpireInfraCapBonuses = { ...zeroCaps(), maxMining: 3 }
    const mods = [makeModifier('maxMining', 5)]
    // pop=5: base=10, empire=3, modifier=5 → 10 + 3 + 5 = 18
    expect(calculateInfraCap(5, InfraDomain.Mining, caps, mods)).toBe(18)
  })

  it('local modifiers are domain-specific (Mineral Veins does not affect DeepMining)', () => {
    const mods = [makeModifier('maxMining', 5)]
    const pop = 5
    expect(calculateInfraCap(pop, InfraDomain.Mining, zeroCaps(), mods)).toBe(15)
    expect(calculateInfraCap(pop, InfraDomain.DeepMining, zeroCaps(), mods)).toBe(10)
  })

  it('always returns non-negative integer for non-Civilian domains', () => {
    const caps = zeroCaps()
    const domains = [
      InfraDomain.Mining, InfraDomain.DeepMining, InfraDomain.GasExtraction,
      InfraDomain.Agricultural, InfraDomain.LowIndustry, InfraDomain.HeavyIndustry,
      InfraDomain.HighTechIndustry, InfraDomain.SpaceIndustry,
      InfraDomain.Transport, InfraDomain.Science, InfraDomain.Military,
    ]
    for (const domain of domains) {
      for (let pop = 1; pop <= 10; pop++) {
        const cap = calculateInfraCap(pop, domain, caps, [])
        expect(cap).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(cap)).toBe(true)
      }
    }
  })

  it('local modifiers target maxAgricultural for Agricultural domain', () => {
    const mods = [makeModifier('maxAgricultural', 6)] // Fertile Plains / Temperate Climate
    // pop=7: base=14, empire=0, modifier=6 → 20
    expect(calculateInfraCap(7, InfraDomain.Agricultural, zeroCaps(), mods)).toBe(20)
  })

  it('local modifiers for Science domain use maxScience key', () => {
    const mods = [makeModifier('maxScience', 5)] // Ancient Ruins
    // pop=5: base=10 + 5 → 15
    expect(calculateInfraCap(5, InfraDomain.Science, zeroCaps(), mods)).toBe(15)
  })

  it('empire bonus does not apply to Civilian (Infinity short-circuits)', () => {
    const caps: EmpireInfraCapBonuses = { ...zeroCaps(), maxMining: 999 }
    // Civilian is still Infinity
    expect(calculateInfraCap(5, InfraDomain.Civilian, caps, [])).toBe(Infinity)
  })
})

// ─── Cross-attribute dependency verification ───────────────────────────────────

describe('attribute calculation chain (combined scenario)', () => {
  it('calculates correct chain for a typical colony', () => {
    // Simulate a medium colony: hab=8, transport=4, pop=6, no corp infra
    // Feature: Temperate Climate (+1 hab), Strategic Location (+2 access)
    const colonyMods = [
      makeModifier('habitability', 1),   // Temperate Climate
      makeModifier('accessibility', 2),  // Strategic Location
    ]

    const hab = calculateHabitability(7, colonyMods) // 7 + 1 = 8
    expect(hab).toBe(8)

    const access = calculateAccessibility(4, colonyMods) // 3 + 2 + 2 = 7
    expect(access).toBe(7)

    const dyn = calculateDynamism(access, 6, 0, colonyMods) // floor((7+6)/2) + 0 = 6
    expect(dyn).toBe(6)

    const qol = calculateQualityOfLife(hab, colonyMods) // 10 - floor(2/3) = 10
    expect(qol).toBe(10)

    const stab = calculateStability(qol, 0, 0, colonyMods) // 10 - 0 - 0 + 0 = 10
    expect(stab).toBe(10)

    const growth = calculateGrowthPerTurn(qol, stab, access, hab, colonyMods)
    // hab_malus = floor(max(0,10-8)/3) = floor(2/3) = 0
    // growth = floor((10+10+7)/3) - 3 - 0 = floor(9) - 3 = 6
    expect(growth).toBe(6)
  })

  it('debt tokens directly reduce stability without being a modifier', () => {
    const mods: Modifier[] = [] // No modifiers at all
    const debtTokens = 6

    // With 6 debt tokens: debt_malus = floor(6/2) = 3
    // qol=10: qol_malus=0, military=0: bonus=0
    // stability = 10 - 0 - 3 + 0 = 7
    const stab = calculateStability(10, 0, debtTokens, mods)
    expect(stab).toBe(7)

    // Adding a stability modifier still stacks correctly
    const modsWithFeature = [makeModifier('stability', -1)]
    const stabWithFeature = calculateStability(10, 0, debtTokens, modsWithFeature)
    expect(stabWithFeature).toBe(6) // 7 - 1
  })

  it('local modifiers and empire bonuses combine correctly in infra cap', () => {
    const empireCaps: EmpireInfraCapBonuses = { ...zeroCaps(), maxMining: 3 }
    const localMods = [makeModifier('maxMining', 5)] // Mineral Veins

    // pop=6: base=12, empire=3, local=5 → 20
    const cap = calculateInfraCap(6, InfraDomain.Mining, empireCaps, localMods)
    expect(cap).toBe(20)

    // Without any bonuses: cap=12
    const capBase = calculateInfraCap(6, InfraDomain.Mining, zeroCaps(), [])
    expect(capBase).toBe(12)
  })
})
