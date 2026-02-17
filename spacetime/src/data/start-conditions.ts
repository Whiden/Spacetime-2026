/**
 * start-conditions.ts — Terra Nova, starting colony, starting budget, and galaxy seed.
 * See Data.md § 17 Start Conditions.
 *
 * These values define the initial game state for every new game.
 * Terra Nova is the only pre-defined planet — all others are procedurally generated.
 *
 * TODO (Story 12.4): game.store.ts initializeGame() uses these values.
 */

import {
  PlanetType,
  PlanetSize,
  PlanetStatus,
  DepositType,
  RichnessLevel,
  InfraDomain,
  ColonyType,
} from '../types/common'

// ─── Terra Nova Planet ────────────────────────────────────────────────────────

/** Terra Nova's fixed planet properties. */
export const TERRA_NOVA_PLANET = {
  name: 'Terra Nova',
  type: PlanetType.Continental,
  size: PlanetSize.Large,
  status: PlanetStatus.Colonized,
  baseHabitability: 8,
  /** Pre-defined features for Terra Nova. */
  features: [
    'TemperateClimate',
    'FertilePlains',
    'StrategicLocation',
  ],
  /** Pre-defined deposits for Terra Nova. */
  deposits: [
    { type: DepositType.FertileGround, richness: RichnessLevel.Rich, richnessRevealed: true },
    { type: DepositType.CommonOreVein, richness: RichnessLevel.Moderate, richnessRevealed: true },
    { type: DepositType.RareOreVein, richness: RichnessLevel.Poor, richnessRevealed: true },
  ],
} as const

// ─── Starting Colony ──────────────────────────────────────────────────────────

/** Terra Nova's starting colony properties. */
export const STARTING_COLONY = {
  name: 'Terra Nova',
  type: ColonyType.FrontierColony,
  populationLevel: 7,
} as const

/** Starting infrastructure levels for Terra Nova (from Data.md § 17). */
export interface StartingInfraLevel {
  domain: InfraDomain
  publicLevels: number
}

export const STARTING_INFRASTRUCTURE: StartingInfraLevel[] = [
  { domain: InfraDomain.Civilian, publicLevels: 14 },
  { domain: InfraDomain.Mining, publicLevels: 2 },
  { domain: InfraDomain.Agricultural, publicLevels: 3 },
  { domain: InfraDomain.LowIndustry, publicLevels: 2 },
  { domain: InfraDomain.Transport, publicLevels: 2 },
  { domain: InfraDomain.Science, publicLevels: 1 },
  { domain: InfraDomain.HeavyIndustry, publicLevels: 1 },
  { domain: InfraDomain.HighTechIndustry, publicLevels: 1 },
  { domain: InfraDomain.SpaceIndustry, publicLevels: 1 },
  { domain: InfraDomain.Military, publicLevels: 2 },
]

// ─── Starting Budget ──────────────────────────────────────────────────────────

/** Budget Points at game start. */
export const STARTING_BP = 10

// ─── Starting Galaxy ──────────────────────────────────────────────────────────

/** Galaxy generation parameters. */
export const GALAXY_GENERATION_PARAMS = {
  /** Total number of sectors to generate. */
  sectorCountMin: 10,
  sectorCountMax: 15,
  /** Connections for the starting sector. */
  startingSectorConnectionsMin: 2,
  startingSectorConnectionsMax: 3,
  /** All sectors: min 2, max 4 connections. */
  minConnectionsPerSector: 2,
  maxConnectionsPerSector: 4,
  /** Number of bottleneck sectors (exactly 2 connections). */
  bottleneckSectorCountMin: 1,
  bottleneckSectorCountMax: 2,
  /** Maximum hops from start to the furthest sector. */
  maxHopsFromStart: 5,
  /** Starting sector exploration percentage. */
  startingSectorExplorationPercent: 10,
} as const

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum debt tokens the empire can accumulate. */
export const MAX_DEBT_TOKENS = 10

/** BP to spend adding 1 public infrastructure level to any colony. */
export const DIRECT_INVEST_COST_BP = 3

/** BP cost when a debt token is cleared at the start of a turn. */
export const DEBT_TOKEN_CLEAR_COST_BP = 1
