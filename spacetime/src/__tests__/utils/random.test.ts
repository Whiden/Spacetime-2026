/**
 * random.test.ts — Unit tests for random number utilities.
 */

import { describe, it, expect } from 'vitest'
import { randomInt, randomFloat, chance, weightedRandom, createSeededRandom } from '../../utils/random'

describe('createSeededRandom', () => {
  it('produces deterministic output for the same seed', () => {
    const rng1 = createSeededRandom(42)
    const rng2 = createSeededRandom(42)
    expect(rng1()).toBe(rng2())
    expect(rng1()).toBe(rng2())
  })

  it('produces different output for different seeds', () => {
    const v1 = createSeededRandom(42)()
    const v2 = createSeededRandom(99)()
    expect(v1).not.toBe(v2)
  })

  it('returns values in [0, 1)', () => {
    const rng = createSeededRandom(123)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('randomInt', () => {
  it('returns an integer within [min, max] inclusive', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomInt(1, 6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
    }
  })

  it('returns min when min === max', () => {
    expect(randomInt(5, 5)).toBe(5)
  })

  it('produces deterministic output with seed', () => {
    const v1 = randomInt(1, 100, 42)
    const v2 = randomInt(1, 100, 42)
    expect(v1).toBe(v2)
  })

  it('produces different output with different seeds', () => {
    // Run enough times that different seeds should produce different results
    const results = new Set(Array.from({ length: 10 }, (_, i) => randomInt(1, 1000, i)))
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('randomFloat', () => {
  it('returns a float within [min, max)', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomFloat(0.8, 1.2)
      expect(v).toBeGreaterThanOrEqual(0.8)
      expect(v).toBeLessThan(1.2)
    }
  })

  it('produces deterministic output with seed', () => {
    const v1 = randomFloat(0, 1, 42)
    const v2 = randomFloat(0, 1, 42)
    expect(v1).toBe(v2)
  })
})

describe('chance', () => {
  it('always returns true for 100%', () => {
    for (let i = 0; i < 20; i++) {
      expect(chance(100)).toBe(true)
    }
  })

  it('always returns false for 0%', () => {
    for (let i = 0; i < 20; i++) {
      expect(chance(0)).toBe(false)
    }
  })

  it('produces deterministic output with seed', () => {
    const v1 = chance(50, 42)
    const v2 = chance(50, 42)
    expect(v1).toBe(v2)
  })

  it('approximately matches the target probability over many runs', () => {
    const RUNS = 10000
    let trueCount = 0
    for (let i = 0; i < RUNS; i++) {
      if (chance(30)) trueCount++
    }
    const actualPercent = (trueCount / RUNS) * 100
    // Allow ±5% tolerance
    expect(actualPercent).toBeGreaterThan(25)
    expect(actualPercent).toBeLessThan(35)
  })
})

describe('weightedRandom', () => {
  it('selects from a single-option list', () => {
    expect(weightedRandom([{ value: 'only', weight: 1 }])).toBe('only')
  })

  it('throws on empty options', () => {
    expect(() => weightedRandom([])).toThrow()
  })

  it('always returns the high-weight option when other weights are near zero', () => {
    const options = [
      { value: 'common', weight: 9999 },
      { value: 'rare', weight: 1 },
    ]
    let commonCount = 0
    for (let i = 0; i < 100; i++) {
      if (weightedRandom(options) === 'common') commonCount++
    }
    expect(commonCount).toBeGreaterThan(95)
  })

  it('distributes results approximately according to weights', () => {
    const options = [
      { value: 0, weight: 40 },
      { value: 1, weight: 40 },
      { value: 2, weight: 20 },
    ]
    const counts = [0, 0, 0]
    const RUNS = 10000
    for (let i = 0; i < RUNS; i++) {
      const result = weightedRandom(options)
      counts[result]++
    }
    // ~40% for 0, ~40% for 1, ~20% for 2 (±5% tolerance)
    expect((counts[0]! / RUNS) * 100).toBeGreaterThan(35)
    expect((counts[0]! / RUNS) * 100).toBeLessThan(45)
    expect((counts[2]! / RUNS) * 100).toBeGreaterThan(15)
    expect((counts[2]! / RUNS) * 100).toBeLessThan(25)
  })

  it('produces deterministic output with seed', () => {
    const options = [
      { value: 'a', weight: 50 },
      { value: 'b', weight: 50 },
    ]
    const v1 = weightedRandom(options, 42)
    const v2 = weightedRandom(options, 42)
    expect(v1).toBe(v2)
  })
})
