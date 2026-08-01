import createIntlMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { refreshSession } from '@/lib/supabase/middleware'

const handleLocale = createIntlMiddleware(routing)

export async function middleware(request: NextRequest) {
  // Order matters: locale resolution first (it may rewrite the URL), then
  // the auth cookie rotation is layered onto that same response.
  const response = handleLocale(request)
  return refreshSession(request, response)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|favicon|.*\\..*).*)'],
}
