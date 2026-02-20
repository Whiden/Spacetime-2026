/**
 * save.test.ts — Unit tests for game state serialization (Story 18.1).
 *
 * Acceptance criteria:
 * - serializeGameState → valid JSON string with version + timestamp
 * - deserializeGameState → typed GameState with Maps restored
 * - Round-trip: serialize → deserialize → deep equal original
 * - Invalid JSON throws descriptive error
 * - Missing fields throw descriptive error
 * - Wrong version throws descriptive error
 */

import { describe, it, expect } from 'vitest'
import { serializeGameState, deserializeGameState, SAVE_VERSION } from '../../utils/save'
import type { GameState } from '../../types/game'
import type { Colony } from '../../types/colony'
import type { Planet } from '../../types/planet'
import type { SectorMarketState } from '../../types/trade'
import {
  ColonyType,
  PlanetType,
  PlanetSize,
  PlanetStatus,
  InfraDomain,
  ResourceType,
  SectorDensity,
} from '../../types/common'
import type { TurnNumber, BPAmount, ColonyId, PlanetId, SectorId } from '../../types/common'
import type { InfraState, ColonyInfrastructure } from '../../types/infrastructure'
import type { Sector, Galaxy } from '../../types/sector'
import type { BudgetState } from '../../types/budget'
import { createEmptyEmpireBonuses } from '../../types/empire'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SECTOR_ID = 'sec_sv0001' as SectorId
const PLANET_ID = 'pln_sv0001' as PlanetId
const COLONY_ID = 'col_sv0001' as ColonyId

function makeInfraState(domain: InfraDomain, publicLevels = 0): InfraState {
  return {
    domain,
    ownership: { publicLevels, corporateLevels: new Map() },
    currentCap: Infinity,
  }
}

function makeInfra(): ColonyInfrastructure {
  const result = {} as ColonyInfrastructure
  for (const domain of Object.values(InfraDomain)) {
    result[domain] = makeInfraState(domain, 0)
  }
  return result
}

function makeColony(): Colony {
  return {
    id: COLONY_ID,
    planetId: PLANET_ID,
    sectorId: SECTOR_ID,
    name: 'Arcadia',
    type: ColonyType.FrontierColony,
    populationLevel: 5,
    attributes: {
      habitability: 7,
      accessibility: 4,
      dynamism: 6,
      qualityOfLife: 5,
      stability: 8,
      growth: 0,
    },
    infrastructure: makeInfra(),
    corporationsPresent: [],
    modifiers: [],
    foundedTurn: 1 as TurnNumber,
  }
}

function makePlanet(): Planet {
  return {
    id: PLANET_ID,
    name: 'Arcadia Prime',
    sectorId: SECTOR_ID,
    type: PlanetType.Continental,
    size: PlanetSize.Large,
    status: PlanetStatus.Colonized,
    baseHabitability: 7,
    deposits: [],
    features: [],
    featureModifiers: [],
    orbitScanTurn: 1,
    groundSurveyTurn: 1,
  }
}

function makeSector(): Sector {
  return {
    id: SECTOR_ID,
    name: 'Core Sector',
    density: SectorDensity.Moderate,
    explorationPercent: 20,
    threatModifier: 1.0,
    firstEnteredTurn: 1 as TurnNumber,
  }
}

function makeGalaxy(): Galaxy {
  const sectors = new Map<SectorId, Sector>()
  sectors.set(SECTOR_ID, makeSector())
  const adjacency = new Map<SectorId, SectorId[]>()
  adjacency.set(SECTOR_ID, [])
  return { sectors, adjacency, startingSectorId: SECTOR_ID }
}

function makeZeroResourceRecord(): Record<ResourceType, number> {
  return Object.values(ResourceType).reduce(
    (acc, r) => ({ ...acc, [r]: 0 }),
    {} as Record<ResourceType, number>,
  )
}

function makeSectorMarket(): SectorMarketState {
  return {
    sectorId: SECTOR_ID,
    totalProduction: makeZeroResourceRecord(),
    totalConsumption: makeZeroResourceRecord(),
    netSurplus: makeZeroResourceRecord(),
    inboundFlows: [],
    outboundFlows: [],
  }
}

function makeBudget(): BudgetState {
  return {
    currentBP: 50 as BPAmount,
    incomeSources: [],
    expenseEntries: [],
    totalIncome: 0 as BPAmount,
    totalExpenses: 0 as BPAmount,
    netBP: 50 as BPAmount,
    debtTokens: 0,
    stabilityMalus: 0,
    calculatedTurn: 1 as TurnNumber,
  }
}

function makeMinimalState(): GameState {
  const colonies = new Map<string, Colony>()
  colonies.set(COLONY_ID, makeColony())

  const planets = new Map<string, Planet>()
  planets.set(PLANET_ID, makePlanet())

  const sectorMarkets = new Map<string, SectorMarketState>()
  sectorMarkets.set(SECTOR_ID, makeSectorMarket())

  return {
    turn: 3 as TurnNumber,
    phase: 'player_action',
    currentBP: 50 as BPAmount,
    debtTokens: 1,
    budget: makeBudget(),
    empireBonuses: createEmptyEmpireBonuses(),
    galaxy: makeGalaxy(),
    colonies,
    planets,
    corporations: new Map(),
    contracts: new Map(),
    ships: new Map(),
    missions: new Map(),
    scienceDomains: new Map(),
    discoveries: new Map(),
    schematics: new Map(),
    patents: new Map(),
    sectorMarkets,
    tradeRoutes: [],
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('serializeGameState', () => {
  it('returns a valid JSON string', () => {
    const state = makeMinimalState()
    const json = serializeGameState(state)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('includes version number', () => {
    const parsed = JSON.parse(serializeGameState(makeMinimalState()))
    expect(parsed.version).toBe(SAVE_VERSION)
  })

  it('includes an ISO timestamp', () => {
    const parsed = JSON.parse(serializeGameState(makeMinimalState()))
    expect(typeof parsed.timestamp).toBe('string')
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp)
  })

  it('serializes Maps as plain objects', () => {
    const state = makeMinimalState()
    const parsed = JSON.parse(serializeGameState(state))
    const gs = parsed.gameState
    expect(gs.colonies).not.toBeInstanceOf(Map)
    expect(typeof gs.colonies).toBe('object')
    expect(gs.colonies[COLONY_ID]).toBeDefined()
  })

  it('preserves scalar fields', () => {
    const state = makeMinimalState()
    const parsed = JSON.parse(serializeGameState(state))
    const gs = parsed.gameState
    expect(gs.turn).toBe(3)
    expect(gs.currentBP).toBe(50)
    expect(gs.debtTokens).toBe(1)
    expect(gs.phase).toBe('player_action')
  })
})

describe('deserializeGameState', () => {
  it('restores Map fields as Map instances', () => {
    const state = makeMinimalState()
    const restored = deserializeGameState(serializeGameState(state))
    expect(restored.colonies).toBeInstanceOf(Map)
    expect(restored.planets).toBeInstanceOf(Map)
    expect(restored.corporations).toBeInstanceOf(Map)
    expect(restored.sectorMarkets).toBeInstanceOf(Map)
  })

  it('throws on invalid JSON', () => {
    expect(() => deserializeGameState('not json')).toThrow('Invalid save file: JSON parse failed')
  })

  it('throws when required fields are missing', () => {
    expect(() => deserializeGameState('{}')).toThrow('Invalid save file: missing required fields')
  })

  it('throws on wrong version', () => {
    const raw = JSON.parse(serializeGameState(makeMinimalState()))
    raw.version = 999
    expect(() => deserializeGameState(JSON.stringify(raw))).toThrow('Unsupported save version')
  })
})

describe('round-trip serialization', () => {
  it('preserves turn number, BP, and debtTokens', () => {
    const state = makeMinimalState()
    const restored = deserializeGameState(serializeGameState(state))
    expect(restored.turn).toBe(state.turn)
    expect(restored.currentBP).toBe(state.currentBP)
    expect(restored.debtTokens).toBe(state.debtTokens)
  })

  it('preserves colony data with correct ID', () => {
    const state = makeMinimalState()
    const restored = deserializeGameState(serializeGameState(state))
    expect(restored.colonies.has(COLONY_ID)).toBe(true)
    const colony = restored.colonies.get(COLONY_ID)!
    expect(colony.name).toBe('Arcadia')
    expect(colony.populationLevel).toBe(5)
  })

  it('preserves planet data', () => {
    const state = makeMinimalState()
    const restored = deserializeGameState(serializeGameState(state))
    expect(restored.planets.has(PLANET_ID)).toBe(true)
    const planet = restored.planets.get(PLANET_ID)!
    expect(planet.name).toBe('Arcadia Prime')
    expect(planet.type).toBe(PlanetType.Continental)
  })

  it('preserves empty Maps as empty Maps', () => {
    const state = makeMinimalState()
    const restored = deserializeGameState(serializeGameState(state))
    expect(restored.corporations).toBeInstanceOf(Map)
    expect(restored.corporations.size).toBe(0)
    expect(restored.ships).toBeInstanceOf(Map)
    expect(restored.ships.size).toBe(0)
  })

  it('preserves galaxy sector data', () => {
    const state = makeMinimalState()
    const restored = deserializeGameState(serializeGameState(state))
    expect(restored.galaxy.startingSectorId).toBe(SECTOR_ID)
  })

  it('preserves tradeRoutes and events arrays', () => {
    const state = makeMinimalState()
    const restored = deserializeGameState(serializeGameState(state))
    expect(Array.isArray(restored.tradeRoutes)).toBe(true)
    expect(Array.isArray(restored.events)).toBe(true)
  })

  it('preserves empireBonuses structure', () => {
    const state = makeMinimalState()
    const restored = deserializeGameState(serializeGameState(state))
    expect(typeof restored.empireBonuses.shipStats).toBe('object')
    expect(typeof restored.empireBonuses.infraCaps).toBe('object')
  })

  it('preserves sectorMarkets keyed by sectorId', () => {
    const state = makeMinimalState()
    const restored = deserializeGameState(serializeGameState(state))
    expect(restored.sectorMarkets.has(SECTOR_ID)).toBe(true)
  })
})
