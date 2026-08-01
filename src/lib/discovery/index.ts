import 'server-only'

import { sweepGeoapify } from './geoapify'
import { sweepOverpass } from './overpass'
import { sweepPlaces } from './google-places'
import { TIER_RANK, tierOf, type ProspectCandidate, type SweepInput } from './types'

export { DiscoveryError, isSellable, isWhatsAppReady, tierOf, TIER_RANK } from './types'
export type { ProspectCandidate, SweepInput, ContactTier } from './types'

/**
 * Picks the discovery engines and hides the choice from the rest of the app.
 *
 * WHY THERE IS NO GOOGLE PLACES BY DEFAULT
 * ────────────────────────────────────────
 * Places (New) returns nothing until a billing card is attached to the
 * Cloud project — a hard blocker for most Indonesian users. Everything
 * below runs without a card.
 *
 * WHY TWO FREE SOURCES INSTEAD OF ONE
 * ───────────────────────────────────
 * Geoapify and Overpass both draw on OpenStreetMap, but they surface
 * different slices of it: Geoapify gives a clean category taxonomy and a
 * reliable endpoint, while raw Overpass exposes tag variants Geoapify
 * drops — `contact:mobile`, `contact:phone`, secondary numbers. Phone
 * coverage is the scarcest thing in Indonesian OSM data and the single
 * most valuable field in this product, so both are queried in parallel
 * and merged. Latency is max(a, b), not a + b, and repeat searches are
 * served from the database cache for free anyway.
 */
export function activeProviders(): string[] {
  const providers: string[] = []
  if (process.env.GOOGLE_PLACES_API_KEY) providers.push('google')
  if (process.env.GEOAPIFY_API_KEY) providers.push('geoapify')
  providers.push('osm')
  return providers
}

/**
 * How long the whole sweep may take before we answer with whatever has
 * arrived. Overpass is public infrastructure and occasionally takes
 * twenty seconds; the user should never wait that long, and the platform
 * will kill the function before it finishes anyway.
 */
const SWEEP_BUDGET_MS = 20_000

/** Resolves to [] instead of hanging past the budget. */
function withBudget(
  task: Promise<ProspectCandidate[]>,
  label: string,
): Promise<ProspectCandidate[]> {
  return Promise.race([
    task.catch((error) => {
      console.warn(`[discovery] ${label} failed:`, (error as Error)?.message)
      return [] as ProspectCandidate[]
    }),
    new Promise<ProspectCandidate[]>((resolve) =>
      setTimeout(() => {
        console.warn(`[discovery] ${label} exceeded ${SWEEP_BUDGET_MS}ms budget`)
        resolve([])
      }, SWEEP_BUDGET_MS),
    ),
  ])
}

export async function sweep(input: SweepInput): Promise<ProspectCandidate[]> {
  const tasks: Array<Promise<ProspectCandidate[]>> = []

  // Google Places, when funded, is strictly better data — but it never
  // suppresses the free sources, because merging only adds coverage.
  if (process.env.GOOGLE_PLACES_API_KEY) {
    tasks.push(withBudget(sweepPlaces(input), 'google-places'))
  }
  if (process.env.GEOAPIFY_API_KEY) {
    tasks.push(withBudget(sweepGeoapify(input), 'geoapify'))
  }
  tasks.push(withBudget(sweepOverpass(input), 'overpass'))

  // Every task already absorbs its own failure, so this settles fast and
  // a single slow provider can no longer take the whole sweep down with
  // it. Partial results beat a dead request.
  const harvested = (await Promise.all(tasks)).flat()

  return rankAndDedupe(harvested, input.limit ?? 20)
}

/**
 * Merges results from several sources into one ordered list.
 *
 * Dedupe is by normalised name plus a ~110 m location bucket, because the
 * same shop appears in Geoapify and Overpass under different ids and
 * slightly different coordinates. When two records collide, the richer
 * one wins — a record carrying a phone number always beats one without.
 */
function rankAndDedupe(candidates: ProspectCandidate[], limit: number): ProspectCandidate[] {
  const byKey = new Map<string, ProspectCandidate>()

  for (const candidate of candidates) {
    const key = dedupeKey(candidate)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, candidate)
      continue
    }
    byKey.set(key, richer(existing, candidate))
  }

  return Array.from(byKey.values())
    .sort((a, b) => {
      // WhatsApp-ready first, then callable, then walk-in, then already-served.
      const tier = TIER_RANK[a.contactTier] - TIER_RANK[b.contactTier]
      if (tier !== 0) return tier
      // Within a tier, a record with an address is more actionable.
      const detail = Number(Boolean(b.address)) - Number(Boolean(a.address))
      if (detail !== 0) return detail
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
    })
    .slice(0, limit * 3)
}

function dedupeKey(candidate: ProspectCandidate): string {
  const name = candidate.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)

  // 0.001 degrees is roughly 110 m — tight enough to keep two neighbouring
  // warungs apart, loose enough to fuse two records of the same one.
  const lat = candidate.lat === null ? 'x' : candidate.lat.toFixed(3)
  const lng = candidate.lng === null ? 'x' : candidate.lng.toFixed(3)
  return `${name}@${lat},${lng}`
}

/** Prefers whichever duplicate carries more usable contact detail. */
function richer(a: ProspectCandidate, b: ProspectCandidate): ProspectCandidate {
  const score = (c: ProspectCandidate) =>
    (c.phoneE164 ? 4 : 0) +
    (c.phoneDial ? 2 : 0) +
    (c.address ? 1 : 0) +
    (c.category ? 1 : 0) +
    (c.rating !== null ? 1 : 0)

  const winner = score(b) > score(a) ? b : a
  const loser = winner === a ? b : a

  // Fill the winner's gaps from the loser rather than discarding data.
  const phoneE164 = winner.phoneE164 ?? loser.phoneE164
  const phoneDial = winner.phoneDial ?? loser.phoneDial
  const website = winner.website ?? loser.website

  return {
    ...winner,
    phone: winner.phone ?? loser.phone,
    phoneE164,
    phoneDial,
    website,
    address: winner.address ?? loser.address,
    area: winner.area ?? loser.area,
    category: winner.category ?? loser.category,
    rating: winner.rating ?? loser.rating,
    mapsUri: winner.mapsUri ?? loser.mapsUri,
    // Recomputed, never inherited: a merge that gains a phone number must
    // also gain the tier that number earns, or it sorts below leads that
    // are strictly worse.
    contactTier: tierOf(phoneE164, phoneDial, website),
  }
}
