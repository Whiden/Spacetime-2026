/**
 * modifiers.test.ts — Unit tests for the modifier resolver.
 * Covers: additive stacking, multiplicative stacking, mixed order,
 * empty list, conditional modifiers, and breakdown attribution.
 */

import { describe, it, expect } from 'vitest'
import {
  resolveModifiers,
  getModifierBreakdown,
  filterByTarget,
} from '../../../engine/formulas/modifiers'
import type { Modifier } from '../../../types/modifier'

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeAddModifier(
  target: string,
  value: number,
  sourceName = 'Test Source',
  id = `mod_${Math.random()}`,
): Modifier {
  return {
    id: id as Modifier['id'],
    target,
    operation: 'add',
    value,
    sourceType: 'feature',
    sourceId: 'test_source',
    sourceName,
  }
}

function makeMultiplyModifier(
  target: string,
  value: number,
  sourceName = 'Test Multiplier',
  id = `mod_${Math.random()}`,
): Modifier {
  return {
    id: id as Modifier['id'],
    target,
    operation: 'multiply',
    value,
    sourceType: 'feature',
    sourceId: 'test_source',
    sourceName,
  }
}

function makeConditionalModifier(
  target: string,
  value: number,
  attribute: string,
  comparison: 'lte' | 'gte',
  threshold: number,
): Modifier {
  return {
    id: `mod_cond_${Math.random()}` as Modifier['id'],
    target,
    operation: 'add',
    value,
    sourceType: 'feature',
    sourceId: 'conditional_source',
    sourceName: 'Conditional Feature',
    condition: {
      attribute,
      comparison,
      value: threshold,
      scope: 'colony',
    },
  }
}

// ─── resolveModifiers Tests ───────────────────────────────────────────────────

describe('resolveModifiers', () => {
  it('returns base value when modifier list is empty', () => {
    expect(resolveModifiers(8, 'habitability', [])).toBe(8)
  })

  it('applies a single additive modifier correctly', () => {
    const modifiers = [makeAddModifier('habitability', 1)]
    expect(resolveModifiers(8, 'habitability', modifiers)).toBe(9)
  })

  it('stacks multiple additive modifiers correctly', () => {
    const modifiers = [
      makeAddModifier('habitability', 1),
      makeAddModifier('habitability', -2),
      makeAddModifier('habitability', 3),
    ]
    // 8 + (1 - 2 + 3) = 10
    expect(resolveModifiers(8, 'habitability', modifiers)).toBe(10)
  })

  it('applies a single multiplicative modifier correctly', () => {
    const modifiers = [makeMultiplyModifier('habitability', 1.5)]
    // 8 × 1.5 = 12
    expect(resolveModifiers(8, 'habitability', modifiers)).toBe(12)
  })

  it('stacks multiple multiplicative modifiers sequentially', () => {
    const modifiers = [
      makeMultiplyModifier('habitability', 1.5),
      makeMultiplyModifier('habitability', 2.0),
    ]
    // 8 × 1.5 × 2.0 = 24
    expect(resolveModifiers(8, 'habitability', modifiers)).toBe(24)
  })

  it('applies additive modifiers BEFORE multiplicative modifiers', () => {
    const modifiers = [
      makeMultiplyModifier('habitability', 1.5), // Applied second
      makeAddModifier('habitability', 2),         // Applied first
    ]
    // (8 + 2) × 1.5 = 15, NOT (8 × 1.5) + 2 = 14
    expect(resolveModifiers(8, 'habitability', modifiers)).toBe(15)
  })

  it('ignores modifiers targeting a different stat', () => {
    const modifiers = [
      makeAddModifier('stability', 3),
      makeAddModifier('habitability', 1),
    ]
    expect(resolveModifiers(8, 'habitability', modifiers)).toBe(9)
    expect(resolveModifiers(5, 'stability', modifiers)).toBe(8)
  })

  it('clamps result to provided min', () => {
    const modifiers = [makeAddModifier('habitability', -20)]
    // 8 - 20 = -12, clamped to 0
    expect(resolveModifiers(8, 'habitability', modifiers, 0)).toBe(0)
  })

  it('clamps result to provided max', () => {
    const modifiers = [makeAddModifier('habitability', 20)]
    // 8 + 20 = 28, clamped to 10
    expect(resolveModifiers(8, 'habitability', modifiers, 0, 10)).toBe(10)
  })

  it('does not clamp when no bounds provided', () => {
    const modifiers = [makeAddModifier('habitability', 20)]
    expect(resolveModifiers(8, 'habitability', modifiers)).toBe(28)
  })

  it('applies conditional modifier when condition is met (lte)', () => {
    const modifier = makeConditionalModifier('growth', 1, 'habitability', 'lte', 4)
    // habitability = 3, condition 3 ≤ 4 → true → applies +1
    expect(resolveModifiers(5, 'growth', [modifier], undefined, undefined, { habitability: 3 })).toBe(6)
  })

  it('does NOT apply conditional modifier when condition is not met', () => {
    const modifier = makeConditionalModifier('growth', 1, 'habitability', 'lte', 4)
    // habitability = 7, condition 7 ≤ 4 → false → does not apply
    expect(resolveModifiers(5, 'growth', [modifier], undefined, undefined, { habitability: 7 })).toBe(5)
  })

  it('applies conditional modifier when condition is met (gte)', () => {
    const modifier = makeConditionalModifier('dynamism', 2, 'populationLevel', 'gte', 5)
    // populationLevel = 6, condition 6 ≥ 5 → true → applies +2
    expect(resolveModifiers(3, 'dynamism', [modifier], undefined, undefined, { populationLevel: 6 })).toBe(5)
  })

  it('treats modifier as inactive when condition attribute is missing from context', () => {
    const modifier = makeConditionalModifier('growth', 1, 'habitability', 'lte', 4)
    // No habitability in context → condition cannot be evaluated → modifier inactive
    expect(resolveModifiers(5, 'growth', [modifier])).toBe(5)
  })
})

// ─── getModifierBreakdown Tests ───────────────────────────────────────────────

describe('getModifierBreakdown', () => {
  it('returns empty array when no modifiers target the stat', () => {
    const modifiers = [makeAddModifier('stability', 1, 'SomeFeature')]
    expect(getModifierBreakdown('habitability', modifiers)).toEqual([])
  })

  it('returns correct breakdown entries for applicable modifiers', () => {
    const modifiers = [
      makeAddModifier('habitability', 1, 'Temperate Climate'),
      makeAddModifier('habitability', -2, 'Harsh Radiation'),
      makeMultiplyModifier('habitability', 1.1, 'Rich Biosphere'),
      makeAddModifier('stability', 2, 'Irrelevant'),
    ]
    const breakdown = getModifierBreakdown('habitability', modifiers)
    expect(breakdown).toHaveLength(3)
    expect(breakdown[0]).toEqual({ source: 'Temperate Climate', operation: 'add', value: 1 })
    expect(breakdown[1]).toEqual({ source: 'Harsh Radiation', operation: 'add', value: -2 })
    expect(breakdown[2]).toEqual({ source: 'Rich Biosphere', operation: 'multiply', value: 1.1 })
  })

  it('excludes conditional modifiers whose conditions are not met', () => {
    const conditional = makeConditionalModifier('growth', 1, 'habitability', 'lte', 4)
    const always = makeAddModifier('growth', 2, 'Always Active')
    const breakdown = getModifierBreakdown('growth', [conditional, always], { habitability: 7 })
    // conditional not met, only 'Always Active' should appear
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0]?.source).toBe('Always Active')
  })
})

// ─── filterByTarget Tests ─────────────────────────────────────────────────────

describe('filterByTarget', () => {
  it('returns only modifiers targeting the specified stat', () => {
    const modifiers = [
      makeAddModifier('habitability', 1),
      makeAddModifier('stability', 2),
      makeMultiplyModifier('habitability', 1.2),
    ]
    const filtered = filterByTarget('habitability', modifiers)
    expect(filtered).toHaveLength(2)
    expect(filtered.every((m) => m.target === 'habitability')).toBe(true)
  })

  it('returns empty array when no modifiers match', () => {
    const modifiers = [makeAddModifier('stability', 1)]
    expect(filterByTarget('habitability', modifiers)).toEqual([])
  })
})
