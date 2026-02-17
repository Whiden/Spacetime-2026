/**
 * personality-traits.ts — Corporation personality trait definitions and spawn weights.
 * See Data.md § 9 Corporation Personality Traits.
 *
 * Conflicting trait pairs (cannot both be assigned to the same corp):
 * - Cautious / Aggressive
 * - Innovative / Conservative
 * - Ethical / Ruthless
 */

import { CorpPersonalityTrait } from '../types/common'

export interface PersonalityTraitDefinition {
  trait: CorpPersonalityTrait
  name: string
  description: string
  /** Future mechanical effect description. */
  futureEffects: string
  spawnWeight: number
}

export const PERSONALITY_TRAIT_DEFINITIONS: Record<CorpPersonalityTrait, PersonalityTraitDefinition> = {
  [CorpPersonalityTrait.Cautious]: {
    trait: CorpPersonalityTrait.Cautious,
    name: 'Cautious',
    description: 'Avoids risky ventures. Prefers safe, established planets.',
    futureEffects: 'Avoids risky contracts, retreats earlier in combat.',
    spawnWeight: 15,
  },
  [CorpPersonalityTrait.Aggressive]: {
    trait: CorpPersonalityTrait.Aggressive,
    name: 'Aggressive',
    description: 'Pursues high-value contracts and holds the line in conflict.',
    futureEffects: 'Targets bigger contracts, holds in combat longer.',
    spawnWeight: 15,
  },
  [CorpPersonalityTrait.Innovative]: {
    trait: CorpPersonalityTrait.Innovative,
    name: 'Innovative',
    description: 'Drives technological development and explores new sectors.',
    futureEffects: 'Creates better schematics, invests in new sectors.',
    spawnWeight: 10,
  },
  [CorpPersonalityTrait.Conservative]: {
    trait: CorpPersonalityTrait.Conservative,
    name: 'Conservative',
    description: 'Prefers reliable, time-tested investment over experimentation.',
    futureEffects: 'Invests in safe, established planets.',
    spawnWeight: 15,
  },
  [CorpPersonalityTrait.Opportunistic]: {
    trait: CorpPersonalityTrait.Opportunistic,
    name: 'Opportunistic',
    description: 'Quick to diversify and expand into whatever market is booming.',
    futureEffects: 'Diversifies early, settles rejected planets.',
    spawnWeight: 15,
  },
  [CorpPersonalityTrait.Ethical]: {
    trait: CorpPersonalityTrait.Ethical,
    name: 'Ethical',
    description: 'Committed to responsible business. Popular with colonial populations.',
    futureEffects: 'Avoids exploitation, popular with population.',
    spawnWeight: 10,
  },
  [CorpPersonalityTrait.Ruthless]: {
    trait: CorpPersonalityTrait.Ruthless,
    name: 'Ruthless',
    description: 'Prioritizes profit above all else. Often triggers conflicts.',
    futureEffects: 'Triggers corporate conflict events more often.',
    spawnWeight: 10,
  },
  [CorpPersonalityTrait.Efficient]: {
    trait: CorpPersonalityTrait.Efficient,
    name: 'Efficient',
    description: 'Lean operations and streamlined logistics reduce overhead.',
    futureEffects: 'Lower infrastructure maintenance.',
    spawnWeight: 10,
  },
}

/** Trait pairs that cannot both be assigned to the same corporation. */
export const CONFLICTING_TRAIT_PAIRS: [CorpPersonalityTrait, CorpPersonalityTrait][] = [
  [CorpPersonalityTrait.Cautious, CorpPersonalityTrait.Aggressive],
  [CorpPersonalityTrait.Innovative, CorpPersonalityTrait.Conservative],
  [CorpPersonalityTrait.Ethical, CorpPersonalityTrait.Ruthless],
]

export const TRAIT_SPAWN_WEIGHTS = Object.values(PERSONALITY_TRAIT_DEFINITIONS).map((def) => ({
  value: def.trait,
  weight: def.spawnWeight,
}))

/** Chance (0-100%) that a generated corp gets 2 traits instead of 1. */
export const DUAL_TRAIT_CHANCE = 30
