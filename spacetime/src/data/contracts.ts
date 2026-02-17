/**
 * contracts.ts — Contract type templates with base costs and durations.
 * See Data.md § 10 Contract Types.
 */

import { ContractType, CorpType } from '../types/common'

export interface ContractTypeDefinition {
  type: ContractType
  name: string
  description: string
  targetType: 'sector' | 'planet' | 'colony' | 'sector_pair'
  baseBpPerTurn: number
  baseDurationTurns: number | 'ongoing' | 'by_colony_type'
  eligibleCorpTypes: CorpType[]
  /**
   * Quality bonus per corporation level tier (applied to output, not cost).
   * Level 1-3: base, Level 4-6: +1, Level 7+: +2
   */
  qualityScalesWithCorpLevel: boolean
}

export const CONTRACT_TYPE_DEFINITIONS: Record<ContractType, ContractTypeDefinition> = {
  [ContractType.Exploration]: {
    type: ContractType.Exploration,
    name: 'Exploration',
    description: 'Explore a sector to increase its exploration percentage and discover planets.',
    targetType: 'sector',
    baseBpPerTurn: 2,
    baseDurationTurns: 2,
    eligibleCorpTypes: [CorpType.Exploration],
    qualityScalesWithCorpLevel: true,
  },
  [ContractType.GroundSurvey]: {
    type: ContractType.GroundSurvey,
    name: 'Ground Survey',
    description: 'Survey an orbit-scanned planet to reveal full resource and feature data.',
    targetType: 'planet',
    baseBpPerTurn: 1,
    baseDurationTurns: 2,
    eligibleCorpTypes: [CorpType.Exploration],
    qualityScalesWithCorpLevel: false,
  },
  [ContractType.Colonization]: {
    type: ContractType.Colonization,
    name: 'Colonization',
    description: 'Establish a new colony on an accepted, ground-surveyed planet.',
    targetType: 'planet',
    baseBpPerTurn: 2, // Overridden by colony type definition
    baseDurationTurns: 'by_colony_type',
    eligibleCorpTypes: [CorpType.Construction],
    qualityScalesWithCorpLevel: true,
  },
  [ContractType.ShipCommission]: {
    type: ContractType.ShipCommission,
    name: 'Ship Commission',
    description: 'Commission a ship of a specific role and size variant from a shipbuilding corporation.',
    targetType: 'colony',
    baseBpPerTurn: 1, // Overridden by ship size calculation
    baseDurationTurns: 3, // Overridden by ship size calculation
    eligibleCorpTypes: [CorpType.Shipbuilding],
    qualityScalesWithCorpLevel: true,
  },
  [ContractType.TradeRoute]: {
    type: ContractType.TradeRoute,
    name: 'Trade Route',
    description: 'Establish an ongoing trade route between two adjacent sectors (50% surplus sharing).',
    targetType: 'sector_pair',
    baseBpPerTurn: 2,
    baseDurationTurns: 'ongoing',
    eligibleCorpTypes: [CorpType.Transport],
    qualityScalesWithCorpLevel: false,
  },
}

/**
 * Calculate the actual duration for an exploration contract based on corp level.
 * Duration = max(2, 4 - floor(corpLevel / 2))
 * Level 1-3: 3 turns, Level 4-5: 2 turns, Level 6+: 2 turns (min)
 */
export function calculateExplorationDuration(corpLevel: number): number {
  return Math.max(2, 4 - Math.floor(corpLevel / 2))
}
