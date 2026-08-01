import 'server-only'

import { extractArea, toDialNumber, toWhatsAppNumber } from '@/lib/utils'
import { DiscoveryError, tierOf, type ProspectCandidate, type SweepInput } from './types'

/**
 * Google Places (New) — the optional premium engine.
 *
 * Kept intact but no longer the default: it needs a billing card attached
 * to the Cloud project, which is the exact blocker OSM routes around. The
 * moment `GOOGLE_PLACES_API_KEY` is set, the router in ./index.ts prefers
 * this — richer data, real ratings, better phone coverage. Until then it
 * simply never runs.
 *
 * The FieldMask below is load-bearing: Places (New) returns contact fields
 * directly from searchText only when they are named here, which is what
 * lets one request return names AND phone numbers instead of one request
 * plus one Place Details call per result. Do not trim it.
 */

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.location',
  'places.googleMapsUri',
  'places.businessStatus',
].join(',')

interface RawPlace {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  primaryTypeDisplayName?: { text?: string }
  location?: { latitude?: number; longitude?: number }
  googleMapsUri?: string
  businessStatus?: string
}

export async function sweepPlaces({
  query,
  city,
  center,
  radiusMeters,
  limit = 20,
  languageCode = 'id',
}: SweepInput): Promise<ProspectCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new DiscoveryError('GOOGLE_PLACES_API_KEY missing', 'auth')

  const body: Record<string, unknown> = {
    textQuery: city ? `${query} di ${city}` : query,
    languageCode,
    regionCode: 'ID',
    maxResultCount: Math.min(limit, 20),
  }

  if (center && radiusMeters) {
    body.locationBias = {
      circle: {
        center: { latitude: center.lat, longitude: center.lng },
        radius: Math.min(radiusMeters, 50_000),
      },
    }
  }

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(9_000),
      cache: 'no-store',
    })
  } catch {
    throw new DiscoveryError('Places request failed to complete', 'network')
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    if (response.status === 429 || detail.includes('RESOURCE_EXHAUSTED')) {
      throw new DiscoveryError('Daily Places quota exhausted', 'quota', 429)
    }
    if (response.status === 401 || response.status === 403) {
      throw new DiscoveryError('Places key rejected', 'auth', response.status)
    }
    throw new DiscoveryError(`Places responded ${response.status}`, 'unknown', response.status)
  }

  const payload = (await response.json()) as { places?: RawPlace[] }
  return (payload.places ?? [])
    .filter((place) => place.businessStatus !== 'CLOSED_PERMANENTLY')
    .map(toCandidate)
}

function toCandidate(place: RawPlace): ProspectCandidate {
  const rawPhone = place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null
  const address = place.formattedAddress ?? null
  const website = place.websiteUri ?? null
  const phoneE164 = toWhatsAppNumber(rawPhone)
  const phoneDial = toDialNumber(rawPhone)

  return {
    placeId: `gmaps/${place.id}`,
    name: place.displayName?.text ?? 'Tanpa nama',
    category: place.primaryTypeDisplayName?.text ?? null,
    address,
    area: extractArea(address),
    phone: rawPhone,
    phoneE164,
    phoneDial,
    website,
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviewCount: place.userRatingCount ?? 0,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    mapsUri: place.googleMapsUri ?? null,
    contactTier: tierOf(phoneE164, phoneDial, website),
  }
}
