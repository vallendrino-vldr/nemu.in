/**
 * Nemu.in service worker.
 *
 * THE ONE RULE: never serve stale application data.
 *
 * A lead list, a credit balance and an AI-written pitch are all worthless
 * the moment they are out of date — a cached balance that says 30 when
 * the server says 0 is worse than no offline support at all. So:
 *
 *   HTML and anything dynamic → network first, cache only as a
 *     last-resort offline fallback.
 *   Hashed build assets (/_next/static/*) → cache first, because their
 *     filenames change on every deploy and can never go stale.
 *   Map tiles → cache first with a hard cap, since they are immutable
 *     and re-fetching them on every pan is what makes a map feel slow.
 *
 * Combined with skipWaiting + clients.claim, a new deploy takes over on
 * the next page load rather than waiting for every tab to close.
 */

const VERSION = 'nemu-v3'
const SHELL_CACHE = `${VERSION}-shell`
const TILE_CACHE = `${VERSION}-tiles`
const MAX_TILES = 400

self.addEventListener('install', (event) => {
  // Activate immediately; do not queue behind the previous worker.
  self.skipWaiting()
  event.waitUntil(caches.open(SHELL_CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache from an older VERSION so a deploy cannot leave
      // yesterday's HTML lying around.
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

/** Lets the page force an update without a manual reload. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Auth and Supabase traffic must never be intercepted: a cached
  // session response would be both wrong and a security problem.
  if (
    url.pathname.startsWith('/auth/') ||
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.geoapify.com') ||
    url.hostname.includes('overpass') ||
    url.hostname.includes('googleapis.com')
  ) {
    return
  }

  // Map tiles: immutable, cache-first, bounded.
  if (url.hostname.endsWith('basemaps.cartocdn.com') || url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(cacheFirstBounded(request))
    return
  }

  // Hashed build output: filename is the version, so cache-first is safe.
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Everything else, HTML included: network first.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request))
  }
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

async function cacheFirstBounded(request) {
  const cache = await caches.open(TILE_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
      // Trim oldest entries rather than letting tiles grow without limit.
      const keys = await cache.keys()
      if (keys.length > MAX_TILES) {
        await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((key) => cache.delete(key)))
      }
    }
    return response
  } catch {
    return new Response('', { status: 504 })
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok && request.mode === 'navigate') {
      const cache = await caches.open(SHELL_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') {
      const shell = await caches.match('/')
      if (shell) return shell
    }
    throw new Error('offline')
  }
}
