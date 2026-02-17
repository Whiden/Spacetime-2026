/**
 * common.ts — Shared types used across the entire project.
 *
 * Contains:
 * - Branded ID types for all game entities
 * - Branded scalar types (TurnNumber, BPAmount)
 * - All shared enums referenced by multiple systems
 *
 * No Vue or Pinia imports. No game logic.
 */

// ─── Branded ID Types ─────────────────────────────────────────────────────────
// All entity IDs are strings prefixed by type for debuggability (e.g., "col_abc123").
// The branded pattern prevents accidentally passing a CorpId where a ColonyId is expected.

export type ColonyId = string & { readonly _brand: 'ColonyId' }
export type CorpId = string & { readonly _brand: 'CorpId' }
export type ContractId = string & { readonly _brand: 'ContractId' }
export type ShipId = string & { readonly _brand: 'ShipId' }
export type MissionId = string & { readonly _brand: 'MissionId' }
export type SectorId = string & { readonly _brand: 'SectorId' }
export type PlanetId = string & { readonly _brand: 'PlanetId' }
export type PatentId = string & { readonly _brand: 'PatentId' }
export type SchematicId = string & { readonly _brand: 'SchematicId' }
export type DiscoveryId = string & { readonly _brand: 'DiscoveryId' }
export type CaptainId = string & { readonly _brand: 'CaptainId' }
export type EventId = string & { readonly _brand: 'EventId' }
export type ModifierId = string & { readonly _brand: 'ModifierId' }

// ─── Branded Scalar Types ─────────────────────────────────────────────────────

/** Abstract turn counter. One turn = one turn. */
export type TurnNumber = number & { readonly _brand: 'TurnNumber' }

/** Budget Points — the single currency of the game. Always an integer. */
export type BPAmount = number & { readonly _brand: 'BPAmount' }

// ─── Planet Enums ─────────────────────────────────────────────────────────────

/** Planet type affects base habitability, available deposit pools, and spawn weight. */
export enum PlanetType {
  Continental = 'Continental',
  Jungle = 'Jungle',
  Water = 'Water',
  Swamp = 'Swamp',
  Arid = 'Arid',
  Tundra = 'Tundra',
  Rocky = 'Rocky',
  Volcanic = 'Volcanic',
  Barren = 'Barren',
  GasGiant = 'GasGiant',
}

/** Planet size affects max population level, deposit slots, and feature slots. */
export enum PlanetSize {
  Tiny = 'Tiny',
  Small = 'Small',
  Medium = 'Medium',
  Large = 'Large',
  Huge = 'Huge',
}

/**
 * Lifecycle status of a planet.
 * Undiscovered → OrbitScanned → GroundSurveyed → Accepted/Rejected → Colonized
 */
export enum PlanetStatus {
  Undiscovered = 'Undiscovered',
  OrbitScanned = 'OrbitScanned',
  GroundSurveyed = 'GroundSurveyed',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
  Colonized = 'Colonized',
}

// ─── Deposit Enums ────────────────────────────────────────────────────────────

/** Natural resource deposits found on planets. */
export enum DepositType {
  FertileGround = 'FertileGround',
  RichOcean = 'RichOcean',
  FungalNetworks = 'FungalNetworks',
  ThermalVentEcosystem = 'ThermalVentEcosystem',
  CommonOreVein = 'CommonOreVein',
  CarbonBasedLand = 'CarbonBasedLand',
  SurfaceMetalFields = 'SurfaceMetalFields',
  GlacialDeposits = 'GlacialDeposits',
  RareOreVein = 'RareOreVein',
  CrystalFormations = 'CrystalFormations',
  TectonicSeams = 'TectonicSeams',
  AncientSeabed = 'AncientSeabed',
  GasPocket = 'GasPocket',
  SubsurfaceIceReserves = 'SubsurfaceIceReserves',
  VolcanicFumaroles = 'VolcanicFumaroles',
  AtmosphericLayers = 'AtmosphericLayers',
}

/** Deposit richness determines the extraction cap for the matching infrastructure domain. */
export enum RichnessLevel {
  Poor = 'Poor',         // cap: 5
  Moderate = 'Moderate', // cap: 10
  Rich = 'Rich',         // cap: 15
  Exceptional = 'Exceptional', // cap: 20
}

// ─── Resource Enums ───────────────────────────────────────────────────────────

/**
 * All nine tradeable resource types plus Transport Capacity (consumed locally).
 * Resources are either extracted, manufactured, or service-based.
 */
export enum ResourceType {
  // Extracted from deposits
  Food = 'Food',
  CommonMaterials = 'CommonMaterials',
  RareMaterials = 'RareMaterials',
  Volatiles = 'Volatiles',
  // Manufactured
  ConsumerGoods = 'ConsumerGoods',
  HeavyMachinery = 'HeavyMachinery',
  HighTechGoods = 'HighTechGoods',
  ShipParts = 'ShipParts',
  // Service (consumed locally, not traded)
  TransportCapacity = 'TransportCapacity',
}

// ─── Infrastructure Enums ─────────────────────────────────────────────────────

/**
 * Infrastructure domains. Each domain has production/consumption rules and a cap.
 * See Data.md § Infrastructure Domains for full domain definitions.
 */
export enum InfraDomain {
  Civilian = 'Civilian',           // Uncapped, no production
  Mining = 'Mining',               // Produces CommonMaterials
  DeepMining = 'DeepMining',       // Produces RareMaterials
  GasExtraction = 'GasExtraction', // Produces Volatiles
  Agricultural = 'Agricultural',   // Produces Food
  LowIndustry = 'LowIndustry',     // Produces ConsumerGoods, consumes CommonMaterials
  HeavyIndustry = 'HeavyIndustry', // Produces HeavyMachinery, consumes CommonMaterials + RareMaterials
  HighTechIndustry = 'HighTechIndustry', // Produces HighTechGoods, consumes RareMaterials + Volatiles
  SpaceIndustry = 'SpaceIndustry', // Produces ShipParts, consumes HighTechGoods + HeavyMachinery
  Transport = 'Transport',         // Produces TransportCapacity
  Science = 'Science',             // Produces Research Points (RP)
  Military = 'Military',           // Produces Security Points (SP)
}

// ─── Colony Enums ─────────────────────────────────────────────────────────────

/**
 * Colony type is set by the colonization contract.
 * Determines starting infrastructure, passive bonus, and BP/turn cost.
 */
export enum ColonyType {
  FrontierColony = 'FrontierColony',
  MiningOutpost = 'MiningOutpost',
  ScienceOutpost = 'ScienceOutpost',
  MilitaryOutpost = 'MilitaryOutpost',
}

// ─── Corporation Enums ────────────────────────────────────────────────────────

/**
 * Corporation primary specialization type. Determines what infrastructure
 * a corp invests in by default and which contracts it is eligible for.
 */
export enum CorpType {
  Exploitation = 'Exploitation',   // Mining, DeepMining, GasExtraction
  Construction = 'Construction',   // Civilian, colonization contracts
  Industrial = 'Industrial',       // LowIndustry, HeavyIndustry, HighTechIndustry
  Shipbuilding = 'Shipbuilding',   // SpaceIndustry, ship commission
  Science = 'Science',             // Science, discoveries, patents
  Transport = 'Transport',         // Transport, trade routes
  Military = 'Military',           // Military, missions, ship commission
  Exploration = 'Exploration',     // Exploration and ground survey contracts
  Agriculture = 'Agriculture',     // Agricultural
}

/**
 * Personality traits influence corp AI behavior. 1-2 traits per corp.
 * Conflicting pairs: Cautious/Aggressive, Innovative/Conservative, Ethical/Ruthless.
 */
export enum CorpPersonalityTrait {
  Cautious = 'Cautious',
  Aggressive = 'Aggressive',
  Innovative = 'Innovative',
  Conservative = 'Conservative',
  Opportunistic = 'Opportunistic',
  Ethical = 'Ethical',
  Ruthless = 'Ruthless',
  Efficient = 'Efficient',
}

// ─── Contract Enums ───────────────────────────────────────────────────────────

/** Contract types represent every distinct player-initiated action. */
export enum ContractType {
  Exploration = 'Exploration',
  GroundSurvey = 'GroundSurvey',
  Colonization = 'Colonization',
  ShipCommission = 'ShipCommission',
  TradeRoute = 'TradeRoute',
}

/** Lifecycle status of a contract. */
export enum ContractStatus {
  Active = 'Active',
  Completed = 'Completed',
  Failed = 'Failed',
}

// ─── Mission Enums ────────────────────────────────────────────────────────────

/** Mission types define the purpose and cost structure of a military deployment. */
export enum MissionType {
  Escort = 'Escort',
  Assault = 'Assault',
  Defense = 'Defense',
  Rescue = 'Rescue',
  Investigation = 'Investigation',
}

/** Phase of an active mission. */
export enum MissionPhase {
  Travel = 'Travel',
  Execution = 'Execution',
  Return = 'Return',
  Completed = 'Completed',
}

// ─── Ship Enums ───────────────────────────────────────────────────────────────

/**
 * Ship roles define the purpose and base stat profile for a commissioned ship.
 * The building corp interprets the role through its own capabilities and schematics.
 */
export enum ShipRole {
  SystemPatrol = 'SystemPatrol',
  Escort = 'Escort',
  Recon = 'Recon',
  Assault = 'Assault',
  Carrier = 'Carrier',
  Flagship = 'Flagship',
  Transport = 'Transport',
}

/** Size variant requested at ship commission time. Scales cost, build time, and stats. */
export enum SizeVariant {
  Light = 'Light',       // ×0.75 multiplier
  Standard = 'Standard', // ×1.0 multiplier
  Heavy = 'Heavy',       // ×1.25 multiplier
}

/** Current operational status of a ship. */
export enum ShipStatus {
  Stationed = 'Stationed',
  OnMission = 'OnMission',
  UnderRepair = 'UnderRepair',
  UnderConstruction = 'UnderConstruction',
}

/** Captain experience level, gained through completed missions. */
export enum CaptainExperience {
  Green = 'Green',       // ×0.8 combat modifier — new captains
  Regular = 'Regular',   // ×1.0 — after 2 missions
  Veteran = 'Veteran',   // ×1.1 — after 5 missions
  Elite = 'Elite',       // ×1.2 — after 10 missions
}

// ─── Schematic Enums ──────────────────────────────────────────────────────────

/**
 * Schematic categories for shipbuilding corp equipment blueprints.
 * Schematics are unlocked by science discoveries and are corp-specific.
 * TODO (Story 14.3): wire schematic bonus-per-level values from Data.md once finalized.
 */
export enum SchematicCategory {
  Hull = 'Hull',
  Sensor = 'Sensor',
  Armor = 'Armor',
  Shield = 'Shield',
  Turret = 'Turret',
  Missile = 'Missile',
  Reactor = 'Reactor',
  Engine = 'Engine',
  TargetingSystem = 'TargetingSystem',
  Fighter = 'Fighter',
  Bomber = 'Bomber',
  Gunship = 'Gunship',
  ElectronicSystems = 'ElectronicSystems',
}

// ─── Science Enums ────────────────────────────────────────────────────────────

/**
 * The nine science domains. Each advances based on empire science output.
 * When a domain levels up, it unlocks a discovery pool.
 */
export enum ScienceSectorType {
  Society = 'Society',
  Energy = 'Energy',
  AppliedSciences = 'AppliedSciences',
  Weaponry = 'Weaponry',
  Propulsion = 'Propulsion',
  Construction = 'Construction',
  LifeSciences = 'LifeSciences',
  Materials = 'Materials',
  Computing = 'Computing',
}

// ─── Event Enums ──────────────────────────────────────────────────────────────

/**
 * Visual priority of a game event, determines display order and color coding.
 * Critical (red) → Warning (orange) → Info (white) → Positive (green)
 */
export enum EventPriority {
  Critical = 'Critical',   // Attack, ship destroyed, debt crisis
  Warning = 'Warning',     // Shortage, stability drop
  Info = 'Info',           // Contract progress, discovery
  Positive = 'Positive',   // Contract complete, population growth
}

// ─── Sector Enums ─────────────────────────────────────────────────────────────

/** Sector density affects the number of available exploration contracts. */
export enum SectorDensity {
  Sparse = 'Sparse',
  Moderate = 'Moderate',
  Dense = 'Dense',
}
