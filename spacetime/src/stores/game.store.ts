/**
 * game.store.ts — Master game store that orchestrates turn resolution and state distribution.
 *
 * Story 12.4: Implements initializeGame(), endTurn(), and getFullGameState().
 * Acts as the coordinator between all domain stores and the turn resolver engine.
 *
 * Architecture:
 * - Holds only game-level state: turn number and game phase.
 * - Domain state (colonies, corporations, budget, etc.) lives in their own stores.
 * - endTurn() assembles a GameState snapshot, calls resolveTurn(), and distributes results.
 *
 * TODO (Story 12.5): EndTurn UI button triggers endTurn() from this store.
 * TODO (Story 18.1): Save/load uses getFullGameState() for serialization.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TurnNumber, ColonyId } from '../types/common'
import { CorpType, InfraDomain } from '../types/common'
import type { GameState, GamePhase } from '../types/game'
import type { Galaxy } from '../types/sector'
import { createEmptyEmpireBonuses } from '../types/empire'
import { resolveTurn } from '../engine/turn/turn-resolver'
import { useGalaxyStore } from './galaxy.store'
import { useColonyStore } from './colony.store'
import { usePlanetStore } from './planet.store'
import { useCorporationStore } from './corporation.store'
import { useBudgetStore } from './budget.store'
import { useContractStore } from './contract.store'
import { useMarketStore } from './market.store'
import { generateCorporation } from '../generators/corp-generator'

export const useGameStore = defineStore('game', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** Current turn number. Starts at 1. */
  const turn = ref<TurnNumber>(1 as TurnNumber)

  /** Current phase of the game loop. */
  const phase = ref<GamePhase>('player_action')

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** Current turn number. */
  const currentTurn = computed<TurnNumber>(() => turn.value)

  /** Current game phase. */
  const gamePhase = computed<GamePhase>(() => phase.value)

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Initializes a new game:
   * 1. Generates the galaxy.
   * 2. Creates Terra Nova colony and planet.
   * 3. Initializes the budget store.
   * 4. Spawns starting corporations on Terra Nova.
   * 5. Sets turn to 1, phase to player_action.
   *
   * Starting corporations (from Features.md Story 12.4 + Specs.md § 15):
   * - One level 1 Exploration corp
   * - One level 1 Construction corp
   * - Two level 1 Science corps (each owning one science infrastructure level on Terra Nova)
   */
  function initializeGame() {
    const galaxyStore = useGalaxyStore()
    const colonyStore = useColonyStore()
    const corpStore = useCorporationStore()
    const budgetStore = useBudgetStore()

    // 1. Generate galaxy
    galaxyStore.generate()
    const startingSectorId = galaxyStore.startingSectorId!

    // 2. Initialize Terra Nova (creates planet + colony in their stores)
    colonyStore.initializeTerraNova(startingSectorId)

    // 3. Initialize budget
    budgetStore.initialize()

    // 4. Spawn starting corporations on Terra Nova
    const terraNovaPlanetId = _getTerraNovaPlanetId(colonyStore, startingSectorId)
    _spawnStartingCorporations(corpStore, colonyStore, terraNovaPlanetId, startingSectorId)

    // 5. Set turn and phase
    turn.value = 1 as TurnNumber
    phase.value = 'player_action'
  }

  /**
   * Assembles the complete GameState from all domain stores.
   * Used by endTurn() to snapshot state before passing it to the turn resolver.
   *
   * @returns A fully assembled GameState reflecting current store state.
   */
  function getFullGameState(): GameState {
    const galaxyStore = useGalaxyStore()
    const colonyStore = useColonyStore()
    const planetStore = usePlanetStore()
    const corpStore = useCorporationStore()
    const budgetStore = useBudgetStore()
    const contractStore = useContractStore()
    const marketStore = useMarketStore()

    const galaxy: Galaxy = {
      sectors: galaxyStore.sectors,
      adjacency: galaxyStore.adjacency,
      startingSectorId: galaxyStore.startingSectorId!,
    }

    return {
      turn: turn.value,
      phase: phase.value,

      // Budget
      currentBP: budgetStore.currentBP as any,
      debtTokens: budgetStore.debtTokens,
      budget: {
        currentBP: budgetStore.currentBP as any,
        incomeSources: [...budgetStore.incomeSources],
        expenseEntries: [...budgetStore.expenseEntries],
        totalIncome: budgetStore.totalIncome as any,
        totalExpenses: budgetStore.totalExpenses as any,
        netBP: budgetStore.netBP as any,
        debtTokens: budgetStore.debtTokens,
        stabilityMalus: budgetStore.stabilityMalus,
        calculatedTurn: turn.value,
      },

      empireBonuses: createEmptyEmpireBonuses(),

      galaxy,

      // Entities
      colonies: new Map(colonyStore.colonies),
      planets: new Map(planetStore.planets),
      corporations: new Map(corpStore.corporations),
      contracts: new Map(contractStore.contracts),
      ships: new Map(),
      missions: new Map(),

      // Science (empty until Epic 13)
      scienceDomains: new Map(),
      discoveries: new Map(),
      schematics: new Map(),
      patents: new Map(),

      // Trade
      sectorMarkets: new Map(marketStore.sectorMarkets),
      tradeRoutes: [],

      events: [],

      startedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    }
  }

  /**
   * Runs the full turn resolution pipeline:
   * 1. Sets phase to 'resolving'.
   * 2. Assembles GameState from all stores.
   * 3. Calls resolveTurn() (pure engine function).
   * 4. Distributes results back to all domain stores.
   * 5. Increments turn and sets phase to 'reviewing'.
   */
  function endTurn() {
    if (phase.value !== 'player_action') return

    // 1. Set resolving phase
    phase.value = 'resolving'

    // 2. Assemble full game state
    const gameState = getFullGameState()

    // 3. Run turn resolver (pure engine function)
    const result = resolveTurn(gameState)
    const { updatedState } = result

    // 4. Distribute results back to stores
    _distributeResults(updatedState)

    // 5. Advance turn and switch to reviewing
    turn.value = updatedState.turn
    phase.value = 'reviewing'
  }

  /**
   * Transitions from 'reviewing' back to 'player_action'.
   * Called after the player has reviewed the turn events.
   */
  function acknowledgeResults() {
    if (phase.value !== 'reviewing') return
    phase.value = 'player_action'
  }

  // ─── Internal Helpers ────────────────────────────────────────────────────────

  /**
   * Distributes the updated GameState from the turn resolver back to all domain stores.
   */
  function _distributeResults(state: GameState) {
    const colonyStore = useColonyStore()
    const planetStore = usePlanetStore()
    const corpStore = useCorporationStore()
    const budgetStore = useBudgetStore()
    const contractStore = useContractStore()
    const galaxyStore = useGalaxyStore()
    const marketStore = useMarketStore()

    // Colonies
    for (const colony of state.colonies.values()) {
      colonyStore.updateColony(colony)
    }

    // Planets
    for (const planet of state.planets.values()) {
      planetStore.updatePlanet(planet)
    }

    // Corporations
    for (const corp of state.corporations.values()) {
      corpStore.addCorporation(corp)
    }

    // Contracts
    for (const contract of state.contracts.values()) {
      contractStore.contracts.set(contract.id, contract)
    }

    // Galaxy sectors
    for (const sector of state.galaxy.sectors.values()) {
      galaxyStore.updateSector(sector)
    }

    // Budget — patch reactive state via $patch to properly update the store
    budgetStore.$patch({
      currentBP: state.currentBP,
      debtTokens: state.debtTokens,
      incomeSources: state.budget.incomeSources,
      expenseEntries: state.budget.expenseEntries,
    })

    // Market — replace the entire sector markets map via $patch
    marketStore.$patch({ sectorMarkets: new Map(state.sectorMarkets) as any })
  }

  return {
    // State
    turn,
    phase,
    // Getters
    currentTurn,
    gamePhase,
    // Actions
    initializeGame,
    getFullGameState,
    endTurn,
    acknowledgeResults,
  }
})

// ─── Private Initialization Helpers ──────────────────────────────────────────

/**
 * Finds the Terra Nova planet ID from the colony store.
 * Terra Nova is the only colony at game start, in the starting sector.
 */
function _getTerraNovaPlanetId(
  colonyStore: ReturnType<typeof useColonyStore>,
  startingSectorId: string,
): import('../types/common').PlanetId {
  const colonies = colonyStore.getColoniesBySector(startingSectorId as any)
  const terraNova = colonies[0]
  if (!terraNova) throw new Error('Terra Nova colony not found after initialization')
  return terraNova.planetId as import('../types/common').PlanetId
}

/**
 * Spawns the four starting corporations on Terra Nova:
 * - 1× Exploration (level 1)
 * - 1× Construction (level 1)
 * - 2× Science (level 1), each owning 1 Science infrastructure level on Terra Nova
 *
 * The Science corps' infrastructure ownership is recorded in their assets.
 * The colony's Science infrastructure comes from STARTING_INFRASTRUCTURE (1 level).
 * Each Science corp owns half of that level (recorded as 1 private level each).
 */
function _spawnStartingCorporations(
  corpStore: ReturnType<typeof useCorporationStore>,
  colonyStore: ReturnType<typeof useColonyStore>,
  terraNovaPlanetId: import('../types/common').PlanetId,
  startingSectorId: string,
): void {
  const foundedTurn = 1 as import('../types/common').TurnNumber
  const colonies = colonyStore.getColoniesBySector(startingSectorId as any)
  const terraNova = colonies[0]
  if (!terraNova) return
  const terranovaColonyId = terraNova.id as ColonyId

  // Exploration corp
  const explorationCorp = generateCorporation({
    type: CorpType.Exploration,
    homePlanetId: terraNovaPlanetId,
    foundedTurn,
  })
  corpStore.addCorporation(explorationCorp)

  // Construction corp
  const constructionCorp = generateCorporation({
    type: CorpType.Construction,
    homePlanetId: terraNovaPlanetId,
    foundedTurn,
  })
  corpStore.addCorporation(constructionCorp)

  // Two Science corps, each owning 1 Science infra level on Terra Nova
  for (let i = 0; i < 2; i++) {
    const scienceCorp = generateCorporation({
      type: CorpType.Science,
      homePlanetId: terraNovaPlanetId,
      foundedTurn,
    })

    // Record ownership: 1 Science infrastructure level on Terra Nova
    scienceCorp.assets.infrastructureByColony.set(terranovaColonyId, {
      [InfraDomain.Science]: 1,
    })

    corpStore.addCorporation(scienceCorp)
  }
}
