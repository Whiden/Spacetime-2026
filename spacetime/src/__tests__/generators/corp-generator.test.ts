/**
 * corp-generator.test.ts — Unit tests for corporation generation.
 *
 * Tests cover:
 * - Name uniqueness over 100 generations
 * - Trait conflict exclusion
 * - Valid type assignment (from parameter and random)
 * - Starting stats (level 1, capital 0, home planet)
 * - Corporation object structure
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { generateCorporation, type GenerateCorpParams } from '../../generators/corp-generator'
import { clearNameRegistry } from '../../generators/name-generator'
import { CorpType, CorpPersonalityTrait } from '../../types/common'
import type { PlanetId, TurnNumber } from '../../types/common'
import { CONFLICTING_TRAIT_PAIRS } from '../../data/personality-traits'

// ─── Test Helpers ────────────────────────────────────────────────────────────

const TEST_PLANET_ID = 'pln_testaaaa' as PlanetId
const TEST_TURN: TurnNumber = 1 as TurnNumber

function makeParams(overrides?: Partial<GenerateCorpParams>): GenerateCorpParams {
  return {
    homePlanetId: TEST_PLANET_ID,
    foundedTurn: TEST_TURN,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateCorporation', () => {
  beforeEach(() => {
    clearNameRegistry()
  })

  // ── Name Generation ──────────────────────────────────────────────────────

  describe('name generation', () => {
    it('generates a non-empty string name', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.name).toBeTruthy()
      expect(typeof corp.name).toBe('string')
      expect(corp.name.length).toBeGreaterThan(0)
    })

    it('generates unique names over 100 generations', () => {
      const names = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const corp = generateCorporation(makeParams())
        names.add(corp.name)
      }
      // All 100 names should be unique
      expect(names.size).toBe(100)
    })

    it('generates names with expected format (prefix + suffix, optionally with connector)', () => {
      const corp = generateCorporation(makeParams())
      // Name should have at least 2 words (prefix and suffix)
      const words = corp.name.split(' ')
      expect(words.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ── Type Assignment ──────────────────────────────────────────────────────

  describe('type assignment', () => {
    it('assigns the type from parameter when provided', () => {
      const corp = generateCorporation(makeParams({ type: CorpType.Science }))
      expect(corp.type).toBe(CorpType.Science)
    })

    it('assigns each corp type correctly when specified', () => {
      const allTypes = Object.values(CorpType)
      for (const type of allTypes) {
        const corp = generateCorporation(makeParams({ type }))
        expect(corp.type).toBe(type)
      }
    })

    it('assigns a valid CorpType when no type is provided', () => {
      const allTypes = Object.values(CorpType) as string[]
      // Generate several to ensure random assignment works
      for (let i = 0; i < 20; i++) {
        const corp = generateCorporation(makeParams())
        expect(allTypes).toContain(corp.type)
      }
    })

    it('produces variety in random type assignment over many generations', () => {
      const typesSeen = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const corp = generateCorporation(makeParams())
        typesSeen.add(corp.type)
      }
      // Should have seen at least a few different types
      expect(typesSeen.size).toBeGreaterThanOrEqual(3)
    })
  })

  // ── Trait Assignment ─────────────────────────────────────────────────────

  describe('trait assignment', () => {
    it('assigns 1 or 2 traits', () => {
      for (let i = 0; i < 50; i++) {
        const corp = generateCorporation(makeParams())
        expect(corp.traits.length).toBeGreaterThanOrEqual(1)
        expect(corp.traits.length).toBeLessThanOrEqual(2)
      }
    })

    it('assigns valid CorpPersonalityTrait values', () => {
      const allTraits = Object.values(CorpPersonalityTrait) as string[]
      for (let i = 0; i < 50; i++) {
        const corp = generateCorporation(makeParams())
        for (const trait of corp.traits) {
          expect(allTraits).toContain(trait)
        }
      }
    })

    it('never assigns conflicting trait pairs', () => {
      // Generate many corps and check that no conflicting pairs appear
      for (let i = 0; i < 200; i++) {
        const corp = generateCorporation(makeParams())
        if (corp.traits.length === 2) {
          const [t1, t2] = corp.traits
          for (const [a, b] of CONFLICTING_TRAIT_PAIRS) {
            const hasConflict =
              (t1 === a && t2 === b) || (t1 === b && t2 === a)
            expect(hasConflict).toBe(false)
          }
        }
      }
    })

    it('never assigns duplicate traits', () => {
      for (let i = 0; i < 200; i++) {
        const corp = generateCorporation(makeParams())
        if (corp.traits.length === 2) {
          expect(corp.traits[0]).not.toBe(corp.traits[1])
        }
      }
    })

    it('sometimes generates 1 trait and sometimes 2 traits over many runs', () => {
      let singleCount = 0
      let dualCount = 0
      for (let i = 0; i < 200; i++) {
        const corp = generateCorporation(makeParams())
        if (corp.traits.length === 1) singleCount++
        if (corp.traits.length === 2) dualCount++
      }
      // 70/30 split — both should occur
      expect(singleCount).toBeGreaterThan(0)
      expect(dualCount).toBeGreaterThan(0)
      // Rough check: single should be more common than dual
      expect(singleCount).toBeGreaterThan(dualCount)
    })
  })

  // ── Starting Stats ───────────────────────────────────────────────────────

  describe('starting stats', () => {
    it('starts at level 1', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.level).toBe(1)
    })

    it('starts with 0 capital', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.capital).toBe(0)
    })

    it('sets homePlanetId from parameter', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.homePlanetId).toBe(TEST_PLANET_ID)
    })

    it('includes homePlanet in planetsPresent', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.planetsPresent).toContain(TEST_PLANET_ID)
      expect(corp.planetsPresent.length).toBe(1)
    })

    it('sets foundedTurn from parameter', () => {
      const turn = 5 as TurnNumber
      const corp = generateCorporation(makeParams({ foundedTurn: turn }))
      expect(corp.foundedTurn).toBe(turn)
    })

    it('starts with no active contracts', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.activeContractIds).toEqual([])
    })
  })

  // ── Assets ─────────────────────────────────────────────────────────────

  describe('assets', () => {
    it('starts with empty infrastructure holdings', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.assets.infrastructureByColony.size).toBe(0)
    })

    it('starts with no schematics', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.assets.schematics).toEqual([])
    })

    it('starts with no patents', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.assets.patents).toEqual([])
    })
  })

  // ── ID Generation ────────────────────────────────────────────────────────

  describe('ID generation', () => {
    it('generates a corp_ prefixed ID', () => {
      const corp = generateCorporation(makeParams())
      expect(corp.id).toMatch(/^corp_/)
    })

    it('generates unique IDs for each corporation', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const corp = generateCorporation(makeParams())
        ids.add(corp.id)
      }
      expect(ids.size).toBe(50)
    })
  })
})
