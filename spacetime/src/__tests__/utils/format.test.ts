/**
 * format.test.ts — Unit tests for formatting utilities.
 */

import { describe, it, expect } from 'vitest'
import { formatBP, formatPercent, formatTurns } from '../../utils/format'
import type { BPAmount } from '../../types/common'

const bp = (n: number) => n as BPAmount

describe('formatBP', () => {
  it('formats positive BP with + sign by default', () => {
    expect(formatBP(bp(12))).toBe('+12 BP')
  })

  it('formats negative BP with - sign', () => {
    expect(formatBP(bp(-3))).toBe('-3 BP')
  })

  it('formats zero BP without sign', () => {
    expect(formatBP(bp(0))).toBe('0 BP')
  })

  it('formats positive BP without sign when showSign is false', () => {
    expect(formatBP(bp(12), false)).toBe('12 BP')
  })

  it('still formats negative BP with sign even when showSign is false', () => {
    expect(formatBP(bp(-5), false)).toBe('-5 BP')
  })
})

describe('formatPercent', () => {
  it('formats a percentage value', () => {
    expect(formatPercent(75)).toBe('75%')
    expect(formatPercent(100)).toBe('100%')
    expect(formatPercent(0)).toBe('0%')
  })

  it('rounds to nearest integer', () => {
    expect(formatPercent(33.3)).toBe('33%')
    expect(formatPercent(66.7)).toBe('67%')
  })

  it('converts ratio to percentage when isRatio is true', () => {
    expect(formatPercent(0.75, true)).toBe('75%')
    expect(formatPercent(1.0, true)).toBe('100%')
    expect(formatPercent(0.333, true)).toBe('33%')
  })
})

describe('formatTurns', () => {
  it('uses singular for 1 turn', () => {
    expect(formatTurns(1)).toBe('1 turn')
  })

  it('uses plural for multiple turns', () => {
    expect(formatTurns(3)).toBe('3 turns')
    expect(formatTurns(10)).toBe('10 turns')
  })

  it('uses plural for 0 turns', () => {
    expect(formatTurns(0)).toBe('0 turns')
  })
})
