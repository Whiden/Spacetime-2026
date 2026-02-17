/**
 * corporation.store.ts — Pinia store for all corporations.
 *
 * Holds all corporations, provides actions for creation, capital management,
 * and level ups. Getters for lookup by ID, type, and planet.
 *
 * TODO (Story 11.1): Corp AI phase calls addCapital/spendCapital during turn resolution.
 * TODO (Story 11.2): corp-phase.ts integrates corp AI into turn resolution.
 * TODO (Story 11.3): Organic emergence adds corps via addCorporation().
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CorpId, PlanetId, TurnNumber } from '../types/common'
import { CorpType } from '../types/common'
import type { Corporation } from '../types/corporation'
import { generateCorporation } from '../generators/corp-generator'
import { calculateCorpTax } from '../engine/formulas/tax'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Level up cost = current_level × 3 Capital. */
const LEVEL_UP_COST_MULTIPLIER = 3

/** Maximum corporation level. */
const MAX_CORP_LEVEL = 10

export const useCorporationStore = defineStore('corporation', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** All corporations keyed by ID. */
  const corporations = ref<Map<CorpId, Corporation>>(new Map())

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** Returns a corporation by ID, or undefined if not found. */
  function getCorp(id: CorpId): Corporation | undefined {
    return corporations.value.get(id)
  }

  /** Returns all corporations of a given type. */
  function getCorpsByType(type: CorpType): Corporation[] {
    return [...corporations.value.values()].filter((c) => c.type === type)
  }

  /** Returns all corporations present on a given planet. */
  function getCorpsByPlanet(planetId: PlanetId): Corporation[] {
    return [...corporations.value.values()].filter((c) =>
      c.planetsPresent.includes(planetId),
    )
  }

  /**
   * Returns the calculated tax for a corporation.
   * Level 1-2 corps pay 0 (startup exemption per Specs.md § 2).
   */
  function getCorpTax(id: CorpId): number {
    const corp = corporations.value.get(id)
    if (!corp) return 0
    return calculateCorpTax(corp.level)
  }

  /** All corporations as an array. */
  const allCorporations = computed<Corporation[]>(() => [...corporations.value.values()])

  /** Total corporation count. */
  const corpCount = computed<number>(() => corporations.value.size)

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Adds an existing corporation to the store.
   * Used for organic emergence or restoring from save.
   */
  function addCorporation(corp: Corporation) {
    corporations.value.set(corp.id, corp)
  }

  /**
   * Generates and adds a new level 1 corporation (kickstart via contract).
   *
   * @param type - The corporation type to create
   * @param homePlanetId - The planet where this corp is founded
   * @param foundedTurn - The turn this corp is created
   * @returns The newly created Corporation
   */
  function kickstartCorp(
    type: CorpType,
    homePlanetId: PlanetId,
    foundedTurn: TurnNumber,
  ): Corporation {
    const corp = generateCorporation({ type, homePlanetId, foundedTurn })
    corporations.value.set(corp.id, corp)
    return corp
  }

  /**
   * Increases a corporation's capital.
   * Used for passive income, contract completion bonuses, etc.
   *
   * @param corpId - The corporation to add capital to
   * @param amount - Capital to add (must be positive)
   */
  function addCapital(corpId: CorpId, amount: number) {
    const corp = corporations.value.get(corpId)
    if (!corp) return
    if (amount <= 0) return
    corp.capital += amount
  }

  /**
   * Decreases a corporation's capital, validating sufficient funds.
   *
   * @param corpId - The corporation to spend from
   * @param amount - Capital to spend (must be positive)
   * @returns true if the spend was successful, false if insufficient capital
   */
  function spendCapital(corpId: CorpId, amount: number): boolean {
    const corp = corporations.value.get(corpId)
    if (!corp) return false
    if (amount <= 0) return false
    if (corp.capital < amount) return false
    corp.capital -= amount
    return true
  }

  /**
   * Levels up a corporation if it has sufficient capital.
   * Cost = current_level × 3 Capital.
   *
   * @param corpId - The corporation to level up
   * @returns true if the level up was successful, false otherwise
   */
  function levelUp(corpId: CorpId): boolean {
    const corp = corporations.value.get(corpId)
    if (!corp) return false
    if (corp.level >= MAX_CORP_LEVEL) return false

    const cost = corp.level * LEVEL_UP_COST_MULTIPLIER
    if (corp.capital < cost) return false

    corp.capital -= cost
    corp.level += 1
    return true
  }

  return {
    // State
    corporations,
    // Getters (functions)
    getCorp,
    getCorpsByType,
    getCorpsByPlanet,
    getCorpTax,
    // Getters (computed)
    allCorporations,
    corpCount,
    // Actions
    addCorporation,
    kickstartCorp,
    addCapital,
    spendCapital,
    levelUp,
  }
})
