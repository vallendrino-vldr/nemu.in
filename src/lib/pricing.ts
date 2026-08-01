import type { CreditAction } from '@/lib/database.types'

/**
 * Single source of truth for what anything costs. The server charges from
 * this table and the UI quotes from this table, so a price can never be
 * displayed as one number and billed as another.
 */
export const CREDIT_COST = {
  /** One sweep returns up to LEADS_PER_SWEEP results. */
  scrape: 2,
  score: 3,
  pitch: 1,
  deep_pitch: 8,
  copilot: 2,
} as const satisfies Partial<Record<CreditAction, number>>

export type BillableAction = keyof typeof CREDIT_COST

export const SIGNUP_BONUS = 30
export const LEADS_PER_SWEEP = 10

/** Radius ladder used by the Smart Radius Expansion prompt, in metres. */
export const RADIUS_LADDER = [3_000, 8_000, 20_000, 50_000] as const
export const DEFAULT_RADIUS = RADIUS_LADDER[0]

export function nextRadius(current: number): number | null {
  const idx = RADIUS_LADDER.findIndex((r) => r === current)
  if (idx === -1) return RADIUS_LADDER[1] ?? null
  return RADIUS_LADDER[idx + 1] ?? null
}

export function costOf(action: BillableAction): number {
  return CREDIT_COST[action]
}
