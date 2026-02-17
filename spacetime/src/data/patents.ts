/**
 * patents.ts — Patent definitions placeholder.
 * See Data.md § 14 Patents.
 *
 * Patents are technological advantages owned by corporations that improve their operations.
 * Full patent mechanics are planned for post-prototype implementation.
 *
 * TODO: Define full patent category tables and effects once patent system is implemented.
 * For now this module provides the structural placeholder and placeholder definitions.
 */

/** Patent domain categories (placeholder). */
export type PatentDomain = 'construction' | 'exploration' | 'extraction' | 'manufacturing' | 'science'

export interface PatentDefinition {
  definitionId: string
  name: string
  domain: PatentDomain
  description: string
  /** Operational bonus target (e.g., 'contractSpeed', 'extractionEfficiency'). */
  bonusTarget: string
  /** Bonus value per level. */
  bonusPerLevel: number
}

/**
 * Placeholder patent definitions.
 * TODO: Expand with full patent tables during Story 14.4 implementation.
 */
export const PATENT_DEFINITIONS: PatentDefinition[] = [
  {
    definitionId: 'construction_prefab_techniques',
    name: 'Prefab Construction Techniques',
    domain: 'construction',
    description: 'Streamlined building methods reduce contract durations.',
    bonusTarget: 'contractSpeed',
    bonusPerLevel: 0.1, // 10% faster per level
  },
  {
    definitionId: 'exploration_advanced_scanners',
    name: 'Advanced Orbital Scanners',
    domain: 'exploration',
    description: 'Enhanced scanning technology improves orbit scan quality.',
    bonusTarget: 'scanQuality',
    bonusPerLevel: 1,
  },
]
