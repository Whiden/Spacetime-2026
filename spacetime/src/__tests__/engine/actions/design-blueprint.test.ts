/**
 * design-blueprint.test.ts — Unit tests for ship blueprint design engine action.
 *
 * Story 15.1 — Blueprint System.
 *
 * Test coverage:
 * - Stat formula at corp level 1 / 5 / 10
 * - Tech bonus additive effect
 * - Size variant multiplier on `size` stat and derived stats (`bp_per_turn`, `base_build_time`)
 * - Schematic bonus stacking
 * - Randomness bounded to [0.8, 1.2]
 * - Derived stat calculations (hull_points, power_projection)
 * - Ability score calculations (Fight, Investigation, Support)
 */

import { describe, it, expect } from 'vitest'
import { designBlueprint, calculateShipAbilities } from '../../../engine/actions/design-blueprint'
import type { DesignBlueprintInput } from '../../../engine/actions/design-blueprint'
import { ShipRole, SizeVariant, ShipStatus, CaptainExperience, CorpType } from '../../../types/common'
import type { ShipId, SectorId, TurnNumber, CorpId, CaptainId } from '../../../types/common'
import type { Corporation } from '../../../types/corporation'
import type { Schematic } from '../../../types/science'
import { createEmptyEmpireBonuses } from '../../../types/empire'
import { SchematicCategory, ScienceSectorType } from '../../../types/common'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a minimal Corporation fixture at the given level. */
function makeCorp(level: number, type = CorpType.Shipbuilding): Corporation {
  return {
    id: 'corp_test' as CorpId,
    name: 'Test Shipbuilding Corp',
    type,
    level,
    capital: 0,
    traits: [],
    homePlanetId: null,
    foundedTurn: 1 as TurnNumber,
    assets: {
      infrastructureByColony: new Map(),
      schematics: [],
      patents: [],
    },
  }
}

/** A deterministic randFn that always returns the midpoint → multiplier = 1.0. */
const midRand = () => 0.5 // 0.8 + 0.5 * 0.4 = 1.0

/** A randFn that always returns 0 → multiplier = 0.8 (minimum). */
const minRand = () => 0

/** A randFn that always returns 0.9999 → multiplier ≈ 1.2 (maximum). */
const maxRand = () => 0.9999

/** Base design-blueprint input. */
function makeInput(
  overrides: Partial<DesignBlueprintInput> = {},
): DesignBlueprintInput {
  return {
    shipId: 'ship_test' as ShipId,
    shipName: 'ISV Test',
    role: ShipRole.Assault,
    sizeVariant: SizeVariant.Standard,
    buildingCorp: makeCorp(1),
    empireBonuses: createEmptyEmpireBonuses(),
    corpSchematics: [],
    homeSectorId: 'sec_test' as SectorId,
    builtTurn: 1 as TurnNumber,
    randFn: midRand,
    ...overrides,
  }
}

/** Creates a schematic fixture targeting a given stat. */
function makeSchematic(statTarget: string, bonusAmount: number): Schematic {
  return {
    id: `sch_${statTarget}` as any,
    name: `Test ${statTarget}`,
    category: SchematicCategory.Armor,
    scienceDomain: ScienceSectorType.Materials,
    level: 1,
    statTarget,
    bonusAmount,
    randomModifier: 0,
    iteration: 1,
    ownerCorpId: 'corp_test' as CorpId,
    sourceDiscoveryId: 'dsc_test' as any,
  }
}

// ─── Stat Formula Tests ───────────────────────────────────────────────────────

describe('designBlueprint — stat formula', () => {
  /**
   * Assault role base stats: { size:6, speed:3, firepower:7, armor:6, sensors:3, evasion:2 }
   * At corp level 1 with midRand (×1.0) and no tech/schematic bonuses:
   *   corp_modifier = 0.7 + 1 × 0.06 = 0.76
   *   firepower: floor(7 × 0.76) = floor(5.32) = 5
   *   armor:     floor(6 × 0.76) = floor(4.56) = 4
   *   final      = floor(stat × 1.0) = stat
   */
  it('applies corp_modifier = 0.7 + level × 0.06 at corp level 1', () => {
    const ship = designBlueprint(makeInput({ buildingCorp: makeCorp(1) }))
    // firepower: floor(floor(7 × 0.76) × 1.0) = floor(5) = 5
    expect(ship.primaryStats.firepower).toBe(5)
    // armor: floor(floor(6 × 0.76) × 1.0) = floor(4) = 4
    expect(ship.primaryStats.armor).toBe(4)
  })

  it('applies correct corp_modifier at corp level 5', () => {
    // corp_modifier = 0.7 + 5 × 0.06 = 1.0
    // firepower: floor(floor(7 × 1.0) × 1.0) = 7
    // armor:     floor(floor(6 × 1.0) × 1.0) = 6
    const ship = designBlueprint(makeInput({ buildingCorp: makeCorp(5) }))
    expect(ship.primaryStats.firepower).toBe(7)
    expect(ship.primaryStats.armor).toBe(6)
  })

  it('applies correct corp_modifier at corp level 10', () => {
    // corp_modifier = 0.7 + 10 × 0.06 = 1.3
    // firepower: floor(floor(7 × 1.3) × 1.0) = floor(9.1) = 9
    // armor:     floor(floor(6 × 1.3) × 1.0) = floor(7.8) = 7
    const ship = designBlueprint(makeInput({ buildingCorp: makeCorp(10) }))
    expect(ship.primaryStats.firepower).toBe(9)
    expect(ship.primaryStats.armor).toBe(7)
  })
})

// ─── Tech Bonus Additive Effect ──────────────────────────────────────────────

describe('designBlueprint — empire tech bonus additive effect', () => {
  it('adds tech bonus to role base before corp scaling', () => {
    const empireWith2Firepower = createEmptyEmpireBonuses()
    empireWith2Firepower.shipStats.firepower = 2

    // At level 5 (corp_modifier = 1.0), midRand:
    // firepower: floor((7+2) × 1.0) × 1.0 = 9
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      empireBonuses: empireWith2Firepower,
    }))
    expect(ship.primaryStats.firepower).toBe(9)
  })

  it('tech bonus stacks additively before corp scaling', () => {
    const techBonuses = createEmptyEmpireBonuses()
    techBonuses.shipStats.speed = 3

    // Assault role speed base = 3, +3 tech = 6
    // At corp level 5 (modifier 1.0): floor(6 × 1.0) × 1.0 = 6
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      empireBonuses: techBonuses,
    }))
    expect(ship.primaryStats.speed).toBe(6)
  })
})

// ─── Size Variant Multiplier ──────────────────────────────────────────────────

describe('designBlueprint — size variant multiplier', () => {
  it('Light variant applies ×0.75 to size stat', () => {
    // Assault base size=6, corp level 5 (modifier 1.0): raw_size = floor(6 × 1.0) × 1.0 = 6
    // Light: floor(6 × 0.75) = floor(4.5) = 4
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      sizeVariant: SizeVariant.Light,
    }))
    expect(ship.primaryStats.size).toBe(4)
  })

  it('Heavy variant applies ×1.25 to size stat', () => {
    // raw_size = 6, Heavy: floor(6 × 1.25) = floor(7.5) = 7
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      sizeVariant: SizeVariant.Heavy,
    }))
    expect(ship.primaryStats.size).toBe(7)
  })

  it('Standard variant leaves size stat unchanged', () => {
    const ship = designBlueprint(makeInput({ buildingCorp: makeCorp(5) }))
    expect(ship.primaryStats.size).toBe(6)
  })

  it('Light variant applies ×0.75 to bp_per_turn', () => {
    // raw_size=6, base_bp = max(1, floor(6/3)) = max(1,2) = 2
    // Light: max(1, floor(2 × 0.75)) = max(1, floor(1.5)) = max(1,1) = 1
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      sizeVariant: SizeVariant.Light,
    }))
    expect(ship.derivedStats.bpPerTurn).toBe(1)
  })

  it('Heavy variant applies ×1.25 to bp_per_turn', () => {
    // raw_size=6, base_bp = 2; Heavy: max(1, floor(2 × 1.25)) = max(1,2) = 2
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      sizeVariant: SizeVariant.Heavy,
    }))
    expect(ship.derivedStats.bpPerTurn).toBe(2)
  })

  it('Light variant applies ×0.75 to build_time', () => {
    // raw_size=6, base_time = max(3, floor(6×1)) = 6
    // Light: max(1, floor(6 × 0.75)) = max(1, 4) = 4
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      sizeVariant: SizeVariant.Light,
    }))
    expect(ship.derivedStats.buildTimeTurns).toBe(4)
  })

  it('Heavy variant applies ×1.25 to build_time', () => {
    // raw_size=6, base_time=6; Heavy: max(1, floor(6 × 1.25)) = max(1,7) = 7
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      sizeVariant: SizeVariant.Heavy,
    }))
    expect(ship.derivedStats.buildTimeTurns).toBe(7)
  })
})

// ─── Schematic Bonus Stacking ─────────────────────────────────────────────────

describe('designBlueprint — schematic bonus stacking', () => {
  it('schematic bonus is added after corp scaling before random', () => {
    // corp level 5, Assault firepower base=7, modifier=1.0
    // after corp: floor(7 × 1.0) = 7
    // +2 schematic → 9
    // with midRand ×1.0: floor(9 × 1.0) = 9
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      corpSchematics: [makeSchematic('firepower', 2)],
    }))
    expect(ship.primaryStats.firepower).toBe(9)
  })

  it('multiple schematics targeting the same stat stack additively', () => {
    // firepower: 7 after corp, +2 +1 = +3 total → 10, midRand: 10
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      corpSchematics: [
        makeSchematic('firepower', 2),
        makeSchematic('firepower', 1),
      ],
    }))
    expect(ship.primaryStats.firepower).toBe(10)
  })

  it('schematics on different stats do not cross-contaminate', () => {
    // +2 armor, 0 firepower bonus
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      corpSchematics: [makeSchematic('armor', 2)],
    }))
    expect(ship.primaryStats.firepower).toBe(7) // no schematic bonus
    expect(ship.primaryStats.armor).toBe(8) // base 6 + schematic 2
  })
})

// ─── Randomness Bounds ────────────────────────────────────────────────────────

describe('designBlueprint — randomness bounded to [0.8, 1.2]', () => {
  it('min random (×0.8) produces lower stats', () => {
    const shipMin = designBlueprint(makeInput({ buildingCorp: makeCorp(5), randFn: minRand }))
    const shipMid = designBlueprint(makeInput({ buildingCorp: makeCorp(5), randFn: midRand }))
    // Firepower at level 5: 7 base × 1.0 corp = 7
    // min ×0.8 = floor(7 × 0.8) = 5
    // mid ×1.0 = floor(7 × 1.0) = 7
    expect(shipMin.primaryStats.firepower).toBeLessThan(shipMid.primaryStats.firepower)
    expect(shipMin.primaryStats.firepower).toBe(5)
  })

  it('max random (×1.2) produces higher stats', () => {
    const shipMax = designBlueprint(makeInput({ buildingCorp: makeCorp(5), randFn: maxRand }))
    const shipMid = designBlueprint(makeInput({ buildingCorp: makeCorp(5), randFn: midRand }))
    // max ×1.2 = floor(7 × 1.2) = floor(8.4) = 8
    expect(shipMax.primaryStats.firepower).toBeGreaterThan(shipMid.primaryStats.firepower)
    expect(shipMax.primaryStats.firepower).toBe(8)
  })

  it('stats are never negative even at minimum roll with low base', () => {
    // Recon role: firepower base=1, at level 1 corp (modifier 0.76):
    // floor(1 × 0.76) = 0; with minRand ×0.8: floor(0 × 0.8) = 0
    const ship = designBlueprint(makeInput({
      role: ShipRole.Recon,
      buildingCorp: makeCorp(1),
      randFn: minRand,
    }))
    expect(ship.primaryStats.firepower).toBeGreaterThanOrEqual(0)
  })
})

// ─── Derived Stat Calculations ────────────────────────────────────────────────

describe('designBlueprint — derived stat calculations', () => {
  it('hull_points = size × 5 + armor × 10 + schematic bonuses + role bonuses', () => {
    // Assault, level 5, midRand, Standard variant
    // size=6, armor=6; role hull bonus = 10
    // hull = 6×5 + 6×10 + 0 + 10 = 30 + 60 + 10 = 100
    const ship = designBlueprint(makeInput({ buildingCorp: makeCorp(5) }))
    const { size, armor } = ship.primaryStats
    const expectedHull = size * 5 + armor * 10 + 10 // role bonus = 10
    expect(ship.derivedStats.hullPoints).toBe(expectedHull)
  })

  it('power_projection = floor(size × 1.5) + schematic bonuses + role bonuses', () => {
    // Assault role: derivedStatBonuses.powerProjection = 3
    // size=6: floor(6 × 1.5) = 9; +3 role = 12
    const ship = designBlueprint(makeInput({ buildingCorp: makeCorp(5) }))
    const { size } = ship.primaryStats
    const expectedPP = Math.floor(size * 1.5) + 3
    expect(ship.derivedStats.powerProjection).toBe(expectedPP)
  })

  it('hull_points schematic bonus is added correctly', () => {
    const ship = designBlueprint(makeInput({
      buildingCorp: makeCorp(5),
      corpSchematics: [makeSchematic('hullPoints', 20)],
    }))
    const { size, armor } = ship.primaryStats
    expect(ship.derivedStats.hullPoints).toBe(size * 5 + armor * 10 + 10 + 20)
  })

  it('bp_per_turn uses raw size (before variant) with max(1,...)', () => {
    // Recon base size=2, level 5 (modifier 1.0), midRand: raw_size=2
    // bp = max(1, floor(2/3)) = max(1,0) = 1
    const ship = designBlueprint(makeInput({
      role: ShipRole.Recon,
      buildingCorp: makeCorp(5),
    }))
    expect(ship.derivedStats.bpPerTurn).toBe(1)
  })

  it('base_build_time uses raw size with max(3,...)', () => {
    // Recon base size=2, level 5, midRand: raw_size=2
    // build_time = max(3, floor(2×1)) = max(3,2) = 3
    const ship = designBlueprint(makeInput({
      role: ShipRole.Recon,
      buildingCorp: makeCorp(5),
    }))
    expect(ship.derivedStats.buildTimeTurns).toBe(3)
  })
})

// ─── Ability Score Calculations ───────────────────────────────────────────────

describe('calculateShipAbilities', () => {
  it('calculates Fight ability correctly', () => {
    const stats = { size: 6, speed: 3, firepower: 7, armor: 6, sensors: 3, evasion: 2 }
    const abilities = calculateShipAbilities(stats)
    // Fight = floor((7 + floor(6 × 0.75) + floor(2 × 0.5)) × 6 / 2)
    //       = floor((7 + 4 + 1) × 3)
    //       = floor(36) = 36
    expect(abilities.fight).toBe(36)
  })

  it('calculates Investigation ability correctly', () => {
    const stats = { size: 6, speed: 3, firepower: 7, armor: 6, sensors: 3, evasion: 2 }
    const abilities = calculateShipAbilities(stats)
    // Investigation = floor((floor(3 × 0.75) + 3) × 6 / 2)
    //               = floor((2 + 3) × 3)
    //               = floor(15) = 15
    expect(abilities.investigation).toBe(15)
  })

  it('calculates Support ability correctly', () => {
    const stats = { size: 6, speed: 3, firepower: 7, armor: 6, sensors: 3, evasion: 2 }
    const abilities = calculateShipAbilities(stats)
    // Support = floor((floor(7 × 0.5) + floor(3 × 0.75)) × 6 / 2)
    //         = floor((3 + 2) × 3)
    //         = floor(15) = 15
    expect(abilities.support).toBe(15)
  })

  it('abilities are zero when size is zero', () => {
    const stats = { size: 0, speed: 3, firepower: 7, armor: 6, sensors: 3, evasion: 2 }
    const abilities = calculateShipAbilities(stats)
    expect(abilities.fight).toBe(0)
    expect(abilities.investigation).toBe(0)
    expect(abilities.support).toBe(0)
  })

  it('designBlueprint wires ability scores into the returned ship', () => {
    const ship = designBlueprint(makeInput({ buildingCorp: makeCorp(5) }))
    const derived = calculateShipAbilities(ship.primaryStats)
    expect(ship.abilities.fight).toBe(derived.fight)
    expect(ship.abilities.investigation).toBe(derived.investigation)
    expect(ship.abilities.support).toBe(derived.support)
  })
})

// ─── Ship Object Completeness ─────────────────────────────────────────────────

describe('designBlueprint — returned Ship object', () => {
  it('starts at 100% condition', () => {
    const ship = designBlueprint(makeInput())
    expect(ship.condition).toBe(100)
  })

  it('status is UnderConstruction', () => {
    const ship = designBlueprint(makeInput())
    expect(ship.status).toBe(ShipStatus.UnderConstruction)
  })

  it('captain starts at Green experience', () => {
    const ship = designBlueprint(makeInput())
    expect(ship.captain.experience).toBe(CaptainExperience.Green)
  })

  it('service record has correct builtByCorpId and builtTurn', () => {
    const ship = designBlueprint(makeInput())
    expect(ship.serviceRecord.builtByCorpId).toBe('corp_test')
    expect(ship.serviceRecord.builtTurn).toBe(1)
    expect(ship.serviceRecord.destroyed).toBe(false)
  })

  it('appliedSchematicIds contains passed schematic IDs', () => {
    const schematics = [makeSchematic('armor', 2), makeSchematic('firepower', 1)]
    const ship = designBlueprint(makeInput({ corpSchematics: schematics }))
    expect(ship.appliedSchematicIds).toContain('sch_armor')
    expect(ship.appliedSchematicIds).toContain('sch_firepower')
  })

  it('sizeVariant is preserved on the ship', () => {
    const ship = designBlueprint(makeInput({ sizeVariant: SizeVariant.Heavy }))
    expect(ship.sizeVariant).toBe(SizeVariant.Heavy)
  })

  it('role is preserved on the ship', () => {
    const ship = designBlueprint(makeInput({ role: ShipRole.Recon }))
    expect(ship.role).toBe(ShipRole.Recon)
  })
})
