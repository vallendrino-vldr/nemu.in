'use server'

import { getServerClient } from '@/lib/supabase/server'
import { assertServiceEnabled, charge, refund, ApiDisabledError, CreditError } from '@/lib/credits'
import { GeminiError } from '@/lib/gemini'
import { scoreLead, writePitch, deepAudit, type PitchTone } from '@/lib/ai/analyst'
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
