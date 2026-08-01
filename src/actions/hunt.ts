'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { getServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { assertServiceEnabled, charge, refund, ApiDisabledError, CreditError } from '@/lib/credits'
import { sweep, isSellable, DiscoveryError, type ProspectCandidate } from '@/lib/discovery'
import { LEADS_PER_SWEEP, nextRadius } from '@/lib/pricing'
import { fail, succeed, type ActionResult } from '@/lib/result'
import type { Lead } from '@/lib/database.types'

const CACHE_TTL_DAYS = 7

export interface SweepInput {
  query: string
  city: string
  radiusMeters: number
  center?: { lat: number; lng: number } | null
}

export interface SweepOutput {
  leads: Lead[]
  /** True when the whole result came from the shared cache: no quota spent. */
  fromCache: boolean
  totalFound: number
  sellableCount: number
  balance: number
}

/**
 * The money path.
 *
 * Order of operations is deliberate and worth reading before changing:
 *   1. kill switch  — never spend quota an admin has paused
 *   2. cache lookup — a hit costs zero credits and zero requests
 *   3. charge       — only once we know we are actually calling Google
 *   4. call         — one request, contact fields included via FieldMask
 *   5. refund       — on quota errors or a genuinely empty radius
 *
 * A failed or empty sweep must never cost a credit. That rule is what
 * makes the "widen the radius" prompt safe to accept.
 */
export async function sweepForLeads(input: SweepInput): Promise<ActionResult<SweepOutput>> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('auth')

  const query = input.query.trim()
  const city = input.city.trim()
  if (!query) return fail('empty')

  try {
    await assertServiceEnabled(supabase, 'places')
  } catch (error) {
    if (error instanceof ApiDisabledError) return fail('api_disabled')
    throw error
  }

  const queryHash = hashSweep(query, city, input.radiusMeters)

  // ── 1. Shared cache ────────────────────────────────────────────────
  const cached = await readSweepCache(supabase, queryHash)
  if (cached && cached.length > 0) {
    const saved = await persistLeads(supabase, user.id, cached)
    // Cache bookkeeping runs on the service role: the shared cache is
    // read by every user, so no browser session may write to it.
    await getAdminClient().rpc('touch_sweep_cache', { p_query_hash: queryHash })
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    revalidatePath('/dashboard')
    return succeed({
      leads: saved,
      fromCache: true,
      totalFound: cached.length,
      sellableCount: cached.filter(isSellable).length,
      balance: profile?.credits ?? 0,
    })
  }

  // ── 2. Charge, then call ───────────────────────────────────────────
  let balance: number
  try {
    const charged = await charge(supabase, 'scrape', { query, city, radius: input.radiusMeters })
    balance = charged.balance
  } catch (error) {
    if (error instanceof CreditError) {
      return fail('insufficient_credits', { needed: error.needed, have: error.have })
    }
    throw error
  }

  let candidates: ProspectCandidate[]
  try {
    candidates = await sweep({
      query,
      city,
      center: input.center,
      radiusMeters: input.radiusMeters,
      limit: LEADS_PER_SWEEP * 2,
    })
  } catch (error) {
    await refund(user.id, 'scrape', 'discovery_failed')
    if (error instanceof DiscoveryError && error.kind === 'quota') return fail('quota')
    return fail('unknown')
  }

  // ── 3. Empty radius is not the user's fault, so it is not their bill ──
  if (candidates.length === 0) {
    await refund(user.id, 'scrape', 'empty_radius')
    return fail('empty', { suggestRadius: nextRadius(input.radiusMeters) ?? undefined })
  }

  await getAdminClient().rpc('record_sweep', {
    p_query_hash: queryHash,
    p_query_text: query,
    p_city: city,
    p_places: candidates as unknown as Record<string, unknown>[],
  })

  const saved = await persistLeads(supabase, user.id, candidates)

  revalidatePath('/dashboard')
  return succeed({
    leads: saved,
    fromCache: false,
    totalFound: candidates.length,
    sellableCount: candidates.filter(isSellable).length,
    balance,
  })
}

// ── helpers ──────────────────────────────────────────────────────────

function hashSweep(query: string, city: string, radius: number): string {
  const normalized = `${query.toLowerCase()}|${city.toLowerCase()}|${radius}`
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha1').update(normalized).digest('hex')
}

async function readSweepCache(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  queryHash: string,
): Promise<ProspectCandidate[] | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString()

  const { data: entry } = await supabase
    .from('search_cache')
    .select('place_ids, created_at')
    .eq('query_hash', queryHash)
    .gte('created_at', cutoff)
    .maybeSingle()

  const ids = (entry as { place_ids?: string[] } | null)?.place_ids
  if (!ids?.length) return null

  const { data: places } = await supabase
    .from('place_cache')
    .select('payload')
    .in('place_id', ids)

  const rows = (places ?? []) as unknown as Array<{ payload: ProspectCandidate }>
  return rows.map((row) => row.payload)
}

/**
 * Writes the sweep into the user's own archive. Upsert on
 * (user_id, place_id) means re-running a search never duplicates a card
 * and never wipes an AI score the user already paid for.
 */
async function persistLeads(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  userId: string,
  candidates: ProspectCandidate[],
): Promise<Lead[]> {
  const rows = candidates.map((candidate) => ({
    user_id: userId,
    place_id: candidate.placeId,
    name: candidate.name,
    category: candidate.category,
    address: candidate.address,
    area: candidate.area,
    phone: candidate.phone,
    phone_e164: candidate.phoneE164,
    phone_dial: candidate.phoneDial,
    website: candidate.website,
    rating: candidate.rating,
    review_count: candidate.reviewCount,
    lat: candidate.lat,
    lng: candidate.lng,
    maps_uri: candidate.mapsUri,
    contact_tier: candidate.contactTier,
  }))

  const { data, error } = await supabase
    .from('leads')
    .upsert(rows as never, { onConflict: 'user_id,place_id', ignoreDuplicates: false })
    .select('*')

  if (error) throw error
  return (data ?? []) as Lead[]
}
