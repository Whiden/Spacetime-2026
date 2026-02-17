/**
 * science-sectors.ts — Science domain definitions and level thresholds.
 * See Data.md § 13 Science Domains & Discoveries and Specs.md § 8 Science & Technology.
 *
 * TODO (Story 14.1): science-sim.ts uses these thresholds for domain advancement.
 * TODO (Story 14.5): science.store.ts initializes domain states from these definitions.
 */

import { ScienceSectorType } from '../types/common'

export interface ScienceDomainDefinition {
  type: ScienceSectorType
  name: string
  description: string
  /** What this domain primarily unlocks (schematics, colony improvements, etc.). */
  primaryEffects: string
}

export const SCIENCE_DOMAIN_DEFINITIONS: Record<ScienceSectorType, ScienceDomainDefinition> = {
  [ScienceSectorType.Society]: {
    type: ScienceSectorType.Society,
    name: 'Society',
    description: 'Social sciences, governance, and administrative organization.',
    primaryEffects: 'Colony management, stability improvements, population growth.',
  },
  [ScienceSectorType.Energy]: {
    type: ScienceSectorType.Energy,
    name: 'Energy',
    description: 'Power generation, energy storage, and field technology.',
    primaryEffects: 'Power generation, shield schematics.',
  },
  [ScienceSectorType.AppliedSciences]: {
    type: ScienceSectorType.AppliedSciences,
    name: 'Applied Sciences',
    description: 'Engineering, manufacturing, and materials processing.',
    primaryEffects: 'Infrastructure efficiency, construction speed.',
  },
  [ScienceSectorType.Weaponry]: {
    type: ScienceSectorType.Weaponry,
    name: 'Weaponry',
    description: 'Weapons development and combat doctrine.',
    primaryEffects: 'Weapons schematics, combat bonuses.',
  },
  [ScienceSectorType.Propulsion]: {
    type: ScienceSectorType.Propulsion,
    name: 'Propulsion',
    description: 'Spacecraft drives, FTL technology, and travel efficiency.',
    primaryEffects: 'Engine schematics, travel time reduction.',
  },
  [ScienceSectorType.Construction]: {
    type: ScienceSectorType.Construction,
    name: 'Construction',
    description: 'Automated construction, habitat engineering, and drone systems.',
    primaryEffects: 'Infrastructure caps, habitability improvements, drone schematics.',
  },
  [ScienceSectorType.LifeSciences]: {
    type: ScienceSectorType.LifeSciences,
    name: 'Life Sciences',
    description: 'Biology, medicine, and ecological adaptation.',
    primaryEffects: 'Habitability bonuses, food production, population health.',
  },
  [ScienceSectorType.Materials]: {
    type: ScienceSectorType.Materials,
    name: 'Materials',
    description: 'Advanced materials, composites, and exotic matter.',
    primaryEffects: 'Armor schematics, hull improvements, extraction bonuses.',
  },
  [ScienceSectorType.Computing]: {
    type: ScienceSectorType.Computing,
    name: 'Computing',
    description: 'Artificial intelligence, sensor networks, and targeting systems.',
    primaryEffects: 'Sensor schematics, targeting improvements, AI bonuses.',
  },
}

/**
 * Calculate the science points threshold to reach a given domain level.
 * Formula: threshold = level × 15
 * Level 1: 15 points, Level 2: 30 points, Level 3: 45 points, etc.
 */
export function getScienceLevelThreshold(level: number): number {
  return level * 15
}

/**
 * Science level tier names for display.
 * TODO: Level 4+ names to be defined during implementation.
 */
export const SCIENCE_LEVEL_TIER_NAMES: Record<number, string> = {
  0: 'Space Age',
  1: 'New Age',
  2: 'Traveller Age',
  3: 'Settler Age',
}
