/**
 * corp-phase.ts — Corporation AI integration into the turn resolution pipeline.
 *
 * Story 11.2: Integrates corp-ai.ts decisions into the full turn pipeline.
 *
 * Responsibilities each turn:
 *   1. Sort all corporations by level descending (biggest corps act first).
 *   2. For each corp (skipping any absorbed mid-turn):
 *      a. Calculate passive capital gain (random(0,1) + floor(ownedInfra / 10)).
 *      b. Apply capital gain to the corporation.
 *      c. Run corporation AI (runCorpInvestmentAI from corp-ai.ts).
 *      d. Merge AI results back into the running state:
 *         - Update the corporation's capital, level, and asset holdings.
 *         - Update any colonies where infrastructure ownership changed.
 *         - Remove absorbed corporations from the corporation map.
 *   3. Return updated GameState + all events (investments and acquisitions).
 *
 * Turn order context:
 *   Corp-phase (#7) runs AFTER science-phase (#6) and BEFORE colony-phase (#8).
 *   The colony state the AI sees is from the start of this turn (pre-colony-phase).
 *   Infrastructure caps may not be fully recalculated yet; the AI uses currentCap
 *   as set by the previous colony-phase — this is intentional and matches the spec.
 *
 * Ordering rationale: highest-level corps act first so megacorps have first pick
 * of investment targets before smaller corps can react. This mirrors real-world
 * corporate dynamics where larger players have structural advantages.
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 11.3): Organic corporation emergence (dynamism-based new corp spawning)
 *   is added to this file or colony-phase.ts.
 * TODO (Story 12.1): turn-resolver.ts calls resolveCorpPhase() in the correct order
 *   (after science-phase, before colony-phase).
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { Corporation } from '../../types/corporation'
import type { Colony } from '../../types/colony'
import type { GameEvent } from '../../types/event'
import type { CorpId } from '../../types/common'
import { getTotalOwnedInfra } from '../formulas/growth'
import { calculateCapitalGain } from '../formulas/growth'
import { runCorpInvestmentAI } from '../simulation/corp-ai'

// ─── Phase Entry Point ────────────────────────────────────────────────────────

/**
 * Runs the full corporation AI phase for all corporations in one turn.
 *
 * Processing order: highest level first. This ensures megacorps have first
 * pick of investment opportunities, mirroring their real-world structural advantage.
 *
 * Each corporation:
 *   1. Gains passive capital (based on total owned infrastructure).
 *   2. Runs AI decision-making (investment and/or acquisition).
 *
 * State is updated after each corp so subsequent corps see accurate colony
 * infrastructure counts and correct corporation levels when evaluating targets.
 *
 * @param state - Full GameState at this point in the turn pipeline.
 * @returns PhaseResult with updated corporations, colonies, and generated events.
 */
export function resolveCorpPhase(state: GameState): PhaseResult {
  const events: GameEvent[] = []

  // Working copies — mutated incrementally as each corp is processed
  let updatedCorporations = new Map<string, Corporation>(state.corporations)
  let updatedColonies = new Map<string, Colony>(state.colonies)

  // Track corporations absorbed mid-turn so we skip processing them if they
  // appear later in the sorted order (sorted by original level; absorbed corps
  // were smaller, so they appear later).
  const absorbedCorpIds = new Set<CorpId>()

  // Sort by level descending: a copy of IDs ordered by original level.
  // We snapshot the sort order at the start of the turn — level changes from
  // acquisitions during this turn do not reorder the queue.
  const processingOrder = [...state.corporations.values()]
    .sort((a, b) => b.level - a.level)
    .map((corp) => corp.id)

  for (const corpId of processingOrder) {
    // Skip corps absorbed earlier this turn (acquired by another corp)
    if (absorbedCorpIds.has(corpId as CorpId)) continue

    const currentCorp = updatedCorporations.get(corpId)
    if (!currentCorp) continue // Defensive guard

    // ── Step 1: Apply passive capital gain ────────────────────────────────
    // Capital gain = random(0,1) + floor(totalOwnedInfra / 10)
    const totalOwned = getTotalOwnedInfra(currentCorp.assets.infrastructureByColony)
    const capitalGain = calculateCapitalGain(totalOwned)

    const corpWithNewCapital: Corporation = {
      ...currentCorp,
      capital: currentCorp.capital + capitalGain,
    }

    // ── Step 2: Run AI with the most up-to-date state ─────────────────────
    // Build a view of the current state with the running colony and corp maps,
    // so each corp's AI sees investments made by previously-processed corps.
    const currentState: GameState = {
      ...state,
      corporations: updatedCorporations,
      colonies: updatedColonies,
    }

    const aiResult = runCorpInvestmentAI(corpWithNewCapital, currentState)

    // ── Step 3: Merge AI results back into running state ──────────────────

    // Update the corporation (new capital, possibly new level from acquisition)
    updatedCorporations.set(aiResult.updatedCorp.id, aiResult.updatedCorp)

    // Update any colonies where this corp added infrastructure
    for (const [colonyId, updatedColony] of aiResult.updatedColonies) {
      updatedColonies.set(colonyId, updatedColony)
    }

    // Handle acquisition: remove absorbed corporation from the active map
    if (aiResult.absorbedCorpId) {
      absorbedCorpIds.add(aiResult.absorbedCorpId)
      updatedCorporations.delete(aiResult.absorbedCorpId)
    }

    events.push(...aiResult.events)
  }

  return {
    updatedState: {
      ...state,
      corporations: updatedCorporations,
      colonies: updatedColonies,
    },
    events,
  }
}
