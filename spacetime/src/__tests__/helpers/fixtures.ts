/**
 * Shared test fixtures used across multiple test files.
 *
 * Only truly identical helpers belong here. Helpers with per-file signature
 * differences (makeInfra, makeColony, makeState) stay local to each test.
 */

import type { BudgetState } from '../../types/budget'
import type { Sector, Galaxy } from '../../types/sector'
import type { Planet, Deposit } from '../../types/planet'
import type {
  SectorId,
  PlanetId,
  TurnNumber,
  BPAmount,
} from '../../types/common'
import {
  SectorDensity,
  PlanetType,
  PlanetSize,
  PlanetStatus,
  DepositType,
  RichnessLevel,
} from '../../types/common'

/**
 * Minimal BudgetState with sane defaults. Identical across all test files.
 */
export function makeMinimalBudget(): BudgetState {
  return {
    currentBP: 10 as BPAmount,
    incomeSources: [],
    expenseEntries: [],
    totalIncome: 0 as BPAmount,
    totalExpenses: 0 as BPAmount,
    netBP: 10 as BPAmount,
    debtTokens: 0,
    stabilityMalus: 0,
    calculatedTurn: 1 as TurnNumber,
  }
}

/**
 * Simple sector with reasonable defaults.
 */
export function makeSector(id: SectorId, name = `Sector ${id}`): Sector {
  return {
    id,
    name,
    density: SectorDensity.Moderate,
    explorationPercent: 10,
    threatModifier: 1.0,
    firstEnteredTurn: 1 as TurnNumber,
  }
}

/**
 * Galaxy from a list of sectors with empty adjacency.
 */
export function makeGalaxy(sectors: Sector[], fallbackId?: SectorId): Galaxy {
  const sectorsMap = new Map<SectorId, Sector>()
  const adjacency = new Map<SectorId, SectorId[]>()
  for (const s of sectors) {
    sectorsMap.set(s.id, s)
    adjacency.set(s.id, [])
  }
  return {
    sectors: sectorsMap,
    adjacency,
    startingSectorId: sectors[0]?.id ?? fallbackId!,
  }
}

/**
 * Galaxy from a single sector ID (convenience for corp-phase style tests).
 */
export function makeGalaxyFromId(sectorId: SectorId): Galaxy {
  return makeGalaxy([makeSector(sectorId)], sectorId)
}

/**
 * Continental Large planet with optional deposits and base habitability.
 */
export function makePlanetBase(
  id: PlanetId,
  sectorId: SectorId,
  deposits: Deposit[] = [],
  baseHabitability = 8,
  size = PlanetSize.Large,
): Planet {
  return {
    id,
    name: `Planet ${id}`,
    sectorId,
    type: PlanetType.Continental,
    size,
    status: PlanetStatus.Colonized,
    baseHabitability,
    deposits,
    features: [],
    featureModifiers: [],
    orbitScanTurn: 1,
    groundSurveyTurn: 1,
  }
}

/**
 * Common deposit fixture: FertileGround Rich.
 */
export const FERTILE_DEPOSIT: Deposit = {
  type: DepositType.FertileGround,
  richness: RichnessLevel.Rich,
  richnessRevealed: true,
}

/**
 * Simple deposit factory.
 */
export function makeDeposit(type: DepositType, richness: RichnessLevel): Deposit {
  return { type, richness, richnessRevealed: true }
}
