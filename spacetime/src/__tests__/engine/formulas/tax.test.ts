/**
 * tax.test.ts — Unit tests for planet tax and corporation tax formulas.
 *
 * Covers: planet tax with various population/habitability combinations,
 * low-population exemption, corporation tax with level scaling,
 * and startup tax exemption (level 1-2 pay 0).
 */

import { describe, it, expect } from 'vitest'
import { calculatePlanetTax, calculateCorpTax } from '../../../engine/formulas/tax'

// ─── Planet Tax ──────────────────────────────────────────────────────────────

describe('calculatePlanetTax', () => {
  it('returns 0 when popLevel < 5', () => {
    expect(calculatePlanetTax(1, 10)).toBe(0)
    expect(calculatePlanetTax(2, 10)).toBe(0)
    expect(calculatePlanetTax(3, 10)).toBe(0)
    expect(calculatePlanetTax(4, 10)).toBe(0)
  })

  it('returns 10 BP for pop 7 hab 9 (acceptance criterion)', () => {
    // habitability_cost = max(0, 10-9) × max(1, floor(7/3)) = 1 × 2 = 2
    // planet_tax = max(0, floor(49/4) - 2) = max(0, 12 - 2) = 10
    expect(calculatePlanetTax(7, 9)).toBe(10)
  })

  it('returns 0 BP for pop 5 hab 2 (acceptance criterion)', () => {
    // habitability_cost = max(0, 10-2) × max(1, floor(5/3)) = 8 × 1 = 8
    // planet_tax = max(0, floor(25/4) - 8) = max(0, 6 - 8) = 0
    expect(calculatePlanetTax(5, 2)).toBe(0)
  })

  it('returns 0 BP for pop 7 hab 2 (acceptance criterion)', () => {
    // habitability_cost = max(0, 10-2) × max(1, floor(7/3)) = 8 × 2 = 16
    // planet_tax = max(0, floor(49/4) - 16) = max(0, 12 - 16) = 0
    expect(calculatePlanetTax(7, 2)).toBe(0)
  })

  it('higher population yields more tax with good habitability', () => {
    const tax5 = calculatePlanetTax(5, 10)
    const tax7 = calculatePlanetTax(7, 10)
    const tax10 = calculatePlanetTax(10, 10)
    expect(tax7).toBeGreaterThan(tax5)
    expect(tax10).toBeGreaterThan(tax7)
  })

  it('low habitability reduces tax', () => {
    const taxHighHab = calculatePlanetTax(7, 10)
    const taxMedHab = calculatePlanetTax(7, 5)
    const taxLowHab = calculatePlanetTax(7, 2)
    expect(taxHighHab).toBeGreaterThan(taxMedHab)
    expect(taxMedHab).toBeGreaterThanOrEqual(taxLowHab)
  })

  it('returns correct tax for pop 10 hab 10 (max values)', () => {
    // habitability_cost = max(0, 10-10) × max(1, floor(10/3)) = 0 × 3 = 0
    // planet_tax = max(0, floor(100/4) - 0) = 25
    expect(calculatePlanetTax(10, 10)).toBe(25)
  })

  it('returns correct tax for pop 5 hab 10 (minimum taxable pop)', () => {
    // habitability_cost = 0
    // planet_tax = max(0, floor(25/4)) = 6
    expect(calculatePlanetTax(5, 10)).toBe(6)
  })

  it('returns correct tax for pop 6 hab 8', () => {
    // habitability_cost = max(0, 10-8) × max(1, floor(6/3)) = 2 × 2 = 4
    // planet_tax = max(0, floor(36/4) - 4) = max(0, 9 - 4) = 5
    expect(calculatePlanetTax(6, 8)).toBe(5)
  })

  it('returns 0 for pop 5 hab 0 (extreme low habitability)', () => {
    // habitability_cost = max(0, 10-0) × max(1, floor(5/3)) = 10 × 1 = 10
    // planet_tax = max(0, floor(25/4) - 10) = max(0, 6 - 10) = 0
    expect(calculatePlanetTax(5, 0)).toBe(0)
  })

  it('never returns negative values', () => {
    for (let pop = 0; pop <= 10; pop++) {
      for (let hab = 0; hab <= 10; hab++) {
        expect(calculatePlanetTax(pop, hab)).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('always returns integers', () => {
    for (let pop = 0; pop <= 10; pop++) {
      for (let hab = 0; hab <= 10; hab++) {
        const tax = calculatePlanetTax(pop, hab)
        expect(Number.isInteger(tax)).toBe(true)
      }
    }
  })
})

// ─── Corporation Tax ─────────────────────────────────────────────────────────

describe('calculateCorpTax', () => {
  it('level 1 corps pay 0 BP (startup exemption)', () => {
    // floor(1/5) = 0
    expect(calculateCorpTax(1)).toBe(0)
  })

  it('level 2 corps pay 0 BP (startup exemption)', () => {
    // floor(4/5) = 0
    expect(calculateCorpTax(2)).toBe(0)
  })

  it('level 3 corps pay 1 BP', () => {
    // floor(9/5) = 1
    expect(calculateCorpTax(3)).toBe(1)
  })

  it('level 5 corps pay 5 BP', () => {
    // floor(25/5) = 5
    expect(calculateCorpTax(5)).toBe(5)
  })

  it('level 10 corps pay 20 BP', () => {
    // floor(100/5) = 20
    expect(calculateCorpTax(10)).toBe(20)
  })

  it('higher level yields more tax', () => {
    const tax3 = calculateCorpTax(3)
    const tax5 = calculateCorpTax(5)
    const tax10 = calculateCorpTax(10)
    expect(tax5).toBeGreaterThan(tax3)
    expect(tax10).toBeGreaterThan(tax5)
  })

  it('always returns integers', () => {
    for (let level = 1; level <= 10; level++) {
      const tax = calculateCorpTax(level)
      expect(Number.isInteger(tax)).toBe(true)
    }
  })

  it('never returns negative values', () => {
    for (let level = 1; level <= 10; level++) {
      expect(calculateCorpTax(level)).toBeGreaterThanOrEqual(0)
    }
  })

  it('scales quadratically with level', () => {
    // Verify the formula: floor(level² / 5)
    for (let level = 1; level <= 10; level++) {
      expect(calculateCorpTax(level)).toBe(Math.floor((level * level) / 5))
    }
  })
})
