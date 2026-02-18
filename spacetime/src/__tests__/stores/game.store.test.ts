/**
 * game.store.test.ts — Unit tests for the game Pinia store (Story 12.4).
 *
 * Tests cover:
 * - Initial state values
 * - initializeGame(): galaxy generated, Terra Nova created, budget set, 4 corps spawned
 * - getFullGameState(): assembles complete GameState from domain stores
 * - endTurn(): phase transitions, turn increments, state distribution
 * - acknowledgeResults(): now a no-op; reviewing phase removed in playability fix
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGameStore } from '../../stores/game.store'
import { useGalaxyStore } from '../../stores/galaxy.store'
import { useColonyStore } from '../../stores/colony.store'
import { useCorporationStore } from '../../stores/corporation.store'
import { useBudgetStore } from '../../stores/budget.store'
import { CorpType, InfraDomain } from '../../types/common'
import { STARTING_BP } from '../../data/start-conditions'
import { getCorporateLevels } from '../../types/infrastructure'

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setActivePinia(createPinia())
})

// ─── Initial State ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts at turn 1', () => {
    const store = useGameStore()
    expect(store.currentTurn).toBe(1)
  })

  it('starts in player_action phase', () => {
    const store = useGameStore()
    expect(store.gamePhase).toBe('player_action')
  })
})

// ─── initializeGame() ─────────────────────────────────────────────────────────

describe('initializeGame()', () => {
  it('generates galaxy with at least one sector', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const galaxyStore = useGalaxyStore()
    expect(galaxyStore.sectors.size).toBeGreaterThan(0)
    expect(galaxyStore.startingSectorId).not.toBeNull()
  })

  it('creates Terra Nova colony', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const colonyStore = useColonyStore()
    expect(colonyStore.colonyCount).toBe(1)
    expect(colonyStore.allColonies[0]!.name).toBe('Terra Nova')
  })

  it('initializes budget to STARTING_BP', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const budgetStore = useBudgetStore()
    expect(budgetStore.currentBP).toBe(STARTING_BP)
    expect(budgetStore.debtTokens).toBe(0)
  })

  it('spawns exactly 4 starting corporations', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const corpStore = useCorporationStore()
    expect(corpStore.corpCount).toBe(4)
  })

  it('spawns one Exploration corp', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const corpStore = useCorporationStore()
    const explorationCorps = corpStore.getCorpsByType(CorpType.Exploration)
    expect(explorationCorps).toHaveLength(1)
    expect(explorationCorps[0]!.level).toBe(1)
  })

  it('spawns one Construction corp', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const corpStore = useCorporationStore()
    const constructionCorps = corpStore.getCorpsByType(CorpType.Construction)
    expect(constructionCorps).toHaveLength(1)
    expect(constructionCorps[0]!.level).toBe(1)
  })

  it('spawns two Science corps', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const corpStore = useCorporationStore()
    const scienceCorps = corpStore.getCorpsByType(CorpType.Science)
    expect(scienceCorps).toHaveLength(2)
  })

  it('Science corps each own 1 Science infra level in their assets', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const corpStore = useCorporationStore()
    const colonyStore = useColonyStore()
    const scienceCorps = corpStore.getCorpsByType(CorpType.Science)
    const terraNova = colonyStore.allColonies[0]!

    for (const corp of scienceCorps) {
      const holdings = corp.assets.infrastructureByColony.get(terraNova.id)
      expect(holdings).toBeDefined()
      expect(holdings![InfraDomain.Science]).toBe(1)
    }
  })

  it('Terra Nova Science infra has 2 corporate levels and 0 public levels', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const colonyStore = useColonyStore()
    const terraNova = colonyStore.allColonies[0]!
    const scienceInfra = terraNova.infrastructure[InfraDomain.Science]

    // All science levels are corporate-owned (1 per science corp)
    expect(scienceInfra.ownership.publicLevels).toBe(0)
    expect(getCorporateLevels(scienceInfra)).toBe(2)
  })

  it('sets turn to 1', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()
    expect(gameStore.currentTurn).toBe(1)
  })

  it('sets phase to player_action', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()
    expect(gameStore.gamePhase).toBe('player_action')
  })

  it('all starting corps are level 1', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const corpStore = useCorporationStore()
    for (const corp of corpStore.allCorporations) {
      expect(corp.level).toBe(1)
    }
  })

  it('all starting corps are founded on Terra Nova', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const corpStore = useCorporationStore()
    const colonyStore = useColonyStore()
    const terraNova = colonyStore.allColonies[0]!

    for (const corp of corpStore.allCorporations) {
      expect(corp.homePlanetId).toBe(terraNova.planetId)
    }
  })
})

// ─── getFullGameState() ───────────────────────────────────────────────────────

describe('getFullGameState()', () => {
  it('returns a GameState with turn 1 after init', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const state = gameStore.getFullGameState()
    expect(state.turn).toBe(1)
  })

  it('includes Terra Nova colony', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const state = gameStore.getFullGameState()
    expect(state.colonies.size).toBe(1)
    const colony = [...state.colonies.values()][0]!
    expect(colony.name).toBe('Terra Nova')
  })

  it('includes all 4 starting corporations', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const state = gameStore.getFullGameState()
    expect(state.corporations.size).toBe(4)
  })

  it('includes galaxy sectors', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const state = gameStore.getFullGameState()
    expect(state.galaxy.sectors.size).toBeGreaterThan(0)
    expect(state.galaxy.startingSectorId).not.toBeNull()
  })

  it('includes Terra Nova planet', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const state = gameStore.getFullGameState()
    expect(state.planets.size).toBe(1)
    const planet = [...state.planets.values()][0]!
    expect(planet.name).toBe('Terra Nova')
  })

  it('has correct currentBP in state', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const state = gameStore.getFullGameState()
    expect(state.currentBP).toBe(STARTING_BP)
  })

  it('has zero debtTokens at start', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    const state = gameStore.getFullGameState()
    expect(state.debtTokens).toBe(0)
  })
})

// ─── endTurn() ────────────────────────────────────────────────────────────────

describe('endTurn()', () => {
  it('increments turn after endTurn()', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    expect(gameStore.currentTurn).toBe(1)
    gameStore.endTurn()
    expect(gameStore.currentTurn).toBe(2)
  })

  it('returns directly to player_action after endTurn() — no reviewing phase', () => {
    // Events are displayed non-blocking on the dashboard; no acknowledgement required.
    const gameStore = useGameStore()
    gameStore.initializeGame()

    gameStore.endTurn()
    expect(gameStore.gamePhase).toBe('player_action')
  })

  it('distributes updated colonies back to colony store', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    gameStore.endTurn()

    const colonyStore = useColonyStore()
    expect(colonyStore.colonyCount).toBe(1)
  })

  it('can end multiple turns sequentially', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    for (let i = 0; i < 3; i++) {
      gameStore.endTurn()
    }

    expect(gameStore.currentTurn).toBe(4)
  })
})

// ─── acknowledgeResults() ─────────────────────────────────────────────────────
// acknowledgeResults() is now a no-op: the reviewing phase was removed so that
// the player is never blocked by turn events. The method is kept for API
// compatibility but does nothing meaningful.

describe('acknowledgeResults()', () => {
  it('is a no-op — phase stays player_action', () => {
    const gameStore = useGameStore()
    gameStore.initializeGame()

    // After endTurn, phase is already player_action
    gameStore.endTurn()
    expect(gameStore.gamePhase).toBe('player_action')

    // acknowledgeResults does nothing when already in player_action
    gameStore.acknowledgeResults()
    expect(gameStore.gamePhase).toBe('player_action')
  })
})
