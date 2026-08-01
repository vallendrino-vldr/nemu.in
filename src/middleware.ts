import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { refreshSession } from '@/lib/supabase/middleware'

const handleLocale = createIntlMiddleware(routing)

/**
 * WHY THIS FILE IS THE PERFORMANCE FIX
 * ────────────────────────────────────
 * The first version called `supabase.auth.getUser()` on every single
 * request. That is a network round trip from the Vercel function to
 * Supabase in Singapore, and it ran for the landing page, for the
 * manifest, for the service worker — for everything. Stacked on a cold
 * start it is most of the "five seconds per tap" the app was showing.
 *
 * Two rules now:
 *   1. Public routes never touch the network. The landing page renders
 *      from cache and the session is resolved by the page itself.
 *   2. Protected routes check for the presence of an auth cookie first.
 *      No cookie means no session to refresh, so we redirect immediately
 *      instead of asking Supabase to confirm what we already know.
 */

/**
 * Paths that require a session. Everything else skips the auth hop.
 *
 * God Mode is not listed because it is no longer a route — it is a tab
 * inside the shell, gated by the profile role the shell already loaded.
 */
const PROTECTED = ['/dashboard']

function isProtected(pathname: string): boolean {
  // Locale prefixes are stripped first: /en/dashboard and /dashboard are
  // the same route as far as access control is concerned.
  const withoutLocale = pathname.replace(/^\/(id|en)(?=\/|$)/, '') || '/'
  return PROTECTED.some((base) => withoutLocale === base || withoutLocale.startsWith(`${base}/`))
}

/**
 * Supabase stores its session in cookies named `sb-<ref>-auth-token`,
 * chunked as `.0`, `.1`, … when the JWT is large. Presence is enough to
 * decide whether a refresh is worth a round trip.
 */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => /^sb-.*-auth-token(\.\d+)?$/.test(cookie.name))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Locale resolution first — it may rewrite the URL, and everything
  // below layers onto the response it produces.
  const response = handleLocale(request)

  if (!isProtected(pathname)) return response

  if (!hasAuthCookie(request)) {
    const home = new URL('/', request.url)
    return NextResponse.redirect(home)
  }

  return refreshSession(request, response)
}

export const config = {
  // Static assets, the manifest and the service worker must never pass
  // through here: a service worker delayed by an auth round trip cannot
  // do its job of making the app feel instant.
  matcher: ['/((?!api|_next|_vercel|manifest.webmanifest|sw.js|icon-.*|.*\\..*).*)'],
}
