/**
 * tax.ts — Planet tax and corporation tax formulas.
 *
 * Pure functions with no Vue/Pinia imports.
 * All values are integers (floor-based rounding).
 *
 * Formulas from Specs.md § 2 (Budget System):
 *
 * Planet tax:
 *   habitability_cost = max(0, 10 - habitability) × max(1, floor(pop_level / 3))
 *   planet_tax = max(0, floor(population_level² / 4) - habitability_cost)
 *   Returns 0 if popLevel < 5.
 *
 * Corporation tax:
 *   corp_tax = floor(corp_level² / 5)
 *   Level 1-2 corporations pay 0 BP (startups don't pay taxes).
 */

/**
 * Calculate the planet tax income from a colony.
 *
 * Higher population yields more tax. Low habitability increases costs,
 * reducing the net tax. Very low population (< 5) pays nothing.
 *
 * @param popLevel - Colony population level (1-10)
 * @param habitability - Colony habitability attribute (0-10)
 * @returns Tax income in BP (integer, >= 0)
 */
export function calculatePlanetTax(popLevel: number, habitability: number): number {
  // Colonies below population level 5 don't generate tax
  if (popLevel < 5) {
    return 0
  }

  const habitabilityCost =
    Math.max(0, 10 - habitability) * Math.max(1, Math.floor(popLevel / 3))

  const planetTax = Math.max(0, Math.floor((popLevel * popLevel) / 4) - habitabilityCost)

  return planetTax
}

/**
 * Calculate the corporation tax income from a corporation.
 *
 * Level 1-2 corporations pay 0 BP (startup exemption).
 * Higher-level corps contribute more as their influence grows.
 *
 * @param corpLevel - Corporation level (1-10)
 * @returns Tax income in BP (integer, >= 0)
 */
export function calculateCorpTax(corpLevel: number): number {
  return Math.floor((corpLevel * corpLevel) / 5)
}
