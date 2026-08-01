import 'server-only'

import type { AppSupabaseClient } from '@/lib/supabase/types'
import { getAdminClient } from '@/lib/supabase/admin'
import { costOf, type BillableAction } from '@/lib/pricing'

type Client = AppSupabaseClient

export class CreditError extends Error {
  constructor(
    readonly needed: number,
    readonly have: number,
  ) {
    super(`INSUFFICIENT_CREDITS needed=${needed} have=${have}`)
    this.name = 'CreditError'
  }
}

export class ApiDisabledError extends Error {
  constructor(readonly service: 'places' | 'gemini') {
    super(`${service} disabled by kill switch`)
    this.name = 'ApiDisabledError'
  }
}

/**
 * Charges the caller for an action.
 *
 * The whole check-and-deduct runs inside one Postgres function with a
 * row lock, so two tabs firing simultaneously cannot both pass the
 * balance check. Super admins are charged zero but still land in the
 * ledger, so God Mode usage is auditable instead of invisible.
 */
export async function charge(
  supabase: Client,
  action: BillableAction,
  meta: Record<string, unknown> = {},
): Promise<{ balance: number; wasFree: boolean }> {
  const amount = costOf(action)

  const { data, error } = await supabase.rpc('consume_credits', {
    p_action: action,
    p_amount: amount,
    p_meta: meta,
  })

  if (error) {
    const match = /INSUFFICIENT_CREDITS:(\d+):(\d+)/.exec(error.message)
    if (match) throw new CreditError(Number(match[1]), Number(match[2]))
    throw error
  }

  const row = Array.isArray(data) ? data[0] : data
  return { balance: row?.balance ?? 0, wasFree: row?.was_free ?? false }
}

/**
 * Hands credits back when a paid operation fails downstream. Nobody
 * should pay for a 500 that we caused.
 *
 * Runs through the service-role client, not the caller's. `refund_credits`
 * is revoked from `authenticated` precisely because a user-callable
 * "give me credits" endpoint is a mint — the browser must never be able
 * to reach it, only this server path with an amount fixed by the price
 * table.
 */
export async function refund(
  userId: string,
  action: BillableAction,
  reason: string,
): Promise<void> {
  const admin = getAdminClient()
  await admin.rpc('refund_credits', {
    p_user: userId,
    p_amount: costOf(action),
    p_reason: reason,
  })
}

/** Global kill switch. Read before spending a single quota unit. */
export async function assertServiceEnabled(
  supabase: Client,
  service: 'places' | 'gemini',
): Promise<void> {
  const { data } = await supabase
    .from('app_settings')
    .select('places_enabled, gemini_enabled')
    .eq('id', 1)
    .single()

  if (!data) return // Fail open: a missing settings row must not brick the app.

  const enabled = service === 'places' ? data.places_enabled : data.gemini_enabled
  if (!enabled) throw new ApiDisabledError(service)
}
