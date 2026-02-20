/**
 * useSaveLoad.ts — Save/load composable for multi-slot LocalStorage persistence.
 *
 * Story 18.2: Implements autosave, manual save to 3 named slots, load, JSON export, and JSON import.
 *
 * Storage keys:
 *   spacetime_save_auto       — autosave slot
 *   spacetime_save_slot_0     — manual slot 0
 *   spacetime_save_slot_1     — manual slot 1
 *   spacetime_save_slot_2     — manual slot 2
 *
 * TODO (Story 18.3): Wire export/import into a SaveLoadPanel UI component.
 */

import { ref, computed } from 'vue'
import { serializeGameState, deserializeGameState, SAVE_VERSION } from '../utils/save'
import type { GameState } from '../types/game'

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTOSAVE_KEY = 'spacetime_save_auto'
const SLOT_KEY_PREFIX = 'spacetime_save_slot_'
const SLOT_COUNT = 3

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SaveSlotInfo {
  /** 'auto' | 0 | 1 | 2 */
  slot: 'auto' | number
  /** Human-readable name */
  name: string
  /** Turn number at save time */
  turn: number
  /** ISO timestamp */
  dateSaved: string
  /** Whether this slot has data */
  occupied: boolean
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useSaveLoad() {
  const errorMessage = ref<string | null>(null)
  const successMessage = ref<string | null>(null)

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function _storageKey(slot: 'auto' | number): string {
    return slot === 'auto' ? AUTOSAVE_KEY : `${SLOT_KEY_PREFIX}${slot}`
  }

  function _clearMessages() {
    errorMessage.value = null
    successMessage.value = null
  }

  function _readRaw(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  function _writeRaw(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  }

  function _deleteRaw(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }

  /** Parses just the metadata fields from a raw JSON save without full deserialization. */
  function _peekSlotInfo(slot: 'auto' | number): SaveSlotInfo {
    const key = _storageKey(slot)
    const raw = _readRaw(key)
    const name = slot === 'auto' ? 'Autosave' : `Slot ${Number(slot) + 1}`

    if (!raw) {
      return { slot, name, turn: 0, dateSaved: '', occupied: false }
    }

    try {
      const parsed = JSON.parse(raw) as {
        version?: number
        timestamp?: string
        gameState?: { turn?: number }
      }
      return {
        slot,
        name,
        turn: parsed.gameState?.turn ?? 0,
        dateSaved: parsed.timestamp ?? '',
        occupied: true,
      }
    } catch {
      return { slot, name, turn: 0, dateSaved: '', occupied: false }
    }
  }

  // ─── Slot Listing ────────────────────────────────────────────────────────────

  /**
   * Returns metadata for all slots (autosave + 3 manual).
   * Reads localStorage but does NOT deserialize the full state.
   */
  const slotList = computed<SaveSlotInfo[]>(() => {
    const slots: SaveSlotInfo[] = [_peekSlotInfo('auto')]
    for (let i = 0; i < SLOT_COUNT; i++) {
      slots.push(_peekSlotInfo(i))
    }
    return slots
  })

  // ─── Save ────────────────────────────────────────────────────────────────────

  /**
   * Saves the given game state to the autosave slot.
   * Called automatically by game.store after every turn resolution.
   */
  function autosave(state: GameState): void {
    const json = serializeGameState(state)
    _writeRaw(AUTOSAVE_KEY, json)
  }

  /**
   * Saves to a named manual slot (0–2).
   * Returns true on success, false on failure.
   */
  function saveToSlot(slot: number, state: GameState): boolean {
    _clearMessages()
    if (slot < 0 || slot >= SLOT_COUNT) {
      errorMessage.value = `Invalid slot: ${slot}`
      return false
    }
    const json = serializeGameState(state)
    const ok = _writeRaw(_storageKey(slot), json)
    if (ok) {
      successMessage.value = `Game saved to Slot ${slot + 1}.`
    } else {
      errorMessage.value = 'Save failed: storage may be full.'
    }
    return ok
  }

  /**
   * Deletes a manual slot.
   */
  function deleteSlot(slot: number): void {
    _clearMessages()
    _deleteRaw(_storageKey(slot))
  }

  // ─── Load ────────────────────────────────────────────────────────────────────

  /**
   * Loads game state from any slot.
   * Returns the deserialized GameState, or null on failure (with errorMessage set).
   */
  function loadFromSlot(slot: 'auto' | number): GameState | null {
    _clearMessages()
    const raw = _readRaw(_storageKey(slot))
    if (!raw) {
      errorMessage.value = slot === 'auto'
        ? 'No autosave found.'
        : `Slot ${Number(slot) + 1} is empty.`
      return null
    }
    try {
      const state = deserializeGameState(raw)
      successMessage.value = slot === 'auto'
        ? 'Autosave loaded.'
        : `Slot ${Number(slot) + 1} loaded.`
      return state
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : 'Load failed.'
      return null
    }
  }

  // ─── JSON Export ─────────────────────────────────────────────────────────────

  /**
   * Downloads the current game state as a .json file.
   * Triggers a browser download dialog.
   */
  function exportToJson(state: GameState, filename?: string): void {
    _clearMessages()
    const json = serializeGameState(state)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename ?? `spacetime_turn${state.turn}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    successMessage.value = 'Save file downloaded.'
  }

  // ─── JSON Import ─────────────────────────────────────────────────────────────

  /**
   * Reads a .json file from a FileList input element, validates, and returns the GameState.
   * Returns null on any failure (with errorMessage set).
   */
  function importFromJson(files: FileList | null): Promise<GameState | null> {
    _clearMessages()
    if (!files || files.length === 0) {
      errorMessage.value = 'No file selected.'
      return Promise.resolve(null)
    }
    const file = files[0]
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      errorMessage.value = 'File must be a .json save file.'
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result
        if (typeof text !== 'string') {
          errorMessage.value = 'Failed to read file.'
          resolve(null)
          return
        }
        try {
          // Basic format validation: must parse and have expected version
          const parsed = JSON.parse(text) as { version?: unknown }
          if (typeof parsed.version !== 'number') {
            errorMessage.value = 'Invalid save file: missing version field.'
            resolve(null)
            return
          }
          if (parsed.version !== SAVE_VERSION) {
            errorMessage.value = `Unsupported save version ${parsed.version} (expected ${SAVE_VERSION}).`
            resolve(null)
            return
          }
          const state = deserializeGameState(text)
          successMessage.value = `Save file imported (Turn ${state.turn}).`
          resolve(state)
        } catch (e) {
          errorMessage.value = e instanceof Error ? e.message : 'Failed to parse save file.'
          resolve(null)
        }
      }
      reader.onerror = () => {
        errorMessage.value = 'File read error.'
        resolve(null)
      }
      reader.readAsText(file)
    })
  }

  return {
    // Reactive state
    errorMessage,
    successMessage,
    slotList,
    // Actions
    autosave,
    saveToSlot,
    deleteSlot,
    loadFromSlot,
    exportToJson,
    importFromJson,
  }
}
