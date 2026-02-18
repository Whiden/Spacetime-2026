/**
 * production.test.ts — Unit tests for resource production and consumption formulas.
 *
 * Covers: extraction, extraction caps, manufacturing (with/without inputs),
 * industrial input calculation, population consumption (food, consumer goods, TC),
 * and infrastructure cap logic (civilian uncapped, population-based).
 *
 * All boundary values tested as required by Story 8.1 acceptance criteria.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateExtraction,
  calculateExtractionCap,
  calculateManufacturing,
  calculateIndustrialInput,
  calculateFoodConsumption,
  calculateConsumerGoodsConsumption,
  calculateTCConsumption,
  calculateInfraCap,
} from '../../../engine/formulas/production'
import { InfraDomain, RichnessLevel } from '../../../types/common'

// ─── calculateExtraction ─────────────────────────────────────────────────────

describe('calculateExtraction', () => {
  it('returns 0 for 0 infra levels (no infrastructure built)', () => {
    expect(calculateExtraction(0, 1.0)).toBe(0)
  })

  it('returns 0 for 0 richness modifier (degenerate case)', () => {
    expect(calculateExtraction(5, 0)).toBe(0)
  })

  it('returns infraLevel when modifier is 1.0 (standard output)', () => {
    expect(calculateExtraction(1, 1.0)).toBe(1)
    expect(calculateExtraction(5, 1.0)).toBe(5)
    expect(calculateExtraction(10, 1.0)).toBe(10)
    expect(calculateExtraction(15, 1.0)).toBe(15)
  })

  it('returns infraLevel × modifier for bonus features (e.g. Metallic Core +0.5)', () => {
    // Metallic Core grants +0.5 Mining output → modifier becomes 1.5
    expect(calculateExtraction(4, 1.5)).toBe(6)
    expect(calculateExtraction(10, 1.5)).toBe(15)
  })

  it('returns infraLevel × modifier for malus features (e.g. modifier < 1)', () => {
    expect(calculateExtraction(10, 0.5)).toBe(5)
  })

  it('uses exact formula: infraLevel × richnessModifier', () => {
    // Acceptance criterion: calculateExtraction(infraLevel, richnessModifier) returns infraLevel × richnessModifier
    expect(calculateExtraction(7, 1.0)).toBe(7 * 1.0)
    expect(calculateExtraction(3, 1.5)).toBe(3 * 1.5)
    expect(calculateExtraction(20, 1.0)).toBe(20 * 1.0)
  })
})

// ─── calculateExtractionCap ──────────────────────────────────────────────────

describe('calculateExtractionCap', () => {
  it('returns 5 for Poor richness', () => {
    // Acceptance criterion: Poor → 5
    expect(calculateExtractionCap(RichnessLevel.Poor)).toBe(5)
  })

  it('returns 10 for Moderate richness', () => {
    // Acceptance criterion: Moderate → 10
    expect(calculateExtractionCap(RichnessLevel.Moderate)).toBe(10)
  })

  it('returns 15 for Rich richness', () => {
    // Acceptance criterion: Rich → 15
    expect(calculateExtractionCap(RichnessLevel.Rich)).toBe(15)
  })

  it('returns 20 for Exceptional richness', () => {
    // Acceptance criterion: Exceptional → 20
    expect(calculateExtractionCap(RichnessLevel.Exceptional)).toBe(20)
  })

  it('covers all four richness levels (none missing)', () => {
    const levels = Object.values(RichnessLevel)
    const caps = levels.map(r => calculateExtractionCap(r))
    expect(caps).toEqual([5, 10, 15, 20])
  })
})

// ─── calculateManufacturing ───────────────────────────────────────────────────

describe('calculateManufacturing', () => {
  it('returns 0 for 0 infra levels regardless of inputs', () => {
    expect(calculateManufacturing(0, true)).toBe(0)
    expect(calculateManufacturing(0, false)).toBe(0)
  })

  it('returns infraLevel when all inputs are available (full output)', () => {
    // Acceptance criterion: returns infraLevel if inputs available
    expect(calculateManufacturing(1, true)).toBe(1)
    expect(calculateManufacturing(5, true)).toBe(5)
    expect(calculateManufacturing(10, true)).toBe(10)
    expect(calculateManufacturing(14, true)).toBe(14)
  })

  it('returns max(1, floor(infraLevel / 2)) when inputs are in shortage', () => {
    // Updated: Specs.md says 'halved (not zero)'. max(1, floor(level/2)) ensures at least 1.
    expect(calculateManufacturing(1, false)).toBe(1)   // max(1, floor(1/2)) = 1 (not zero)
    expect(calculateManufacturing(2, false)).toBe(1)   // max(1, floor(2/2)) = 1
    expect(calculateManufacturing(5, false)).toBe(2)   // max(1, floor(5/2)) = 2
    expect(calculateManufacturing(10, false)).toBe(5)  // floor(10/2) = 5
    expect(calculateManufacturing(7, false)).toBe(3)   // floor(7/2) = 3
  })

  it('floors correctly for odd infra levels with shortage', () => {
    expect(calculateManufacturing(3, false)).toBe(1)   // floor(3/2) = 1
    expect(calculateManufacturing(9, false)).toBe(4)   // floor(9/2) = 4
    expect(calculateManufacturing(11, false)).toBe(5)  // floor(11/2) = 5
  })

  it('full output is always >= halved output', () => {
    for (let i = 0; i <= 20; i++) {
      expect(calculateManufacturing(i, true)).toBeGreaterThanOrEqual(
        calculateManufacturing(i, false),
      )
    }
  })
})

// ─── calculateIndustrialInput ─────────────────────────────────────────────────

describe('calculateIndustrialInput', () => {
  it('returns 0 for 0 infra levels (no consumption)', () => {
    expect(calculateIndustrialInput(0)).toBe(0)
  })

  it('returns infraLevel (1 unit per level per input type)', () => {
    // Acceptance criterion: returns infraLevel (1 per level per input type)
    expect(calculateIndustrialInput(1)).toBe(1)
    expect(calculateIndustrialInput(5)).toBe(5)
    expect(calculateIndustrialInput(10)).toBe(10)
    expect(calculateIndustrialInput(14)).toBe(14)
  })

  it('mirrors manufacturing input: same level produces and consumes equally', () => {
    // At level N with full inputs: produces N units, consumes N of each input
    const level = 7
    expect(calculateManufacturing(level, true)).toBe(calculateIndustrialInput(level))
  })
})

// ─── Population consumption (Food, Consumer Goods, TC) ──────────────────────
//
// All three functions share the same formula: popLevel × 1.
// Tested together to reduce duplication while maintaining full coverage.

describe.each([
  { name: 'calculateFoodConsumption', fn: calculateFoodConsumption },
  { name: 'calculateConsumerGoodsConsumption', fn: calculateConsumerGoodsConsumption },
  { name: 'calculateTCConsumption', fn: calculateTCConsumption },
])('$name', ({ fn }) => {
  it('returns 0 for pop level 0 (uninhabited)', () => {
    expect(fn(0)).toBe(0)
  })

  it('returns popLevel × 1 (acceptance criterion)', () => {
    expect(fn(1)).toBe(1)
    expect(fn(3)).toBe(3)
    expect(fn(5)).toBe(5)
    expect(fn(7)).toBe(7)
    expect(fn(10)).toBe(10)
  })

  it('scales linearly with population level', () => {
    for (let pop = 1; pop <= 10; pop++) {
      expect(fn(pop)).toBe(pop)
    }
  })
})

describe('population consumption contract', () => {
  it('all three consumption functions return identical values at every pop level', () => {
    for (let pop = 0; pop <= 10; pop++) {
      const food = calculateFoodConsumption(pop)
      const cg = calculateConsumerGoodsConsumption(pop)
      const tc = calculateTCConsumption(pop)
      expect(cg).toBe(food)
      expect(tc).toBe(food)
    }
  })
})

// ─── calculateInfraCap ────────────────────────────────────────────────────────

describe('calculateInfraCap', () => {
  it('returns (popLevel+1)*2 for Civilian domain (capped at next pop level)', () => {
    // Updated: Specs.md § 6 caps Civilian at next_population_level × 2.
    expect(calculateInfraCap(1, InfraDomain.Civilian)).toBe(4)   // (1+1)*2 = 4
    expect(calculateInfraCap(7, InfraDomain.Civilian)).toBe(16)  // (7+1)*2 = 16
    expect(calculateInfraCap(10, InfraDomain.Civilian)).toBe(22) // (10+1)*2 = 22
  })

  it('returns popLevel × 2 for industry domains', () => {
    // Acceptance criterion: returns popLevel × 2 for non-civilian
    expect(calculateInfraCap(5, InfraDomain.LowIndustry)).toBe(10)
    expect(calculateInfraCap(7, InfraDomain.HeavyIndustry)).toBe(14)
    expect(calculateInfraCap(10, InfraDomain.HighTechIndustry)).toBe(20)
    expect(calculateInfraCap(3, InfraDomain.SpaceIndustry)).toBe(6)
    expect(calculateInfraCap(4, InfraDomain.Transport)).toBe(8)
    expect(calculateInfraCap(6, InfraDomain.Science)).toBe(12)
    expect(calculateInfraCap(2, InfraDomain.Military)).toBe(4)
  })

  it('returns popLevel × 2 as baseline for extraction domains', () => {
    // Extraction domains (Mining, DeepMining, GasExtraction, Agricultural) use
    // calculateExtractionCap() for their actual cap. calculateInfraCap() still
    // returns popLevel × 2 as a fallback — the caller takes the minimum of the two.
    expect(calculateInfraCap(5, InfraDomain.Mining)).toBe(10)
    expect(calculateInfraCap(5, InfraDomain.DeepMining)).toBe(10)
    expect(calculateInfraCap(5, InfraDomain.GasExtraction)).toBe(10)
    expect(calculateInfraCap(5, InfraDomain.Agricultural)).toBe(10)
  })

  it('returns 2 cap at minimum pop level (pop 1)', () => {
    const nonCivilianDomains = Object.values(InfraDomain).filter(
      d => d !== InfraDomain.Civilian,
    )
    for (const domain of nonCivilianDomains) {
      expect(calculateInfraCap(1, domain)).toBe(2)
    }
  })

  it('returns 20 cap at max pop level (pop 10)', () => {
    const nonCivilianDomains = Object.values(InfraDomain).filter(
      d => d !== InfraDomain.Civilian,
    )
    for (const domain of nonCivilianDomains) {
      expect(calculateInfraCap(10, domain)).toBe(20)
    }
  })

  it('scales linearly with population for non-civilian domains', () => {
    for (let pop = 1; pop <= 10; pop++) {
      expect(calculateInfraCap(pop, InfraDomain.Transport)).toBe(pop * 2)
    }
  })
})
