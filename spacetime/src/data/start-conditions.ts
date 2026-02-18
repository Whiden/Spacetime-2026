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
  /** Pre-defined deposits for Terra Nova (from Data.md § 17). */
  deposits: [
    { type: DepositType.CommonOreVein,   richness: RichnessLevel.Moderate, richnessRevealed: true },
    { type: DepositType.CarbonBasedLand, richness: RichnessLevel.Moderate, richnessRevealed: true },
    { type: DepositType.RareOreVein,     richness: RichnessLevel.Poor,     richnessRevealed: true },
    { type: DepositType.FertileGround,   richness: RichnessLevel.Rich,     richnessRevealed: true },
    { type: DepositType.FertileGround,   richness: RichnessLevel.Moderate, richnessRevealed: true },
    { type: DepositType.RichOcean,       richness: RichnessLevel.Moderate, richnessRevealed: true },
    { type: DepositType.GasPocket,       richness: RichnessLevel.Poor,     richnessRevealed: true },
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
  // Civilian is capped at next_pop_level × 2 = 8 × 2 = 16. 14 is safely below cap.
  { domain: InfraDomain.Civilian,          publicLevels: 14 },
  // Mining 5: covers Low Industry 8 + Heavy Industry 1 = up to 9 demand.
  { domain: InfraDomain.Mining,            publicLevels: 5  },
  // Deep Mining 3: Rare Ore (Poor, cap 5). Covers Heavy 1 + High-Tech 1 = 2. Surplus available.
  { domain: InfraDomain.DeepMining,        publicLevels: 3  },
  // Gas Extraction 2: GasPocket (Poor, cap 5). Produces 2 Volatiles. Feeds High-Tech Industry.
  { domain: InfraDomain.GasExtraction,     publicLevels: 2  },
  // Agricultural 10: Fertile Ground (Rich cap 15 + Moderate cap 10) + Rich Ocean + features.
  // Produces 10 Food per turn. Pop demand = 7. Surplus of 3.
  { domain: InfraDomain.Agricultural,      publicLevels: 10 },
  // Low Industry 8: consumes 8 Common Materials (Mining 5 produces 5 → deficit of 3 from market).
  // Produces 8 Consumer Goods. Pop demand = 7. Surplus of 1.
  { domain: InfraDomain.LowIndustry,       publicLevels: 8  },
  // Heavy Industry 1: consumes 1 Common + 1 Rare (both met). Produces 1 Heavy Machinery.
  { domain: InfraDomain.HeavyIndustry,     publicLevels: 1  },
  // High-Tech Industry 1: consumes 1 Rare + 1 Volatile (both available). Produces 1 High-Tech Goods.
  { domain: InfraDomain.HighTechIndustry,  publicLevels: 1  },
  // Space Industry 1: needs 1 Heavy Machinery + 1 High-Tech Goods (both available with 1 each).
  { domain: InfraDomain.SpaceIndustry,     publicLevels: 1  },
  { domain: InfraDomain.Transport,         publicLevels: 2  },
  // Science 0 public: all science infra is corporate-owned (2 science corps each own 1 level).
  // game.store.ts _spawnStartingCorporations transfers these levels to corporateLevels on the colony.
  { domain: InfraDomain.Science,           publicLevels: 0  },
  { domain: InfraDomain.Military,          publicLevels: 2  },
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
