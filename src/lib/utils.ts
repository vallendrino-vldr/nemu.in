import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalises any Indonesian phone number to bare E.164 digits.
 *
 * Sources publish numbers in a dozen shapes: "0812-3456-7890",
 * "+62 812 3456 7890", "(0274) 123456", "+62-274-7423399". Everything
 * downstream wants exactly one. Returns null when the input is not a
 * plausible Indonesian number at all.
 */
export function toDialNumber(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Businesses often publish two numbers in one field, separated by ; or /.
  const first = raw.split(/[;,]|\s+\/\s+/)[0] ?? raw
  let digits = first.replace(/[^\d+]/g, '')

  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('62')) {
    /* already country-coded */
  } else if (digits.startsWith('0')) digits = `62${digits.slice(1)}`
  else if (digits.length >= 8) digits = `62${digits}`

  // 62 + 8..13 digits covers both mobile and every regional landline.
  return /^62\d{8,13}$/.test(digits) ? digits : null
}

/**
 * The subset of numbers WhatsApp can actually receive: Indonesian mobile,
 * which always begins 08 locally and therefore 628 in E.164.
 *
 * Kept separate from `toDialNumber` because a landline is still a usable
 * lead — it just gets a "call them" action instead of a dead wa.me link.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const digits = toDialNumber(raw)
  if (!digits) return null
  if (!digits.startsWith('628')) return null
  return digits.length >= 11 ? digits : null
}

/** "Jl. Kaliurang KM 5, Sleman, DIY" → "Sleman" */
export function extractArea(address: string | null | undefined): string | null {
  if (!address) return null
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 2) return parts[0] ?? null
  // Second-to-last is reliably the kabupaten/kota in Google's ID format.
  return parts[parts.length - 2] ?? parts[0]
}

export function initialsOf(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

/**
 * Deterministic hue from a string. Two businesses with the same name get
 * the same colour on every device — no random(), no hydration mismatch.
 */
export function hueFrom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

export function formatCompact(value: number, locale = 'id-ID'): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function relativeTime(iso: string, locale = 'id-ID'): string {
  const diff = Date.now() - new Date(iso).getTime()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const table: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 1000],
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
    ['week', 604_800_000],
    ['month', 2_592_000_000],
    ['year', 31_536_000_000],
  ]
  let chosen: [Intl.RelativeTimeFormatUnit, number] = table[0]!
  for (const entry of table) if (diff >= entry[1]) chosen = entry
  return rtf.format(-Math.floor(diff / chosen[1]), chosen[0])
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
