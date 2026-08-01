'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Crosshair, Radar, Search, Telescope } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge, Field, Panel } from '@/components/ui/primitives'
import { SonarRadar } from '@/components/sonar-radar'
import { usePaidAction } from '@/hooks/use-paid-action'
import { useLeadStore } from '@/store/lead-store'
import { sweepForLeads } from '@/actions/hunt'
import { CREDIT_COST, DEFAULT_RADIUS, LEADS_PER_SWEEP, RADIUS_LADDER } from '@/lib/pricing'
import { haptic } from '@/lib/haptics'

/**
 * The hunt screen: one viewport, one job.
 *
 * Results deliberately do not render here. They land in the shared store
 * and the tab bar's Leads badge ticks up, so this screen never becomes an
 * endless scroll — which was the specific complaint about the old
 * single-page dashboard.
 */
export function HuntView() {
  const t = useTranslations('hunt')
  const tCommon = useTranslations('common')
  const { run, isPending } = usePaidAction()
  const merge = useLeadStore((state) => state.merge)

  const [query, setQuery] = React.useState('')
  const [city, setCity] = React.useState('')
  const [radius, setRadius] = React.useState<number>(DEFAULT_RADIUS)
  const [center, setCenter] = React.useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = React.useState(false)

  const [sweeping, setSweeping] = React.useState(false)
  const [emptyAt, setEmptyAt] = React.useState<number | null>(null)
  const [lastResult, setLastResult] = React.useState<{ total: number; sellable: number; cached: boolean } | null>(null)

  const submitRef = React.useRef<HTMLButtonElement>(null)

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
        toast.error(t('locationDenied'))
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    )
  }

  const performSweep = async (event: React.MouseEvent | null, overrideRadius?: number) => {
    const targetRadius = overrideRadius ?? radius
    if (!query.trim()) return

    setSweeping(true)
    setEmptyAt(null)
    setLastResult(null)

    const rect = submitRef.current?.getBoundingClientRect()
    const anchor =
      event ??
      (rect ? ({ clientX: rect.left + 40, clientY: rect.top + 20 } as React.MouseEvent) : null)

    const result = await run('sweep', anchor, () =>
      sweepForLeads({ query, city, radiusMeters: targetRadius, center }),
    )

    setSweeping(false)
    if (!result) return

    if (result.leads.length === 0) {
      setEmptyAt(targetRadius)
      return
    }

    merge(result.leads)
    setLastResult({
      total: result.totalFound,
      sellable: result.sellableCount,
      cached: result.fromCache,
    })

    toast.success(t('resultsTitle', { count: result.totalFound }), {
      description: t('resultsSubtitle', { withoutWeb: result.sellableCount }),
    })
  }

  if (sweeping) {
    return (
      <Panel tone="flat" pad="none">
        <SonarRadar
          label={t('scanning', { city: city || tCommon('nearby') })}
          sublabel={t('scanningSub')}
        />
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <Panel pad="lg" className="space-y-5">
        <div>
          <h2 className="font-display text-[1.75rem] leading-none text-ink">{t('title')}</h2>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">{t('subtitle')}</p>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="overline">{t('queryLabel')}</span>
            <Field
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('queryPlaceholder')}
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="overline">{t('cityLabel')}</span>
            <Field
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={t('cityPlaceholder')}
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
        </div>

        <div className="space-y-2">
          <span className="overline">{t('radiusLabel')}</span>
          <div className="grid grid-cols-4 gap-1.5">
            {RADIUS_LADDER.map((meters) => (
              <Button
                key={meters}
                variant={radius === meters ? 'primary' : 'sunken'}
                size="sm"
                onClick={() => setRadius(meters)}
                aria-pressed={radius === meters}
                className="px-0"
              >
                {meters / 1000}
                <span className="text-[0.625rem] opacity-70">{tCommon('km')}</span>
              </Button>
            ))}
          </div>
        </div>

        <Button
          variant={center ? 'ai' : 'sunken'}
          size="sm"
          onClick={useMyLocation}
          loading={locating}
          className="w-full"
        >
          <Crosshair className="h-3.5 w-3.5" strokeWidth={2.4} />
          {center ? t('locationLocked') : t('useLocation')}
        </Button>

        <div className="space-y-2.5 pt-1">
          <Button
            ref={submitRef}
            variant="primary"
            size="lg"
            onClick={(event) => void performSweep(event)}
            loading={isPending('sweep')}
            disabled={!query.trim()}
            feedback="spend"
            className="w-full"
          >
            <Search className="h-4 w-4" strokeWidth={2.5} />
            {t('submit')}
          </Button>

          <p className="text-center text-[0.6875rem] text-ink-faint">
            {t('cost', { amount: CREDIT_COST.scrape, count: LEADS_PER_SWEEP })}
          </p>
        </div>
      </Panel>

      {/* ── Outcome ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lastResult ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Panel pad="lg" className="space-y-3 text-center">
              <p className="font-mono text-4xl font-bold leading-none tabular text-pandan-500">
                {lastResult.sellable}
              </p>
              <p className="text-[0.875rem] font-semibold text-ink">{t('landedTitle')}</p>
              <p className="text-[0.8125rem] leading-relaxed text-ink-soft">{t('landedBody')}</p>
              {lastResult.cached ? (
                <Badge tone="opportunity">{t('cachedNote', { count: lastResult.total })}</Badge>
              ) : null}
            </Panel>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Smart radius expansion ──────────────────────────────────── */}
      <AnimatePresence>
        {emptyAt !== null ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Panel pad="lg" className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-sunken text-ink-faint shadow-well">
                <Telescope className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-display text-2xl text-ink">{t('emptyTitle')}</h3>
              <p className="mx-auto mt-2 max-w-xs text-[0.8125rem] leading-relaxed text-ink-soft">
                {t('emptyBody')}
              </p>

              {nextRungOf(emptyAt) ? (
                <div className="mt-6 space-y-3">
                  <p className="mx-auto max-w-xs text-[0.75rem] leading-relaxed text-ink-faint">
                    {t('expandBody')}
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
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
    </div>
  )
}

function nextRungOf(current: number): number | null {
  const index = RADIUS_LADDER.findIndex((rung) => rung === current)
  if (index === -1) return RADIUS_LADDER[1] ?? null
  return RADIUS_LADDER[index + 1] ?? null
}
