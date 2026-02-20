/**
 * useMissionCreation.ts — Wizard state for mission creation.
 *
 * Story 16.5: Manages the 4-step mission wizard:
 *   Step 1: Select mission type
 *   Step 2: Select target sector
 *   Step 3: Select ships (multi-select from available)
 *   Step 4: Review cost/risk and confirm
 *
 * Calls missionStore.createMission() on confirm, then fleetStore.updateShips()
 * to keep the fleet roster in sync.
 */

import { ref, computed } from 'vue'
import { useFleetStore } from '../stores/fleet.store'
import { useGalaxyStore } from '../stores/galaxy.store'
import { useMissionStore } from '../stores/mission.store'
import { useGameStore } from '../stores/game.store'
import { MissionType } from '../types/common'
import type { SectorId, ShipId } from '../types/common'
import type { Ship } from '../types/ship'

// Relevant ability score per mission type
export const MISSION_ABILITY_LABEL: Record<MissionType, 'Fight' | 'Investigation' | 'Support'> = {
  [MissionType.Assault]:       'Fight',
  [MissionType.Defense]:       'Fight',
  [MissionType.Escort]:        'Support',
  [MissionType.Rescue]:        'Investigation',
  [MissionType.Investigation]: 'Investigation',
}

export type MissionCreationStep = 1 | 2 | 3 | 4

export function useMissionCreation(onClose: () => void) {
  const fleetStore  = useFleetStore()
  const galaxyStore = useGalaxyStore()
  const missionStore = useMissionStore()
  const gameStore   = useGameStore()

  // ─── Wizard State ────────────────────────────────────────────────────────────

  const step            = ref<MissionCreationStep>(1)
  const selectedType    = ref<MissionType | null>(null)
  const selectedSector  = ref<SectorId | null>(null)
  const selectedShipIds = ref<Set<ShipId>>(new Set())
  const errorMessage    = ref<string | null>(null)
  const submitting      = ref(false)

  // ─── Derived Data ────────────────────────────────────────────────────────────

  /** All sectors in the galaxy as an array for display. */
  const allSectors = computed(() =>
    [...galaxyStore.sectors.values()].sort((a, b) => a.name.localeCompare(b.name)),
  )

  /** Ships eligible for missions: stationed + government-owned. */
  const availableShips = computed<Ship[]>(() =>
    fleetStore.availableShips.filter((s) => s.ownerCorpId === 'government'),
  )

  /** Currently selected ships. */
  const selectedShips = computed<Ship[]>(() =>
    availableShips.value.filter((s) => selectedShipIds.value.has(s.id as ShipId)),
  )

  /** The relevant ability score for the chosen mission type. */
  const abilityLabel = computed(() =>
    selectedType.value ? MISSION_ABILITY_LABEL[selectedType.value] : null,
  )

  /**
   * Task force ability score: sum of the relevant ability across selected ships.
   */
  const taskForceAbility = computed<number>(() => {
    if (!abilityLabel.value) return 0
    return selectedShips.value.reduce((sum, s) => {
      const key = abilityLabel.value!.toLowerCase() as 'fight' | 'investigation' | 'support'
      return sum + s.abilities[key]
    }, 0)
  })

  /** BP/turn cost preview (base + fleet surcharge for size ≥ 7). */
  const MISSION_BASE_COST: Record<MissionType, number> = {
    [MissionType.Escort]:        1,
    [MissionType.Assault]:       3,
    [MissionType.Defense]:       2,
    [MissionType.Rescue]:        2,
    [MissionType.Investigation]: 1,
  }

  const estimatedCost = computed<number>(() => {
    if (!selectedType.value) return 0
    const base      = MISSION_BASE_COST[selectedType.value]
    const surcharge = selectedShips.value.filter((s) => s.primaryStats.size >= 7).length
    return base + surcharge
  })

  // ─── Wizard Navigation ───────────────────────────────────────────────────────

  function canAdvance(): boolean {
    switch (step.value) {
      case 1: return selectedType.value !== null
      case 2: return selectedSector.value !== null
      case 3: return selectedShipIds.value.size > 0
      default: return true
    }
  }

  function next() {
    if (!canAdvance()) return
    errorMessage.value = null
    step.value = (step.value + 1) as MissionCreationStep
  }

  function back() {
    if (step.value > 1) {
      step.value = (step.value - 1) as MissionCreationStep
      errorMessage.value = null
    }
  }

  function selectType(type: MissionType) {
    selectedType.value = type
    // Clear downstream selections if type changed
    selectedShipIds.value.clear()
  }

  function selectSector(sectorId: SectorId) {
    selectedSector.value = sectorId
  }

  function toggleShip(shipId: ShipId) {
    if (selectedShipIds.value.has(shipId)) {
      selectedShipIds.value.delete(shipId)
    } else {
      selectedShipIds.value.add(shipId)
    }
    // Trigger reactivity
    selectedShipIds.value = new Set(selectedShipIds.value)
  }

  // ─── Confirm ─────────────────────────────────────────────────────────────────

  async function confirm() {
    if (!selectedType.value || !selectedSector.value || selectedShipIds.value.size === 0) return

    submitting.value = true
    errorMessage.value = null

    try {
      const state  = gameStore.getFullGameState()
      const result = missionStore.createMission(
        {
          missionType:    selectedType.value,
          targetSectorId: selectedSector.value,
          shipIds:        [...selectedShipIds.value],
        },
        state,
      )

      if (result.success) {
        // Sync updated ship statuses (OnMission) back to fleet store
        fleetStore.updateShips(result.updatedShips)
        onClose()
      } else {
        const errorMap: Record<string, string> = {
          NO_SHIPS_SELECTED:  'No ships selected.',
          SHIP_NOT_FOUND:     'One or more ships could not be found.',
          SHIP_NOT_AVAILABLE: 'One or more ships are not available.',
          SHIP_NOT_GOVERNMENT:'Only government-owned ships can be assigned to missions.',
          SECTOR_NOT_FOUND:   'Target sector not found.',
          NO_HOME_SECTOR:     'Could not compute travel route to target sector.',
        }
        errorMessage.value = errorMap[result.error] ?? result.error
      }
    } finally {
      submitting.value = false
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  function reset() {
    step.value            = 1
    selectedType.value    = null
    selectedSector.value  = null
    selectedShipIds.value = new Set()
    errorMessage.value    = null
    submitting.value      = false
  }

  return {
    // State
    step,
    selectedType,
    selectedSector,
    selectedShipIds,
    errorMessage,
    submitting,
    // Derived
    allSectors,
    availableShips,
    selectedShips,
    abilityLabel,
    taskForceAbility,
    estimatedCost,
    // Actions
    canAdvance,
    next,
    back,
    selectType,
    selectSector,
    toggleShip,
    confirm,
    reset,
  }
}
