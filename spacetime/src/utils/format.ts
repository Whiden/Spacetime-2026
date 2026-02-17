/**
 * format.ts — Display formatting utilities for game values.
 *
 * Used by UI components to format numbers, turns, and BP amounts for display.
 * No Vue or Pinia imports. Pure TypeScript.
 */

import type { BPAmount } from '../types/common'

// ─── formatBP ─────────────────────────────────────────────────────────────────

/**
 * Formats a BP amount for display in the UI.
 * Positive values show with "+" prefix; negative values show with "-" prefix.
 *
 * @param amount - The BP amount to format
 * @param showSign - If true, always shows + or - sign (default: true for net values)
 * @returns Formatted string (e.g., "+12 BP", "-3 BP", "0 BP")
 *
 * @example
 * formatBP(12 as BPAmount)          // → "+12 BP"
 * formatBP(-3 as BPAmount)          // → "-3 BP"
 * formatBP(0 as BPAmount)           // → "0 BP"
 * formatBP(12 as BPAmount, false)   // → "12 BP"
 */
export function formatBP(amount: BPAmount, showSign = true): string {
  if (showSign && amount > 0) return `+${amount} BP`
  return `${amount} BP`
}

// ─── formatPercent ────────────────────────────────────────────────────────────

/**
 * Formats a number as a percentage string.
 *
 * @param value - The value to format (0-100 for percentage, or 0-1 for ratio)
 * @param isRatio - If true, multiplies by 100 first (default: false)
 * @returns Formatted string (e.g., "75%", "100%")
 *
 * @example
 * formatPercent(75)       // → "75%"
 * formatPercent(0.75, true) // → "75%"
 * formatPercent(100)      // → "100%"
 */
export function formatPercent(value: number, isRatio = false): string {
  const pct = isRatio ? Math.round(value * 100) : Math.round(value)
  return `${pct}%`
}

// ─── formatTurns ──────────────────────────────────────────────────────────────

/**
 * Formats a turn count for display.
 *
 * @param count - Number of turns
 * @returns Formatted string (e.g., "3 turns", "1 turn")
 *
 * @example
 * formatTurns(3)  // → "3 turns"
 * formatTurns(1)  // → "1 turn"
 * formatTurns(0)  // → "0 turns"
 */
export function formatTurns(count: number): string {
  return count === 1 ? '1 turn' : `${count} turns`
}
