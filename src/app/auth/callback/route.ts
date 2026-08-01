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

  // Behind a proxy the reported origin is the internal one, so the
  // forwarded host is the only value that matches what the browser typed.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const base =
    forwardedHost && !forwardedHost.startsWith('localhost')
      ? `${request.headers.get('x-forwarded-proto') ?? 'https'}://${forwardedHost}`
      : origin

  if (!code) {
    // Supabase reports provider failures as query params rather than a
    // code. Passing the real reason through beats a generic "failed".
    const providerError =
      searchParams.get('error_description') ?? searchParams.get('error') ?? 'no_code'
    return NextResponse.redirect(
      `${base}/?auth=failed&reason=${encodeURIComponent(providerError)}`,
    )
  }

  const supabase = await getServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${base}/?auth=failed&reason=${encodeURIComponent(error.message)}`,
    )
  }

  return NextResponse.redirect(`${base}${next}`)
}
