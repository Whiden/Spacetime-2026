/**
 * save.ts — Game state serialization and deserialization.
 *
 * Converts GameState (which contains Maps) to/from JSON-compatible format.
 * Maps are serialized as plain objects keyed by entity ID.
 *
 * Save file format:
 *   { version: number, timestamp: string, gameState: SerializedGameState }
 *
 * TODO (Story 18.2): LocalStorage persistence and multi-slot save/load.
 * TODO (Story 18.3): JSON file export/import UI.
 */

import type { GameState } from '../types/game'

// ─── Constants ────────────────────────────────────────────────────────────────

export const SAVE_VERSION = 1

// ─── Save File Shape ──────────────────────────────────────────────────────────

export interface SaveFile {
  version: number
  timestamp: string
  gameState: SerializedGameState
}

/**
 * JSON-safe representation of GameState: Maps replaced by plain objects.
 * All other fields are JSON-native (numbers, strings, arrays, nested objects).
 */
type SerializedGameState = Omit<
  GameState,
  | 'colonies'
  | 'planets'
  | 'corporations'
  | 'contracts'
  | 'ships'
  | 'missions'
  | 'scienceDomains'
  | 'discoveries'
  | 'schematics'
  | 'patents'
  | 'sectorMarkets'
> & {
  colonies: Record<string, unknown>
  planets: Record<string, unknown>
  corporations: Record<string, unknown>
  contracts: Record<string, unknown>
  ships: Record<string, unknown>
  missions: Record<string, unknown>
  scienceDomains: Record<string, unknown>
  discoveries: Record<string, unknown>
  schematics: Record<string, unknown>
  patents: Record<string, unknown>
  sectorMarkets: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapToRecord<V>(map: Map<string, V>): Record<string, V> {
  const record: Record<string, V> = {}
  for (const [key, value] of map) {
    record[key] = value
  }
  return record
}

function recordToMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record))
}

// ─── Serialization ────────────────────────────────────────────────────────────

/**
 * Converts a full GameState to a JSON string suitable for storage or export.
 * The output includes a version number and ISO timestamp.
 */
export function serializeGameState(state: GameState): string {
  const serialized: SerializedGameState = {
    ...state,
    colonies: mapToRecord(state.colonies),
    planets: mapToRecord(state.planets),
    corporations: mapToRecord(state.corporations),
    contracts: mapToRecord(state.contracts),
    ships: mapToRecord(state.ships),
    missions: mapToRecord(state.missions),
    scienceDomains: mapToRecord(state.scienceDomains),
    discoveries: mapToRecord(state.discoveries),
    schematics: mapToRecord(state.schematics),
    patents: mapToRecord(state.patents),
    sectorMarkets: mapToRecord(state.sectorMarkets),
  }

  const saveFile: SaveFile = {
    version: SAVE_VERSION,
    timestamp: new Date().toISOString(),
    gameState: serialized,
  }

  return JSON.stringify(saveFile)
}

// ─── Deserialization ──────────────────────────────────────────────────────────

/**
 * Parses a JSON save string back into a typed GameState.
 * Throws an Error if the JSON is invalid or the version is unsupported.
 */
export function deserializeGameState(json: string): GameState {
  let saveFile: SaveFile

  try {
    saveFile = JSON.parse(json) as SaveFile
  } catch {
    throw new Error('Invalid save file: JSON parse failed')
  }

  if (
    typeof saveFile !== 'object' ||
    saveFile === null ||
    typeof saveFile.version !== 'number' ||
    typeof saveFile.timestamp !== 'string' ||
    typeof saveFile.gameState !== 'object' ||
    saveFile.gameState === null
  ) {
    throw new Error('Invalid save file: missing required fields')
  }

  if (saveFile.version !== SAVE_VERSION) {
    throw new Error(
      `Unsupported save version ${saveFile.version} (expected ${SAVE_VERSION})`,
    )
  }

  const s = saveFile.gameState

  const state: GameState = {
    ...(s as Omit<GameState, keyof SerializedGameState>),
    // scalar fields pass through via spread above; restore Maps below
    turn: s.turn,
    phase: s.phase,
    currentBP: s.currentBP,
    debtTokens: s.debtTokens,
    budget: s.budget,
    empireBonuses: s.empireBonuses,
    galaxy: s.galaxy,
    tradeRoutes: s.tradeRoutes,
    events: s.events,
    startedAt: s.startedAt,
    lastSavedAt: s.lastSavedAt,
    // Maps restored from serialized plain objects
    colonies: recordToMap(s.colonies) as GameState['colonies'],
    planets: recordToMap(s.planets) as GameState['planets'],
    corporations: recordToMap(s.corporations) as GameState['corporations'],
    contracts: recordToMap(s.contracts) as GameState['contracts'],
    ships: recordToMap(s.ships) as GameState['ships'],
    missions: recordToMap(s.missions) as GameState['missions'],
    scienceDomains: recordToMap(s.scienceDomains) as GameState['scienceDomains'],
    discoveries: recordToMap(s.discoveries) as GameState['discoveries'],
    schematics: recordToMap(s.schematics) as GameState['schematics'],
    patents: recordToMap(s.patents) as GameState['patents'],
    sectorMarkets: recordToMap(s.sectorMarkets) as GameState['sectorMarkets'],
  }

  return state
}
