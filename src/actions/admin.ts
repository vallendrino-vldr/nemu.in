'use server'

import { revalidatePath } from 'next/cache'

import { getServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { fail, succeed, type ActionResult } from '@/lib/result'
import type { Profile } from '@/lib/database.types'

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

export interface GodStats {
  userCount: number
  creditsInCirculation: number
  leadCount: number
  aiCallsToday: number
  placesEnabled: boolean
  geminiEnabled: boolean
  cacheHits: number
}

export async function loadGodStats(): Promise<ActionResult<GodStats>> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return fail(guard.user ? 'forbidden' : 'auth')

  const admin = getAdminClient()
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)

  const [users, leads, ledger, settings, cache] = await Promise.all([
    admin.from('profiles').select('credits'),
    admin.from('leads').select('id', { count: 'exact', head: true }),
    admin
      .from('credit_ledger')
      .select('id', { count: 'exact', head: true })
      .in('action', ['score', 'pitch', 'deep_pitch', 'copilot'])
      .gte('created_at', midnight.toISOString()),
    admin.from('app_settings').select('places_enabled, gemini_enabled').eq('id', 1).single(),
    admin.from('search_cache').select('hit_count'),
  ])

  const profiles = (users.data ?? []) as Array<{ credits: number }>
  const cacheRows = (cache.data ?? []) as unknown as Array<{ hit_count: number }>

  return succeed({
    userCount: profiles.length,
    creditsInCirculation: profiles.reduce((sum, row) => sum + row.credits, 0),
    leadCount: leads.count ?? 0,
    aiCallsToday: ledger.count ?? 0,
    placesEnabled: settings.data?.places_enabled ?? true,
    geminiEnabled: settings.data?.gemini_enabled ?? true,
    cacheHits: cacheRows.reduce((sum, row) => sum + (row.hit_count ?? 0), 0),
  })
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
