'use server'

import { getServerClient } from '@/lib/supabase/server'
import { assertServiceEnabled, charge, refund, ApiDisabledError, CreditError } from '@/lib/credits'
import { GeminiError } from '@/lib/gemini'
import { scoreLead, writePitch, deepAudit, type PitchTone } from '@/lib/ai/analyst'
import { costOf } from '@/lib/pricing'
import { fail, succeed, type ActionResult } from '@/lib/result'
import type { Lead } from '@/lib/database.types'
import type { ProspectCandidate } from '@/lib/discovery'

/**
 * Every paid AI action follows the same three beats: charge, call, and
 * refund on failure. The refund is not politeness — it is the reason a
 * user is willing to press the button a second time.
 */

async function loadLead(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  leadId: string,
  userId: string,
): Promise<Lead | null> {
  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data as Lead) ?? null
}

function asCandidate(lead: Lead): ProspectCandidate {
  return {
    placeId: lead.place_id,
    name: lead.name,
    category: lead.category,
    address: lead.address,
    area: lead.area,
    phone: lead.phone,
    phoneE164: lead.phone_e164,
    phoneDial: lead.phone_dial,
    website: lead.website,
    rating: lead.rating,
    reviewCount: lead.review_count ?? 0,
    lat: lead.lat,
    lng: lead.lng,
    mapsUri: lead.maps_uri,
    contactTier: lead.contact_tier,
  }
}

// ── AI score ────────────────────────────────────────────────────────

export interface ScoreOutput {
  score: number
  verdict: string
  angle: string
  balance: number
}

export async function scoreLeadAction(leadId: string): Promise<ActionResult<ScoreOutput>> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('auth')

  const lead = await loadLead(supabase, leadId, user.id)
  if (!lead) return fail('not_found')

  try {
    await assertServiceEnabled(supabase, 'gemini')
  } catch (error) {
    if (error instanceof ApiDisabledError) return fail('api_disabled')
    throw error
  }

  let balance: number
  let wasFree = false
  try {
    const charged = await charge(supabase, 'score', { leadId })
    balance = charged.balance
    wasFree = charged.wasFree
  } catch (error) {
    if (error instanceof CreditError)
      return fail('insufficient_credits', { needed: error.needed, have: error.have })
    throw error
  }

  try {
    const result = await scoreLead(asCandidate(lead))
    await supabase
      .from('leads')
      .update({ ai_score: result.score, ai_verdict: result.verdict, ai_angle: result.angle } as never)
      .eq('id', leadId)

    return succeed({ ...result, balance })
  } catch (error) {
    await refund(user.id, 'score', 'gemini_failed', wasFree)
    if (error instanceof GeminiError) {
      if (error.kind === 'exhausted') return fail('ai_busy')
      // No key configured, or every key rejected: a deployment problem
      // the operator can actually fix, so say so instead of shrugging.
      if (error.kind === 'auth') return fail('not_configured')
    }
    return fail('unknown')
  }
}

// ── Bulk score ──────────────────────────────────────────────────────

export interface BulkScoreRow {
  leadId: string
  ok: boolean
  score?: number
  verdict?: string
  angle?: string
}

export interface BulkScoreOutput {
  results: BulkScoreRow[]
  scored: number
  failed: number
  /** Asked for but not attempted because the balance ran out first. */
  skipped: number
  balance: number
}

/** How many leads one bulk call will attempt. */
const BULK_LIMIT = 8
/**
 * Concurrency.
 *
 * Gemini's free tier is rate-limited per key, and firing eight requests
 * at once walks straight into 429 on every one of them. Three in flight
 * keeps the key rotation's cooldown logic useful instead of overwhelming
 * it, and eight leads still finish in roughly three waves — comfortably
 * inside the page's 60-second budget.
 */
const BULK_CONCURRENCY = 3

/**
 * Scores several leads in one press.
 *
 * A sweep returns ten leads and the old flow meant ten separate taps,
 * each with its own spinner. This is the same paid path per lead — charge,
 * call, refund on failure — just driven by a small worker pool instead of
 * by the user's finger.
 *
 * Leads the caller cannot afford are reported as `skipped` rather than
 * attempted and failed, so the UI can say "you could only do 4 of these"
 * instead of showing four successes and four mysterious errors.
 */
export async function scoreLeadsBulk(leadIds: string[]): Promise<ActionResult<BulkScoreOutput>> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('auth')

  try {
    await assertServiceEnabled(supabase, 'gemini')
  } catch (error) {
    if (error instanceof ApiDisabledError) return fail('api_disabled')
    throw error
  }

  const requested = [...new Set(leadIds.filter((id) => typeof id === 'string' && id))].slice(
    0,
    BULK_LIMIT,
  )
  if (requested.length === 0) return fail('empty')

  // Work out up front how many are actually affordable. Super admins on
  // the free ride are charged nothing, so their affordable count is the
  // whole batch.
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, role, bill_admin')
    .eq('id', user.id)
    .single()

  const ridesFree = profile?.role === 'super_admin' && !profile?.bill_admin
  const unitCost = costOf('score')
  const affordable = ridesFree
    ? requested.length
    : Math.min(requested.length, Math.floor((profile?.credits ?? 0) / unitCost))

  if (affordable === 0) {
    return fail('insufficient_credits', { needed: unitCost, have: profile?.credits ?? 0 })
  }

  const targets = requested.slice(0, affordable)
  const results: BulkScoreRow[] = []

  const runOne = async (leadId: string): Promise<BulkScoreRow> => {
    const lead = await loadLead(supabase, leadId, user.id)
    if (!lead) return { leadId, ok: false }

    let wasFree = false
    try {
      const charged = await charge(supabase, 'score', { leadId, bulk: true })
      wasFree = charged.wasFree
    } catch (error) {
      // Someone else spent the balance mid-batch, or the account was
      // banned between the pre-check and now. Either way: not attempted.
      if (error instanceof CreditError) return { leadId, ok: false }
      throw error
    }

    try {
      const result = await scoreLead(asCandidate(lead))
      await supabase
        .from('leads')
        .update({
          ai_score: result.score,
          ai_verdict: result.verdict,
          ai_angle: result.angle,
        } as never)
        .eq('id', leadId)
      return { leadId, ok: true, ...result }
    } catch {
      await refund(user.id, 'score', 'gemini_failed_bulk', wasFree)
      return { leadId, ok: false }
    }
  }

  // A fixed pool of workers pulling from one queue: the batch finishes as
  // fast as the slowest three, not as slow as the sum of eight.
  const queue = [...targets]
  await Promise.all(
    Array.from({ length: Math.min(BULK_CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        const next = queue.shift()
        if (!next) return
        results.push(await runOne(next))
      }
    }),
  )

  // Read the balance back rather than deriving it: concurrent charges
  // make local arithmetic a guess, and the meter must never disagree
  // with the database.
  const { data: after } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single()

  return succeed({
    results,
    scored: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    skipped: requested.length - targets.length,
    balance: after?.credits ?? profile?.credits ?? 0,
  })
}

// ── Standard pitch ──────────────────────────────────────────────────

export interface PitchOutput {
  message: string
  tone: PitchTone
  balance: number
}

export async function writePitchAction(
  leadId: string,
  tone: PitchTone = 'warm',
): Promise<ActionResult<PitchOutput>> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('auth')

  const lead = await loadLead(supabase, leadId, user.id)
  if (!lead) return fail('not_found')

  try {
    await assertServiceEnabled(supabase, 'gemini')
  } catch (error) {
    if (error instanceof ApiDisabledError) return fail('api_disabled')
    throw error
  }

  let balance: number
  let wasFree = false
  try {
    const charged = await charge(supabase, 'pitch', { leadId, tone })
    balance = charged.balance
    wasFree = charged.wasFree
  } catch (error) {
    if (error instanceof CreditError)
      return fail('insufficient_credits', { needed: error.needed, have: error.have })
    throw error
  }

  try {
    const message = await writePitch(asCandidate(lead), tone, lead.ai_angle)
    await supabase.from('leads').update({ pitch: message, pitch_tone: tone } as never).eq('id', leadId)
    return succeed({ message, tone, balance })
  } catch (error) {
    await refund(user.id, 'pitch', 'gemini_failed', wasFree)
    if (error instanceof GeminiError) {
      if (error.kind === 'exhausted') return fail('ai_busy')
      // No key configured, or every key rejected: a deployment problem
      // the operator can actually fix, so say so instead of shrugging.
      if (error.kind === 'auth') return fail('not_configured')
    }
    return fail('unknown')
  }
}

// ── Deep audit ──────────────────────────────────────────────────────

export interface DeepAuditOutput {
  weaknesses: Array<{ title: string; detail: string; impact: 'tinggi' | 'sedang' | 'rendah' }>
  estimatedLoss: string
  message: string
  balance: number
}

export async function deepAuditAction(leadId: string): Promise<ActionResult<DeepAuditOutput>> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('auth')

  const lead = await loadLead(supabase, leadId, user.id)
  if (!lead) return fail('not_found')

  try {
    await assertServiceEnabled(supabase, 'gemini')
  } catch (error) {
    if (error instanceof ApiDisabledError) return fail('api_disabled')
    throw error
  }

  let balance: number
  let wasFree = false
  try {
    const charged = await charge(supabase, 'deep_pitch', { leadId })
    balance = charged.balance
    wasFree = charged.wasFree
  } catch (error) {
    if (error instanceof CreditError)
      return fail('insufficient_credits', { needed: error.needed, have: error.have })
    throw error
  }

  try {
    const audit = await deepAudit(asCandidate(lead))
    await supabase
      .from('leads')
      .update({ pitch: audit.message, pitch_tone: 'audit' } as never)
      .eq('id', leadId)
    return succeed({ ...audit, balance })
  } catch (error) {
    await refund(user.id, 'deep_pitch', 'gemini_failed', wasFree)
    if (error instanceof GeminiError) {
      if (error.kind === 'exhausted') return fail('ai_busy')
      // No key configured, or every key rejected: a deployment problem
      // the operator can actually fix, so say so instead of shrugging.
      if (error.kind === 'auth') return fail('not_configured')
    }
    return fail('unknown')
  }
}

// ── Free actions ────────────────────────────────────────────────────

export async function markContacted(leadId: string): Promise<ActionResult<null>> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('auth')

  await supabase
    .from('leads')
    .update({ status: 'contacted' } as never)
    .eq('id', leadId)
    .eq('user_id', user.id)

  return succeed(null)
}

/**
 * Deletes leads the user no longer wants.
 *
 * An archive that only ever grows is a junk drawer: the whole point of
 * the filter chips is to find work, and dead entries make that harder
 * every sweep. Scoped to the caller's own rows by both the where clause
 * and RLS, so one user can never clear another's archive.
 */
export async function deleteLeads(ids: string[]): Promise<ActionResult<{ removed: number }>> {
  const supabase = await getServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('auth')

  const targets = ids.filter((id) => typeof id === 'string' && id.length > 0).slice(0, 500)
  if (targets.length === 0) return succeed({ removed: 0 })

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('user_id', user.id)
    .in('id', targets)

  if (error) return fail('unknown')
  return succeed({ removed: targets.length })
}
