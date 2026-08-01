import 'server-only'

/**
 * How reachable a prospect is, in the order a freelancer would work them.
 *
 * THE FIELD FINDING THAT SHAPED THIS
 * ──────────────────────────────────
 * A real sweep of 200 named food businesses inside 4 km of central
 * Yogyakarta returned: 192 with no website, but only 12 with any phone
 * number at all — and most of those were landlines (+62 274), which
 * WhatsApp cannot receive.
 *
 * Filtering to "has a mobile number AND no website" would therefore have
 * thrown away 184 genuine prospects to keep 1. So the product signal is
 * "no website" — that part OSM knows extremely well — and contact method
 * becomes a *ranking* concern instead of a gate. The user still gets a
 * WhatsApp-first list; they simply also get the rest, in order.
 */
export type ContactTier =
  /** Mobile number, no website. One tap to WhatsApp. */
  | 'whatsapp'
  /** Landline only, no website. Worth a call or a walk-in. */
  | 'phone'
  /** No number published, no website. Findable via Maps. */
  | 'visit'
  /** Already has a website. Not the target. */
  | 'served'

export const TIER_RANK: Record<ContactTier, number> = {
  whatsapp: 0,
  phone: 1,
  visit: 2,
  served: 3,
}

/**
 * The provider-neutral shape every discovery backend must produce.
 *
 * Geoapify, Overpass and Google Places have wildly different payloads,
 * but the rest of the app — the leads table, the AI analyst, the Ghost
 * Site — only ever sees this.
 */
export interface ProspectCandidate {
  /** Stable, source-scoped id. Geoapify hash, `node/123`, or a Places id. */
  placeId: string
  name: string
  category: string | null
  address: string | null
  area: string | null
  /** Human-readable number as published. */
  phone: string | null
  /** Bare E.164 digits, mobile only — safe to drop into a wa.me link. */
  phoneE164: string | null
  /** Bare E.164 digits for any number, mobile or landline — for tel:. */
  phoneDial: string | null
  website: string | null
  rating: number | null
  reviewCount: number
  lat: number | null
  lng: number | null
  mapsUri: string | null
  contactTier: ContactTier
}

export function tierOf(phoneE164: string | null, phoneDial: string | null, website: string | null): ContactTier {
  if (website) return 'served'
  if (phoneE164) return 'whatsapp'
  if (phoneDial) return 'phone'
  return 'visit'
}

/** Worth showing at all: nobody is buying a website they already have. */
export function isSellable(candidate: ProspectCandidate): boolean {
  return candidate.contactTier !== 'served'
}

/** The subset that can be pitched on WhatsApp today, with no extra work. */
export function isWhatsAppReady(candidate: ProspectCandidate): boolean {
  return candidate.contactTier === 'whatsapp'
}

/**
 * One error type for every backend so `hunt.ts` can branch on `kind`
 * without knowing which provider ran.
 */
export class DiscoveryError extends Error {
  constructor(
    message: string,
    readonly kind: 'quota' | 'auth' | 'network' | 'unknown',
    readonly status?: number,
  ) {
    super(message)
    this.name = 'DiscoveryError'
  }
}

export interface SweepInput {
  query: string
  city: string
  /** Browser-supplied coordinates. Free — skips a geocoding round trip. */
  center?: { lat: number; lng: number } | null
  radiusMeters?: number
  limit?: number
  languageCode?: string
}
