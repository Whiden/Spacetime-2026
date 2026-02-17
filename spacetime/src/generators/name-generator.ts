/**
 * name-generator.ts — Shared name generation utilities for corporations, ships, captains, etc.
 *
 * Provides functions to generate unique names from prefix/suffix pools with optional connectors.
 * Tracks previously generated names to guarantee uniqueness within a session.
 *
 * No Vue or Pinia imports. Pure TypeScript.
 */

import { chance } from '../utils/random'

// ─── Name Registry ───────────────────────────────────────────────────────────

/**
 * Set of all names generated so far. Used to guarantee uniqueness.
 * Cleared between game sessions (new game resets everything).
 */
const generatedNames = new Set<string>()

/**
 * Clears the name registry. Call when starting a new game.
 */
export function clearNameRegistry(): void {
  generatedNames.clear()
}

// ─── Corp Name Generation ────────────────────────────────────────────────────

/**
 * Generates a unique corporation name from prefix + suffix pools,
 * with an optional connector word between them.
 *
 * Name patterns:
 * - "Apex Corp" (80% — direct prefix + suffix)
 * - "Apex & Corp" (20% — prefix + connector + suffix)
 *
 * @param prefixes - Pool of name prefixes
 * @param suffixes - Pool of name suffixes
 * @param connectors - Pool of connector words (e.g., "&", "and", "of")
 * @param connectorChance - Percentage chance (0-100) of using a connector
 * @param maxAttempts - Maximum retries before throwing (default 100)
 * @returns A unique name string
 */
export function generateCorpName(
  prefixes: string[],
  suffixes: string[],
  connectors: string[],
  connectorChance: number,
  maxAttempts = 100,
): string {
  for (let i = 0; i < maxAttempts; i++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]!
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]!

    let name: string
    if (connectors.length > 0 && chance(connectorChance)) {
      const connector = connectors[Math.floor(Math.random() * connectors.length)]!
      name = `${prefix} ${connector} ${suffix}`
    } else {
      name = `${prefix} ${suffix}`
    }

    if (!generatedNames.has(name)) {
      generatedNames.add(name)
      return name
    }
  }

  throw new Error(
    `generateCorpName: failed to generate unique name after ${maxAttempts} attempts`,
  )
}
