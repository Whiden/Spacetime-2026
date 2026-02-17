/**
 * sector-names.ts — Sector name generation pools (50+ names minimum).
 * Used by sector-generator.ts for procedural galaxy generation.
 */

/** Pool of sector names. At least 50 unique names. */
export const SECTOR_NAMES: string[] = [
  // Stellar designations
  'Alpha Centauri', 'Arcturus', 'Altair', 'Aldebaran', 'Antares',
  'Betelgeuse', 'Bellatrix', 'Barnard\'s Reach',
  'Canopus', 'Capella', 'Castor', 'Cetus',
  'Deneb', 'Denebola', 'Dubhe',
  'Eridanus', 'Epsilon Reach',
  'Fomalhaut', 'Fornax Deep',
  'Gemini Expanse', 'Groombridge',
  'Hadar', 'Hamal', 'Hydrae Belt',
  'Iota Reach',
  'Kappa Sector',
  'Lambda Expanse', 'Lacaille Reach',
  'Mira', 'Mirach', 'Mintaka', 'Mirzam',
  'Nunki',
  'Ophiuchi Drift',
  'Pollux', 'Procyon', 'Proxima',
  'Rasalhague', 'Regulus', 'Rigel',
  'Shaula', 'Sirius', 'Spica',
  'Tauri Expanse', 'Thuban',
  'Unuk',
  'Vega', 'Volans',
  'Wasat', 'Wezen',

  // Descriptive / evocative names
  'Ashfall Corridor',
  'Black Margin', 'Brightedge',
  'Cascading Fields', 'Coldreach', 'Coreward',
  'Darkspur', 'Deep Margin', 'Distant March',
  'Ember Reach', 'Ether Drift',
  'Far Corridor', 'Frontier Reach',
  'Ghost Corridor',
  'Halo Fringe',
  'Ironspur',
  'Junction', 'Jumpgate Sector',
  'Keystone',
  'Last Reach',
  'Margin Deep', 'Middle Corridor',
  'Narrow Gate',
  'Outpost Line',
  'Pale Reach', 'Perdition',
  'Rimward', 'Rough Corridor',
  'Shatteredfield', 'Silence',
  'Terminal Reach', 'The Divide', 'The Threshold',
  'Uncertain Margin',
  'Veil',
  'Waystone',
  'Xeno Frontier',
]

/** Verify at least 50 names available. */
if (SECTOR_NAMES.length < 50) {
  throw new Error(`sector-names.ts: Insufficient sector name pool (${SECTOR_NAMES.length} < 50 required)`)
}
