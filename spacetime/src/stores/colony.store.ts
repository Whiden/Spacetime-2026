/**
 * colony.store.ts — Pinia store for all colonies.
 *
 * Holds all colonies, provides getters for lookup and filtering,
 * and initializes Terra Nova on game start using start-conditions data.
 *
 * TODO (Story 7.3): Contract completion creates new colonies via addColony().
 * TODO (Story 10.3): Colony phase updates colony attributes each turn.
 * TODO (Story 12.4): game.store.ts calls initializeTeraNova() during game init.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ColonyId, SectorId, TurnNumber, InfraDomain, BPAmount } from '../types/common'
import { PlanetStatus } from '../types/common'
import type { Colony } from '../types/colony'
import type { Planet, Deposit } from '../types/planet'
import { investPlanet, type InvestPlanetResult } from '../engine/actions/invest-planet'
import { generateColony } from '../generators/colony-generator'
import { usePlanetStore } from './planet.store'
import { PLANET_FEATURE_BY_ID } from '../data/planet-features'
import { generatePlanetId, generateModifierId } from '../utils/id'
import {
  TERRA_NOVA_PLANET,
  STARTING_COLONY,
  STARTING_INFRASTRUCTURE,
} from '../data/start-conditions'

export const useColonyStore = defineStore('colony', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** All colonies keyed by ID. */
  const colonies = ref<Map<ColonyId, Colony>>(new Map())

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /** Adds a new colony to the store. */
  function addColony(colony: Colony) {
    colonies.value.set(colony.id, colony)
  }

  /** Updates an existing colony (e.g., after turn resolution). */
  function updateColony(colony: Colony) {
    colonies.value.set(colony.id, colony)
  }

  /** Removes a colony (e.g., abandonment). */
  function removeColony(id: ColonyId) {
    colonies.value.delete(id)
  }

  /**
   * Validates and applies a +1 public infrastructure investment to a colony domain.
   * Calls the investPlanet engine function, then updates the colony in-store on success.
   * The caller (view) is responsible for deducting bpSpent from the budget store.
   *
   * @param colonyId   - Target colony
   * @param domain     - Infrastructure domain to invest in
   * @param currentBP  - Player's current BP (used for validation)
   * @param deposits   - Planet deposits for cap/deposit validation
   * @returns InvestPlanetResult — success with updatedColony, or failure with error code
   */
  function investInfrastructure(
    colonyId: ColonyId,
    domain: InfraDomain,
    currentBP: BPAmount,
    deposits: Deposit[],
  ): InvestPlanetResult {
    const result = investPlanet({
      colonyId,
      domain,
      currentBP,
      colonies: colonies.value,
      deposits,
    })
    if (result.success) {
      updateColony(result.updatedColony)
    }
    return result
  }

  /**
   * Initializes Terra Nova as the starting colony.
   * Creates the Terra Nova planet in the planet store and generates the colony.
   *
   * @param startingSectorId - The sector ID where Terra Nova is located
   */
  function initializeTerraNova(startingSectorId: SectorId) {
    const planetStore = usePlanetStore()

    // Build Terra Nova planet from start-conditions data
    const terraNovaPlanet = buildTerraNovaPlanet(startingSectorId)
    planetStore.addPlanet(terraNovaPlanet)

    // Generate the starting colony using the colony generator
    const colony = generateColony({
      planet: terraNovaPlanet,
      colonyType: STARTING_COLONY.type,
      name: STARTING_COLONY.name,
      populationLevel: STARTING_COLONY.populationLevel,
      foundedTurn: 0 as TurnNumber,
      overrideInfrastructure: STARTING_INFRASTRUCTURE.map((entry) => ({
        domain: entry.domain,
        publicLevels: entry.publicLevels,
      })),
    })

    colonies.value.set(colony.id, colony)
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** Returns a colony by ID, or undefined if not found. */
  function getColony(id: ColonyId): Colony | undefined {
    return colonies.value.get(id)
  }

  /** All colonies as an array. */
  const allColonies = computed<Colony[]>(() => [...colonies.value.values()])

  /** Colonies in a specific sector. */
  function getColoniesBySector(sectorId: SectorId): Colony[] {
    return [...colonies.value.values()].filter((c) => c.sectorId === sectorId)
  }

  /** All sector IDs that have at least one colony. */
  const sectorsWithColonies = computed<SectorId[]>(() => {
    const sectorIds = new Set<SectorId>()
    for (const colony of colonies.value.values()) {
      sectorIds.add(colony.sectorId)
    }
    return [...sectorIds]
  })

  /** Total colony count. */
  const colonyCount = computed<number>(() => colonies.value.size)

  return {
    // State
    colonies,
    // Actions
    addColony,
    updateColony,
    removeColony,
    investInfrastructure,
    initializeTerraNova,
    // Getters (functions)
    getColony,
    getColoniesBySector,
    // Getters (computed)
    allColonies,
    sectorsWithColonies,
    colonyCount,
  }
})

// ─── Terra Nova Planet Builder ──────────────────────────────────────────────

/**
 * Builds the Terra Nova planet from start-conditions data.
 * Terra Nova has fixed properties (not procedurally generated).
 */
function buildTerraNovaPlanet(sectorId: SectorId): Planet {
  // Build feature objects from feature IDs
  const features = TERRA_NOVA_PLANET.features.map((featureId) => {
    const featureDef = PLANET_FEATURE_BY_ID[featureId]
    return {
      featureId,
      orbitVisible: featureDef?.orbitVisible ?? true,
      revealed: true, // Terra Nova is fully known
    }
  })

  // Build feature modifiers from feature definitions
  const featureModifiers = TERRA_NOVA_PLANET.features.flatMap((featureId) => {
    const featureDef = PLANET_FEATURE_BY_ID[featureId]
    if (!featureDef) return []
    return featureDef.modifierTemplates.map((template) => ({
      id: generateModifierId(),
      target: template.target,
      operation: template.operation,
      value: template.value,
      sourceType: 'feature' as const,
      sourceId: featureId,
      sourceName: featureDef.name,
    }))
  })

  return {
    id: generatePlanetId(),
    name: TERRA_NOVA_PLANET.name,
    sectorId,
    type: TERRA_NOVA_PLANET.type,
    size: TERRA_NOVA_PLANET.size,
    status: TERRA_NOVA_PLANET.status,
    baseHabitability: TERRA_NOVA_PLANET.baseHabitability,
    deposits: TERRA_NOVA_PLANET.deposits.map((d) => ({
      type: d.type,
      richness: d.richness,
      richnessRevealed: d.richnessRevealed,
    })),
    features,
    featureModifiers,
    orbitScanTurn: 0,
    groundSurveyTurn: 0,
  }
}
