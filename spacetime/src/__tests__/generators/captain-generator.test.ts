/**
 * captain-generator.test.ts — Unit tests for Story 15.3: Captain Generator.
 *
 * Covers:
 * - Name generation (non-empty, "FirstName LastName" format)
 * - Default experience level (Green)
 * - Experience progression thresholds
 * - Returns typed Captain object with correct initial fields
 */

import { describe, it, expect } from 'vitest'
import { generateCaptain, getExperienceLevel } from '../../generators/captain-generator'
import { CaptainExperience } from '../../types/common'
import { CAPTAIN_FIRST_NAMES, CAPTAIN_LAST_NAMES } from '../../data/captain-names'

// ─── Name Generation ──────────────────────────────────────────────────────────

describe('generateCaptain — name generation', () => {
  it('returns a non-empty name', () => {
    const captain = generateCaptain()
    expect(captain.name.length).toBeGreaterThan(0)
  })

  it('name is in "FirstName LastName" format (two words)', () => {
    const captain = generateCaptain()
    const parts = captain.name.split(' ')
    expect(parts).toHaveLength(2)
  })

  it('first name comes from CAPTAIN_FIRST_NAMES pool', () => {
    // Deterministic: mock rand to always pick index 0
    let call = 0
    const mockRand = () => (call++ === 0 ? 0 : 0)
    const captain = generateCaptain(mockRand)
    const [first] = captain.name.split(' ')
    expect(CAPTAIN_FIRST_NAMES).toContain(first)
  })

  it('last name comes from CAPTAIN_LAST_NAMES pool', () => {
    // Deterministic: first call picks first name, second picks last name
    let call = 0
    const mockRand = () => (call++ === 0 ? 0 : 0)
    const captain = generateCaptain(mockRand)
    const [, last] = captain.name.split(' ')
    expect(CAPTAIN_LAST_NAMES).toContain(last)
  })

  it('generates different names with different rand values', () => {
    let i = 0
    const names = new Set<string>()
    for (let n = 0; n < 20; n++) {
      const captain = generateCaptain(() => (i++ % 10) / 10)
      names.add(captain.name)
    }
    // Should produce at least a few distinct names across 20 calls
    expect(names.size).toBeGreaterThan(1)
  })
})

// ─── Default Experience ────────────────────────────────────────────────────────

describe('generateCaptain — default experience', () => {
  it('starts at Green experience', () => {
    const captain = generateCaptain()
    expect(captain.experience).toBe(CaptainExperience.Green)
  })

  it('starts with 0 missions completed', () => {
    const captain = generateCaptain()
    expect(captain.missionsCompleted).toBe(0)
  })

  it('starts with 0 battles', () => {
    const captain = generateCaptain()
    expect(captain.battlesCount).toBe(0)
  })

  it('has a non-empty id prefixed with cpt_', () => {
    const captain = generateCaptain()
    expect(captain.id).toMatch(/^cpt_/)
  })
})

// ─── Experience Progression Thresholds ────────────────────────────────────────

describe('getExperienceLevel — progression thresholds', () => {
  it('0 missions → Green', () => {
    expect(getExperienceLevel(0)).toBe(CaptainExperience.Green)
  })

  it('1 mission → Green', () => {
    expect(getExperienceLevel(1)).toBe(CaptainExperience.Green)
  })

  it('2 missions → Regular', () => {
    expect(getExperienceLevel(2)).toBe(CaptainExperience.Regular)
  })

  it('4 missions → Regular', () => {
    expect(getExperienceLevel(4)).toBe(CaptainExperience.Regular)
  })

  it('5 missions → Veteran', () => {
    expect(getExperienceLevel(5)).toBe(CaptainExperience.Veteran)
  })

  it('9 missions → Veteran', () => {
    expect(getExperienceLevel(9)).toBe(CaptainExperience.Veteran)
  })

  it('10 missions → Elite', () => {
    expect(getExperienceLevel(10)).toBe(CaptainExperience.Elite)
  })

  it('100 missions → Elite', () => {
    expect(getExperienceLevel(100)).toBe(CaptainExperience.Elite)
  })
})
