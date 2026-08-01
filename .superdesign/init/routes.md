# Routes

File-based routing, Next.js 15 App Router, `[locale]` segment via next-intl.
Locales `id` (default, bare root) and `en` (prefixed). `localePrefix: 'as-needed'`.

| URL | File | Layout | Renders |
|---|---|---|---|
| `/` · `/en` | `src/app/[locale]/page.tsx` | `[locale]/layout.tsx` | Marketing landing: hero, stats, how-it-works, Ghost Site demo, auth panel |
| `/dashboard` · `/en/dashboard` | `src/app/[locale]/dashboard/page.tsx` | `[locale]/layout.tsx` | **The app.** Server-renders profile + up to 300 leads, hands both to `AppShell`. `maxDuration = 60`, `dynamic = 'force-dynamic'` |
| `/auth/callback` | `src/app/auth/callback/route.ts` | *(none — route handler)* | OAuth landing strip. Lives **outside** `[locale]` on purpose |
| — | `src/app/[locale]/error.tsx` | — | Global error boundary |
| — | `src/app/[locale]/not-found.tsx` | — | 404 |

## Middleware — `src/middleware.ts`

```ts
const PROTECTED = ['/dashboard']

export const config = {
  matcher: ['/((?!api|auth|_next|_vercel|manifest.webmanifest|sw.js|icon-.*|.*\\..*).*)'],
}
```

**`auth` in that exclusion list is load-bearing.** `/auth/callback` once returned a flat 404 in production because the next-intl middleware tried to give it a locale prefix and the rewritten path matched no route. No amount of fixing the OAuth secret would have cured it.

Protected routes check for the presence of an `sb-*-auth-token` cookie before spending a network round trip on `getUser()` — the first version called Supabase in Singapore on *every* request including the manifest and service worker, which was most of the app's "five seconds per tap".

## Tabs are not routes

God Mode, Archive, Map and Account are **client-side tabs inside `AppShell`**, not URLs. Every tab used to be a route, so every tap paid for a server round trip, a middleware auth check and a cold start.

*(Being changed now: God Mode is being promoted to its own route `/god` so it can carry a full-power admin console that does not belong in a phone tab bar.)*
