'use client'

/**
 * Physical feedback vocabulary. Each pattern is short enough to read as
 * texture rather than as a notification buzz.
 *
 * Silently no-ops on desktop and on iOS Safari, which is the intended
 * behaviour — haptics are a bonus layer, never load-bearing.
 */
const PATTERNS = {
  /** A control accepted the press. */
  tap: 8,
  /** Something meaningful landed: results arrived, pitch generated. */
  land: [14, 30, 18],
  /** Credits left the wallet. */
  spend: [6, 24, 10],
  /** Credits arrived. */
  receive: [10, 40, 10, 40, 16],
  /** Rejected: out of credits, empty result, blocked action. */
  reject: [40, 55, 40],
} as const

export type HapticIntent = keyof typeof PATTERNS

export function haptic(intent: HapticIntent = 'tap') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    navigator.vibrate(PATTERNS[intent] as number | number[])
  } catch {
    // Some browsers throw when the page is not visible. Not worth a log line.
  }
}
