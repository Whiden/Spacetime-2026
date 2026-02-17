/**
 * corporation-names.ts — Name generation pools for corporations.
 * See Structure.md: "50+ prefixes, 50+ suffixes minimum"
 * Generated names: "[Prefix] [Suffix]" or "[Prefix] [Connector] [Suffix]"
 */

/** Corporate name prefixes (50+). Can stand alone or combine with a suffix. */
export const CORP_NAME_PREFIXES: string[] = [
  // Abstract / evocative
  'Apex', 'Astra', 'Atlas', 'Aurum', 'Axiom',
  'Beacon', 'Boreal', 'Bright', 'Broad',
  'Cascade', 'Catalyst', 'Centauri', 'Cerulean', 'Citadel',
  'Cobalt', 'Collective', 'Condor', 'Core', 'Crest',
  'Crown', 'Cygnus',
  'Delta', 'Drake', 'Dusk',
  'Eclipse', 'Embark', 'Empire', 'Endure', 'Epoch',
  'Equinox', 'Esper', 'Ethos',
  'Farreach', 'Ferrum', 'Frontier',
  'Galactic', 'Genesis', 'Granite', 'Gust',
  'Halo', 'Harbinger', 'Helix', 'Helion', 'Horizon',
  'Hydra',
  'Ignite', 'Imprint', 'Inertia', 'Infinite', 'Ion',
  'Ironwall', 'Ironwood',
  'Junction',
  'Keystone',
  'Lattice', 'Lodestar', 'Luminary', 'Lynx',
  'Meridian', 'Meso', 'Minera', 'Momentum',
  'Nautilus', 'Nebula', 'Nexus', 'Nova',
  'Obsidian', 'Olympus', 'Onyx', 'Orbit', 'Outreach',
  'Pangea', 'Pathfinder', 'Peak', 'Phoenix', 'Pinnacle',
  'Pioneer', 'Polaris', 'Pulse',
  'Quantum',
  'Radiant', 'Rampart', 'Reach', 'Redstone', 'Relay',
  'Rimward', 'Rockwall', 'Rubric',
  'Sentinel', 'Seraph', 'Silver', 'Skyward', 'Solace',
  'Solaris', 'Sovereign', 'Spectra', 'Starfall', 'Stargate',
  'Stasis', 'Steadfast', 'Stellar', 'Summit',
  'Techne', 'Terran', 'Titan', 'Torch', 'Torus',
  'Traverse', 'Trident',
  'Umbral', 'Unified', 'Uplift',
  'Valiant', 'Vanguard', 'Vault', 'Vector', 'Velocity',
  'Venn', 'Ventus', 'Verdant', 'Vertex', 'Vortex',
  'Wayfarer', 'Waypoint', 'Weld', 'Wilder', 'Windlass',
  'Xeno', 'Xenon',
  'Zeal', 'Zenith', 'Zero',
]

/** Corporate name suffixes (50+). Combined with a prefix. */
export const CORP_NAME_SUFFIXES: string[] = [
  // Corporate / institutional
  'Associates', 'Authority',
  'Bureau',
  'Capital', 'Collective', 'Commerce', 'Combine', 'Company',
  'Consortium', 'Contracting', 'Corp', 'Corporation',
  'Development', 'Directorate', 'Division', 'Dynamics',
  'Engineering', 'Enterprise', 'Enterprises', 'Exchange',
  'Extraction', 'Exploratory',
  'Federation', 'Fields', 'Firm', 'Foundation', 'Futures',
  'Group', 'Guild',
  'Holdings', 'House',
  'Industries', 'Initiatives', 'Institute', 'Integrated',
  'Junction',
  'Logistics',
  'Manufacturing', 'Mining', 'Motion',
  'Navigation', 'Networks',
  'Operations',
  'Partners', 'Pathways', 'Procurement', 'Projects',
  'Resources', 'Research',
  'Sciences', 'Securities', 'Services', 'Solutions', 'Systems',
  'Tech', 'Technologies', 'Territories', 'Trading', 'Transit',
  'Union',
  'Ventures',
  'Works',
]

/** Connector words used between prefix and suffix for variety. */
export const CORP_NAME_CONNECTORS: string[] = [
  '&', 'and', 'of',
]

/**
 * Weight for using a connector vs. direct prefix+suffix join (0-100%).
 * 20% chance of using a connector like "Apex & Nexus Corp"
 */
export const CORP_NAME_CONNECTOR_CHANCE = 20
