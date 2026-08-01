'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Crosshair, Radar, Search, TelescopeIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge, Field, Panel } from '@/components/ui/primitives'
import { SonarRadar } from '@/components/sonar-radar'
import { LeadCard } from '@/components/lead-card'
import { usePaidAction } from '@/hooks/use-paid-action'
import { sweepForLeads } from '@/actions/hunt'
import { CREDIT_COST, DEFAULT_RADIUS, LEADS_PER_SWEEP, RADIUS_LADDER } from '@/lib/pricing'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { Lead } from '@/lib/database.types'

interface HuntConsoleProps {
  initialLeads: Lead[]
}

export function HuntConsole({ initialLeads }: HuntConsoleProps) {
  const t = useTranslations('hunt')
  const tCommon = useTranslations('common')
  const { run, isPending } = usePaidAction()

  const [query, setQuery] = React.useState('')
  const [city, setCity] = React.useState('')
  const [radius, setRadius] = React.useState<number>(DEFAULT_RADIUS)
  const [center, setCenter] = React.useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = React.useState(false)

  const [leads, setLeads] = React.useState<Lead[]>(initialLeads)
  const [sweeping, setSweeping] = React.useState(false)
  const [emptyAt, setEmptyAt] = React.useState<number | null>(null)
  const [cachedCount, setCachedCount] = React.useState<number | null>(null)

  const submitRef = React.useRef<HTMLButtonElement>(null)

  /**
   * Browser geolocation is free and exact. Geocoding a typed city name
   * through Google would be a second billable request per sweep, so when
   * the user grants location we use it and skip that cost entirely.
   */
  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return
    setLocating(true)
    haptic('tap')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocating(false)
        haptic('land')
      },
      () => {
        setLocating(false)
        setCenter(null)
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    )
  }

  const performSweep = async (event: React.MouseEvent | null, overrideRadius?: number) => {
    const targetRadius = overrideRadius ?? radius
    if (!query.trim()) return

    setSweeping(true)
    setEmptyAt(null)
    setCachedCount(null)

    // The sonar is not decoration — a Places round trip is 1-3 seconds and
    // a bare spinner makes that feel broken.
    const anchor =
      event ??
      (submitRef.current
        ? ({
            clientX: submitRef.current.getBoundingClientRect().left + 40,
            clientY: submitRef.current.getBoundingClientRect().top + 20,
          } as React.MouseEvent)
        : null)

    const result = await run('sweep', anchor, () =>
      sweepForLeads({ query, city, radiusMeters: targetRadius, center }),
    )

    setSweeping(false)
    if (!result) return

    if (result.leads.length === 0) {
      setEmptyAt(targetRadius)
      return
    }

    setLeads(mergeLeads(result.leads, leads))
    if (result.fromCache) setCachedCount(result.leads.length)

    toast.success(t('resultsTitle', { count: result.totalFound }), {
      description: t('resultsSubtitle', { withoutWeb: result.sellableCount }),
    })
  }

  return (
    <div className="space-y-6">
      {/* ── Console ──────────────────────────────────────────────── */}
      <Panel pad="lg" className="space-y-5">
        <div>
          <h2 className="font-display text-display-md leading-none text-ink">{t('title')}</h2>
          <p className="mt-2 text-[0.8125rem] text-ink-soft">{t('subtitle')}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="overline">{t('queryLabel')}</span>
            <Field
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('queryPlaceholder')}
              autoComplete="off"
            />
          </label>

          <label className="space-y-1.5">
            <span className="overline">{t('cityLabel')}</span>
            <Field
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={t('cityPlaceholder')}
              autoComplete="off"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="overline">{t('radiusLabel')}</span>
          <div className="flex flex-wrap items-center gap-2">
            {RADIUS_LADDER.map((meters) => (
              <Button
                key={meters}
                variant={radius === meters ? 'primary' : 'sunken'}
                size="sm"
                onClick={() => setRadius(meters)}
                aria-pressed={radius === meters}
              >
                {meters / 1000} {tCommon('km')}
              </Button>
            ))}

            <Button
              variant={center ? 'ai' : 'ghost'}
              size="sm"
              onClick={useMyLocation}
              loading={locating}
              className="ml-auto"
            >
              <Crosshair className="h-3.5 w-3.5" strokeWidth={2.4} />
              {center ? 'Lokasi terkunci' : 'Pakai lokasiku'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            ref={submitRef}
            variant="primary"
            size="lg"
            onClick={(event) => void performSweep(event)}
            loading={isPending('sweep')}
            disabled={!query.trim()}
            feedback="spend"
          >
            <Search className="h-4 w-4" strokeWidth={2.5} />
            {isPending('sweep') ? t('submitting') : t('submit')}
          </Button>

          <Badge tone="warning">
            {t('cost', { amount: CREDIT_COST.scrape, count: LEADS_PER_SWEEP })}
          </Badge>
        </div>
      </Panel>

      {/* ── Sonar ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sweeping ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Panel tone="flat" pad="none">
              <SonarRadar
                label={t('scanning', { city: city || 'sekitarmu' })}
                sublabel={t('scanningSub')}
              />
            </Panel>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Smart radius expansion ───────────────────────────────── */}
      <AnimatePresence>
        {emptyAt !== null && !sweeping ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          >
            <Panel pad="lg" className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-sunken text-ink-faint shadow-well">
                <TelescopeIcon className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-display text-2xl text-ink">{t('emptyTitle')}</h3>
              <p className="mx-auto mt-2 max-w-sm text-[0.8125rem] leading-relaxed text-ink-soft">
                {t('emptyBody')}
              </p>

              {nextRungOf(emptyAt) ? (
                <div className="mt-6 space-y-3">
                  <p className="text-[0.8125rem] font-semibold text-ink">{t('expandTitle')}</p>
                  <p className="mx-auto max-w-xs text-[0.75rem] leading-relaxed text-ink-faint">
                    {t('expandBody')}
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={(event) => {
                      const next = nextRungOf(emptyAt)!
                      setRadius(next)
                      void performSweep(event, next)
                    }}
                    feedback="land"
                  >
                    <Radar className="h-4 w-4" strokeWidth={2.4} />
                    {t('expandCta', { radius: nextRungOf(emptyAt)! / 1000 })}
                  </Button>
                </div>
              ) : null}
            </Panel>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Results ──────────────────────────────────────────────── */}
      {cachedCount ? (
        <Badge tone="opportunity">{t('cachedNote', { count: cachedCount })}</Badge>
      ) : null}

      <motion.div layout className={cn('grid gap-4', sweeping && 'pointer-events-none opacity-40')}>
        <AnimatePresence initial={false}>
          {leads.map((lead, index) => (
            <LeadCard key={lead.id} lead={lead} index={index} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────

function nextRungOf(current: number): number | null {
  const index = RADIUS_LADDER.findIndex((rung) => rung === current)
  if (index === -1) return RADIUS_LADDER[1] ?? null
  return RADIUS_LADDER[index + 1] ?? null
}

/**
 * New results go on top, and anything already on screen keeps its place
 * and its paid-for AI score. Replacing the array wholesale would make a
 * user's scored leads visibly vanish after a second sweep.
 */
function mergeLeads(incoming: Lead[], existing: Lead[]): Lead[] {
  const seen = new Set(incoming.map((lead) => lead.id))
  return [...incoming, ...existing.filter((lead) => !seen.has(lead.id))]
}
