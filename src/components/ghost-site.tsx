'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Download, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/primitives'
import { downloadGhostSite, type GhostSubject } from '@/lib/ghost-canvas'
import { haptic } from '@/lib/haptics'
import { hueFrom, initialsOf } from '@/lib/utils'

/**
 * Website Hantu — the sales weapon that costs nothing to fire.
 *
 * Everything on screen is derived from data already sitting in the leads
 * table: name, category, rating, review count, area. No AI call, no image
 * fetch, no extra Google request. The prospect sees what they are missing
 * instead of being told about it.
 */
export function GhostSite({ subject }: { subject: GhostSubject }) {
  const t = useTranslations('ghost')
  const [saved, setSaved] = React.useState(false)

  const hue = hueFrom(subject.name)
  const accent = `hsl(${hue} 62% 46%)`
  const accentDeep = `hsl(${hue} 66% 30%)`

  const handleSave = () => {
    haptic('land')
    if (downloadGhostSite(subject)) {
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2_600)
    }
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-card shadow-relief-lg"
      >
        {/* Browser chrome — sells the illusion that this is a real site. */}
        <div className="flex items-center gap-2 bg-surface-sunken px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sambal-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-ember-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-pandan-300" />
          <span className="ml-3 truncate rounded-pill bg-surface px-3 py-1 font-mono text-[0.625rem] text-ink-faint">
            {slugPreview(subject.name)}
          </span>
        </div>

        {/* Hero */}
        <div className="relative px-6 py-10 sm:px-9 sm:py-14" style={{ background: `linear-gradient(135deg, ${accentDeep}, ${accent})` }}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(70% 60% at 76% 8%, rgba(255,255,255,0.30), transparent 60%)',
            }}
          />

          <div className="relative flex items-center justify-between gap-4">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-white/90">
              {subject.name}
            </span>
            <nav className="hidden gap-5 text-[0.6875rem] font-medium text-white/70 sm:flex">
              <span>{t('mockNav.home')}</span>
              <span>{t('mockNav.menu')}</span>
              <span>{t('mockNav.about')}</span>
              <span>{t('mockNav.contact')}</span>
            </nav>
          </div>

          <h3 className="relative mt-8 text-balance font-display text-[2rem] leading-[1.05] text-white sm:text-[2.75rem]">
            {subject.name}
          </h3>
          <p className="relative mt-2.5 text-sm text-white/80">
            {[subject.category ?? 'Usaha lokal', subject.area].filter(Boolean).join(' · ')}
          </p>
          <p className="relative mt-1 text-[0.75rem] text-white/60">{t('mockTagline')}</p>

          <span className="relative mt-6 inline-flex items-center rounded-pill bg-white px-6 py-3 text-sm font-bold shadow-lg" style={{ color: accentDeep }}>
            {t('mockCta')}
          </span>
        </div>

        {/* Stat card overlapping the hero seam */}
        <div className="relative -mt-7 px-5 sm:px-8">
          <div className="grid grid-cols-3 divide-x divide-hairline rounded-well bg-surface-raised py-5 shadow-relief">
            <Stat value={subject.rating ? subject.rating.toFixed(1) : '—'} label="Rating" starred={Boolean(subject.rating)} />
            <Stat value={subject.reviewCount ? String(subject.reviewCount) : '—'} label="Ulasan" />
            <Stat value="24/7" label="Order" />
          </div>
        </div>

        {/* Body */}
        <div className="bg-surface-raised px-6 pb-9 pt-8 sm:px-9">
          <h4 className="text-base font-bold text-ink">{t('mockSectionTitle')}</h4>
          <ul className="mt-4 space-y-3">
            {[
              subject.reviewCount
                ? t('mockPoint1', { count: subject.reviewCount })
                : t('mockPoint3', { area: subject.area ?? 'Indonesia' }),
              subject.rating ? t('mockPoint2', { rating: subject.rating.toFixed(1) }) : t('mockPoint3', { area: subject.area ?? 'Indonesia' }),
              t('mockPoint3', { area: subject.area ?? 'Indonesia' }),
            ].map((line, index) => (
              <li key={index} className="flex items-start gap-3 text-[0.8125rem] leading-relaxed text-ink-soft">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex items-center gap-3 rounded-well bg-surface-sunken px-4 py-3.5 shadow-well">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold text-white"
              style={{ background: accent }}
            >
              {initialsOf(subject.name)}
            </span>
            <p className="truncate text-[0.75rem] text-ink-faint">
              {subject.address ?? t('mockTagline')}
            </p>
          </div>

          <p className="mt-6 text-center text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            {t('watermark')}
          </p>
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="md" onClick={handleSave} feedback="land">
          <Download className="h-4 w-4" strokeWidth={2.4} />
          {saved ? t('screenshotDone') : t('screenshot')}
        </Button>
        <Badge tone="opportunity">{t('hint')}</Badge>
      </div>
    </div>
  )
}

function Stat({ value, label, starred }: { value: string; label: string; starred?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <span className="flex items-center gap-1 font-mono text-xl font-bold tabular text-ink">
        {starred ? <Star className="h-3.5 w-3.5 fill-ember-400 text-ember-400" /> : null}
        {value}
      </span>
      <span className="text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
    </div>
  )
}

function slugPreview(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20)
  return `${slug || 'usaha'}.com`
}
