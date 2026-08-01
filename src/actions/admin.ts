'use server'

import { revalidatePath } from 'next/cache'

import { getServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { invalidateGeminiKeys } from '@/lib/gemini'
import { fail, succeed, type ActionResult } from '@/lib/result'
import type { ApiKeyView, GodActivityRow, Profile } from '@/lib/database.types'

/**
 * Authority is always re-read from the database. A JWT claim can be stale
 * for up to an hour after a demotion — long enough to matter.
 */
async function requireSuperAdmin() {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, supabase, user: null }

  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (data?.role !== 'super_admin') return { ok: false as const, supabase, user }

  return { ok: true as const, supabase, user }
}

/**
 * Everything the console's masthead needs, from one query.
 *
 * The previous version fired four separate aggregates from the browser and
 * took about seven seconds to paint. `god_stats()` is a single SECURITY
 * DEFINER function that re-checks super_admin itself, so the round trip is
 * one, and "today" is computed in Jakarta time rather than in whatever
 * timezone the serverless region happened to boot in.
 */
export interface GodStats {
  userCount: number
  bannedCount: number
  newUsersToday: number
  activeToday: number
  creditsInCirculation: number
  creditsSpentToday: number
  leadCount: number
  leadsToday: number
  waReadyCount: number
  contactedCount: number
  aiCallsToday: number
  sweepsToday: number
  cacheHits: number
  cachedQueries: number
  placesEnabled: boolean
  geminiEnabled: boolean
  notice: string | null
  /** The line God Mode draws before the Gemini free tier bites. */
  aiDailyBudget: number
  keysTotal: number
  keysActive: number
}

/** Sets the daily AI-call warning threshold shown in the console. */
export async function setAiBudget(budget: number): Promise<ActionResult<{ budget: number }>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')
  if (!Number.isInteger(budget) || budget < 1 || budget > 100_000) return fail('unknown')

  const { data, error } = await guard.supabase.rpc('admin_set_ai_budget', { p_budget: budget })
  if (error) return fail('unknown')

  revalidatePath('/god')
  return succeed({ budget: (data as number) ?? budget })
}

export async function loadGodStats(): Promise<ActionResult<GodStats>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const { data, error } = await guard.supabase.rpc('god_stats')
  if (error || !data) return fail('unknown')

  return succeed(data as unknown as GodStats)
}

export async function listAllUsers(search = ''): Promise<ActionResult<Profile[]>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const admin = getAdminClient()
  let query = admin.from('profiles').select('*').order('last_seen_at', { ascending: false }).limit(100)

  const term = search.trim()
  if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)

  const { data, error } = await query
  if (error) return fail('unknown')
  return succeed((data ?? []) as Profile[])
}

/**
 * Injects credits. The target's browser is subscribed to their own
 * profile row over Supabase Realtime, so the number on their screen
 * changes without a refresh — that is the whole trick.
 *
 * A negative amount is a deduction, which is how the owner can watch his
 * own balance fall while testing.
 */
export async function injectCredits(
  targetId: string,
  amount: number,
  note?: string,
): Promise<ActionResult<{ balance: number }>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100_000) {
    return fail('unknown')
  }

  const { data, error } = await guard.supabase.rpc('grant_credits', {
    p_target: targetId,
    p_amount: amount,
    p_note: note ?? null,
  })

  if (error) return fail('unknown')
  revalidatePath('/god')
  return succeed({ balance: (data as number) ?? 0 })
}

export async function setKillSwitch(
  places: boolean,
  gemini: boolean,
  notice?: string | null,
): Promise<ActionResult<null>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const { error } = await guard.supabase.rpc('set_api_switch', {
    p_places: places,
    p_gemini: gemini,
    p_notice: notice ?? null,
  })

  if (error) return fail('unknown')
  revalidatePath('/god')
  return succeed(null)
}

// ── Moderation ───────────────────────────────────────────────────────

/**
 * Ban, or lift a ban by passing null.
 *
 * The database refuses to ban a super_admin, so the console cannot lock
 * itself out. Enforcement happens inside `consume_credits`, which means a
 * ban bites an already-open session rather than only the next sign-in.
 */
export async function setUserBan(
  targetId: string,
  reason: string | null,
): Promise<ActionResult<null>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const trimmed = reason?.trim()
  const { error } = await guard.supabase.rpc('admin_set_ban', {
    p_target: targetId,
    p_reason: trimmed ? trimmed.slice(0, 300) : null,
  })

  if (error) return fail(error.message.includes('CANNOT_BAN_ADMIN') ? 'forbidden' : 'unknown')
  revalidatePath('/god')
  return succeed(null)
}

/** The warning banner the user sees on their own screen. Null clears it. */
export async function setUserNotice(
  targetId: string,
  message: string | null,
): Promise<ActionResult<null>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const trimmed = message?.trim()
  const { error } = await guard.supabase.rpc('admin_set_notice', {
    p_target: targetId,
    p_message: trimmed ? trimmed.slice(0, 500) : null,
  })

  if (error) return fail('unknown')
  revalidatePath('/god')
  return succeed(null)
}

/**
 * Deletes the auth user. `profiles` cascades from `auth.users`, and
 * `leads` and `credit_ledger` cascade from `profiles`, so this one call
 * removes the account and everything hanging off it.
 *
 * Irreversible, so it refuses two things outright: deleting yourself, and
 * deleting another super_admin.
 */
export async function deleteUser(targetId: string): Promise<ActionResult<null>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')
  if (targetId === guard.user.id) return fail('forbidden')

  const admin = getAdminClient()

  const { data: target } = await admin.from('profiles').select('role').eq('id', targetId).single()
  if (!target) return fail('not_found')
  if (target.role === 'super_admin') return fail('forbidden')

  const { error } = await admin.auth.admin.deleteUser(targetId)
  if (error) return fail('unknown')

  revalidatePath('/god')
  return succeed(null)
}

/**
 * The tester switch: charge me like a normal user.
 *
 * Only ever aimed at the caller — the database ignores any other target —
 * because an admin flipping a peer into billed mode is a prank, not a
 * feature.
 */
export async function setAdminBilling(enabled: boolean): Promise<ActionResult<{ billed: boolean }>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const { data, error } = await guard.supabase.rpc('admin_set_billing', { p_enabled: enabled })
  if (error) return fail('unknown')

  revalidatePath('/god')
  return succeed({ billed: Boolean(data) })
}

// ── Gemini keys ──────────────────────────────────────────────────────

export async function listApiKeys(): Promise<ActionResult<ApiKeyView[]>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const { data, error } = await guard.supabase.rpc('admin_list_api_keys')
  if (error) return fail('unknown')
  return succeed((data ?? []) as unknown as ApiKeyView[])
}

/**
 * Stores a new key.
 *
 * The write goes through the service-role client rather than an RPC the
 * browser could call directly: `api_keys` has RLS on with no policies at
 * all, so service_role is the only thing on the planet that can insert
 * into it. The secret is validated for shape, never echoed back, and only
 * ever leaves the database as a masked preview.
 */
export async function addApiKey(label: string, secret: string): Promise<ActionResult<ApiKeyView[]>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const cleanSecret = secret.trim()
  const cleanLabel = label.trim().slice(0, 60) || 'Kunci tanpa nama'

  // Google's keys are a stable shape. Rejecting the obvious typo here
  // beats discovering it as a 400 in the middle of a paid sweep.
  if (!/^AIza[\w-]{30,}$/.test(cleanSecret)) return fail('not_configured')

  const admin = getAdminClient()
  const { error } = await admin.from('api_keys').insert({
    provider: 'gemini',
    label: cleanLabel,
    secret: cleanSecret,
    active: true,
    created_by: guard.user.id,
  })

  if (error) return fail('unknown')

  // Drops this instance's cached rotation so the new key is live on the
  // next AI call here. Other warm instances pick it up within a minute —
  // for "stop everything right now" the kill switch is the control.
  invalidateGeminiKeys()
  revalidatePath('/god')
  return listApiKeys()
}

export async function toggleApiKey(id: string, active: boolean): Promise<ActionResult<ApiKeyView[]>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const { error } = await guard.supabase.rpc('admin_toggle_api_key', { p_id: id, p_active: active })
  if (error) return fail('unknown')

  invalidateGeminiKeys()
  return listApiKeys()
}

export async function deleteApiKey(id: string): Promise<ActionResult<ApiKeyView[]>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const { error } = await guard.supabase.rpc('admin_delete_api_key', { p_id: id })
  if (error) return fail('unknown')

  invalidateGeminiKeys()
  return listApiKeys()
}

// ── Activity ─────────────────────────────────────────────────────────

export async function loadActivity(limit = 40): Promise<ActionResult<GodActivityRow[]>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const { data, error } = await guard.supabase.rpc('god_recent_activity', { p_limit: limit })
  if (error) return fail('unknown')
  return succeed((data ?? []) as unknown as GodActivityRow[])
}

/** Dismisses the admin warning on the caller's own profile. */
export async function dismissMyNotice(): Promise<ActionResult<null>> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('auth')

  const { error } = await supabase.from('profiles').update({ notice: null }).eq('id', user.id)
  if (error) return fail('unknown')
  return succeed(null)
}
