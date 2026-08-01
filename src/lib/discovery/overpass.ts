import 'server-only'

import { extractArea, toDialNumber, toWhatsAppNumber } from '@/lib/utils'
import { DiscoveryError, tierOf, type ProspectCandidate, type SweepInput } from './types'

/**
 * OpenStreetMap discovery — the zero-cost engine.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Google Places (New) will not return a single result until a billing
 * card is attached to the Cloud project, even inside the free tier. That
 * card is a hard blocker for a lot of Indonesian users. OpenStreetMap has
 * no key, no card, no billing console — just a fair-use policy the app's
 * existing cache layer already respects by turning every repeat search
 * into a database hit instead of a network call.
 *
 * TWO PUBLIC SERVICES, BOTH FREE
 * ──────────────────────────────
 *  1. Nominatim  — turns "Yogyakarta" into a lat/lng. Skipped entirely
 *     when the browser already handed us GPS coordinates.
 *  2. Overpass   — the actual business search, by radius + category.
 *
 * THE COVERAGE TRADE-OFF, STATED HONESTLY
 * ───────────────────────────────────────
 * OSM has fewer phone numbers than Google, especially outside big cities.
 * The Smart Radius Expansion prompt already handles the "nothing here"
 * case gracefully, and a business tagged in OSM with a phone and no
 * website is exactly the lead this product wants — so the fit is better
 * than the raw count suggests.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

// A real, contactable identifier is required by the Nominatim usage
// policy and appreciated by Overpass. Not a browser UA — this is a bot,
// and it says so.
const USER_AGENT = 'Nemu.in/1.0 (+https://github.com/vallendrino-vldr/nemu.in)'

/**
 * Free-text Indonesian trade → OSM tag clauses.
 *
 * OSM classifies businesses by structured tags (amenity, shop, …), not by
 * the words a user types. This dictionary bridges the two so that
 * searching "bengkel" finds a workshop named "Jaya Motor" that never
 * contains the word "bengkel" in its name.
 */
const TAG_MAP: Array<{ match: RegExp; clauses: string[] }> = [
  { match: /\b(kopi|coffee|kafe|cafe|kedai kopi|angkringan)\b/i, clauses: ['"amenity"="cafe"'] },
  {
    match: /\b(makan|resto|restoran|rumah makan|warung|warteg|padang|seafood|bakso|soto|nasi|ayam|sate|mie|mi ayam)\b/i,
    clauses: ['"amenity"="restaurant"', '"amenity"="fast_food"', '"amenity"="food_court"'],
  },
  { match: /\b(bakery|roti|kue|cake|toko kue|pastry)\b/i, clauses: ['"shop"="bakery"', '"shop"="pastry"'] },
  {
    match: /\b(bengkel|servis motor|service motor|montir|tambal ban)\b/i,
    clauses: ['"shop"="motorcycle_repair"', '"shop"="car_repair"', '"shop"="tyres"'],
  },
  { match: /\b(mobil|dealer mobil|cuci mobil|car wash)\b/i, clauses: ['"shop"="car"', '"amenity"="car_wash"'] },
  {
    match: /\b(klinik|dokter|praktek|puskesmas|apotek|apotik|farmasi)\b/i,
    clauses: ['"amenity"="clinic"', '"amenity"="doctors"', '"amenity"="pharmacy"', '"healthcare"~"."'],
  },
  { match: /\b(gigi|dentist|dokter gigi)\b/i, clauses: ['"amenity"="dentist"', '"healthcare"="dentist"'] },
  {
    match: /\b(salon|barber|pangkas|cukur|potong rambut|kecantikan|beauty|spa)\b/i,
    clauses: ['"shop"="hairdresser"', '"shop"="beauty"', '"leisure"="spa"'],
  },
  { match: /\b(laundry|londri|cuci|binatu)\b/i, clauses: ['"shop"="laundry"', '"shop"="dry_cleaning"'] },
  {
    match: /\b(hotel|penginapan|losmen|homestay|guest house|kos|kost|villa)\b/i,
    clauses: ['"tourism"="hotel"', '"tourism"="guest_house"', '"tourism"="hostel"'],
  },
  {
    match: /\b(toko|minimarket|kelontong|swalayan|grosir|sembako)\b/i,
    clauses: ['"shop"~"convenience|general|supermarket|variety_store"'],
  },
  { match: /\b(baju|butik|fashion|distro|pakaian|konveksi|jahit|tailor)\b/i, clauses: ['"shop"~"clothes|boutique|tailor|fashion"'] },
  { match: /\b(hp|handphone|ponsel|gadget|counter pulsa|servis hp)\b/i, clauses: ['"shop"="mobile_phone"'] },
  { match: /\b(gym|fitness|futsal|olahraga)\b/i, clauses: ['"leisure"~"fitness_centre|pitch|sports_centre"'] },
  { match: /\b(sekolah|kursus|bimbel|les|pendidikan|pelatihan)\b/i, clauses: ['"amenity"~"school|college|language_school"'] },
  { match: /\b(percetakan|fotokopi|foto copy|digital printing|print)\b/i, clauses: ['"shop"~"copyshop|printing|stationery"'] },
  { match: /\b(optik|kacamata|optician)\b/i, clauses: ['"shop"="optician"'] },
  { match: /\b(furniture|mebel|meubel|perabot)\b/i, clauses: ['"shop"~"furniture|interior_decoration"'] },
  { match: /\b(bunga|florist|toko bunga)\b/i, clauses: ['"shop"="florist"'] },
  { match: /\b(petshop|pet shop|hewan|klinik hewan)\b/i, clauses: ['"shop"="pet"', '"amenity"="veterinary"'] },
]

/**
 * Turns a raw query into Overpass filter clauses.
 *
 * Two nets are cast and unioned:
 *  1. Name match — catches any business whose name contains a query word,
 *     which is why "kopi" surfaces "Kopi Kenangan Senja".
 *  2. Category tags — catches businesses in the right trade whose name
 *     gives nothing away.
 *
 * Only objects carrying a real business key are kept, so a street or a
 * bare GPS pin never leaks into results.
 */
function buildQuery(query: string, lat: number, lng: number, radius: number, limit: number): string {
  const keyword = query.trim().split(/\s+/).slice(0, 3).join('|')
  const safeKeyword = keyword.replace(/["\\]/g, '')

  const around = `(around:${Math.round(radius)},${lat},${lng})`
  const businessKeys = '["name"]["~^(amenity|shop|craft|office|tourism|healthcare|leisure)$"~"."]'

  const clauses: string[] = []

  // Net 1 — name match, scoped to actual businesses.
  if (safeKeyword) {
    clauses.push(`  nwr${around}["name"~"${safeKeyword}",i]["~^(amenity|shop|craft|office|tourism|healthcare|leisure)$"~"."];`)
  }

  // Net 2 — mapped category tags.
  const mapped = TAG_MAP.filter((entry) => entry.match.test(query)).flatMap((entry) => entry.clauses)
  for (const clause of mapped) {
    clauses.push(`  nwr${around}["name"][${clause}];`)
  }

  // Absolute fallback — if nothing mapped and no keyword survived, pull
  // every named business in radius rather than returning empty.
  if (clauses.length === 0) {
    clauses.push(`  nwr${around}${businessKeys};`)
  }

  return [
    '[out:json][timeout:24];',
    '(',
    ...clauses,
    ');',
    `out center tags ${Math.min(limit * 3, 120)};`,
  ].join('\n')
}

// ── OSM tag payloads ─────────────────────────────────────────────────

interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export async function sweepOverpass({
  query,
  city,
  center,
  radiusMeters = 3_000,
  limit = 20,
}: SweepInput): Promise<ProspectCandidate[]> {
  const origin = center ?? (await geocodeCity(city))
  if (!origin) {
    // No coordinates and no geocode hit means we cannot search a radius.
    // Treated as an empty result, which the caller refunds — never a charge.
    return []
  }

  const overpassQuery = buildQuery(query, origin.lat, origin.lng, radiusMeters, limit)
  const elements = await runOverpass(overpassQuery)

  const seen = new Set<string>()
  const candidates: ProspectCandidate[] = []

  for (const element of elements) {
    const candidate = toCandidate(element)
    if (!candidate) continue
    if (seen.has(candidate.placeId)) continue
    seen.add(candidate.placeId)
    candidates.push(candidate)
  }

  // Ordering is handled centrally in ./index.ts once every source has
  // reported, so a merged list ranks consistently.
  return candidates
}

// ── Nominatim: city name → coordinates ───────────────────────────────

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const name = city.trim()
  if (!name) return null

  const url = new URL(NOMINATIM)
  url.searchParams.set('q', name)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'id')
  url.searchParams.set('accept-language', 'id')

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const hits = (await response.json()) as Array<{ lat: string; lon: string }>
    const first = hits[0]
    if (!first) return null
    return { lat: Number(first.lat), lng: Number(first.lon) }
  } catch {
    return null
  }
}

// ── Overpass: run against mirrors, fail over on throttle ─────────────

async function runOverpass(query: string): Promise<OsmElement[]> {
  let lastKind: DiscoveryError['kind'] = 'network'

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(26_000),
        cache: 'no-store',
      })

      // Overpass signals overload with 429 or 504. Try the next mirror.
      if (response.status === 429 || response.status === 504) {
        lastKind = 'quota'
        continue
      }
      if (!response.ok) {
        lastKind = 'network'
        continue
      }

      const payload = (await response.json()) as { elements?: OsmElement[] }
      return payload.elements ?? []
    } catch {
      lastKind = 'network'
      continue
    }
  }

  throw new DiscoveryError('All Overpass mirrors failed', lastKind)
}

// ── OSM tags → ProspectCandidate ─────────────────────────────────────

function toCandidate(element: OsmElement): ProspectCandidate | null {
  const tags = element.tags
  if (!tags?.name) return null

  const lat = element.lat ?? element.center?.lat ?? null
  const lng = element.lon ?? element.center?.lon ?? null

  const rawPhone =
    tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? tags.mobile ?? null
  const website =
    tags.website ?? tags['contact:website'] ?? tags.url ?? tags['contact:facebook'] ?? null

  const address = composeAddress(tags)
  const phoneE164 = toWhatsAppNumber(rawPhone)
  const phoneDial = toDialNumber(rawPhone)

  return {
    placeId: `osm/${element.type}/${element.id}`,
    name: tags.name,
    category: humanCategory(tags),
    address,
    area: extractArea(address) ?? tags['addr:city'] ?? tags['addr:suburb'] ?? null,
    phone: rawPhone,
    phoneE164,
    phoneDial,
    website,
    rating: null, // OSM has no ratings; the AI scorer handles a null gracefully.
    reviewCount: 0,
    lat,
    lng,
    mapsUri:
      lat !== null && lng !== null
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.openstreetmap.org/${element.type}/${element.id}`,
    contactTier: tierOf(phoneE164, phoneDial, website),
  }
}

function composeAddress(tags: Record<string, string>): string | null {
  if (tags['addr:full']) return tags['addr:full']

  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
  const parts = [
    street,
    tags['addr:suburb'],
    tags['addr:village'],
    tags['addr:city'] ?? tags['addr:town'],
    tags['addr:district'],
  ].filter(Boolean)

  return parts.length ? parts.join(', ') : null
}

/** Turns `amenity=cafe` into a readable "Cafe", Indonesian where obvious. */
function humanCategory(tags: Record<string, string>): string | null {
  const raw =
    tags.amenity ??
    tags.shop ??
    tags.craft ??
    tags.tourism ??
    tags.healthcare ??
    tags.office ??
    tags.leisure ??
    null
  if (!raw) return null

  const LABELS: Record<string, string> = {
    cafe: 'Kafe',
    restaurant: 'Rumah Makan',
    fast_food: 'Kedai Cepat Saji',
    food_court: 'Food Court',
    bakery: 'Toko Roti',
    car_repair: 'Bengkel Mobil',
    motorcycle_repair: 'Bengkel Motor',
    car_wash: 'Cuci Mobil',
    clinic: 'Klinik',
    doctors: 'Praktik Dokter',
    dentist: 'Dokter Gigi',
    pharmacy: 'Apotek',
    hairdresser: 'Salon / Barber',
    beauty: 'Salon Kecantikan',
    laundry: 'Laundry',
    hotel: 'Hotel',
    guest_house: 'Penginapan',
    convenience: 'Toko Kelontong',
    supermarket: 'Swalayan',
    clothes: 'Toko Pakaian',
    mobile_phone: 'Konter HP',
    florist: 'Toko Bunga',
    optician: 'Optik',
    furniture: 'Toko Mebel',
    pet: 'Pet Shop',
    veterinary: 'Klinik Hewan',
  }

  return LABELS[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
