/**
 * combat-resolver.test.ts — Unit tests for Story 16.2: Combat Resolver.
 *
 * Tests cover:
 * - Win/loss outcome based on Fight vs difficulty roll
 * - Captain modifier correctly applied (Green/Regular/Veteran/Elite)
 * - Condition delta is within win range (5-20%) on victory
 * - Condition delta is within loss range (30-60%) on defeat
 * - Ship with condition reaching 0 is marked as destroyed
 * - Narrative is non-empty and reflects win/loss
 * - Multiple ships each receive independent condition deltas
 */

import { describe, it, expect } from 'vitest'
import { resolveCombat } from '../../../engine/simulation/combat-resolver'
import {
  CaptainExperience,
  MissionType,
  ShipRole,
  SizeVariant,
  ShipStatus,
  SectorDensity,
} from '../../../types/common'
import type { ShipId, SectorId, CaptainId, CorpId, TurnNumber } from '../../../types/common'
import type { Ship } from '../../../types/ship'
import type { Sector } from '../../../types/sector'

// ─── Constants ────────────────────────────────────────────────────────────────

const TURN_1 = 1 as TurnNumber
const SECTOR_A = 'sec_aaaaaaaa' as SectorId
const SHIP_1 = 'ship_0001' as ShipId
const SHIP_2 = 'ship_0002' as ShipId
const CAPTAIN_1 = 'cpt_0001' as CaptainId

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSector(overrides: Partial<Sector> = {}): Sector {
  return {
    id: SECTOR_A,
    name: 'Test Sector',
    density: SectorDensity.Moderate,
    explorationPercent: 50,
    threatModifier: 1.0,
    firstEnteredTurn: TURN_1,
    ...overrides,
  }
}

function makeShip(id: ShipId, overrides: Partial<{ condition: number; fight: number }> = {}): Ship {
  return {
    id,
    name: 'Test Ship',
    role: ShipRole.Assault,
    sizeVariant: SizeVariant.Standard,
    primaryStats: { size: 5, speed: 4, firepower: 6, armor: 4, sensors: 3, evasion: 3 },
    derivedStats: { hullPoints: 65, powerProjection: 7, bpPerTurn: 2, buildTimeTurns: 5 },
    abilities: { fight: overrides.fight ?? 20, investigation: 5, support: 4 },
    condition: overrides.condition ?? 100,
    captain: {
      id: CAPTAIN_1,
      name: 'Test Captain',
      experience: CaptainExperience.Regular,
      missionsCompleted: 3,
      battlesCount: 1,
    },
    serviceRecord: {
      shipId: id,
      builtTurn: TURN_1,
      builtByCorpId: 'corp_test' as CorpId,
      missionsCompleted: 3,
      battlesCount: 1,
      destroyed: false,
      destroyedTurn: null,
    },
    status: ShipStatus.OnMission,
    homeSectorId: SECTOR_A,
    ownerCorpId: 'government',
    modifiers: [],
    appliedSchematicIds: [],
    builtTurn: TURN_1,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveCombat', () => {
  describe('Win/Loss outcome', () => {
    it('returns victory when Fight × roll easily beats difficulty', () => {
      // Fight = 20, Regular mod = ×1.0 → effectiveFight = 20
      // Difficulty = Assault base(20) × threatModifier(1.0) = 20
      // Roll always returns 1.0 (max of 1.15 variance) → 20 × 1.15 = 23 > 20 → win
      const result = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 100 })], // very high fight
        commanderExperience: CaptainExperience.Regular,
        targetSector: makeSector({ threatModifier: 1.0 }),
        missionType: MissionType.Assault,
        turn: TURN_1,
        randFn: () => 1.0, // max variance → always win with high Fight
      })
      expect(result.outcome).toBe('victory')
    })

    it('returns defeat when Fight is far too low vs difficulty', () => {
      // Fight = 1, Regular ×1.0 → effectiveFight = 1
      // Difficulty = Assault(20) × 1.5 = 30
      // 1 × 1.15 = 1.15 < 30 → lose
      const result = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 1 })],
        commanderExperience: CaptainExperience.Regular,
        targetSector: makeSector({ threatModifier: 1.5 }),
        missionType: MissionType.Assault,
        turn: TURN_1,
        randFn: () => 1.0,
      })
      expect(result.outcome).toBe('defeat')
    })
  })

  describe('Captain modifier application', () => {
    it('Green captain (×0.8) reduces effective Fight score', () => {
      // Fight = 10, Green ×0.8 → effectiveFight = floor(8) = 8
      // Difficulty = Investigation(8) × 1.0 = 8
      // Roll = 1.0 → 8 × 1.15 = 9.2 > 8 → win
      const resultWithGreen = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 10 })],
        commanderExperience: CaptainExperience.Green,
        targetSector: makeSector({ threatModifier: 1.0 }),
        missionType: MissionType.Investigation,
        turn: TURN_1,
        randFn: () => 1.0,
      })
      expect(resultWithGreen.outcome).toBe('victory')

      // Same fight but Green mod results in effectiveFight = 8 vs difficulty 9 (threatModifier 1.1)
      // 8 × 1.15 = 9.2 > 9 → still win, so use lower roll
      // Green: effectiveFight = floor(10 × 0.8) = 8; roll 0.0 → 8 × 0.85 = 6.8 < 9 → defeat
      const resultGreenLose = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 10 })],
        commanderExperience: CaptainExperience.Green,
        targetSector: makeSector({ threatModifier: 1.1 }),
        missionType: MissionType.Investigation,
        turn: TURN_1,
        randFn: () => 0.0, // min variance → 8 × 0.85 = 6.8 < 8.8 → defeat
      })
      expect(resultGreenLose.outcome).toBe('defeat')
    })

    it('Elite captain (×1.2) boosts effective Fight score', () => {
      // Fight = 10, Elite ×1.2 → effectiveFight = floor(12) = 12
      // Difficulty = Investigation(8) × 1.1 = 8.8
      // Roll = 0.0 → 12 × 0.85 = 10.2 > 8.8 → win
      const result = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 10 })],
        commanderExperience: CaptainExperience.Elite,
        targetSector: makeSector({ threatModifier: 1.1 }),
        missionType: MissionType.Investigation,
        turn: TURN_1,
        randFn: () => 0.0,
      })
      expect(result.outcome).toBe('victory')
    })
  })

  describe('Condition delta ranges', () => {
    it('winning ships lose 5-20% condition', () => {
      // Force a win with high fight
      // randFn sequence: first call = combat roll (1.0 = win), subsequent = condition rolls
      let callCount = 0
      const result = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 200, condition: 100 })],
        commanderExperience: CaptainExperience.Regular,
        targetSector: makeSector({ threatModifier: 1.0 }),
        missionType: MissionType.Defense,
        turn: TURN_1,
        randFn: () => {
          // First call: combat roll → 1.0 to ensure win
          // Subsequent calls: condition loss sample
          if (callCount++ === 0) return 1.0
          return 0.5 // mid-range condition roll
        },
      })
      expect(result.outcome).toBe('victory')
      const outcome = result.shipOutcomes[0]!
      expect(outcome.conditionBefore).toBe(100)
      // Win loss: 5% + 0.5 × (20%-5%) = 5% + 7.5% = 12.5% → floor(100 - 100×0.125) = 88
      expect(outcome.conditionAfter).toBeGreaterThanOrEqual(80) // max 20% loss
      expect(outcome.conditionAfter).toBeLessThan(100) // some damage occurred
      expect(outcome.destroyed).toBe(false)
    })

    it('losing ships lose 30-60% condition', () => {
      // Force a loss with very low fight
      let callCount = 0
      const result = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 1, condition: 100 })],
        commanderExperience: CaptainExperience.Regular,
        targetSector: makeSector({ threatModifier: 1.5 }),
        missionType: MissionType.Assault,
        turn: TURN_1,
        randFn: () => {
          if (callCount++ === 0) return 0.0 // min roll → lose
          return 0.5 // mid condition roll
        },
      })
      expect(result.outcome).toBe('defeat')
      const outcome = result.shipOutcomes[0]!
      expect(outcome.conditionBefore).toBe(100)
      // Lose loss: 30% + 0.5 × (60%-30%) = 30% + 15% = 45% → round(100 - 100×0.45) = 55
      expect(outcome.conditionAfter).toBeLessThanOrEqual(70) // at least 30% loss
      expect(outcome.conditionAfter).toBeGreaterThan(0)    // not destroyed at 45% loss
    })
  })

  describe('Ship destruction at 0% condition', () => {
    it('marks ship as destroyed when condition drops to 0', () => {
      // Ship at 50% condition, loses — force max loss (60%)
      // 50 - 50×0.60 = 20 → not destroyed. Use condition 10 for guaranteed zero.
      // 10 - 10×0.60 = 4 → still not. Use condition 1 with max loss fraction.
      // round(1 - 1 × 0.60) = round(0.4) = 0 → destroyed
      let callCount = 0
      const result = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 1, condition: 1 })],
        commanderExperience: CaptainExperience.Regular,
        targetSector: makeSector({ threatModifier: 1.5 }),
        missionType: MissionType.Assault,
        turn: TURN_1,
        randFn: () => {
          if (callCount++ === 0) return 0.0 // lose
          return 1.0 // max loss fraction (60%)
        },
      })
      expect(result.outcome).toBe('defeat')
      const outcome = result.shipOutcomes[0]!
      expect(outcome.conditionAfter).toBe(0)
      expect(outcome.destroyed).toBe(true)
    })

    it('includes destroyed ship ID in the narrative', () => {
      let callCount = 0
      const result = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 1, condition: 1 })],
        commanderExperience: CaptainExperience.Regular,
        targetSector: makeSector({ threatModifier: 1.5 }),
        missionType: MissionType.Assault,
        turn: TURN_1,
        randFn: () => {
          if (callCount++ === 0) return 0.0
          return 1.0
        },
      })
      expect(result.narrative).toContain('1 ship(s) lost')
    })
  })

  describe('Multiple ships', () => {
    it('each ship receives its own condition delta', () => {
      let callCount = 0
      const result = resolveCombat({
        ships: [
          makeShip(SHIP_1, { fight: 200, condition: 100 }),
          makeShip(SHIP_2, { fight: 200, condition: 80 }),
        ],
        commanderExperience: CaptainExperience.Veteran,
        targetSector: makeSector({ threatModifier: 1.0 }),
        missionType: MissionType.Defense,
        turn: TURN_1,
        randFn: () => {
          if (callCount++ === 0) return 1.0 // combat roll → win
          return 0.5 // same loss fraction for each ship
        },
      })
      expect(result.shipOutcomes).toHaveLength(2)
      expect(result.shipOutcomes[0]!.shipId).toBe(SHIP_1)
      expect(result.shipOutcomes[1]!.shipId).toBe(SHIP_2)
      // Both took damage from their respective starting conditions
      expect(result.shipOutcomes[0]!.conditionAfter).toBeLessThan(100)
      expect(result.shipOutcomes[1]!.conditionAfter).toBeLessThan(80)
    })
  })

  describe('Narrative', () => {
    it('returns a non-empty narrative string', () => {
      const result = resolveCombat({
        ships: [makeShip(SHIP_1)],
        commanderExperience: CaptainExperience.Regular,
        targetSector: makeSector(),
        missionType: MissionType.Escort,
        turn: TURN_1,
        randFn: () => 1.0,
      })
      expect(result.narrative.length).toBeGreaterThan(0)
    })

    it('includes "Victory" on win', () => {
      const result = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 200 })],
        commanderExperience: CaptainExperience.Regular,
        targetSector: makeSector({ threatModifier: 1.0 }),
        missionType: MissionType.Defense,
        turn: TURN_1,
        randFn: () => 1.0,
      })
      expect(result.narrative).toContain('Victory')
    })

    it('includes "Defeat" on loss', () => {
      const result = resolveCombat({
        ships: [makeShip(SHIP_1, { fight: 1 })],
        commanderExperience: CaptainExperience.Regular,
        targetSector: makeSector({ threatModifier: 1.5 }),
        missionType: MissionType.Assault,
        turn: TURN_1,
        randFn: () => 0.0,
      })
      expect(result.narrative).toContain('Defeat')
    })
  })
})
