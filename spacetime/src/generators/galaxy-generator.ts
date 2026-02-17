/**
 * galaxy-generator.ts — Generates the full galaxy: 10-15 sectors with adjacency graph.
 *
 * The galaxy is a connected graph of sectors where:
 * - Each sector has 2-4 connections
 * - Starting sector has 2-3 connections
 * - 1-2 bottleneck sectors (exactly 2 connections)
 * - Max 5 hops from start to furthest sector
 * - All sectors reachable from start
 *
 * Pure TypeScript — no Vue or Pinia imports.
 *
 * TODO (Story 3.3): galaxy.store.ts wraps this generator.
 * TODO (Story 3.4): GalaxyView.vue displays the generated galaxy.
 */

import type { SectorId } from '../types/common'
import type { Sector, Galaxy } from '../types/sector'
import { GALAXY_GENERATION_PARAMS } from '../data/start-conditions'
import { generateSector } from './sector-generator'
import { randomInt } from '../utils/random'

// ─── Galaxy Generator ────────────────────────────────────────────────────────

/**
 * Generates a complete galaxy with sectors and adjacency graph.
 *
 * Algorithm overview:
 * 1. Generate sectors and assign them to distance layers from start
 * 2. Build spanning tree connecting each sector to one in the previous layer
 * 3. Designate 1-2 leaf sectors as bottlenecks (will have exactly 2 connections)
 * 4. Add edges to bring all non-bottleneck sectors to 3+ connections
 * 5. Validate all constraints; retry if needed
 *
 * @returns A fully typed Galaxy object
 */
export function generateGalaxy(): Galaxy {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = tryGenerateGalaxy()
    if (result !== null) {
      return result
    }
  }

  throw new Error('galaxy-generator: Failed to generate valid galaxy after 100 attempts')
}

// ─── Internal Generation ─────────────────────────────────────────────────────

function tryGenerateGalaxy(): Galaxy | null {
  const params = GALAXY_GENERATION_PARAMS
  const sectorCount = randomInt(params.sectorCountMin, params.sectorCountMax)
  const usedNames = new Set<string>()

  // Step 1: Generate all sectors
  const startingSector = generateSector({ usedNames, isStartingSector: true })
  const otherSectors: Sector[] = []
  for (let i = 1; i < sectorCount; i++) {
    otherSectors.push(generateSector({ usedNames }))
  }
  const allSectors = [startingSector, ...otherSectors]

  // Step 2: Assign to layers
  const layers = assignLayers(allSectors, params)

  // Step 3: Build adjacency with spanning tree
  const adjacency = new Map<SectorId, SectorId[]>()
  for (const sector of allSectors) {
    adjacency.set(sector.id, [])
  }

  for (let layerIdx = 1; layerIdx < layers.length; layerIdx++) {
    for (const sector of layers[layerIdx]!) {
      const candidates = layers[layerIdx - 1]!.filter(
        (s) => connectionCount(adjacency, s.id) < params.maxConnectionsPerSector,
      )
      if (candidates.length === 0) return null
      addEdge(adjacency, sector.id, pickRandom(candidates).id)
    }
  }

  // Step 4: Designate 1-2 bottleneck sectors from leaf nodes (1 connection after spanning tree)
  const desiredBottlenecks = randomInt(
    params.bottleneckSectorCountMin,
    params.bottleneckSectorCountMax,
  )
  const leafSectors = allSectors.filter(
    (s) => s.id !== startingSector.id && connectionCount(adjacency, s.id) === 1,
  )
  const bottleneckIds = new Set<SectorId>()
  const shuffledLeaves = shuffle(leafSectors)
  for (const leaf of shuffledLeaves) {
    if (bottleneckIds.size >= desiredBottlenecks) break
    bottleneckIds.add(leaf.id)
  }

  // Step 5: Bring bottleneck sectors to exactly 2 connections
  for (const id of bottleneckIds) {
    while (connectionCount(adjacency, id) < 2) {
      if (!tryAddEdge(adjacency, id, layers, params)) break
    }
  }

  // Step 6: Bring all other sectors to at least 3 connections
  // This ensures only the designated bottlenecks end up at exactly 2
  for (const sector of allSectors) {
    if (bottleneckIds.has(sector.id)) continue
    while (connectionCount(adjacency, sector.id) < 3) {
      if (!tryAddEdge(adjacency, sector.id, layers, params)) break
    }
  }

  // Step 7: Final validation
  if (!validateGalaxy(adjacency, allSectors, startingSector.id, params)) {
    return null
  }

  // Build Galaxy object
  const sectors = new Map<SectorId, Sector>()
  for (const sector of allSectors) {
    sectors.set(sector.id, sector)
  }

  return {
    sectors,
    adjacency,
    startingSectorId: startingSector.id,
  }
}

// ─── Layer Assignment ────────────────────────────────────────────────────────

/**
 * Distributes sectors across distance layers from start.
 * Layer 0 = start only. Layer 1 = 2-3 sectors. Rest spread across layers 2+.
 */
function assignLayers(
  allSectors: Sector[],
  params: typeof GALAXY_GENERATION_PARAMS,
): Sector[][] {
  const layers: Sector[][] = []
  const remaining = [...allSectors]

  // Layer 0: starting sector
  layers.push([remaining.shift()!])

  // Layer 1: 2-3 sectors (will be starting sector's connections)
  const layer1Count = randomInt(
    params.startingSectorConnectionsMin,
    params.startingSectorConnectionsMax,
  )
  layers.push(remaining.splice(0, layer1Count))

  // Distribute remaining across layers 2 through maxHops
  if (remaining.length > 0) {
    const additionalLayerCount = Math.min(
      params.maxHopsFromStart - 1,
      Math.max(1, Math.ceil(remaining.length / 3)),
    )

    for (let i = 0; i < additionalLayerCount; i++) {
      layers.push([])
    }

    for (let i = 0; i < remaining.length; i++) {
      const layerIdx = 2 + (i % additionalLayerCount)
      layers[layerIdx]!.push(remaining[i]!)
    }
  }

  return layers
}

// ─── Edge Addition ───────────────────────────────────────────────────────────

/**
 * Tries to add one edge from `sectorId` to a valid candidate in same or adjacent layers.
 * Respects max connections on both sides.
 */
function tryAddEdge(
  adjacency: Map<SectorId, SectorId[]>,
  sectorId: SectorId,
  layers: Sector[][],
  params: typeof GALAXY_GENERATION_PARAMS,
): boolean {
  const sectorLayerIdx = layers.findIndex((layer) => layer.some((s) => s.id === sectorId))
  if (sectorLayerIdx === -1) return false

  // Candidates from same and adjacent layers
  const candidatePool: Sector[] = []
  for (
    let i = Math.max(0, sectorLayerIdx - 1);
    i <= Math.min(layers.length - 1, sectorLayerIdx + 1);
    i++
  ) {
    candidatePool.push(...layers[i]!)
  }

  const candidates = candidatePool.filter(
    (s) =>
      s.id !== sectorId &&
      !isConnected(adjacency, sectorId, s.id) &&
      connectionCount(adjacency, s.id) < params.maxConnectionsPerSector,
  )

  if (candidates.length === 0) return false

  addEdge(adjacency, sectorId, pickRandom(candidates).id)
  return true
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates all galaxy constraints. Returns true if valid.
 */
function validateGalaxy(
  adjacency: Map<SectorId, SectorId[]>,
  allSectors: Sector[],
  startingSectorId: SectorId,
  params: typeof GALAXY_GENERATION_PARAMS,
): boolean {
  // Each sector has 2-4 connections
  for (const sector of allSectors) {
    const count = connectionCount(adjacency, sector.id)
    if (count < params.minConnectionsPerSector || count > params.maxConnectionsPerSector) {
      return false
    }
  }

  // Starting sector has 2-3 connections
  const startCount = connectionCount(adjacency, startingSectorId)
  if (
    startCount < params.startingSectorConnectionsMin ||
    startCount > params.startingSectorConnectionsMax
  ) {
    return false
  }

  // All sectors reachable from start
  if (!allReachable(adjacency, startingSectorId, allSectors.length)) {
    return false
  }

  // Max hops
  if (calculateMaxHops(adjacency, startingSectorId) > params.maxHopsFromStart) {
    return false
  }

  // 1-2 bottleneck sectors (exactly 2 connections)
  const bottleneckCount = allSectors.filter(
    (s) => connectionCount(adjacency, s.id) === 2,
  ).length
  if (
    bottleneckCount < params.bottleneckSectorCountMin ||
    bottleneckCount > params.bottleneckSectorCountMax
  ) {
    return false
  }

  // No self-loops or duplicate edges
  for (const [sectorId, neighbors] of adjacency) {
    if (neighbors.includes(sectorId)) return false
    if (new Set(neighbors).size !== neighbors.length) return false
  }

  return true
}

// ─── Graph Helpers ───────────────────────────────────────────────────────────

function addEdge(adjacency: Map<SectorId, SectorId[]>, a: SectorId, b: SectorId): void {
  adjacency.get(a)!.push(b)
  adjacency.get(b)!.push(a)
}

function connectionCount(adjacency: Map<SectorId, SectorId[]>, id: SectorId): number {
  return adjacency.get(id)?.length ?? 0
}

function isConnected(adjacency: Map<SectorId, SectorId[]>, a: SectorId, b: SectorId): boolean {
  return adjacency.get(a)?.includes(b) ?? false
}

function allReachable(
  adjacency: Map<SectorId, SectorId[]>,
  startId: SectorId,
  totalCount: number,
): boolean {
  const visited = new Set<SectorId>()
  const queue: SectorId[] = [startId]
  visited.add(startId)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return visited.size === totalCount
}

function calculateMaxHops(adjacency: Map<SectorId, SectorId[]>, startId: SectorId): number {
  const distances = new Map<SectorId, number>()
  const queue: SectorId[] = [startId]
  distances.set(startId, 0)

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDist = distances.get(current)!

    for (const neighbor of adjacency.get(current) ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1)
        queue.push(neighbor)
      }
    }
  }

  let maxDist = 0
  for (const dist of distances.values()) {
    if (dist > maxDist) maxDist = dist
  }
  return maxDist
}

// ─── Array Helpers ───────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]!
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}
