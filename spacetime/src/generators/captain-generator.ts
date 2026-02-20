/**
 * captain-generator.ts — Ship captain generation.
 *
 * Story 15.3 — Captain Generator.
 *
 * Generates unique captains with names drawn from first/last name pools and
 * starting at Green experience. Experience level is derived from missionsCompleted:
 *   0–1  → Green   (×0.8 combat modifier)
 *   2–4  → Regular (×1.0)
 *   5–9  → Veteran (×1.1)
 *   10+  → Elite   (×1.2)
 *
 * Pure TypeScript — no Vue or Pinia imports.
 */

import type { CaptainId } from '../types/common'
import { CaptainExperience } from '../types/common'
import type { Captain } from '../types/ship'
import { generateCaptainId } from '../utils/id'
import { CAPTAIN_FIRST_NAMES, CAPTAIN_LAST_NAMES } from '../data/captain-names'

// ─── Experience Progression ───────────────────────────────────────────────────

/** Mission thresholds at which a captain advances to the next experience tier. */
const EXPERIENCE_THRESHOLDS: Array<{ minMissions: number; level: CaptainExperience }> = [
  { minMissions: 10, level: CaptainExperience.Elite },
  { minMissions: 5,  level: CaptainExperience.Veteran },
  { minMissions: 2,  level: CaptainExperience.Regular },
  { minMissions: 0,  level: CaptainExperience.Green },
]

/**
 * Derives the experience level from the number of completed missions.
 *
 *  0–1  → Green
 *  2–4  → Regular
 *  5–9  → Veteran
 * 10+   → Elite
 */
export function getExperienceLevel(missionsCompleted: number): CaptainExperience {
  for (const threshold of EXPERIENCE_THRESHOLDS) {
    if (missionsCompleted >= threshold.minMissions) {
      return threshold.level
    }
  }
  return CaptainExperience.Green
}

// ─── Name Generation ──────────────────────────────────────────────────────────

/**
 * Generates a captain name as "FirstName LastName".
 * Uses injectable random for deterministic testing.
 */
function generateCaptainName(randFn: () => number): string {
  const first = CAPTAIN_FIRST_NAMES[Math.floor(randFn() * CAPTAIN_FIRST_NAMES.length)]!
  const last = CAPTAIN_LAST_NAMES[Math.floor(randFn() * CAPTAIN_LAST_NAMES.length)]!
  return `${first} ${last}`
}

// ─── Captain Generation ───────────────────────────────────────────────────────

/**
 * Generates a new captain starting at Green experience.
 *
 * @param randFn - Optional RNG for deterministic testing. Defaults to Math.random.
 * @returns A fully typed Captain object.
 */
export function generateCaptain(randFn: () => number = Math.random): Captain {
  return {
    id: generateCaptainId(),
    name: generateCaptainName(randFn),
    experience: CaptainExperience.Green,
    missionsCompleted: 0,
    battlesCount: 0,
  }
}
