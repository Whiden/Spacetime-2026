/**
 * corporation-types.ts — Corporation type definitions and investment priorities.
 * See Data.md § 8 Corporation Types.
 */

import { CorpType, InfraDomain } from '../types/common'

export interface CorpTypeDefinition {
  type: CorpType
  name: string
  description: string
  /** Primary infrastructure domains this corp invests in. */
  primaryDomains: InfraDomain[]
  /** Special abilities and contract eligibility notes. */
  specialAbilities: string[]
}

export const CORP_TYPE_DEFINITIONS: Record<CorpType, CorpTypeDefinition> = {
  [CorpType.Exploitation]: {
    type: CorpType.Exploitation,
    name: 'Exploitation',
    description: 'Specializes in resource extraction. The backbone of the empire\'s raw material supply.',
    primaryDomains: [InfraDomain.Mining, InfraDomain.DeepMining, InfraDomain.GasExtraction],
    specialAbilities: [
      'Can be commissioned for Mining Outpost colonization contracts',
    ],
  },
  [CorpType.Construction]: {
    type: CorpType.Construction,
    name: 'Construction',
    description: 'Builds civilian and public infrastructure. Required for colonization contracts.',
    primaryDomains: [InfraDomain.Civilian],
    specialAbilities: [
      'Required for Colonization contracts',
      'Can establish outposts on rejected planets independently',
    ],
  },
  [CorpType.Industrial]: {
    type: CorpType.Industrial,
    name: 'Industrial',
    description: 'Operates manufacturing facilities. Drives consumer goods and industrial output.',
    primaryDomains: [InfraDomain.LowIndustry, InfraDomain.HeavyIndustry, InfraDomain.HighTechIndustry],
    specialAbilities: [],
  },
  [CorpType.Shipbuilding]: {
    type: CorpType.Shipbuilding,
    name: 'Shipbuilding',
    description: 'Builds ships. Develops unique schematics that define each corp\'s fleet signature.',
    primaryDomains: [InfraDomain.SpaceIndustry],
    specialAbilities: [
      'Develops proprietary schematics from science discoveries',
      'Required for Ship Commission contracts',
    ],
  },
  [CorpType.Science]: {
    type: CorpType.Science,
    name: 'Science',
    description: 'Drives technological advancement and discoveries. Owns patents.',
    primaryDomains: [InfraDomain.Science],
    specialAbilities: [
      'Rolls for discoveries each turn',
      'Develops patents from discoveries',
      'Can be commissioned for Science Outpost colonization contracts',
    ],
  },
  [CorpType.Transport]: {
    type: CorpType.Transport,
    name: 'Transport',
    description: 'Builds transport infrastructure and operates trade routes between sectors.',
    primaryDomains: [InfraDomain.Transport],
    specialAbilities: [
      'Required for Trade Route contracts',
    ],
  },
  [CorpType.Military]: {
    type: CorpType.Military,
    name: 'Military',
    description: 'Provides security and executes military missions.',
    primaryDomains: [InfraDomain.Military],
    specialAbilities: [
      'Executes military missions',
      'Can commission ships from shipbuilding corps',
      'Can be commissioned for Military Outpost colonization contracts',
    ],
  },
  [CorpType.Exploration]: {
    type: CorpType.Exploration,
    name: 'Exploration',
    description: 'Explores unknown sectors and surveys newly discovered planets.',
    primaryDomains: [],
    specialAbilities: [
      'Required for Exploration contracts',
      'Required for Ground Survey contracts',
    ],
  },
  [CorpType.Agriculture]: {
    type: CorpType.Agriculture,
    name: 'Agriculture',
    description: 'Develops agricultural infrastructure to feed growing colonies.',
    primaryDomains: [InfraDomain.Agricultural],
    specialAbilities: [],
  },
}
