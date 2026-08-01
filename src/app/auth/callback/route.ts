import { NextResponse, type NextRequest } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'

/**
 * OAuth landing strip. Google hands back a one-time code; we swap it for
 * a session and drop the user where they were headed.
 *
 * Lives outside the [locale] segment on purpose — the redirect URI is
 * registered once in the Google console and must never change shape
 * because someone's browser prefers English.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth=failed`)
  }

  const supabase = await getServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/?auth=failed`)
  }

  // Behind a proxy the reported origin can be the internal one; prefer
  // the forwarded host so the user does not land on a localhost URL.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const base =
    process.env.NODE_ENV === 'development' || !forwardedHost
      ? origin
      : `https://${forwardedHost}`

  return NextResponse.redirect(`${base}${next}`)
}
