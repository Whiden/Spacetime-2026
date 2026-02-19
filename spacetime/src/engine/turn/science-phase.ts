/**
 * science-phase.ts — Science advancement during turn resolution.
 *
 * Runs as phase #6 of turn resolution (after mission-phase, before corp-phase).
 *
 * Responsibilities each turn:
 *   1. Calculate empire science output (sum of all science infrastructure).
 *   2. Distribute science points evenly across 9 domains (with focus bonuses).
 *   3. On domain level-up: trigger schematic versioning for affected categories.
 *   4. Roll discovery chances for all science corporations.
 *   5. Roll schematic development for all shipbuilding corporations.
 *   6. Roll patent development for all corporations.
 *
 * Formulas (Specs.md § 8):
 *   empire_science_per_turn = sum(science infrastructure levels)
 *   per_domain_base = floor(empire_science / 9)
 *   threshold_to_next_level = current_level × 15
 *   discovery_chance = (corp_level × 5) + (corp_science_infra × 2) %
 *   schematic_chance = corp_level × 2 %
 *   patent_chance = corp_level × 2 %
 *
 * Pure TypeScript — no Vue or Pinia imports.
 */

import type { GameState, PhaseResult } from '../../types/game'
import type { GameEvent } from '../../types/event'
import type { Discovery, Schematic, Patent } from '../../types/science'
import { CorpType } from '../../types/common'
import {
  calculateEmpireSciencePerTurn,
  distributeScience,
  rollForDiscovery,
} from '../simulation/science-sim'
import {
  rollForSchematic,
  updateSchematicsOnDomainLevelUp,
} from '../../generators/schematic-generator'
import { rollForPatent } from '../../generators/patent-generator'

// ─── Science Phase ────────────────────────────────────────────────────────────

/**
 * resolveSciencePhase — Phase #6: advance science and run discovery/schematic/patent rolls.
 *
 * 1. Calculate empire science output.
 * 2. Distribute across 9 domains; detect level-ups.
 * 3. For each domain that leveled up, update schematics in affected categories.
 * 4. Roll discoveries for all Science corps.
 * 5. Roll schematics for all Shipbuilding corps.
 * 6. Roll patents for all corps.
 */
export function resolveSciencePhase(state: GameState): PhaseResult {
  const { turn } = state
  const allEvents: GameEvent[] = []

  const colonies = Array.from(state.colonies.values())
  const corporations = Array.from(state.corporations.values())

  // ── 1. Science accumulation ────────────────────────────────────────────────
  const empireSciencePerTurn = calculateEmpireSciencePerTurn(colonies)

  // ── 2. Distribute & check level-ups ───────────────────────────────────────
  const { updatedDomains, events: levelUpEvents } = distributeScience(
    state.scienceDomains,
    empireSciencePerTurn,
    turn,
  )
  allEvents.push(...levelUpEvents)

  // ── 3. Schematic versioning on domain level-ups ────────────────────────────
  // Find which domains actually leveled up by comparing old vs new levels.
  let updatedSchematics = new Map(state.schematics)

  for (const [key, newDomain] of updatedDomains) {
    const oldDomain = state.scienceDomains.get(key)
    const oldLevel = oldDomain?.level ?? 0
    if (newDomain.level > oldLevel) {
      const allSchematicsList = Array.from(updatedSchematics.values())
      const { updatedSchematics: versionedSchematics, events: versionEvents } =
        updateSchematicsOnDomainLevelUp(allSchematicsList, newDomain.type, newDomain.level, turn)
      allEvents.push(...versionEvents)

      // Merge versioned schematics back into the map
      for (const s of versionedSchematics) {
        updatedSchematics.set(s.id, s)
      }
    }
  }

  // ── 4. Discovery rolls (Science corps only) ────────────────────────────────
  let currentEmpireBonuses = state.empireBonuses
  let currentScienceDomains = updatedDomains
  const allDiscoveries = new Map(state.discoveries)
  const alreadyDiscoveredDefinitionIds = Array.from(allDiscoveries.values()).map(
    (d) => d.sourceDefinitionId,
  )

  for (const corp of corporations) {
    if (corp.type !== CorpType.Science) continue

    const result = rollForDiscovery(
      corp,
      currentScienceDomains,
      alreadyDiscoveredDefinitionIds,
      currentEmpireBonuses,
      turn,
    )

    if (result.discovery) {
      allDiscoveries.set(result.discovery.id, result.discovery)
      alreadyDiscoveredDefinitionIds.push(result.discovery.sourceDefinitionId)
      currentEmpireBonuses = result.updatedEmpireBonuses
      currentScienceDomains = result.updatedScienceDomains
      allEvents.push(...result.events)
    }
  }

  // ── 5. Schematic rolls (Shipbuilding corps only) ───────────────────────────
  const allDiscoveriesList = Array.from(allDiscoveries.values()) as Discovery[]

  for (const corp of corporations) {
    if (corp.type !== CorpType.Shipbuilding) continue

    const currentSchematicsList = Array.from(updatedSchematics.values()) as Schematic[]
    const result = rollForSchematic(
      corp,
      currentScienceDomains,
      currentSchematicsList,
      allDiscoveriesList,
      turn,
    )

    if (result.newSchematic) {
      // Remove replaced schematic if any
      if (result.replacedSchematicId) {
        updatedSchematics.delete(result.replacedSchematicId)
      }
      updatedSchematics.set(result.newSchematic.id, result.newSchematic)
      allEvents.push(...result.events)
    }
  }

  // ── 6. Patent rolls (all corps) ───────────────────────────────────────────
  const updatedPatents = new Map(state.patents)
  const allPatentsList = Array.from(updatedPatents.values()) as Patent[]

  for (const corp of corporations) {
    const result = rollForPatent(corp, allPatentsList, null, turn)

    if (result.newPatent) {
      updatedPatents.set(result.newPatent.id, result.newPatent)
      allPatentsList.push(result.newPatent)
      allEvents.push(...result.events)
    }
  }

  // ── Assemble updated state ─────────────────────────────────────────────────
  const updatedState: GameState = {
    ...state,
    empireBonuses: currentEmpireBonuses,
    scienceDomains: currentScienceDomains,
    discoveries: allDiscoveries,
    schematics: updatedSchematics,
    patents: updatedPatents,
  }

  return { updatedState, events: allEvents }
}
