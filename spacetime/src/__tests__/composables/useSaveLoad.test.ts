/**
 * useSaveLoad.test.ts — Unit tests for the save/load composable (Story 18.2).
 *
 * Tests LocalStorage multi-slot save/load, autosave, JSON export/import.
 * Uses jsdom's localStorage mock via vitest.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSaveLoad } from '../../composables/useSaveLoad'
import { serializeGameState, SAVE_VERSION } from '../../utils/save'
import type { GameState } from '../../types/game'
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
import type { Colony } from '../../types/colony'
import type { Planet } from '../../types/planet'
import type { Sector, Galaxy } from '../../types/sector'
import type { BudgetState } from '../../types/budget'
import type { SectorMarketState } from '../../types/trade'
import type { InfraState, ColonyInfrastructure } from '../../types/infrastructure'
import { createEmptyEmpireBonuses } from '../../types/empire'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SECTOR_ID = 'sec_sl0001' as SectorId
const PLANET_ID = 'pln_sl0001' as PlanetId
const COLONY_ID = 'col_sl0001' as ColonyId

function makeInfraState(domain: InfraDomain): InfraState {
  return { domain, ownership: { publicLevels: 0, corporateLevels: new Map() }, currentCap: Infinity }
}

function makeInfra(): ColonyInfrastructure {
  const result = {} as ColonyInfrastructure
  for (const domain of Object.values(InfraDomain)) result[domain] = makeInfraState(domain)
  return result
}

function makeColony(): Colony {
  return {
    id: COLONY_ID, planetId: PLANET_ID, sectorId: SECTOR_ID, name: 'Arcadia',
    type: ColonyType.FrontierColony, populationLevel: 5,
    attributes: { habitability: 7, accessibility: 4, dynamism: 6, qualityOfLife: 5, stability: 8, growth: 0 },
    infrastructure: makeInfra(), corporationsPresent: [], modifiers: [], foundedTurn: 1 as TurnNumber,
  }
}

function makePlanet(): Planet {
  return {
    id: PLANET_ID, name: 'Arcadia Prime', sectorId: SECTOR_ID,
    type: PlanetType.Continental, size: PlanetSize.Large, status: PlanetStatus.Colonized,
    baseHabitability: 7, deposits: [], features: [], featureModifiers: [],
    orbitScanTurn: 1, groundSurveyTurn: 1,
  }
}

function makeGalaxy(): Galaxy {
  const sectors = new Map<SectorId, Sector>()
  sectors.set(SECTOR_ID, {
    id: SECTOR_ID, name: 'Core', density: SectorDensity.Moderate,
    explorationPercent: 20, threatModifier: 1.0, firstEnteredTurn: 1 as TurnNumber,
  })
  const adjacency = new Map<SectorId, SectorId[]>()
  adjacency.set(SECTOR_ID, [])
  return { sectors, adjacency, startingSectorId: SECTOR_ID }
}

function makeZeroResources(): Record<ResourceType, number> {
  return Object.values(ResourceType).reduce((acc, r) => ({ ...acc, [r]: 0 }), {} as Record<ResourceType, number>)
}

function makeSectorMarket(): SectorMarketState {
  return {
    sectorId: SECTOR_ID,
    totalProduction: makeZeroResources(), totalConsumption: makeZeroResources(),
    netSurplus: makeZeroResources(), inboundFlows: [], outboundFlows: [],
  }
}

function makeBudget(): BudgetState {
  return {
    currentBP: 50 as BPAmount, incomeSources: [], expenseEntries: [],
    totalIncome: 0 as BPAmount, totalExpenses: 0 as BPAmount, netBP: 50 as BPAmount,
    debtTokens: 0, stabilityMalus: 0, calculatedTurn: 1 as TurnNumber,
  }
}

function makeState(turn = 3): GameState {
  const colonies = new Map<string, Colony>([[COLONY_ID, makeColony()]])
  const planets = new Map<string, Planet>([[PLANET_ID, makePlanet()]])
  const sectorMarkets = new Map<string, SectorMarketState>([[SECTOR_ID, makeSectorMarket()]])
  return {
    turn: turn as TurnNumber, phase: 'player_action',
    currentBP: 50 as BPAmount, debtTokens: 1,
    budget: makeBudget(), empireBonuses: createEmptyEmpireBonuses(),
    galaxy: makeGalaxy(), colonies, planets,
    corporations: new Map(), contracts: new Map(), ships: new Map(), missions: new Map(),
    scienceDomains: new Map(), discoveries: new Map(), schematics: new Map(), patents: new Map(),
    sectorMarkets, tradeRoutes: [], events: [],
    startedAt: '2026-01-01T00:00:00.000Z', lastSavedAt: '2026-01-01T00:00:00.000Z',
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
})

describe('useSaveLoad — autosave', () => {
  it('writes to autosave key in localStorage', () => {
    const { autosave } = useSaveLoad()
    autosave(makeState())
    expect(localStorage.getItem('spacetime_save_auto')).not.toBeNull()
  })

  it('stored JSON includes correct turn number', () => {
    const { autosave } = useSaveLoad()
    autosave(makeState(7))
    const raw = localStorage.getItem('spacetime_save_auto')!
    const parsed = JSON.parse(raw)
    expect(parsed.gameState.turn).toBe(7)
  })
})

describe('useSaveLoad — slotList', () => {
  it('returns 4 slots (autosave + 3 manual)', () => {
    const { slotList } = useSaveLoad()
    expect(slotList.value.length).toBe(4)
  })

  it('empty slots are not occupied', () => {
    const { slotList } = useSaveLoad()
    expect(slotList.value.every(s => !s.occupied)).toBe(true)
  })

  it('autosave slot is occupied after autosave', () => {
    const { autosave, slotList } = useSaveLoad()
    autosave(makeState(5))
    const autoSlot = slotList.value.find(s => s.slot === 'auto')!
    expect(autoSlot.occupied).toBe(true)
    expect(autoSlot.turn).toBe(5)
  })
})

describe('useSaveLoad — saveToSlot / loadFromSlot', () => {
  it('saves to and loads from slot 0', () => {
    const { saveToSlot, loadFromSlot } = useSaveLoad()
    const state = makeState(10)
    const ok = saveToSlot(0, state)
    expect(ok).toBe(true)
    const loaded = loadFromSlot(0)
    expect(loaded).not.toBeNull()
    expect(loaded!.turn).toBe(10)
  })

  it('loaded state has Maps restored', () => {
    const { saveToSlot, loadFromSlot } = useSaveLoad()
    saveToSlot(1, makeState())
    const loaded = loadFromSlot(1)!
    expect(loaded.colonies).toBeInstanceOf(Map)
    expect(loaded.planets).toBeInstanceOf(Map)
  })

  it('sets successMessage on successful save', () => {
    const { saveToSlot, successMessage } = useSaveLoad()
    saveToSlot(0, makeState())
    expect(successMessage.value).toContain('Slot 1')
  })

  it('returns null and sets errorMessage when slot is empty', () => {
    const { loadFromSlot, errorMessage } = useSaveLoad()
    const result = loadFromSlot(2)
    expect(result).toBeNull()
    expect(errorMessage.value).not.toBeNull()
  })

  it('rejects invalid slot numbers', () => {
    const { saveToSlot, errorMessage } = useSaveLoad()
    const ok = saveToSlot(-1, makeState())
    expect(ok).toBe(false)
    expect(errorMessage.value).toContain('Invalid slot')
  })

  it('saves all 3 manual slots independently', () => {
    const { saveToSlot, slotList } = useSaveLoad()
    saveToSlot(0, makeState(2))
    saveToSlot(1, makeState(4))
    saveToSlot(2, makeState(6))
    const turns = slotList.value.filter(s => s.slot !== 'auto').map(s => s.turn)
    expect(turns).toEqual([2, 4, 6])
  })
})

describe('useSaveLoad — deleteSlot', () => {
  it('removes slot data from localStorage', () => {
    const { saveToSlot, deleteSlot, loadFromSlot } = useSaveLoad()
    saveToSlot(0, makeState())
    deleteSlot(0)
    const result = loadFromSlot(0)
    expect(result).toBeNull()
  })
})

describe('useSaveLoad — importFromJson', () => {
  it('rejects null FileList', async () => {
    const { importFromJson, errorMessage } = useSaveLoad()
    const result = await importFromJson(null)
    expect(result).toBeNull()
    expect(errorMessage.value).not.toBeNull()
  })

  it('rejects JSON with wrong version', async () => {
    const { importFromJson, errorMessage } = useSaveLoad()
    const badJson = JSON.stringify({ version: 999, timestamp: new Date().toISOString(), gameState: {} })
    const file = new File([badJson], 'save.json', { type: 'application/json' })
    const list = { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) } as unknown as FileList
    const result = await importFromJson(list)
    expect(result).toBeNull()
    expect(errorMessage.value).toContain('version')
  })

  it('successfully imports a valid save JSON', async () => {
    const { importFromJson } = useSaveLoad()
    const state = makeState(8)
    const json = serializeGameState(state)
    const file = new File([json], 'save.json', { type: 'application/json' })
    const list = { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) } as unknown as FileList
    const result = await importFromJson(list)
    expect(result).not.toBeNull()
    expect(result!.turn).toBe(8)
  })
})
