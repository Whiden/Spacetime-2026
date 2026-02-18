/**
 * invest-planet.test.ts — Unit tests for the player investment action.
 *
 * Covers (Story 8.3 acceptance criteria):
 * - Valid investment: colony below cap, player has 3+ BP, public levels increment
 * - Insufficient BP: player has < 3 BP → INSUFFICIENT_BP error
 * - At population cap: industry domain at popLevel × 2 → AT_CAP error
 * - At deposit cap: extraction domain at richness cap → AT_CAP error
 * - No matching deposit: extraction domain, no deposit on planet → NO_MATCHING_DEPOSIT error
 * - Colony not found: ID not in colonies map → COLONY_NOT_FOUND error
 * - Investment returns updated colony with +1 public level on target domain only
 * - Other domains unaffected by the investment
 * - bpSpent always equals INVEST_COST_BP (3) on success
 */

import { describe, it, expect } from 'vitest'
import { investPlanet, INVEST_COST_BP } from '../../../engine/actions/invest-planet'
import type { Colony } from '../../../types/colony'
import type { Deposit } from '../../../types/planet'
import type { InfraState, ColonyInfrastructure } from '../../../types/infrastructure'
import type { ColonyId, PlanetId, SectorId, TurnNumber, BPAmount } from '../../../types/common'
import {
  InfraDomain,
  DepositType,
  RichnessLevel,
  ColonyType,
} from '../../../types/common'

// ─── Test Constants ───────────────────────────────────────────────────────────

const COLONY_ID = 'col_invest01' as ColonyId
const PLANET_ID = 'pln_invest01' as PlanetId
const SECTOR_ID = 'sec_invest01' as SectorId
const TURN_1 = 1 as TurnNumber

const BP_ENOUGH = 10 as BPAmount  // 10 BP → plenty for investment
const BP_ZERO   = 0 as BPAmount
const BP_TWO    = 2 as BPAmount   // 1 less than required (3)

// ─── Fixture Helpers ──────────────────────────────────────────────────────────

function makeInfraState(domain: InfraDomain, publicLevels: number): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: Infinity, // currentCap is Infinity everywhere until Story 10.1
  }
}

function makeInfra(overrides: Partial<Record<InfraDomain, number>> = {}): ColonyInfrastructure {
  const domains = Object.values(InfraDomain)
  const result = {} as ColonyInfrastructure
  for (const domain of domains) {
    result[domain] = makeInfraState(domain, overrides[domain] ?? 0)
  }
  return result
}

function makeColony(
  infra: ColonyInfrastructure,
  populationLevel = 5,
): Colony {
  return {
    id: COLONY_ID,
    planetId: PLANET_ID,
    sectorId: SECTOR_ID,
    name: 'Invest Test Colony',
    type: ColonyType.FrontierColony,
    populationLevel,
    attributes: {
      habitability: 8,
      accessibility: 5,
      dynamism: 5,
      qualityOfLife: 8,
      stability: 8,
      growth: 0,
    },
    infrastructure: infra,
    corporationsPresent: [],
    modifiers: [],
    foundedTurn: TURN_1,
  }
}

function makeColoniesMap(colony: Colony): Map<string, Colony> {
  return new Map([[colony.id, colony]])
}

function makeFoodDeposit(richness = RichnessLevel.Rich): Deposit {
  return { type: DepositType.FertileGround, richness, richnessRevealed: true }
}

function makeOreDeposit(richness = RichnessLevel.Moderate): Deposit {
  return { type: DepositType.CommonOreVein, richness, richnessRevealed: true }
}

// ─── Colony Not Found ─────────────────────────────────────────────────────────

describe('investPlanet — COLONY_NOT_FOUND', () => {
  it('returns COLONY_NOT_FOUND when colony ID is not in the map', () => {
    const result = investPlanet({
      colonyId: 'col_missing' as ColonyId,
      domain: InfraDomain.Mining,
      currentBP: BP_ENOUGH,
      colonies: new Map(),
      deposits: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('COLONY_NOT_FOUND')
    }
  })
})

// ─── Insufficient BP ──────────────────────────────────────────────────────────

describe('investPlanet — INSUFFICIENT_BP', () => {
  it('returns INSUFFICIENT_BP when player has 0 BP', () => {
    const colony = makeColony(makeInfra())
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Transport,
      currentBP: BP_ZERO,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('INSUFFICIENT_BP')
  })

  it('returns INSUFFICIENT_BP when player has 2 BP (1 less than required)', () => {
    const colony = makeColony(makeInfra())
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.LowIndustry,
      currentBP: BP_TWO,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('INSUFFICIENT_BP')
  })

  it('succeeds with exactly 3 BP (the cost)', () => {
    const colony = makeColony(makeInfra(), 5) // popLevel 5 → cap = 10
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Transport,
      currentBP: INVEST_COST_BP,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(true)
  })
})

// ─── No Matching Deposit ──────────────────────────────────────────────────────

describe('investPlanet — NO_MATCHING_DEPOSIT', () => {
  it('returns NO_MATCHING_DEPOSIT for Mining domain with no ore deposit', () => {
    const colony = makeColony(makeInfra({ [InfraDomain.Mining]: 2 }))
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Mining,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [makeFoodDeposit()], // food deposit, not ore
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('NO_MATCHING_DEPOSIT')
  })

  it('returns NO_MATCHING_DEPOSIT for Agricultural domain with no food deposit', () => {
    const colony = makeColony(makeInfra({ [InfraDomain.Agricultural]: 1 }))
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Agricultural,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [makeOreDeposit()], // ore deposit, not food
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('NO_MATCHING_DEPOSIT')
  })

  it('returns NO_MATCHING_DEPOSIT when deposits list is empty', () => {
    const colony = makeColony(makeInfra())
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.DeepMining,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('NO_MATCHING_DEPOSIT')
  })

  it('does NOT require deposit for non-extraction domains', () => {
    const colony = makeColony(makeInfra(), 5)
    // No deposit needed for Transport (not extraction)
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Transport,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [], // empty — fine for non-extraction
    })
    expect(result.success).toBe(true)
  })
})

// ─── At Cap ───────────────────────────────────────────────────────────────────

describe('investPlanet — AT_CAP', () => {
  it('returns AT_CAP when industry domain is at population cap (popLevel × 2)', () => {
    // popLevel=5 → cap=10; transport is already at 10
    const infra = makeInfra({ [InfraDomain.Transport]: 10 })
    const colony = makeColony(infra, 5) // cap = 5 × 2 = 10
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Transport,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('AT_CAP')
  })

  it('returns AT_CAP when extraction domain reaches deposit richness cap (Poor=5)', () => {
    // Poor deposit cap = 5; Mining already at 5
    const infra = makeInfra({ [InfraDomain.Mining]: 5 })
    const colony = makeColony(infra, 5)
    const poorOreDeposit: Deposit = { type: DepositType.CommonOreVein, richness: RichnessLevel.Poor, richnessRevealed: true }
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Mining,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [poorOreDeposit],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('AT_CAP')
  })

  it('returns AT_CAP when extraction domain reaches Moderate deposit cap (10)', () => {
    const infra = makeInfra({ [InfraDomain.Mining]: 10 })
    const colony = makeColony(infra, 10) // popLevel doesn't matter for extraction cap
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Mining,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [makeOreDeposit(RichnessLevel.Moderate)], // cap = 10
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('AT_CAP')
  })

  it('uses highest richness cap when multiple deposits exist for the domain', () => {
    // Two food deposits: Poor (cap 5) and Rich (cap 15). Cap should be 15.
    const infra = makeInfra({ [InfraDomain.Agricultural]: 15 })
    const colony = makeColony(infra, 10)
    const poorFood: Deposit = { type: DepositType.FertileGround, richness: RichnessLevel.Poor, richnessRevealed: true }
    const richFood: Deposit = { type: DepositType.RichOcean, richness: RichnessLevel.Rich, richnessRevealed: true }
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Agricultural,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [poorFood, richFood], // best cap = 15
    })
    // At 15/15 → AT_CAP
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('AT_CAP')
  })

  it('allows investment below deposit cap even with a lower-richness deposit present', () => {
    // Rich deposit cap = 15; Mining at 10 → still below cap → success
    const infra = makeInfra({ [InfraDomain.Agricultural]: 10 })
    const colony = makeColony(infra, 10)
    const richFood: Deposit = { type: DepositType.FertileGround, richness: RichnessLevel.Rich, richnessRevealed: true }
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Agricultural,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [richFood],
    })
    expect(result.success).toBe(true)
  })

  it('Civilian domain is always below cap (uncapped)', () => {
    // Civilian at 100 — still uncapped
    const infra = makeInfra({ [InfraDomain.Civilian]: 100 })
    const colony = makeColony(infra, 5)
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Civilian,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(true)
  })
})

// ─── Valid Investment ─────────────────────────────────────────────────────────

describe('investPlanet — success', () => {
  it('increments public levels by 1 for a non-extraction domain', () => {
    const infra = makeInfra({ [InfraDomain.Transport]: 3 })
    const colony = makeColony(infra, 5) // cap = 10
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Transport,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const newLevel = result.updatedColony.infrastructure[InfraDomain.Transport].ownership.publicLevels
      expect(newLevel).toBe(4) // 3 + 1
    }
  })

  it('increments public levels for an extraction domain with matching deposit', () => {
    const infra = makeInfra({ [InfraDomain.Mining]: 3 })
    const colony = makeColony(infra, 5)
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Mining,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [makeOreDeposit(RichnessLevel.Rich)], // cap = 15; 3 < 15 → ok
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const newLevel = result.updatedColony.infrastructure[InfraDomain.Mining].ownership.publicLevels
      expect(newLevel).toBe(4)
    }
  })

  it('does not affect other domains', () => {
    const infra = makeInfra({
      [InfraDomain.Transport]: 3,
      [InfraDomain.Science]: 2,
      [InfraDomain.Military]: 1,
    })
    const colony = makeColony(infra, 5)
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Transport,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // Only Transport changes
      expect(result.updatedColony.infrastructure[InfraDomain.Transport].ownership.publicLevels).toBe(4)
      // Other domains unchanged
      expect(result.updatedColony.infrastructure[InfraDomain.Science].ownership.publicLevels).toBe(2)
      expect(result.updatedColony.infrastructure[InfraDomain.Military].ownership.publicLevels).toBe(1)
    }
  })

  it('preserves corporate levels when adding public levels', () => {
    const infra = makeInfra({ [InfraDomain.LowIndustry]: 2 })
    // Add corporate ownership manually
    infra[InfraDomain.LowIndustry].ownership.corporateLevels.set('corp_abc' as import('../../../types/common').CorpId, 3)
    const colony = makeColony(infra, 5) // cap = 10; total = 5 < 10
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.LowIndustry,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const state = result.updatedColony.infrastructure[InfraDomain.LowIndustry]
      expect(state.ownership.publicLevels).toBe(3) // 2 + 1
      expect(state.ownership.corporateLevels.get('corp_abc' as import('../../../types/common').CorpId)).toBe(3) // unchanged
    }
  })

  it('bpSpent is always INVEST_COST_BP (3) on success', () => {
    const colony = makeColony(makeInfra(), 5)
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.Civilian,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.bpSpent).toBe(INVEST_COST_BP)
    }
  })

  it('succeeds one below the population cap', () => {
    // popLevel=5 → cap=10; LowIndustry at 9 → one below cap → success
    const infra = makeInfra({ [InfraDomain.LowIndustry]: 9 })
    const colony = makeColony(infra, 5)
    const result = investPlanet({
      colonyId: COLONY_ID,
      domain: InfraDomain.LowIndustry,
      currentBP: BP_ENOUGH,
      colonies: makeColoniesMap(colony),
      deposits: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.updatedColony.infrastructure[InfraDomain.LowIndustry].ownership.publicLevels).toBe(10)
    }
  })
})
