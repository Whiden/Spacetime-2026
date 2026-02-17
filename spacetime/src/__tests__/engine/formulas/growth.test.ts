/**
 * growth.test.ts — Unit tests for corporation capital formulas.
 *
 * Tests cover all five formulas with boundary values:
 * - calculateCapitalGain
 * - calculateCompletionBonus
 * - calculateLevelUpCost
 * - calculateAcquisitionCost
 * - calculateMaxInfra
 * - getTotalOwnedInfra (helper)
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCapitalGain,
  calculateCompletionBonus,
  calculateLevelUpCost,
  calculateAcquisitionCost,
  calculateMaxInfra,
  getTotalOwnedInfra,
} from '../../../engine/formulas/growth'
import type { CorpInfrastructureHoldings } from '../../../types/corporation'
import { InfraDomain } from '../../../types/common'

// ─── getTotalOwnedInfra ──────────────────────────────────────────────────────

describe('getTotalOwnedInfra', () => {
  it('returns 0 for empty map', () => {
    const map = new Map<string, CorpInfrastructureHoldings>()
    expect(getTotalOwnedInfra(map)).toBe(0)
  })

  it('sums infrastructure across one colony', () => {
    const map = new Map<string, CorpInfrastructureHoldings>()
    map.set('col_test1', {
      [InfraDomain.Mining]: 3,
      [InfraDomain.Agricultural]: 2,
    })
    expect(getTotalOwnedInfra(map)).toBe(5)
  })

  it('sums infrastructure across multiple colonies', () => {
    const map = new Map<string, CorpInfrastructureHoldings>()
    map.set('col_test1', {
      [InfraDomain.Mining]: 3,
      [InfraDomain.DeepMining]: 2,
    })
    map.set('col_test2', {
      [InfraDomain.LowIndustry]: 4,
    })
    expect(getTotalOwnedInfra(map)).toBe(9)
  })
})

// ─── calculateCapitalGain ────────────────────────────────────────────────────

describe('calculateCapitalGain', () => {
  it('returns 0 or 1 when corp owns no infrastructure', () => {
    // random(0,1) + floor(0/10) = random(0,1) + 0
    const results = new Set<number>()
    for (let i = 0; i < 100; i++) {
      results.add(calculateCapitalGain(0))
    }
    // Should only contain 0 and/or 1
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    }
  })

  it('returns at least 1 when corp owns 10+ infrastructure', () => {
    // random(0,1) + floor(10/10) = random(0,1) + 1
    const results: number[] = []
    for (let i = 0; i < 50; i++) {
      results.push(calculateCapitalGain(10))
    }
    // All results should be 1 or 2
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(2)
    }
  })

  it('returns at least 2 when corp owns 20+ infrastructure', () => {
    // random(0,1) + floor(20/10) = random(0,1) + 2
    const results: number[] = []
    for (let i = 0; i < 50; i++) {
      results.push(calculateCapitalGain(20))
    }
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(2)
      expect(r).toBeLessThanOrEqual(3)
    }
  })

  it('floor division means 9 infra gives 0 base', () => {
    // random(0,1) + floor(9/10) = random(0,1) + 0
    const results: number[] = []
    for (let i = 0; i < 50; i++) {
      results.push(calculateCapitalGain(9))
    }
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    }
  })
})

// ─── calculateCompletionBonus ────────────────────────────────────────────────

describe('calculateCompletionBonus', () => {
  it('returns 0 for a very cheap short contract', () => {
    // floor((1 × 2) / 5) = floor(0.4) = 0
    expect(calculateCompletionBonus(1, 2)).toBe(0)
  })

  it('returns 1 for a 1 BP/turn, 5-turn contract', () => {
    // floor((1 × 5) / 5) = 1
    expect(calculateCompletionBonus(1, 5)).toBe(1)
  })

  it('returns 2 for a 2 BP/turn, 5-turn contract', () => {
    // floor((2 × 5) / 5) = 2
    expect(calculateCompletionBonus(2, 5)).toBe(2)
  })

  it('returns 6 for a 2 BP/turn, 15-turn colonization contract', () => {
    // floor((2 × 15) / 5) = 6
    expect(calculateCompletionBonus(2, 15)).toBe(6)
  })

  it('returns 0 for zero cost contract', () => {
    expect(calculateCompletionBonus(0, 10)).toBe(0)
  })

  it('returns 0 for zero duration contract', () => {
    expect(calculateCompletionBonus(3, 0)).toBe(0)
  })

  it('floors the result', () => {
    // floor((3 × 4) / 5) = floor(2.4) = 2
    expect(calculateCompletionBonus(3, 4)).toBe(2)
  })
})

// ─── calculateLevelUpCost ────────────────────────────────────────────────────

describe('calculateLevelUpCost', () => {
  it('costs 3 capital for level 1 corp', () => {
    expect(calculateLevelUpCost(1)).toBe(3)
  })

  it('costs 6 capital for level 2 corp', () => {
    expect(calculateLevelUpCost(2)).toBe(6)
  })

  it('costs 15 capital for level 5 corp', () => {
    expect(calculateLevelUpCost(5)).toBe(15)
  })

  it('costs 30 capital for level 10 corp', () => {
    expect(calculateLevelUpCost(10)).toBe(30)
  })

  it('scales linearly with level', () => {
    for (let level = 1; level <= 10; level++) {
      expect(calculateLevelUpCost(level)).toBe(level * 3)
    }
  })
})

// ─── calculateAcquisitionCost ────────────────────────────────────────────────

describe('calculateAcquisitionCost', () => {
  it('costs 5 capital for level 1 target', () => {
    expect(calculateAcquisitionCost(1)).toBe(5)
  })

  it('costs 25 capital for level 5 target', () => {
    expect(calculateAcquisitionCost(5)).toBe(25)
  })

  it('costs 50 capital for level 10 target', () => {
    expect(calculateAcquisitionCost(10)).toBe(50)
  })

  it('scales linearly with target level', () => {
    for (let level = 1; level <= 10; level++) {
      expect(calculateAcquisitionCost(level)).toBe(level * 5)
    }
  })
})

// ─── calculateMaxInfra ───────────────────────────────────────────────────────

describe('calculateMaxInfra', () => {
  it('level 1 corp can own 4 infrastructure', () => {
    expect(calculateMaxInfra(1)).toBe(4)
  })

  it('level 3 corp can own 12 infrastructure', () => {
    expect(calculateMaxInfra(3)).toBe(12)
  })

  it('level 5 corp can own 20 infrastructure', () => {
    expect(calculateMaxInfra(5)).toBe(20)
  })

  it('level 10 corp can own 40 infrastructure', () => {
    expect(calculateMaxInfra(10)).toBe(40)
  })

  it('scales linearly with corp level', () => {
    for (let level = 1; level <= 10; level++) {
      expect(calculateMaxInfra(level)).toBe(level * 4)
    }
  })
})
