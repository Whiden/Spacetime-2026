/**
 * planet-features.ts — Planet feature definitions with modifiers, visibility, and spawn conditions.
 * See Data.md § 5 Planet Features for the full table.
 *
 * Features translate into Modifier objects when a colony is founded.
 * The modifier targets match the keys in Structure.md § Modifier Targets.
 */

import { PlanetType, PlanetSize } from '../types/common'

// ─── Feature Modifier Template ────────────────────────────────────────────────

/** A modifier template to be instantiated when a colony is founded on this planet. */
export interface FeatureModifierTemplate {
  target: string
  operation: 'add' | 'multiply'
  value: number
}

// ─── Feature Spawn Condition ──────────────────────────────────────────────────

export interface FeatureSpawnCondition {
  allowedPlanetTypes?: PlanetType[]
  allowedPlanetSizes?: PlanetSize[]
  /** If true, can spawn on any planet type. */
  anyPlanetType?: boolean
}

// ─── Feature Definition ───────────────────────────────────────────────────────

export interface PlanetFeatureDefinition {
  featureId: string
  name: string
  /** Whether the feature is visible from an orbit scan (vs. only revealed by ground survey). */
  orbitVisible: boolean
  /** Spawn chance as a percentage. */
  spawnChance: number
  spawnCondition: FeatureSpawnCondition
  /** Modifier templates to register on the colony when it is founded. */
  modifierTemplates: FeatureModifierTemplate[]
  description: string
}

// ─── Feature Definitions ──────────────────────────────────────────────────────

export const PLANET_FEATURE_DEFINITIONS: PlanetFeatureDefinition[] = [
  {
    featureId: 'TemperateClimate',
    name: 'Temperate Climate',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Continental, PlanetType.Jungle] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: 1 },
      { target: 'maxAgricultural', operation: 'add', value: 5 },
    ],
    description: 'Mild weather patterns make this planet exceptionally suitable for settlement.',
  },
  {
    featureId: 'ExtremeSeasons',
    name: 'Extreme Seasons',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Tundra, PlanetType.Arid] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -1 },
      { target: 'stability', operation: 'add', value: -1 },
    ],
    description: 'Dramatic seasonal swings strain infrastructure and colony morale.',
  },
  {
    featureId: 'FertilePlains',
    name: 'Fertile Plains',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Continental, PlanetType.Jungle, PlanetType.Swamp] },
    modifierTemplates: [
      { target: 'maxAgricultural', operation: 'add', value: 5 },
    ],
    description: 'Vast stretches of arable land dramatically expand agricultural potential.',
  },
  {
    featureId: 'MineralVeins',
    name: 'Mineral Veins',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Rocky, PlanetType.Volcanic, PlanetType.Arid] },
    modifierTemplates: [
      { target: 'maxMining', operation: 'add', value: 5 },
    ],
    description: 'Rich veins of ore run close to the surface, raising the mining ceiling.',
  },
  {
    featureId: 'GeothermalActivity',
    name: 'Geothermal Activity',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Volcanic, PlanetType.Tundra] },
    modifierTemplates: [
      { target: 'maxGasExtraction', operation: 'add', value: 5 },
      { target: 'dynamism', operation: 'add', value: 1 },
    ],
    description: 'Volcanic activity drives abundant energy and volatile production.',
  },
  {
    featureId: 'VastOceans',
    name: 'Vast Oceans',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Continental] },
    modifierTemplates: [
      { target: 'maxAgricultural', operation: 'add', value: 5 },
      { target: 'maxPopulation', operation: 'add', value: -1 },
    ],
    description: 'Huge seas limit available land but support enormous aquatic food production.',
  },
  {
    featureId: 'MountainRanges',
    name: 'Mountain Ranges',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Continental, PlanetType.Rocky, PlanetType.Tundra] },
    modifierTemplates: [
      { target: 'maxDeepMining', operation: 'add', value: 3 },
    ],
    description: 'Towering peaks expose deep geological formations for rare mineral extraction.',
  },
  {
    featureId: 'DenseAtmosphere',
    name: 'Dense Atmosphere',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Jungle, PlanetType.Swamp, PlanetType.GasGiant] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -1 },
      { target: 'maxGasExtraction', operation: 'add', value: 3 },
    ],
    description: 'The thick, oppressive air hampers settlers but holds extractable gases.',
  },
  {
    featureId: 'LowGravity',
    name: 'Low Gravity',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Barren, PlanetType.Rocky] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -1 },
      { target: 'accessibility', operation: 'add', value: 1 },
    ],
    description: 'Light gravity eases transportation but causes long-term health complications.',
  },
  {
    featureId: 'HighGravity',
    name: 'High Gravity',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetSizes: [PlanetSize.Large, PlanetSize.Huge] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -1 },
      { target: 'accessibility', operation: 'add', value: -1 },
      { target: 'deepMiningOutput', operation: 'add', value: 0.5 },
    ],
    description: 'Crushing gravity strains bodies and infrastructure, but compresses ore deposits.',
  },
  {
    featureId: 'ToxicEnvironment',
    name: 'Toxic Environment',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Volcanic, PlanetType.Swamp, PlanetType.Barren] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -2 },
      { target: 'maxGasExtraction', operation: 'add', value: 3 },
    ],
    description: 'The environment is hostile to life, but rich in harvestable toxins and gases.',
  },
  {
    featureId: 'StrategicLocation',
    name: 'Strategic Location',
    orbitVisible: true,
    spawnChance: 5,
    spawnCondition: { anyPlanetType: true },
    modifierTemplates: [
      { target: 'accessibility', operation: 'add', value: 2 },
    ],
    description: 'Positioned at a natural crossroads, this planet is easy to reach and supply.',
  },
  {
    featureId: 'RemoteLocation',
    name: 'Remote Location',
    orbitVisible: true,
    spawnChance: 5,
    spawnCondition: { anyPlanetType: true },
    modifierTemplates: [
      { target: 'accessibility', operation: 'add', value: -2 },
    ],
    description: 'Off the beaten path, this planet is expensive to supply and difficult to reach.',
  },
  {
    featureId: 'RichBiosphere',
    name: 'Rich Biosphere',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Continental, PlanetType.Jungle, PlanetType.Water] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: 1 },
      { target: 'qualityOfLife', operation: 'add', value: 1 },
    ],
    description: 'Abundant native life enriches the environment and improves living conditions.',
  },
  {
    featureId: 'UnstableTectonics',
    name: 'Unstable Tectonics',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Volcanic, PlanetType.Rocky] },
    modifierTemplates: [
      { target: 'stability', operation: 'add', value: -1 },
      { target: 'habitability', operation: 'add', value: -1 },
    ],
    description: 'Frequent tremors and quakes endanger infrastructure and unsettle colonists.',
  },
  {
    featureId: 'PristineEnvironment',
    name: 'Pristine Environment',
    orbitVisible: false,
    spawnChance: 10,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Continental, PlanetType.Water, PlanetType.Jungle] },
    modifierTemplates: [
      { target: 'qualityOfLife', operation: 'add', value: 2 },
    ],
    description: 'Untouched beauty makes this world a desirable place to live.',
  },
  {
    featureId: 'HarshRadiation',
    name: 'Harsh Radiation',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Barren, PlanetType.Rocky] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -2 },
    ],
    description: 'Intense stellar radiation requires heavy shielding and reduces habitable zones.',
  },
  {
    featureId: 'NaturalCaverns',
    name: 'Natural Caverns',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Rocky, PlanetType.Barren, PlanetType.Tundra] },
    modifierTemplates: [
      { target: 'dynamism', operation: 'add', value: 1 },
      { target: 'maxMining', operation: 'add', value: 3 },
    ],
    description: 'Extensive cave systems provide natural infrastructure for mining operations.',
  },
  {
    featureId: 'RareCrystals',
    name: 'Rare Crystals',
    orbitVisible: false,
    spawnChance: 5,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Rocky, PlanetType.Volcanic] },
    modifierTemplates: [
      { target: 'dynamism', operation: 'add', value: 1 },
      { target: 'qualityOfLife', operation: 'add', value: 1 },
    ],
    description: 'Spectacular crystal formations attract interest and boost colony morale.',
  },
  {
    featureId: 'DeepGasPockets',
    name: 'Deep Gas Pockets',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.GasGiant, PlanetType.Volcanic, PlanetType.Tundra] },
    modifierTemplates: [
      { target: 'maxGasExtraction', operation: 'add', value: 5 },
      { target: 'gasExtractionOutput', operation: 'add', value: 0.5 },
    ],
    description: 'Pressurized gas reservoirs deep underground dramatically boost volatiles output.',
  },
  {
    featureId: 'UndergroundRivers',
    name: 'Underground Rivers',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Barren, PlanetType.Rocky, PlanetType.Arid] },
    modifierTemplates: [
      { target: 'maxAgricultural', operation: 'add', value: 3 },
    ],
    description: 'Hidden water flows beneath the surface, enabling agriculture in harsh terrain.',
  },
  {
    featureId: 'MetallicCore',
    name: 'Metallic Core',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Rocky, PlanetType.Volcanic, PlanetType.Barren] },
    modifierTemplates: [
      { target: 'miningOutput', operation: 'add', value: 0.5 },
    ],
    description: 'An unusually dense metallic core increases ore output per mining level.',
  },
  {
    featureId: 'PerpetualStorms',
    name: 'Perpetual Storms',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.GasGiant, PlanetType.Water, PlanetType.Jungle] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -1 },
      { target: 'stability', operation: 'add', value: -1 },
      { target: 'gasExtractionOutput', operation: 'add', value: 0.5 },
    ],
    description: 'Endless tempests batter infrastructure but drive constant atmospheric churn.',
  },
  {
    featureId: 'FrozenWastes',
    name: 'Frozen Wastes',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Tundra, PlanetType.Barren] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -1 },
      { target: 'maxMining', operation: 'add', value: 3 },
    ],
    description: 'Ice-locked terrain restricts settlement but preserves ore near the surface.',
  },
  {
    featureId: 'TidalLocked',
    name: 'Tidal Locked',
    orbitVisible: true,
    spawnChance: 15,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Rocky, PlanetType.Barren] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -2 },
      { target: 'dynamism', operation: 'add', value: 1 },
      { target: 'maxMining', operation: 'add', value: 3 },
    ],
    description: 'One side forever dark, one forever lit — harsh extremes drive unusual colony cultures.',
  },
  {
    featureId: 'AncientRuins',
    name: 'Ancient Ruins',
    orbitVisible: false,
    spawnChance: 3,
    spawnCondition: { anyPlanetType: true },
    modifierTemplates: [
      { target: 'dynamism', operation: 'add', value: 2 },
      { target: 'maxScience', operation: 'add', value: 5 },
    ],
    description: 'The remains of a vanished civilization inspire researchers and traders alike.',
  },
  {
    featureId: 'SubterraneanOcean',
    name: 'Subterranean Ocean',
    orbitVisible: false,
    spawnChance: 10,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Tundra, PlanetType.Rocky, PlanetType.Barren] },
    modifierTemplates: [
      { target: 'maxAgricultural', operation: 'add', value: 5 },
      { target: 'habitability', operation: 'add', value: 1 },
    ],
    description: 'A hidden ocean far below the surface transforms agricultural possibilities.',
  },
  {
    featureId: 'MagneticAnomalies',
    name: 'Magnetic Anomalies',
    orbitVisible: false,
    spawnChance: 15,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Rocky, PlanetType.Volcanic, PlanetType.Arid] },
    modifierTemplates: [
      { target: 'maxScience', operation: 'add', value: -3 },
      { target: 'maxDeepMining', operation: 'add', value: 5 },
    ],
    description: 'Powerful magnetic fields disrupt equipment but concentrate deep ore deposits.',
  },
  {
    featureId: 'DenseCanopy',
    name: 'Dense Canopy',
    orbitVisible: false,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Jungle, PlanetType.Swamp] },
    modifierTemplates: [
      { target: 'maxAgricultural', operation: 'add', value: 3 },
      { target: 'accessibility', operation: 'add', value: -1 },
    ],
    description: 'Thick forest cover supports farming but hinders movement and logistics.',
  },
  {
    featureId: 'ShallowCrust',
    name: 'Shallow Crust',
    orbitVisible: false,
    spawnChance: 15,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Volcanic, PlanetType.Arid, PlanetType.Rocky] },
    modifierTemplates: [
      { target: 'maxMining', operation: 'add', value: 3 },
      { target: 'maxDeepMining', operation: 'add', value: 3 },
      { target: 'stability', operation: 'add', value: -1 },
    ],
    description: 'A thin crust allows easy access to minerals but tremors are frequent.',
  },
  {
    featureId: 'OrbitalDebrisRing',
    name: 'Orbital Debris Ring',
    orbitVisible: true,
    spawnChance: 5,
    spawnCondition: { anyPlanetType: true },
    modifierTemplates: [
      { target: 'accessibility', operation: 'add', value: -1 },
      { target: 'maxSpaceIndustry', operation: 'add', value: 3 },
    ],
    description: 'Orbiting debris complicates navigation but provides raw material for space industry.',
  },
  {
    featureId: 'AbundantWildlife',
    name: 'Abundant Wildlife',
    orbitVisible: false,
    spawnChance: 15,
    spawnCondition: {
      allowedPlanetTypes: [PlanetType.Continental, PlanetType.Jungle, PlanetType.Water, PlanetType.Swamp],
    },
    modifierTemplates: [
      { target: 'qualityOfLife', operation: 'add', value: 1 },
      { target: 'maxAgricultural', operation: 'add', value: 3 },
    ],
    description: 'Diverse native fauna enriches the ecosystem and provides agricultural resources.',
  },
  {
    featureId: 'DustStorms',
    name: 'Dust Storms',
    orbitVisible: true,
    spawnChance: 20,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Arid, PlanetType.Barren] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: -1 },
      { target: 'accessibility', operation: 'add', value: -1 },
    ],
    description: 'Relentless dust storms scour the surface, damaging equipment and morale.',
  },
  {
    featureId: 'AuroralActivity',
    name: 'Auroral Activity',
    orbitVisible: true,
    spawnChance: 15,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Tundra, PlanetType.GasGiant] },
    modifierTemplates: [
      { target: 'qualityOfLife', operation: 'add', value: 1 },
    ],
    description: 'Breathtaking light shows in the sky improve colonist morale.',
  },
  {
    featureId: 'DormantSupervolcano',
    name: 'Dormant Supervolcano',
    orbitVisible: false,
    spawnChance: 10,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Volcanic, PlanetType.Rocky] },
    modifierTemplates: [
      { target: 'stability', operation: 'add', value: -2 },
      { target: 'dynamism', operation: 'add', value: 1 },
      { target: 'maxGasExtraction', operation: 'add', value: 5 },
    ],
    description: 'A sleeping giant. Immense volatile reserves offset the existential risk.',
  },
  {
    featureId: 'PreciousMetalsVein',
    name: 'Precious Metals Vein',
    orbitVisible: false,
    spawnChance: 10,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Arid, PlanetType.Rocky, PlanetType.Continental] },
    modifierTemplates: [
      { target: 'deepMiningOutput', operation: 'add', value: 0.5 },
      { target: 'dynamism', operation: 'add', value: 1 },
    ],
    description: 'Rare metals fetch premium prices and attract corporate investment.',
  },
  {
    featureId: 'CollapsedStarFragment',
    name: 'Collapsed Star Fragment',
    orbitVisible: false,
    spawnChance: 5,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Barren, PlanetType.Rocky] },
    modifierTemplates: [
      { target: 'deepMiningOutput', operation: 'add', value: 0.5 },
      { target: 'miningOutput', operation: 'add', value: 0.5 },
      { target: 'habitability', operation: 'add', value: -1 },
    ],
    description: 'Exotic dense matter from a stellar remnant boosts all extraction but harms habitability.',
  },
  {
    featureId: 'BreathableAtmosphere',
    name: 'Breathable Atmosphere',
    orbitVisible: true,
    spawnChance: 10,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Continental, PlanetType.Jungle] },
    modifierTemplates: [
      { target: 'habitability', operation: 'add', value: 2 },
    ],
    description: 'Clean, breathable air eliminates the need for life support infrastructure.',
  },
  {
    featureId: 'CoralReefs',
    name: 'Coral Reefs',
    orbitVisible: false,
    spawnChance: 15,
    spawnCondition: { allowedPlanetTypes: [PlanetType.Water, PlanetType.Swamp] },
    modifierTemplates: [
      { target: 'maxAgricultural', operation: 'add', value: 5 },
      { target: 'qualityOfLife', operation: 'add', value: 1 },
    ],
    description: 'Vibrant reef ecosystems support both food production and colonist wellbeing.',
  },
]

/** Lookup map for fast feature definition access. */
export const PLANET_FEATURE_BY_ID: Record<string, PlanetFeatureDefinition> =
  Object.fromEntries(PLANET_FEATURE_DEFINITIONS.map((f) => [f.featureId, f]))
