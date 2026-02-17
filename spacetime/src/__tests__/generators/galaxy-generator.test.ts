/**
 * galaxy-generator.test.ts — Tests for full galaxy generation.
 *
 * Verifies: sector count, adjacency connectivity, connection limits,
 * bottleneck count, max hops, starting sector properties.
 */

import { describe, it, expect } from 'vitest'
import { generateGalaxy } from '../../generators/galaxy-generator'
import { GALAXY_GENERATION_PARAMS } from '../../data/start-conditions'
import type { SectorId } from '../../types/common'
import type { Galaxy } from '../../types/sector'

// ─── Helper: BFS distance from start ─────────────────────────────────────────

function bfsDistances(galaxy: Galaxy): Map<SectorId, number> {
  const distances = new Map<SectorId, number>()
  const queue: SectorId[] = [galaxy.startingSectorId]
  distances.set(galaxy.startingSectorId, 0)

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDist = distances.get(current)!
    for (const neighbor of galaxy.adjacency.get(current) ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1)
        queue.push(neighbor)
      }
    }
  }

  return distances
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateGalaxy', () => {
  // Generate multiple galaxies to test probabilistic constraints
  const galaxies: Galaxy[] = Array.from({ length: 10 }, () => generateGalaxy())

  it('generates 10-15 sectors', () => {
    for (const galaxy of galaxies) {
      expect(galaxy.sectors.size).toBeGreaterThanOrEqual(GALAXY_GENERATION_PARAMS.sectorCountMin)
      expect(galaxy.sectors.size).toBeLessThanOrEqual(GALAXY_GENERATION_PARAMS.sectorCountMax)
    }
  })

  it('has unique sector names', () => {
    for (const galaxy of galaxies) {
      const names = [...galaxy.sectors.values()].map((s) => s.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    }
  })

  it('has unique sector IDs', () => {
    for (const galaxy of galaxies) {
      const ids = [...galaxy.sectors.keys()]
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    }
  })

  it('has a valid startingSectorId that exists in sectors', () => {
    for (const galaxy of galaxies) {
      expect(galaxy.sectors.has(galaxy.startingSectorId)).toBe(true)
    }
  })

  it('sets starting sector exploration to configured value', () => {
    for (const galaxy of galaxies) {
      const startSector = galaxy.sectors.get(galaxy.startingSectorId)!
      expect(startSector.explorationPercent).toBe(
        GALAXY_GENERATION_PARAMS.startingSectorExplorationPercent,
      )
    }
  })

  it('sets non-starting sectors to 0% exploration', () => {
    for (const galaxy of galaxies) {
      for (const [id, sector] of galaxy.sectors) {
        if (id !== galaxy.startingSectorId) {
          expect(sector.explorationPercent).toBe(0)
        }
      }
    }
  })
})

describe('adjacency graph — connectivity', () => {
  const galaxies: Galaxy[] = Array.from({ length: 10 }, () => generateGalaxy())

  it('all sectors are reachable from start (connected graph)', () => {
    for (const galaxy of galaxies) {
      const distances = bfsDistances(galaxy)
      // Every sector should have a distance (= is reachable)
      expect(distances.size).toBe(galaxy.sectors.size)
    }
  })

  it('adjacency is bidirectional', () => {
    for (const galaxy of galaxies) {
      for (const [sectorId, neighbors] of galaxy.adjacency) {
        for (const neighborId of neighbors) {
          const reverseNeighbors = galaxy.adjacency.get(neighborId)
          expect(reverseNeighbors).toBeDefined()
          expect(reverseNeighbors).toContain(sectorId)
        }
      }
    }
  })

  it('adjacency map has an entry for every sector', () => {
    for (const galaxy of galaxies) {
      for (const sectorId of galaxy.sectors.keys()) {
        expect(galaxy.adjacency.has(sectorId)).toBe(true)
      }
    }
  })
})

describe('adjacency graph — connection limits', () => {
  const galaxies: Galaxy[] = Array.from({ length: 10 }, () => generateGalaxy())

  it('each sector has 2-4 connections', () => {
    for (const galaxy of galaxies) {
      for (const [sectorId, neighbors] of galaxy.adjacency) {
        expect(neighbors.length).toBeGreaterThanOrEqual(GALAXY_GENERATION_PARAMS.minConnectionsPerSector)
        expect(neighbors.length).toBeLessThanOrEqual(GALAXY_GENERATION_PARAMS.maxConnectionsPerSector)
      }
    }
  })

  it('starting sector has 2-3 connections', () => {
    for (const galaxy of galaxies) {
      const startConnections = galaxy.adjacency.get(galaxy.startingSectorId)!.length
      expect(startConnections).toBeGreaterThanOrEqual(
        GALAXY_GENERATION_PARAMS.startingSectorConnectionsMin,
      )
      expect(startConnections).toBeLessThanOrEqual(
        GALAXY_GENERATION_PARAMS.startingSectorConnectionsMax,
      )
    }
  })

  it('max 4 connections per sector', () => {
    for (const galaxy of galaxies) {
      for (const neighbors of galaxy.adjacency.values()) {
        expect(neighbors.length).toBeLessThanOrEqual(4)
      }
    }
  })
})

describe('adjacency graph — bottlenecks and hops', () => {
  const galaxies: Galaxy[] = Array.from({ length: 10 }, () => generateGalaxy())

  it('has 1-2 bottleneck sectors (exactly 2 connections)', () => {
    for (const galaxy of galaxies) {
      const bottleneckCount = [...galaxy.adjacency.values()].filter(
        (neighbors) => neighbors.length === 2,
      ).length
      expect(bottleneckCount).toBeGreaterThanOrEqual(
        GALAXY_GENERATION_PARAMS.bottleneckSectorCountMin,
      )
      expect(bottleneckCount).toBeLessThanOrEqual(
        GALAXY_GENERATION_PARAMS.bottleneckSectorCountMax,
      )
    }
  })

  it('max 5 hops from start to furthest sector', () => {
    for (const galaxy of galaxies) {
      const distances = bfsDistances(galaxy)
      let maxHops = 0
      for (const dist of distances.values()) {
        if (dist > maxHops) maxHops = dist
      }
      expect(maxHops).toBeLessThanOrEqual(GALAXY_GENERATION_PARAMS.maxHopsFromStart)
    }
  })
})

describe('adjacency graph — no duplicate edges', () => {
  const galaxies: Galaxy[] = Array.from({ length: 10 }, () => generateGalaxy())

  it('no sector is connected to itself', () => {
    for (const galaxy of galaxies) {
      for (const [sectorId, neighbors] of galaxy.adjacency) {
        expect(neighbors).not.toContain(sectorId)
      }
    }
  })

  it('no duplicate connections in adjacency lists', () => {
    for (const galaxy of galaxies) {
      for (const neighbors of galaxy.adjacency.values()) {
        const uniqueNeighbors = new Set(neighbors)
        expect(uniqueNeighbors.size).toBe(neighbors.length)
      }
    }
  })
})
