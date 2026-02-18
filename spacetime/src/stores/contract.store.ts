/**
 * contract.store.ts — Pinia store for all contracts.
 *
 * Holds active, completed, and failed contracts.
 * Calls createContract() from the engine for validation and construction.
 * Deducts BP from budget store when a contract is created.
 *
 * contract-phase.ts (Story 7.3): Pure engine phase that advances contracts each turn.
 * TODO (Story 7.4): ContractWizard.vue drives createContract() action from the UI.
 * TODO (Story 12.4): game.store.ts wires contract expenses into expense-phase.ts.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ContractId, CorpId, ColonyId } from '../types/common'
import { ContractStatus } from '../types/common'
import type { Contract } from '../types/contract'
import type { CreateContractParams } from '../engine/actions/create-contract'
import { createContract } from '../engine/actions/create-contract'
import { useBudgetStore } from './budget.store'

export const useContractStore = defineStore('contract', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  /** All contracts (active, completed, failed) keyed by ID. */
  const contracts = ref<Map<ContractId, Contract>>(new Map())

  // ─── Getters ─────────────────────────────────────────────────────────────────

  /** All currently active contracts. */
  const activeContracts = computed<Contract[]>(() =>
    [...contracts.value.values()].filter((c) => c.status === ContractStatus.Active),
  )

  /** All completed contracts, most recent first. */
  const completedContracts = computed<Contract[]>(() =>
    [...contracts.value.values()]
      .filter((c) => c.status === ContractStatus.Completed)
      .sort((a, b) => (b.completedTurn ?? 0) - (a.completedTurn ?? 0)),
  )

  /** All failed contracts. */
  const failedContracts = computed<Contract[]>(() =>
    [...contracts.value.values()].filter((c) => c.status === ContractStatus.Failed),
  )

  /** Total BP/turn committed to active contracts. */
  const totalContractExpenses = computed<number>(() =>
    activeContracts.value.reduce((sum, c) => sum + c.bpPerTurn, 0),
  )

  /** Returns a contract by ID, or undefined if not found. */
  function getContract(id: ContractId): Contract | undefined {
    return contracts.value.get(id)
  }

  /** Returns all active contracts targeting a specific colony. */
  function contractsByColony(colonyId: ColonyId): Contract[] {
    return activeContracts.value.filter(
      (c) => c.target.type === 'colony' && c.target.colonyId === colonyId,
    )
  }

  /**
   * Returns all contracts (active and completed) assigned to a specific corporation.
   * Used to populate corp history in CorpHistory.vue.
   */
  function contractsByCorp(corpId: CorpId): Contract[] {
    return [...contracts.value.values()].filter((c) => c.assignedCorpId === corpId)
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Validates and creates a new contract, then adds it to the store.
   *
   * Calls the engine's createContract() for all validation logic.
   * On success: adds to active contracts and registers the BP/turn expense in the budget store.
   * On failure: returns the error without modifying state.
   *
   * @param params - Full CreateContractParams as required by the engine action
   * @returns The created Contract on success, or null on failure (with error logged)
   */
  function createNewContract(
    params: CreateContractParams,
  ): { success: true; contract: Contract } | { success: false; error: string; message: string } {
    const result = createContract(params)

    if (!result.success) {
      return { success: false, error: result.error, message: result.message }
    }

    const { contract } = result

    // Add to store
    contracts.value.set(contract.id, contract)

    // Register as expense in budget store so the header/dashboard reflect the cost
    const budgetStore = useBudgetStore()
    budgetStore.addExpense('contract', contract.id, _contractExpenseName(contract), contract.bpPerTurn)

    return { success: true, contract }
  }

  /**
   * Advances a contract by one turn (decrements turnsRemaining).
   * If turnsRemaining reaches 0, the contract is marked as completed.
   *
   * Called by contract-phase.ts during turn resolution.
   *
   * @param id - The contract ID to advance
   * @param currentTurn - The current turn number (used to set completedTurn)
   * @returns true if the contract completed this tick, false otherwise
   *
   * TODO (Story 7.3): contract-phase.ts calls this and triggers completion effects.
   */
  function advanceContract(id: ContractId, currentTurn: number): boolean {
    const contract = contracts.value.get(id)
    if (!contract || contract.status !== ContractStatus.Active) return false

    contract.turnsRemaining = Math.max(0, contract.turnsRemaining - 1)

    if (contract.turnsRemaining === 0) {
      completeContract(id, currentTurn)
      return true
    }

    return false
  }

  /**
   * Marks a contract as completed and sets the completion turn.
   * Removes its expense from the budget store.
   *
   * @param id - The contract ID to complete
   * @param currentTurn - The turn on which completion occurred
   */
  function completeContract(id: ContractId, currentTurn: number) {
    const contract = contracts.value.get(id)
    if (!contract) return

    contract.status = ContractStatus.Completed
    contract.completedTurn = currentTurn as any

    // Remove from budget expenses — contract no longer costs BP/turn
    const budgetStore = useBudgetStore()
    budgetStore.removeContractExpense(id)
  }

  /**
   * Marks a contract as failed.
   * Removes its expense from the budget store.
   *
   * Currently unused in prototype (all contracts guaranteed to succeed).
   * TODO (future): failure mechanics when threats interfere with contracts.
   *
   * @param id - The contract ID to fail
   */
  function failContract(id: ContractId) {
    const contract = contracts.value.get(id)
    if (!contract) return

    contract.status = ContractStatus.Failed

    const budgetStore = useBudgetStore()
    budgetStore.removeContractExpense(id)
  }

  return {
    // State
    contracts,
    // Getters (computed)
    activeContracts,
    completedContracts,
    failedContracts,
    totalContractExpenses,
    // Getters (functions)
    getContract,
    contractsByColony,
    contractsByCorp,
    // Actions
    createNewContract,
    advanceContract,
    completeContract,
    failContract,
  }
})

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Derives a human-readable expense name from a contract for the budget breakdown.
 */
function _contractExpenseName(contract: Contract): string {
  const typeLabel: Record<string, string> = {
    Exploration: 'Exploration',
    GroundSurvey: 'Ground Survey',
    Colonization: 'Colonization',
    ShipCommission: 'Ship Commission',
    TradeRoute: 'Trade Route',
  }
  return typeLabel[contract.type] ?? contract.type
}
