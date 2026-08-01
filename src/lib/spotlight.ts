/**
 * The Spotlight search bar's brain.
 *
 * The hunt screen used to ask for "jenis usaha" and "kota" in two
 * separate labelled inputs, which is two decisions and two taps before
 * anything happens. People do not think in fields — they think "kedai
 * kopi di Jogja". This splits that sentence back into the two values the
 * sweep actually needs, and the UI shows the split so nobody has to guess
 * what will be searched.
 */

export interface ParsedQuery {
  query: string
  city: string
}

/**
 * Splits on the last " di " because Indonesian place phrases can contain
 * their own: "warung nasi di pinggir jalan di Sleman" means the business
 * is the whole first half and Sleman is the city. Taking the first " di "
 * would search for "warung nasi" in "pinggir jalan di Sleman".
 *
 * No " di " at all is fine and common ("kedai kopi"). The sweep works
 * with a bare query — city only narrows it.
 */
export function parseSpotlight(raw: string): ParsedQuery {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return { query: '', city: '' }

  const match = /^(.*)\s+di\s+(.+)$/i.exec(text)
  if (!match) return { query: text, city: '' }

  const query = (match[1] ?? '').trim()
  const city = (match[2] ?? '').trim()

  // "di Jogja" on its own has no business type in it — treat the whole
  // thing as a query rather than sweeping for an empty string.
  if (!query) return { query: text, city: '' }

  return { query, city }
}

/** Rebuilds the sentence from its parts, for prefilling the field. */
export function formatSpotlight({ query, city }: ParsedQuery): string {
  return city ? `${query} di ${city}` : query
}

// ── Recent sweeps ────────────────────────────────────────────────────
// Kept in localStorage rather than a table: it is a convenience, it is
// per-device by nature, and a zero-cost project does not spend a database
// round trip on something the browser can remember for free.

export interface RecentSweep {
  query: string
  city: string
  radius: number
  found: number
  at: number
}

const STORE_KEY = 'nemu.recent-sweeps'
const KEEP = 6

export function readRecentSweeps(): RecentSweep[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (row): row is RecentSweep =>
          typeof row === 'object' &&
          row !== null &&
          typeof (row as RecentSweep).query === 'string' &&
          typeof (row as RecentSweep).at === 'number',
      )
      .slice(0, KEEP)
  } catch {
    // A corrupted or quota-blocked store must never take the screen down.
    return []
  }
}

export function pushRecentSweep(entry: RecentSweep): RecentSweep[] {
  if (typeof window === 'undefined') return []
  const key = (row: RecentSweep) => `${row.query.toLowerCase()}|${row.city.toLowerCase()}`
  const next = [entry, ...readRecentSweeps().filter((row) => key(row) !== key(entry))].slice(0, KEEP)
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota — the list is a nicety, not state */
  }
  return next
}

/**
 * Cold-start suggestions. Deliberately whole sentences rather than bare
 * keywords, because their real job is teaching the "X di Y" shape in one
 * tap — after that people type their own.
 */
export const SUGGESTIONS: readonly string[] = [
  'kedai kopi di Jogja',
  'bengkel motor di Bekasi',
  'klinik gigi di Bandung',
  'laundry di Depok',
  'barbershop di Semarang',
  'katering di Surabaya',
] as const
