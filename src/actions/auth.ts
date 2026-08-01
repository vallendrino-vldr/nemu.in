'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerClient } from '@/lib/supabase/server'

function siteOrigin(headerList: Headers): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, '')

  // Vercel preview deployments get a fresh hostname on every push, so the
  // redirect target has to be derived rather than hardcoded.
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const proto = headerList.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export async function signInWithGoogle(returnTo = '/dashboard') {
  const supabase = await getServerClient()
  const origin = siteOrigin(await headers())

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
