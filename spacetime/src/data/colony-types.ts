/**
 * colony-types.ts — Colony type packages, starting infrastructure, passive bonuses, and costs.
 * See Data.md § 6 Colony Types.
 */

import { ColonyType, InfraDomain } from '../types/common'
import type { FeatureModifierTemplate } from './planet-features'

export interface StartingInfraEntry {
  domain: InfraDomain
  publicLevels: number
  /**
   * If true, this infrastructure is only added if the planet has a suitable deposit.
   * (e.g., Mining for MiningOutpost only if the planet has ore deposits)
   */
  requiresDeposit?: boolean
}

export interface ColonyTypeDefinition {
  type: ColonyType
  name: string
  description: string
  startingPopulationLevel: number
  bpPerTurn: number
  durationTurns: number
  startingInfrastructure: StartingInfraEntry[]
  /**
   * Permanent passive bonus registered as a modifier on the colony when it is founded.
   * Registered by colony-generator.ts with sourceType 'colonyType'.
   */
  passiveBonusModifiers: FeatureModifierTemplate[]
}

export const COLONY_TYPE_DEFINITIONS: Record<ColonyType, ColonyTypeDefinition> = {
  [ColonyType.FrontierColony]: {
    type: ColonyType.FrontierColony,
    name: 'Frontier Colony',
    description: 'A general-purpose settlement. High civilian infrastructure supports rapid population growth.',
    startingPopulationLevel: 5,
    bpPerTurn: 2,
    durationTurns: 15,
    startingInfrastructure: [
      { domain: InfraDomain.Civilian, publicLevels: 10 },
      { domain: InfraDomain.LowIndustry, publicLevels: 1 },
      { domain: InfraDomain.Agricultural, publicLevels: 1, requiresDeposit: true },
    ],
    passiveBonusModifiers: [
      { target: 'dynamism', operation: 'add', value: 1 },
    ],
  },
  [ColonyType.MiningOutpost]: {
    type: ColonyType.MiningOutpost,
    name: 'Mining Outpost',
    description: 'Built around resource extraction. Starts with extraction infrastructure fitted to the planet.',
    startingPopulationLevel: 4,
    bpPerTurn: 2,
    durationTurns: 6,
    startingInfrastructure: [
      { domain: InfraDomain.Civilian, publicLevels: 8 },
      // One of Mining/DeepMining/GasExtraction added by colony-generator based on available deposits
      { domain: InfraDomain.Mining, publicLevels: 3, requiresDeposit: true },
      { domain: InfraDomain.DeepMining, publicLevels: 3, requiresDeposit: true },
      { domain: InfraDomain.GasExtraction, publicLevels: 3, requiresDeposit: true },
    ],
    passiveBonusModifiers: [
      { target: 'miningOutput', operation: 'add', value: 0.5 },
      { target: 'deepMiningOutput', operation: 'add', value: 0.5 },
      { target: 'gasExtractionOutput', operation: 'add', value: 0.5 },
    ],
  },
  [ColonyType.ScienceOutpost]: {
    type: ColonyType.ScienceOutpost,
    name: 'Science Outpost',
    description: 'A research-focused settlement generating substantial science output from the start.',
    startingPopulationLevel: 5,
    bpPerTurn: 3,
    durationTurns: 10,
    startingInfrastructure: [
      { domain: InfraDomain.Civilian, publicLevels: 6 },
      { domain: InfraDomain.Science, publicLevels: 3 },
    ],
    passiveBonusModifiers: [
      { target: 'maxScience', operation: 'add', value: 3 },
    ],
  },
  [ColonyType.MilitaryOutpost]: {
    type: ColonyType.MilitaryOutpost,
    name: 'Military Outpost',
    description: 'A fortified base providing sector security and supporting military operations.',
    startingPopulationLevel: 5,
    bpPerTurn: 3,
    durationTurns: 8,
    startingInfrastructure: [
      { domain: InfraDomain.Civilian, publicLevels: 8 },
      { domain: InfraDomain.Military, publicLevels: 3 },
    ],
    passiveBonusModifiers: [
      { target: 'stability', operation: 'add', value: 1 },
      { target: 'maxMilitary', operation: 'add', value: 3 },
    ],
  },
}
