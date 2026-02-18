/**
 * useContractCreation.ts — Composable managing wizard state for contract creation.
 *
 * Drives the 4-step ContractWizard:
 *   Step 1: Select contract type
 *   Step 2: Select target (sector / planet / colony / sector pair)
 *   Step 3: Select corporation (+ optional kickstart)
 *   Step 4: Confirm and submit
 *
 * Reads from galaxy, planet, colony, corporation stores to populate target options.
 * On confirm, calls contractStore.createNewContract() with assembled params.
 *
 * No engine imports — all engine calls are delegated through the contract store.
 *
 * TODO (Story 7.5): ContractsView.vue shows the list of contracts; wizard opened from there.
 */

import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import { ContractType, ColonyType, PlanetStatus } from '../types/common'
import type {
  ContractTarget,
  ColonizationParams,
} from '../types/contract'
import type { CorpId, TurnNumber, SectorId, PlanetId, ColonyId } from '../types/common'
import type { Corporation } from '../types/corporation'
import { useContractStore } from '../stores/contract.store'
import { useBudgetStore } from '../stores/budget.store'
import { useGalaxyStore } from '../stores/galaxy.store'
import { usePlanetStore } from '../stores/planet.store'
import { useColonyStore } from '../stores/colony.store'
import { useCorporationStore } from '../stores/corporation.store'
import { CONTRACT_TYPE_DEFINITIONS, calculateExplorationDuration } from '../data/contracts'
import { COLONY_TYPE_DEFINITIONS } from '../data/colony-types'

// ─── Step Enum ────────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4

// ─── Computed Target Preview ──────────────────────────────────────────────────

/** A selectable target item rendered in Step 2. */
export interface TargetOption {
  id: string
  label: string
  sublabel?: string
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useContractCreation() {
  // ─── Stores ──────────────────────────────────────────────────────────────

  const contractStore = useContractStore()
  const budgetStore = useBudgetStore()
  const galaxyStore = useGalaxyStore()
  const planetStore = usePlanetStore()
  const colonyStore = useColonyStore()
  const corpStore = useCorporationStore()

  // ─── Wizard State ─────────────────────────────────────────────────────────

  const currentStep = ref<WizardStep>(1)

  /** Selected contract type (Step 1). */
  const selectedType = ref<ContractType | null>(null)

  /** Built contract target (Step 2). */
  const selectedTarget = ref<ContractTarget | null>(null)

  /** For TradeRoute: second sector selection. */
  const selectedSectorB = ref<SectorId | null>(null)

  /** For Colonization: selected colony type. */
  const selectedColonyType = ref<ColonyType | null>(null)

  /** Selected corp ID (Step 3). */
  const selectedCorpId = ref<CorpId | null>(null)

  /** Last submission error message (Step 4). */
  const errorMessage = ref<string | null>(null)

  /** True while the creation request is being processed. */
  const submitting = ref(false)

  /**
   * Corp ID kickstarted during this wizard session, if any.
   * Prevents creating duplicate corps if the user clicks kickstart more than once.
   */
  const kickstartedCorpId = ref<CorpId | null>(null)

  // ─── Step 1: Contract Type ────────────────────────────────────────────────

  const contractTypes = Object.values(ContractType)

  function selectType(type: ContractType) {
    selectedType.value = type
    // Reset downstream selections whenever type changes
    selectedTarget.value = null
    selectedSectorB.value = null
    selectedColonyType.value = null
    selectedCorpId.value = null
    kickstartedCorpId.value = null
    errorMessage.value = null
  }

  // ─── Step 2: Target Options ───────────────────────────────────────────────

  /**
   * Available target options for the selected contract type.
   * Returns a flat list of TargetOption items for Step 2.
   */
  const targetOptions = computed<TargetOption[]>(() => {
    if (!selectedType.value) return []

    switch (selectedType.value) {
      case ContractType.Exploration: {
        // Only sectors adjacent to (or containing) a player colony — matching engine rule.
        // If no colonies exist yet (early game before Terra Nova init), show all sectors.
        const colonySectorIds = new Set(colonyStore.allColonies.map((c) => c.sectorId))
        const allSectors = galaxyStore.allSectors
        if (colonySectorIds.size === 0) return allSectors.map((s) => ({
          id: s.id,
          label: s.name,
          sublabel: `${s.explorationPercent}% explored`,
        }))
        return allSectors
          .filter((s) => {
            if (colonySectorIds.has(s.id)) return true
            const adj = galaxyStore.getAdjacentSectors(s.id)
            return adj.some((id) => colonySectorIds.has(id))
          })
          .map((s) => ({
            id: s.id,
            label: s.name,
            sublabel: `${s.explorationPercent}% explored`,
          }))
      }

      case ContractType.GroundSurvey:
        // OrbitScanned or Accepted planets
        return planetStore.allPlanets
          .filter(
            (p) =>
              p.status === PlanetStatus.OrbitScanned || p.status === PlanetStatus.Accepted,
          )
          .map((p) => ({
            id: p.id,
            label: p.name,
            sublabel: p.status === PlanetStatus.OrbitScanned ? 'Orbit scanned' : 'Accepted',
          }))

      case ContractType.Colonization:
        // Accepted or GroundSurveyed planets
        return planetStore.allPlanets
          .filter(
            (p) =>
              p.status === PlanetStatus.Accepted || p.status === PlanetStatus.GroundSurveyed,
          )
          .map((p) => ({
            id: p.id,
            label: p.name,
            sublabel: p.status === PlanetStatus.Accepted ? 'Accepted' : 'Ground surveyed',
          }))

      case ContractType.ShipCommission:
        // All colonies
        return colonyStore.allColonies.map((c) => ({
          id: c.id,
          label: c.name,
          sublabel: `Pop ${c.populationLevel}`,
        }))

      case ContractType.TradeRoute:
        // All sectors (sector A selection)
        return galaxyStore.allSectors.map((s) => ({
          id: s.id,
          label: s.name,
          sublabel: `${s.explorationPercent}% explored`,
        }))

      default:
        return []
    }
  })

  /**
   * Available sector B options for TradeRoute — only sectors adjacent to the selected sector A.
   */
  const sectorBOptions = computed<TargetOption[]>(() => {
    if (selectedType.value !== ContractType.TradeRoute || !selectedTarget.value) return []
    if (selectedTarget.value.type !== 'sector') return []

    const adjacentIds = galaxyStore.getAdjacentSectors(selectedTarget.value.sectorId)
    return adjacentIds
      .map((id) => galaxyStore.getSector(id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: `${s.explorationPercent}% explored`,
      }))
  })

  /** Colony type options for Colonization step 2 extra selection. */
  const colonyTypeOptions = Object.values(ColonyType).map((ct) => ({
    type: ct,
    def: COLONY_TYPE_DEFINITIONS[ct],
  }))

  function selectTarget(id: string) {
    if (!selectedType.value) return

    switch (selectedType.value) {
      case ContractType.Exploration:
        selectedTarget.value = { type: 'sector', sectorId: id as SectorId }
        break
      case ContractType.GroundSurvey:
      case ContractType.Colonization:
        selectedTarget.value = { type: 'planet', planetId: id as PlanetId }
        break
      case ContractType.ShipCommission:
        selectedTarget.value = { type: 'colony', colonyId: id as ColonyId }
        break
      case ContractType.TradeRoute:
        // First sector selection — store as sector target for sectorBOptions to compute
        selectedTarget.value = { type: 'sector', sectorId: id as SectorId }
        selectedSectorB.value = null
        break
    }

    // Reset corp when target changes
    selectedCorpId.value = null
    errorMessage.value = null
  }

  function selectSectorB(id: SectorId) {
    selectedSectorB.value = id
    selectedCorpId.value = null
    errorMessage.value = null
  }

  function selectColonyType(ct: ColonyType) {
    selectedColonyType.value = ct
    selectedCorpId.value = null
    errorMessage.value = null
  }

  /**
   * The fully resolved target (including sector B for trade routes).
   * null when the target is incomplete.
   */
  const resolvedTarget = computed<ContractTarget | null>(() => {
    if (!selectedTarget.value) return null

    if (
      selectedType.value === ContractType.TradeRoute &&
      selectedTarget.value.type === 'sector' &&
      selectedSectorB.value
    ) {
      return {
        type: 'sector_pair',
        sectorIdA: selectedTarget.value.sectorId,
        sectorIdB: selectedSectorB.value,
      }
    }

    // Colonization requires a colony type selection too
    if (
      selectedType.value === ContractType.Colonization &&
      !selectedColonyType.value
    ) {
      return null
    }

    return selectedTarget.value
  })

  // ─── Step 3: Corporation Selection ───────────────────────────────────────

  /**
   * Eligible corporations for the selected contract type.
   * Sorted by level descending (strongest first).
   */
  const eligibleCorps = computed<Corporation[]>(() => {
    if (!selectedType.value) return []

    const def = CONTRACT_TYPE_DEFINITIONS[selectedType.value]
    const MEGACORP_LEVEL = 6
    const CROSS_TYPE_MIN_LEVEL = 3
    const specializedContracts: ContractType[] = [
      ContractType.Colonization,
      ContractType.ShipCommission,
      ContractType.TradeRoute,
    ]

    return corpStore.allCorporations
      .filter((corp) => {
        // Megacorps can do anything
        if (corp.level >= MEGACORP_LEVEL) return true
        // Own type is always eligible
        if (def.eligibleCorpTypes.includes(corp.type)) return true
        // Level 3+ cross-type — only for non-specialized contracts
        if (
          corp.level >= CROSS_TYPE_MIN_LEVEL &&
          !specializedContracts.includes(selectedType.value!)
        )
          return true
        return false
      })
      .sort((a, b) => b.level - a.level)
  })

  function selectCorp(corpId: CorpId) {
    selectedCorpId.value = corpId
    errorMessage.value = null
  }

  /**
   * Kickstarts a new corporation of the required type for the selected contract.
   * Uses Terra Nova as home planet (first colony's planet).
   * Selects the newly created corp automatically.
   *
   * If a corp was already kickstarted this wizard session, reuses it instead of
   * creating a duplicate — prevents spam-clicking from creating multiple corps.
   */
  function kickstartCorp() {
    if (!selectedType.value) return

    // Reuse any corp already kickstarted this wizard session
    if (kickstartedCorpId.value) {
      selectedCorpId.value = kickstartedCorpId.value
      errorMessage.value = null
      return
    }

    const def = CONTRACT_TYPE_DEFINITIONS[selectedType.value]
    const defaultType = def.eligibleCorpTypes[0]
    if (!defaultType) return

    // Use Terra Nova's planet as home — the first colony's planet ID
    const firstColony = colonyStore.allColonies[0]
    if (!firstColony) return

    const turn = 1 as TurnNumber // TODO (Story 12.5): use game.store.ts currentTurn
    const newCorp = corpStore.kickstartCorp(defaultType, firstColony.planetId, turn)
    kickstartedCorpId.value = newCorp.id
    selectedCorpId.value = newCorp.id
    errorMessage.value = null
  }

  // ─── Step 4: Cost Preview ─────────────────────────────────────────────────

  /** Selected corp object for preview. */
  const selectedCorp = computed<Corporation | null>(() => {
    if (!selectedCorpId.value) return null
    return corpStore.getCorp(selectedCorpId.value) ?? null
  })

  /** Preview of BP/turn cost given current selections. */
  const previewBpPerTurn = computed<number>(() => {
    if (!selectedType.value) return 0

    if (selectedType.value === ContractType.Colonization && selectedColonyType.value) {
      return COLONY_TYPE_DEFINITIONS[selectedColonyType.value].bpPerTurn
    }

    return CONTRACT_TYPE_DEFINITIONS[selectedType.value].baseBpPerTurn
  })

  /** Preview of contract duration in turns. */
  const previewDuration = computed<number | 'Ongoing'>(() => {
    if (!selectedType.value) return 0

    if (selectedType.value === ContractType.TradeRoute) return 'Ongoing'

    if (selectedType.value === ContractType.Colonization && selectedColonyType.value) {
      return COLONY_TYPE_DEFINITIONS[selectedColonyType.value].durationTurns
    }

    if (selectedType.value === ContractType.Exploration && selectedCorp.value) {
      return calculateExplorationDuration(selectedCorp.value.level)
    }

    const base = CONTRACT_TYPE_DEFINITIONS[selectedType.value].baseDurationTurns
    if (base === 'ongoing' || base === 'by_colony_type') return 0
    return base
  })

  /** Total BP cost = bpPerTurn × durationTurns (or '∞' for ongoing). */
  const previewTotalCost = computed<number | '∞'>(() => {
    if (previewDuration.value === 'Ongoing') return '∞'
    if (typeof previewDuration.value !== 'number') return 0
    return previewBpPerTurn.value * previewDuration.value
  })

  /** Net BP impact per turn if this contract were active. */
  const previewNetBP = computed<number>(() => {
    return budgetStore.netBP - previewBpPerTurn.value
  })

  // ─── Step Navigation ──────────────────────────────────────────────────────

  /** Whether the current step's selection is complete enough to advance. */
  const canAdvance = computed<boolean>(() => {
    switch (currentStep.value) {
      case 1:
        return selectedType.value !== null
      case 2:
        return resolvedTarget.value !== null
      case 3:
        return selectedCorpId.value !== null
      case 4:
        return true
      default:
        return false
    }
  })

  function nextStep() {
    if (!canAdvance.value) return
    if (currentStep.value < 4) currentStep.value = (currentStep.value + 1) as WizardStep
  }

  function prevStep() {
    if (currentStep.value > 1) currentStep.value = (currentStep.value - 1) as WizardStep
    errorMessage.value = null
  }

  function goToStep(step: WizardStep) {
    // Only allow going back, not skipping forward
    if (step < currentStep.value) currentStep.value = step
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  /**
   * Assembles CreateContractParams and calls the contract store.
   * Returns true on success (caller can close the wizard).
   */
  function submit(): boolean {
    if (!selectedType.value || !resolvedTarget.value || !selectedCorpId.value) return false

    submitting.value = true
    errorMessage.value = null

    const colonizationParams: ColonizationParams | undefined =
      selectedType.value === ContractType.Colonization && selectedColonyType.value
        ? { colonyType: selectedColonyType.value }
        : undefined

    const colonySectorIds = new Set(colonyStore.allColonies.map((c) => c.sectorId))

    const result = contractStore.createNewContract({
      type: selectedType.value,
      target: resolvedTarget.value,
      assignedCorpId: selectedCorpId.value,
      currentTurn: 1 as TurnNumber, // TODO (Story 12.5): use game.store.ts currentTurn
      sectors: galaxyStore.sectors as Map<string, import('../types/sector').Sector>,
      sectorAdjacency: galaxyStore.adjacency as Map<string, string[]>,
      colonySectorIds,
      colonies: colonyStore.colonies as Map<string, import('../types/colony').Colony>,
      planets: planetStore.planets as Map<string, import('../types/planet').Planet>,
      corporations: corpStore.corporations as Map<string, Corporation>,
      colonizationParams,
    })

    submitting.value = false

    if (!result.success) {
      errorMessage.value = result.message
      return false
    }

    return true
  }

  // ─── Reset ────────────────────────────────────────────────────────────────

  /** Resets all wizard state back to Step 1. */
  function reset() {
    currentStep.value = 1
    selectedType.value = null
    selectedTarget.value = null
    selectedSectorB.value = null
    selectedColonyType.value = null
    selectedCorpId.value = null
    kickstartedCorpId.value = null
    errorMessage.value = null
    submitting.value = false
  }

  return {
    // Step
    currentStep: currentStep as Ref<WizardStep>,
    canAdvance,
    nextStep,
    prevStep,
    goToStep,

    // Step 1
    contractTypes,
    selectedType,
    selectType,

    // Step 2
    targetOptions,
    sectorBOptions,
    colonyTypeOptions,
    selectedTarget,
    selectedSectorB,
    selectedColonyType,
    resolvedTarget,
    selectTarget,
    selectSectorB,
    selectColonyType,

    // Step 3
    eligibleCorps,
    selectedCorpId,
    selectedCorp,
    selectCorp,
    kickstartCorp,

    // Step 4 preview
    previewBpPerTurn,
    previewDuration,
    previewTotalCost,
    previewNetBP,

    // Submit
    submitting,
    errorMessage,
    submit,
    reset,
  }
}
