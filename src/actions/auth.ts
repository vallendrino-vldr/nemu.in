'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerClient } from '@/lib/supabase/server'

/**
 * Resolves the origin the user is actually browsing, in that order of
 * trust: forwarded host (what the browser really typed) → Host header →
 * configured env var, last.
 *
 * The env var comes last on purpose. A `NEXT_PUBLIC_SITE_URL` left at
 * `http://localhost:3000` in the Vercel dashboard is exactly how an
 * OAuth round trip ends up dumping a phone browser on localhost, and
 * that is a config mistake the code should survive rather than repeat.
 */
function resolveOrigin(headerList: Headers): string {
  const forwardedHost = headerList.get('x-forwarded-host')
  const host = forwardedHost ?? headerList.get('host')

  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const proto = headerList.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${host}`
  }

  // Genuinely local development, or no host header at all.
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (host) {
    const proto = headerList.get('x-forwarded-proto') ?? 'http'
    return `${proto}://${host}`
  }
  return configured ?? 'http://localhost:3000'
}

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

export async function signOut() {
  const supabase = await getServerClient()
  await supabase.auth.signOut()
  redirect('/')
}
