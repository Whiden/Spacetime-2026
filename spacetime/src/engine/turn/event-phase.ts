/**
 * event-phase.ts — Event generation during turn resolution (placeholder).
 *
 * Runs as phase #10 (final) of turn resolution, after all simulation phases.
 *
 * Current state: Placeholder. No threat events are actively generated in the
 * prototype. The infrastructure (this file) is in place for future extension.
 *
 * Future responsibilities (post-prototype):
 *   - Piracy threats based on military infrastructure gaps
 *   - Corporate conflict events from competing megacorps
 *   - Colony unrest events from sustained low stability/QoL
 *   - Natural disaster events tied to planet features
 *   - Resource crisis events from prolonged shortages
 *   - Unknown encounter events from high-exploration sectors
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Epic 13 / Post-prototype): Implement actual threat/event generation
 *   using the trigger definitions in data/threats.ts.
 */

import type { GameState, PhaseResult } from '../../types/game'

// ─── Event Phase ──────────────────────────────────────────────────────────────

/**
 * resolveEventPhase — Phase #10: generate events based on current state.
 *
 * Placeholder implementation: passes state through unchanged with empty events.
 * Structure is in place for future threat/event generation.
 */
export function resolveEventPhase(state: GameState): PhaseResult {
  // TODO (Post-prototype): Implement threat escalation and random event generation
  //   using trigger tables from data/threats.ts (Specs.md § 13).
  return { updatedState: state, events: [] }
}
