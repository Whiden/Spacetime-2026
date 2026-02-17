/**
 * id.ts — Unique ID generation for all game entities.
 *
 * Uses nanoid for compact, URL-safe unique IDs.
 * All IDs are prefixed with a type identifier for debuggability.
 *
 * ID format: {prefix}_{nanoid(8)}
 * Example: "col_a1b2c3d4"
 *
 * See Structure.md for the full prefix reference table.
 * No Vue or Pinia imports. Pure TypeScript.
 */

import { nanoid } from 'nanoid'
import type {
  ColonyId,
  CorpId,
  ContractId,
  ShipId,
  MissionId,
  SectorId,
  PlanetId,
  PatentId,
  SchematicId,
  DiscoveryId,
  CaptainId,
  EventId,
  ModifierId,
} from '../types/common'

// ─── Generic ID Generator ─────────────────────────────────────────────────────

/**
 * Generates a unique prefixed ID string.
 *
 * @param prefix - The type prefix (e.g., 'col', 'corp')
 * @returns A unique string like "col_a1b2c3d4"
 */
export function generateId(prefix: string): string {
  return `${prefix}_${nanoid(8)}`
}

// ─── Typed ID Generators ──────────────────────────────────────────────────────
// Each function returns a strongly-typed branded ID.

export const generateColonyId = (): ColonyId => generateId('col') as ColonyId
export const generateCorpId = (): CorpId => generateId('corp') as CorpId
export const generateContractId = (): ContractId => generateId('ctr') as ContractId
export const generateShipId = (): ShipId => generateId('ship') as ShipId
export const generateMissionId = (): MissionId => generateId('msn') as MissionId
export const generateSectorId = (): SectorId => generateId('sec') as SectorId
export const generatePlanetId = (): PlanetId => generateId('pln') as PlanetId
export const generatePatentId = (): PatentId => generateId('pat') as PatentId
export const generateSchematicId = (): SchematicId => generateId('sch') as SchematicId
export const generateDiscoveryId = (): DiscoveryId => generateId('dsc') as DiscoveryId
export const generateCaptainId = (): CaptainId => generateId('cpt') as CaptainId
export const generateEventId = (): EventId => generateId('evt') as EventId
export const generateModifierId = (): ModifierId => generateId('mod') as ModifierId
