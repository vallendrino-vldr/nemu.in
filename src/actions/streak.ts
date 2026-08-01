'use server'

import { getServerClient } from '@/lib/supabase/server'
import { fail, succeed, type ActionResult } from '@/lib/result'

export interface StreakSummary {
  /** Consecutive days worked, counting back from today or yesterday. */
  current: number
  longest: number
  todayActions: number
  contactedToday: number
}

/**
 * The work streak.
 *
 * Nothing is stored for this. `credit_ledger` is already append-only and
 * already timestamps every billable action, so "days you actually worked"
 * is a query rather than a counter that could drift — and it is
 * retroactively correct for everyone who has ever used the app.
 *
 * Days are Asia/Jakarta days, not UTC ones. Getting that wrong would
 * break the streak of exactly the people who work late, which is most of
 * them.
 */
export async function loadStreak(): Promise<ActionResult<StreakSummary>> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('auth')

  const { data, error } = await supabase.rpc('my_streak')
  if (error || !data) return fail('unknown')

  return succeed(data as unknown as StreakSummary)
}
