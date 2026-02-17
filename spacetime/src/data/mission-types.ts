/**
 * mission-types.ts — Mission type definitions with base costs and durations.
 * See Data.md § 15 Mission Types and Specs.md § 11 Missions.
 */

import { MissionType } from '../types/common'

export interface MissionTypeDefinition {
  type: MissionType
  name: string
  description: string
  baseBpPerTurn: number
  durationRange: { min: number; max: number }
}

export const MISSION_TYPE_DEFINITIONS: Record<MissionType, MissionTypeDefinition> = {
  [MissionType.Escort]: {
    type: MissionType.Escort,
    name: 'Escort',
    description: 'Protect an active contract from piracy or hostile interference.',
    baseBpPerTurn: 1,
    durationRange: { min: 2, max: 10 }, // Matches assigned contract duration
  },
  [MissionType.Assault]: {
    type: MissionType.Assault,
    name: 'Assault',
    description: 'Offensive strike against a hostile target in a sector.',
    baseBpPerTurn: 3,
    durationRange: { min: 3, max: 8 },
  },
  [MissionType.Defense]: {
    type: MissionType.Defense,
    name: 'Defense',
    description: 'Respond to an active threat against a colony or sector.',
    baseBpPerTurn: 2,
    durationRange: { min: 1, max: 3 },
  },
  [MissionType.Rescue]: {
    type: MissionType.Rescue,
    name: 'Rescue',
    description: 'Investigate and recover a missing task force.',
    baseBpPerTurn: 2,
    durationRange: { min: 2, max: 5 },
  },
  [MissionType.Investigation]: {
    type: MissionType.Investigation,
    name: 'Investigation',
    description: 'Explore an anomaly or point of interest requiring military presence.',
    baseBpPerTurn: 1,
    durationRange: { min: 2, max: 4 },
  },
}

/**
 * Large ship surcharge added to mission BP/turn cost.
 * +1 BP/turn per ship with size ≥ SIZE_SURCHARGE_THRESHOLD.
 */
export const MISSION_SIZE_SURCHARGE_THRESHOLD = 7
export const MISSION_SIZE_SURCHARGE_PER_SHIP = 1
