import 'server-only'

import { toDialNumber, toWhatsAppNumber } from '@/lib/utils'
import { DiscoveryError, tierOf, type ProspectCandidate, type SweepInput } from './types'

/**
 * Geoapify Places — the primary discovery engine.
 *
 * Free tier is 3,000 requests/day with no billing card, which is the
 * whole reason it sits in front of Google Places here. Its data is
 * OpenStreetMap-derived but served through a curated category taxonomy
 * and a real SLA, so it is both easier to query and far more reliable
 * than hitting the public Overpass mirrors directly.
 */

const PLACES = 'https://api.geoapify.com/v2/places'
const GEOCODE = 'https://api.geoapify.com/v1/geocode/search'

/**
 * Indonesian trade words → Geoapify category ids.
 *
 * Geoapify classifies by a fixed taxonomy, not by the words a user types,
 * so this dictionary is what makes "bengkel" find a workshop named "Jaya
 * Motor" that never contains the word "bengkel".
 */
const CATEGORY_MAP: Array<{ match: RegExp; categories: string[] }> = [
  { match: /\b(kopi|coffee|kafe|cafe|kedai kopi|angkringan)\b/i, categories: ['catering.cafe'] },
  {
    match: /\b(makan|resto|restoran|rumah makan|warung|warteg|padang|seafood|bakso|soto|nasi|ayam|sate|mie|mi ayam|kuliner)\b/i,
    categories: ['catering.restaurant', 'catering.fast_food'],
  },
  { match: /\b(bakery|roti|kue|cake|toko kue|pastry|martabak)\b/i, categories: ['commercial.food_and_drink.bakery'] },
  {
    match: /\b(bengkel|servis motor|service motor|montir|tambal ban|onderdil)\b/i,
    categories: ['service.vehicle.repair', 'commercial.vehicle'],
  },
  { match: /\b(cuci mobil|car wash|salon mobil)\b/i, categories: ['service.vehicle.car_wash'] },
  {
    match: /\b(klinik|dokter|praktek|praktik|puskesmas|apotek|apotik|farmasi)\b/i,
    categories: ['healthcare.clinic_or_praxis', 'healthcare.pharmacy'],
  },
  { match: /\b(gigi|dentist|dokter gigi)\b/i, categories: ['healthcare.dentist'] },
  {
    match: /\b(salon|barber|pangkas|cukur|potong rambut|kecantikan|beauty)\b/i,
    categories: ['service.beauty.hairdresser', 'service.beauty'],
  },
  { match: /\b(spa|pijat|massage|refleksi)\b/i, categories: ['service.beauty.spa'] },
  { match: /\b(laundry|londri|binatu|cuci baju)\b/i, categories: ['service.laundry'] },
  {
    match: /\b(hotel|penginapan|losmen|homestay|guest house|kos|kost|villa)\b/i,
    categories: ['accommodation.hotel', 'accommodation.guest_house', 'accommodation.hostel'],
  },
  {
    match: /\b(toko|minimarket|kelontong|swalayan|grosir|sembako)\b/i,
    categories: ['commercial.convenience', 'commercial.supermarket'],
  },
  { match: /\b(baju|butik|fashion|distro|pakaian|konveksi|jahit|tailor)\b/i, categories: ['commercial.clothing'] },
  { match: /\b(hp|handphone|ponsel|gadget|konter|counter pulsa|servis hp)\b/i, categories: ['commercial.elektronics'] },
  { match: /\b(gym|fitness|olahraga|futsal)\b/i, categories: ['sport.fitness', 'sport.sports_centre'] },
  { match: /\b(sekolah|kursus|bimbel|les|pendidikan|pelatihan)\b/i, categories: ['education.school', 'education.language_school'] },
  { match: /\b(percetakan|fotokopi|foto copy|digital printing|print|atk)\b/i, categories: ['commercial.stationery'] },
  { match: /\b(optik|kacamata)\b/i, categories: ['healthcare.optician'] },
  { match: /\b(furniture|mebel|meubel|perabot)\b/i, categories: ['commercial.furniture'] },
  { match: /\b(bunga|florist|toko bunga)\b/i, categories: ['commercial.florist'] },
  { match: /\b(hewan|petshop|pet shop|klinik hewan)\b/i, categories: ['commercial.pet', 'healthcare.veterinary'] },
  { match: /\b(bank|atm|koperasi|pegadaian)\b/i, categories: ['service.financial'] },
]

/** Broad net for a query that matches no dictionary entry. */
const FALLBACK_CATEGORIES = ['commercial', 'catering', 'service', 'healthcare', 'accommodation']

function categoriesFor(query: string): string[] {
  const matched = CATEGORY_MAP.filter((entry) => entry.match.test(query)).flatMap((e) => e.categories)
  return matched.length ? Array.from(new Set(matched)) : FALLBACK_CATEGORIES
}

interface GeoapifyFeature {
  properties?: {
    place_id?: string
    name?: string
    categories?: string[]
    formatted?: string
    address_line2?: string
    street?: string
    city?: string
    suburb?: string
    district?: string
    county?: string
    lon?: number
    lat?: number
    website?: string
    contact?: { phone?: string; mobile?: string; website?: string }
    datasource?: { raw?: Record<string, unknown> }
  }
}

export async function sweepGeoapify({
  query,
  city,
  center,
  radiusMeters = 3_000,
  limit = 20,
}: SweepInput): Promise<ProspectCandidate[]> {
  const apiKey = process.env.GEOAPIFY_API_KEY
  if (!apiKey) throw new DiscoveryError('GEOAPIFY_API_KEY missing', 'auth')

  const origin = center ?? (await geocodeCity(city, apiKey))
  // No coordinates means no radius to search. Caller treats this as empty
  // and refunds — it is never charged.
  if (!origin) return []

  const url = new URL(PLACES)
  url.searchParams.set('categories', categoriesFor(query).join(','))
  url.searchParams.set(
    'filter',
    `circle:${origin.lng},${origin.lat},${Math.min(Math.round(radiusMeters), 50_000)}`,
  )
  url.searchParams.set('bias', `proximity:${origin.lng},${origin.lat}`)
  url.searchParams.set('limit', String(Math.min(limit * 4, 100)))
  url.searchParams.set('lang', 'id')
  url.searchParams.set('apiKey', apiKey)

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(9_000),
      cache: 'no-store',
    })
  } catch {
    throw new DiscoveryError('Geoapify request failed to complete', 'network')
  }

  if (response.status === 429) throw new DiscoveryError('Geoapify daily quota reached', 'quota', 429)
  if (response.status === 401) throw new DiscoveryError('Geoapify key rejected', 'auth', 401)
  if (!response.ok) throw new DiscoveryError(`Geoapify responded ${response.status}`, 'unknown', response.status)

  const payload = (await response.json()) as { features?: GeoapifyFeature[] }
  const out: ProspectCandidate[] = []

  for (const feature of payload.features ?? []) {
    const candidate = toCandidate(feature)
    if (candidate) out.push(candidate)
  }
  return out
}

async function geocodeCity(city: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const name = city.trim()
  if (!name) return null

  const url = new URL(GEOCODE)
  url.searchParams.set('text', name)
  url.searchParams.set('filter', 'countrycode:id')
  url.searchParams.set('limit', '1')
  url.searchParams.set('lang', 'id')
  url.searchParams.set('apiKey', apiKey)

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6_000), cache: 'no-store' })
    if (!response.ok) return null
    const payload = (await response.json()) as { features?: GeoapifyFeature[] }
    const props = payload.features?.[0]?.properties
    if (typeof props?.lat !== 'number' || typeof props?.lon !== 'number') return null
    return { lat: props.lat, lng: props.lon }
  } catch {
    return null
  }
}

function toCandidate(feature: GeoapifyFeature): ProspectCandidate | null {
  const props = feature.properties
  if (!props?.name || !props.place_id) return null

  const raw = (props.datasource?.raw ?? {}) as Record<string, string | undefined>

  const rawPhone =
    props.contact?.phone ??
    props.contact?.mobile ??
    raw.phone ??
    raw['contact:phone'] ??
    raw['contact:mobile'] ??
    raw.mobile ??
    null

  const website =
    props.website ?? props.contact?.website ?? raw.website ?? raw['contact:website'] ?? null

  const phoneE164 = toWhatsAppNumber(rawPhone)
  const phoneDial = toDialNumber(rawPhone)

  const lat = props.lat ?? null
  const lng = props.lon ?? null

  return {
    placeId: `geoapify/${props.place_id}`,
    name: props.name,
    category: humanCategory(props.categories),
    address: props.address_line2 ?? props.formatted ?? props.street ?? null,
    area: props.suburb ?? props.district ?? props.city ?? props.county ?? null,
    phone: rawPhone,
    phoneE164,
    phoneDial,
    website,
    rating: null, // Geoapify carries no ratings; the AI scorer handles null.
    reviewCount: 0,
    lat,
    lng,
    mapsUri:
      lat !== null && lng !== null
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : null,
    contactTier: tierOf(phoneE164, phoneDial, website),
  }
}

/** `catering.cafe` → "Kafe". Falls back to a readable last segment. */
function humanCategory(categories: string[] | undefined): string | null {
  if (!categories?.length) return null

  const LABELS: Record<string, string> = {
    'catering.cafe': 'Kafe',
    'catering.restaurant': 'Rumah Makan',
    'catering.fast_food': 'Kedai Cepat Saji',
    'commercial.food_and_drink.bakery': 'Toko Roti',
    'service.vehicle.repair': 'Bengkel',
    'service.vehicle.car_wash': 'Cuci Mobil',
    'healthcare.clinic_or_praxis': 'Klinik',
    'healthcare.pharmacy': 'Apotek',
    'healthcare.dentist': 'Dokter Gigi',
    'healthcare.optician': 'Optik',
    'healthcare.veterinary': 'Klinik Hewan',
    'service.beauty.hairdresser': 'Salon / Barber',
    'service.beauty.spa': 'Spa & Pijat',
    'service.beauty': 'Salon Kecantikan',
    'service.laundry': 'Laundry',
    'service.financial': 'Jasa Keuangan',
    'accommodation.hotel': 'Hotel',
    'accommodation.guest_house': 'Penginapan',
    'accommodation.hostel': 'Hostel',
    'commercial.convenience': 'Toko Kelontong',
    'commercial.supermarket': 'Swalayan',
    'commercial.clothing': 'Toko Pakaian',
    'commercial.elektronics': 'Toko Elektronik',
    'commercial.furniture': 'Toko Mebel',
    'commercial.florist': 'Toko Bunga',
    'commercial.pet': 'Pet Shop',
    'commercial.stationery': 'Percetakan & ATK',
    'education.school': 'Sekolah',
    'education.language_school': 'Tempat Kursus',
    'sport.fitness': 'Gym',
    'sport.sports_centre': 'Pusat Olahraga',
  }

  // Prefer the most specific category that has a hand-written label.
  const sorted = [...categories].sort((a, b) => b.split('.').length - a.split('.').length)
  for (const category of sorted) {
    if (LABELS[category]) return LABELS[category]
  }

  const leaf = sorted[0]?.split('.').pop() ?? null
  return leaf ? leaf.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null
}
