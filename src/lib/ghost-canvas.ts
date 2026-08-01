'use client'

import { hueFrom, initialsOf } from '@/lib/utils'

/**
 * Paints the Ghost Site to a canvas and hands back a PNG blob URL.
 *
 * Drawn with the Canvas 2D API rather than an html-to-image dependency:
 * this keeps the bundle free of a 40 kB rasteriser, sidesteps every
 * cross-origin font and CSS-variable failure mode that DOM screenshotting
 * has, and produces a fixed 1080×1350 portrait — the aspect ratio
 * WhatsApp shows without cropping.
 */

export interface GhostSubject {
  name: string
  category: string | null
  area: string | null
  address: string | null
  rating: number | null
  reviewCount: number
  phone: string | null
}

const WIDTH = 1080
const HEIGHT = 1350

export function paintGhostSite(subject: GhostSubject): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const hue = hueFrom(subject.name)
  const accent = `hsl(${hue} 62% 46%)`
  const accentDeep = `hsl(${hue} 66% 30%)`

  // ── Page ground ───────────────────────────────────────────────────
  ctx.fillStyle = '#faf7f2'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // ── Hero band ─────────────────────────────────────────────────────
  const hero = ctx.createLinearGradient(0, 0, WIDTH, 620)
  hero.addColorStop(0, accentDeep)
  hero.addColorStop(1, accent)
  ctx.fillStyle = hero
  ctx.fillRect(0, 0, WIDTH, 620)

  // Soft light bloom so the band is not a flat rectangle.
  const bloom = ctx.createRadialGradient(WIDTH * 0.76, 130, 20, WIDTH * 0.76, 130, 520)
  bloom.addColorStop(0, 'rgba(255,255,255,0.30)')
  bloom.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, WIDTH, 620)

  // ── Fake nav ──────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '600 24px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(truncate(ctx, subject.name.toUpperCase(), 380), 72, 78)

  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = '500 21px system-ui, -apple-system, "Segoe UI", sans-serif'
  const navItems = ['Beranda', 'Menu', 'Tentang', 'Kontak']
  let navX = WIDTH - 72
  for (const item of [...navItems].reverse()) {
    const width = ctx.measureText(item).width
    navX -= width
    ctx.fillText(item, navX, 78)
    navX -= 38
  }

  // ── Headline ──────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 76px system-ui, -apple-system, "Segoe UI", sans-serif'
  const lines = wrap(ctx, subject.name, WIDTH - 144, 2)
  lines.forEach((line, index) => ctx.fillText(line, 72, 268 + index * 86))

  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.font = '400 27px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(
    truncate(ctx, `${subject.category ?? 'Usaha lokal'} · ${subject.area ?? 'Indonesia'}`, WIDTH - 144),
    72,
    268 + lines.length * 86 + 26,
  )

  // ── CTA pill ──────────────────────────────────────────────────────
  const ctaY = 268 + lines.length * 86 + 82
  roundedRect(ctx, 72, ctaY, 300, 74, 37)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.fillStyle = accentDeep
  ctx.font = '700 26px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Pesan Sekarang', 222, ctaY + 38)
  ctx.textAlign = 'left'

  // ── Floating stat card ────────────────────────────────────────────
  const cardY = 546
  ctx.save()
  ctx.shadowColor = 'rgba(30,20,10,0.20)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 16
  roundedRect(ctx, 72, cardY, WIDTH - 144, 190, 28)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  const stats: Array<[string, string]> = [
    [subject.rating ? subject.rating.toFixed(1) : '—', 'Rating Google'],
    [String(subject.reviewCount || '—'), 'Ulasan'],
    ['24/7', 'Pesan online'],
  ]
  stats.forEach(([value, label], index) => {
    const columnX = 72 + (WIDTH - 144) * ((index + 0.5) / 3)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#1a1613'
    ctx.font = '800 52px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(value, columnX, cardY + 78)
    ctx.fillStyle = '#8a8078'
    ctx.font = '600 20px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(label.toUpperCase(), columnX, cardY + 130)
  })
  ctx.textAlign = 'left'

  // ── Content section ───────────────────────────────────────────────
  ctx.fillStyle = '#1a1613'
  ctx.font = '700 40px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText('Kenapa pelanggan balik lagi', 72, 830)

  const bullets = [
    subject.reviewCount
      ? `Dipercaya ${subject.reviewCount} pelanggan yang sudah kasih ulasan`
      : 'Pelayanan yang bikin pelanggan pengin balik',
    subject.rating ? `Rating ${subject.rating.toFixed(1)} dari 5 di Google Maps` : 'Terdaftar resmi di Google Maps',
    subject.area ? `Lokasi strategis di ${subject.area}` : 'Gampang ditemukan dan dihubungi',
  ]

  bullets.forEach((text, index) => {
    const y = 900 + index * 84
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(90, y, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#4a423b'
    ctx.font = '400 26px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(truncate(ctx, text, WIDTH - 200), 124, y)
  })

  // ── Contact strip ─────────────────────────────────────────────────
  roundedRect(ctx, 72, 1152, WIDTH - 144, 108, 24)
  ctx.fillStyle = '#f2ece3'
  ctx.fill()

  ctx.fillStyle = accentDeep
  ctx.font = '700 22px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(initialsOf(subject.name), 108, 1206)

  ctx.fillStyle = '#6b6159'
  ctx.font = '400 22px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(
    truncate(ctx, subject.address ?? 'Hubungi kami lewat WhatsApp', WIDTH - 320),
    186,
    1206,
  )

  // ── Watermark ─────────────────────────────────────────────────────
  ctx.fillStyle = '#b3a89d'
  ctx.font = '600 19px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Contoh dibuat otomatis oleh Nemu.in', WIDTH / 2, 1305)

  return canvas.toDataURL('image/png')
}

export function downloadGhostSite(subject: GhostSubject): boolean {
  const dataUrl = paintGhostSite(subject)
  if (!dataUrl) return false

  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = `nemu-${slug(subject.name)}.png`
  anchor.click()
  return true
}

// ── canvas helpers ──────────────────────────────────────────────────

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut}…`
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = word
      if (lines.length === maxLines) return lines
    } else {
      current = candidate
    }
  }
  if (current && lines.length < maxLines) lines.push(truncate(ctx, current, maxWidth))
  return lines
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}
