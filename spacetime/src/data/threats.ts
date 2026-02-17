/**
 * threats.ts — Threat category definitions (placeholder for prototype).
 * See Specs.md § 13 Threats & Events.
 *
 * Threats are deferred from the prototype. The event infrastructure is implemented
 * (Epic 19) but no threats are actively generated.
 *
 * TODO (Epic 20 / post-prototype): Implement full threat generation system.
 */

/** The seven threat categories that escalate in probability over time. */
export type ThreatCategory =
  | 'piracy'
  | 'corporate_conflict'
  | 'colony_unrest'
  | 'natural_disaster'
  | 'resource_crisis'
  | 'unknown_encounter'
  | 'internal_corruption'

export interface ThreatCategoryDefinition {
  category: ThreatCategory
  name: string
  description: string
  /**
   * Base probability per turn at game start.
   * Escalates over time (formula to be defined during implementation).
   */
  baseProbabilityPerTurn: number
}

/**
 * Threat category definitions — placeholder values.
 * All threat generation is disabled in the prototype.
 */
export const THREAT_CATEGORY_DEFINITIONS: ThreatCategoryDefinition[] = [
  {
    category: 'piracy',
    name: 'Piracy',
    description: 'Raids on trade convoys and mining operations.',
    baseProbabilityPerTurn: 0,
  },
  {
    category: 'corporate_conflict',
    name: 'Corporate Conflict',
    description: 'Hostile competition between corporations spills into violence.',
    baseProbabilityPerTurn: 0,
  },
  {
    category: 'colony_unrest',
    name: 'Colony Unrest',
    description: 'Political instability or riots threaten colonial order.',
    baseProbabilityPerTurn: 0,
  },
  {
    category: 'natural_disaster',
    name: 'Natural Disaster',
    description: 'Geological or atmospheric events damage infrastructure.',
    baseProbabilityPerTurn: 0,
  },
  {
    category: 'resource_crisis',
    name: 'Resource Crisis',
    description: 'Critical shortages cascade into empire-wide instability.',
    baseProbabilityPerTurn: 0,
  },
  {
    category: 'unknown_encounter',
    name: 'Unknown Encounter',
    description: 'Something unexpected emerges from deep space.',
    baseProbabilityPerTurn: 0,
  },
  {
    category: 'internal_corruption',
    name: 'Internal Corruption',
    description: 'Systemic rot within the empire\'s institutions.',
    baseProbabilityPerTurn: 0,
  },
]
