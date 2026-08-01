'use server'

import { createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { getServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { fail, succeed, type ActionResult } from '@/lib/result'

/**
 * Resolves the origin the user is actually browsing, in that order of
 * trust: forwarded host (what the browser really typed) → Host header →
 * configured env var, last.
 *
 * The env var comes last on purpose. A `NEXT_PUBLIC_SITE_URL` left at
 * `http://localhost:3000` in a deploy dashboard is exactly how an OAuth
 * round trip ends up dumping a phone browser on localhost, and that is a
 * config mistake the code should survive rather than repeat.
 */
function resolveOrigin(headerList: Headers): string {
  const forwardedHost = headerList.get('x-forwarded-host')
  const host = forwardedHost ?? headerList.get('host')

  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const proto = headerList.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${host}`
  }
  if (host) {
    const proto = headerList.get('x-forwarded-proto') ?? 'http'
    return `${proto}://${host}`
  }
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
}

/**
 * A salted hash of the caller's IP. The rate-limit table stores this
 * rather than the address itself, so the table is worthless to anyone
 * who reads it and we still get a stable per-visitor key.
 */
function hashCaller(headerList: Headers): string {
  const raw =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip') ??
    'unknown'
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-24) ?? 'nemu-static-salt'
  return createHash('sha256').update(`${salt}:${raw}`).digest('hex')
}

// ── Google ───────────────────────────────────────────────────────────

export async function signInWithGoogle(returnTo = '/dashboard') {
  const supabase = await getServerClient()
  const origin = resolveOrigin(await headers())

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })

  if (error || !data.url) redirect('/?auth=failed')
  redirect(data.url)
}

// ── Email + password ─────────────────────────────────────────────────

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

export interface AuthOutcome {
  /** Where the client should go once the session cookie is set. */
  next: string
}

/**
 * Signs an existing account in. Plain Supabase password grant — the
 * session cookie is written by the server client, so the browser is
 * authenticated the moment this returns.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<ActionResult<AuthOutcome>> {
  const address = email.trim().toLowerCase()
  if (!EMAIL_SHAPE.test(address) || password.length < 8) return fail('bad_credentials')

  const supabase = await getServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email: address, password })

  if (error) return fail('bad_credentials')
  return succeed({ next: '/dashboard' })
}

/**
 * Creates an account and signs it in immediately.
 *
 * WHY THIS GOES THROUGH THE ADMIN API
 * ───────────────────────────────────
 * The project has `mailer_autoconfirm` off and no SMTP configured, so an
 * ordinary `signUp()` would create a user who then waits forever for a
 * confirmation mail that is never sent. Creating the user server-side
 * with `email_confirm: true` is the only path that produces an account
 * someone can actually log into today.
 *
 * That deliberately removes the mailbox as a barrier, so the barrier
 * moves to `claim_signup_slot`: a handful of accounts per IP per day.
 * Without it, 30 free credits per unverified address is a faucet.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string,
): Promise<ActionResult<AuthOutcome>> {
  const address = email.trim().toLowerCase()
  if (!EMAIL_SHAPE.test(address)) return fail('bad_email')
  if (password.length < 8) return fail('weak_password')

  const admin = getAdminClient()
  const ipHash = hashCaller(await headers())

  const { data: allowed, error: brakeError } = await admin.rpc('claim_signup_slot', {
    p_ip_hash: ipHash,
    p_email: address,
  })
  // Fail closed only on an explicit refusal: a brake that errors should
  // not lock every new user out of the product.
  if (brakeError) return fail('unknown')
  if (allowed !== true) return fail('rate_limited')

  const { error: createError } = await admin.auth.admin.createUser({
    email: address,
    password,
    email_confirm: true,
    user_metadata: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
  })

  if (createError) {
    // Supabase phrases the duplicate case several ways depending on
    // version; matching on the status keeps this from rotting.
    const duplicate =
      createError.status === 422 || /already been registered|already exists/i.test(createError.message)
    return fail(duplicate ? 'email_taken' : 'unknown')
  }

  // The signup trigger has already created the profile and its 30
  // credits; signing in here just mints the session cookie.
  const supabase = await getServerClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: address,
    password,
  })
  if (signInError) return fail('unknown')

  return succeed({ next: '/dashboard' })
}

export async function signOut() {
  const supabase = await getServerClient()
  await supabase.auth.signOut()
  redirect('/')
}
