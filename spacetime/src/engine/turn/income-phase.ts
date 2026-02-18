/**
 * income-phase.ts — Income calculation during turn resolution.
 *
 * Runs as phase #2 of turn resolution (after debt-phase, before expense-phase).
 *
 * Responsibilities:
 *   1. Sum all planet taxes from every colony.
 *   2. Sum all corporation taxes from every corporation.
 *   3. Apply total income to the current BP balance.
 *   4. Return itemised income sources on the budget state.
 *
 * Note: Debt clearance BP cost (1 BP per cleared token) is handled as an
 * expense entry in expense-phase, not here. This keeps income and expenses
 * cleanly separated for the budget breakdown UI.
 *
 * Formulas (Specs.md § 2):
 *   planet_tax = max(0, floor(pop² / 4) - habitability_cost)   (0 for pop < 5)
 *   corp_tax   = floor(corp_level² / 5)                        (0 for level 1-2)
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * Story 12.2: Dedicated unit tests in income-phase.test.ts.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { IncomeSource } from '../../types/budget'
import type { ColonyId, CorpId } from '../../types/common'
import { calculatePlanetTax, calculateCorpTax } from '../formulas/tax'

// ─── Income Phase ─────────────────────────────────────────────────────────────

/**
 * resolveIncomePhase — Phase #2: calculate and apply all income sources.
 *
 * Sums planet taxes and corp taxes, credits them to currentBP, and updates
 * the itemised income breakdown on budget state.
 */
export function resolveIncomePhase(state: GameState): PhaseResult {
  const incomeSources: IncomeSource[] = []

  // ── Planet taxes ────────────────────────────────────────────────────────────
  for (const [, colony] of state.colonies) {
    const tax = calculatePlanetTax(
      colony.populationLevel,
      colony.attributes.habitability,
    )
    if (tax > 0) {
      incomeSources.push({
        type: 'planet_tax',
        sourceId: colony.id as ColonyId,
        sourceName: colony.name,
        amount: tax,
      })
    }
  }

  // ── Corporation taxes ────────────────────────────────────────────────────────
  for (const [, corp] of state.corporations) {
    const tax = calculateCorpTax(corp.level)
    if (tax > 0) {
      incomeSources.push({
        type: 'corp_tax',
        sourceId: corp.id as CorpId,
        sourceName: corp.name,
        amount: tax,
      })
    }
  }

  const totalIncome = incomeSources.reduce((sum, src) => sum + src.amount, 0)

  const updatedState: GameState = {
    ...state,
    currentBP: state.currentBP + totalIncome,
    budget: {
      ...state.budget,
      incomeSources,
      totalIncome,
      calculatedTurn: state.turn,
    },
  }

  return { updatedState, events: [] }
}
