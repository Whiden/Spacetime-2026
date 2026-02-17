/**
 * math.test.ts — Unit tests for math utilities.
 */

import { describe, it, expect } from 'vitest'
import { clamp, roundDown, scale } from '../../utils/math'

describe('clamp', () => {
  it('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('clamps to min when below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(-100, 0, 10)).toBe(0)
  })

  it('clamps to max when above range', () => {
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(100, 0, 10)).toBe(10)
  })

  it('works with negative ranges', () => {
    expect(clamp(-3, -5, -1)).toBe(-3)
    expect(clamp(-10, -5, -1)).toBe(-5)
    expect(clamp(0, -5, -1)).toBe(-1)
  })
})

describe('roundDown', () => {
  it('rounds down positive floats', () => {
    expect(roundDown(7.9)).toBe(7)
    expect(roundDown(7.1)).toBe(7)
    expect(roundDown(7.0)).toBe(7)
  })

  it('rounds down negative floats (toward negative infinity)', () => {
    expect(roundDown(-1.2)).toBe(-2)
    expect(roundDown(-1.9)).toBe(-2)
  })

  it('returns integer unchanged', () => {
    expect(roundDown(5)).toBe(5)
    expect(roundDown(0)).toBe(0)
  })
})

describe('scale', () => {
  it('maps midpoint correctly', () => {
    expect(scale(5, 0, 10, 0, 100)).toBe(50)
  })

  it('maps minimum correctly', () => {
    expect(scale(0, 0, 10, 0, 100)).toBe(0)
  })

  it('maps maximum correctly', () => {
    expect(scale(10, 0, 10, 0, 100)).toBe(100)
  })

  it('works with non-zero output ranges', () => {
    expect(scale(5, 0, 10, 20, 40)).toBe(30)
  })

  it('works with inverted output range', () => {
    expect(scale(5, 0, 10, 100, 0)).toBe(50)
  })

  it('returns toMin when fromMin === fromMax', () => {
    expect(scale(5, 5, 5, 0, 100)).toBe(0)
  })
})
