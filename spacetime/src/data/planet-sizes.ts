/**
 * planet-sizes.ts — Planet size definitions with population caps, slot counts, and spawn weights.
 * See Data.md § 4 Planet Sizes.
 */

import { PlanetSize } from '../types/common'

export interface PlanetSizeDefinition {
  size: PlanetSize
  name: string
  maxPopulationLevel: number
  depositSlots: { min: number; max: number }
  featureSlots: { min: number; max: number }
  spawnWeight: number
}

export const PLANET_SIZE_DEFINITIONS: Record<PlanetSize, PlanetSizeDefinition> = {
  [PlanetSize.Tiny]: {
    size: PlanetSize.Tiny,
    name: 'Tiny',
    maxPopulationLevel: 4,
    depositSlots: { min: 1, max: 3 },
    featureSlots: { min: 1, max: 1 },
    spawnWeight: 15,
  },
  [PlanetSize.Small]: {
    size: PlanetSize.Small,
    name: 'Small',
    maxPopulationLevel: 5,
    depositSlots: { min: 2, max: 4 },
    featureSlots: { min: 1, max: 2 },
    spawnWeight: 25,
  },
  [PlanetSize.Medium]: {
    size: PlanetSize.Medium,
    name: 'Medium',
    maxPopulationLevel: 8,
    depositSlots: { min: 3, max: 5 },
    featureSlots: { min: 2, max: 3 },
    spawnWeight: 30,
  },
  [PlanetSize.Large]: {
    size: PlanetSize.Large,
    name: 'Large',
    maxPopulationLevel: 9,
    depositSlots: { min: 4, max: 6 },
    featureSlots: { min: 2, max: 4 },
    spawnWeight: 20,
  },
  [PlanetSize.Huge]: {
    size: PlanetSize.Huge,
    name: 'Huge',
    maxPopulationLevel: 10,
    depositSlots: { min: 5, max: 8 },
    featureSlots: { min: 3, max: 5 },
    spawnWeight: 10,
  },
}

export const PLANET_SIZE_SPAWN_WEIGHTS = Object.values(PLANET_SIZE_DEFINITIONS).map((def) => ({
  value: def.size,
  weight: def.spawnWeight,
}))
