'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowRight,
  Check,
  Crosshair,
  History,
  Radar,
  Search,
  SlidersHorizontal,
  Telescope,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Ambient, Badge, Panel } from '@/components/ui/primitives'
import { SonarRadar } from '@/components/sonar-radar'
import { usePaidAction } from '@/hooks/use-paid-action'
import { useLeadStore, sellableOf } from '@/store/lead-store'
import { sweepForLeads } from '@/actions/hunt'
import { StreakWidget } from '@/components/streak-widget'
import {
  parseSpotlight,
  pushRecentSweep,
  readRecentSweeps,
  SUGGESTIONS,
  type RecentSweep,
} from '@/lib/spotlight'
import { CREDIT_COST, DEFAULT_RADIUS, LEADS_PER_SWEEP, RADIUS_LADDER } from '@/lib/pricing'
import { haptic } from '@/lib/haptics'
import { cn, relativeTime } from '@/lib/utils'

/**
 * The hunt screen.
 *
 * WHAT CHANGED AND WHY
 * ────────────────────
 * This used to be three stacked form controls inside one grey panel: a
 * business-type field, a city field, a four-button radius row. It worked,
 * and it read as homework. The owner's verdict on it was "berantakan,
 * murahan, ga berkelas… AI SLOP", and he was right — the first screen
 * after sign-in asked the user to fill something in before it told them
 * anything.
 *
 * Two structural changes fix that:
 *
 *  1. **It opens with what you already own.** The count of WhatsApp-ready
 *     leads waiting for a message is the largest thing on the screen. A
 *     status report, not a blank form.
 *
 *  2. **The sweep is one field, not three.** "kedai kopi di Jogja" is how
 *     people actually think; `parseSpotlight` splits it back into the two
 *     values the server wants, and the parse is shown so nobody has to
 *     guess. Radius and location are demoted to a row of quiet secondary
 *     controls under the field — they are refinements, not peers of the
 *     thing you came here to do.
 *
 * Results still deliberately do not render here. They land in the shared
 * store and the tab bar's Archive badge ticks up, so this screen never
 * becomes an endless scroll.
 */
export function HuntView({ onGoToArchive }: { onGoToArchive?: () => void }) {
  const t = useTranslations('hunt')
  const tCommon = useTranslations('common')
  const { run, isPending } = usePaidAction()
  const merge = useLeadStore((state) => state.merge)

  // Raw state only — a selector that derives an array here is what took
  // three tabs down in a previous life. See store/lead-store.ts.
  const allLeads = useLeadStore((state) => state.leads)
  const stats = React.useMemo(() => {
    const sellable = sellableOf(allLeads)
    return {
      total: sellable.length,
      waReady: sellable.filter((lead) => lead.contact_tier === 'whatsapp').length,
      untouched: sellable.filter((lead) => lead.status === 'new').length,
    }
  }, [allLeads])

  const [text, setText] = React.useState('')
  const [radius, setRadius] = React.useState<number>(DEFAULT_RADIUS)
  const [center, setCenter] = React.useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = React.useState(false)
  const [tuning, setTuning] = React.useState(false)

  const [sweeping, setSweeping] = React.useState(false)
  const [emptyAt, setEmptyAt] = React.useState<number | null>(null)
  const [lastResult, setLastResult] = React.useState<{
    total: number
    sellable: number
    cached: boolean
  } | null>(null)
  const [recent, setRecent] = React.useState<RecentSweep[]>([])

  const submitRef = React.useRef<HTMLButtonElement>(null)
  const fieldRef = React.useRef<HTMLInputElement>(null)

  // localStorage is read after mount, never during render — reading it
  // inline would make the server and client markup disagree.
  React.useEffect(() => setRecent(readRecentSweeps()), [])

  const parsed = React.useMemo(() => parseSpotlight(text), [text])
  const canSweep = parsed.query.length > 0

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

  const performSweep = async (
    event: React.MouseEvent | null,
    override?: { radius?: number; text?: string },
  ) => {
    const targetRadius = override?.radius ?? radius
    const source = override?.text ?? text
    const { query, city } = parseSpotlight(source)
    if (!query) return

    setSweeping(true)
    setEmptyAt(null)
    setLastResult(null)

    const rect = submitRef.current?.getBoundingClientRect()
    const anchor =
      event ??
      (rect ? ({ clientX: rect.left + 20, clientY: rect.top + 20 } as React.MouseEvent) : null)

    const result = await run('sweep', anchor, () =>
      sweepForLeads({ query, city, radiusMeters: targetRadius, center }),
    )

    setSweeping(false)
    if (!result) return

    if (result.leads.length === 0) {
      const nextR = nextRungOf(targetRadius)
      if (nextR) {
        toast.info(t('autoExpanding', { radius: nextR / 1000, defaultMessage: `Memperluas otomatis ke ${nextR / 1000}km...` }))
        setRadius(nextR)
        // Fire asynchronously to allow the state to settle and SonarRadar to re-mount
        setTimeout(() => {
          void performSweep(anchor, { radius: nextR, text: source })
        }, 300)
        return
      }
      setEmptyAt(targetRadius)
      return
    }

    merge(result.leads)
    setRecent(
      pushRecentSweep({
        query,
        city,
        radius: targetRadius,
        found: result.totalFound,
        at: Date.now(),
      }),
    )
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
          label={t('scanning', { city: parsed.city || tCommon('nearby') })}
          sublabel={t('scanningSub')}
        />
      </Panel>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Status opening ──────────────────────────────────────────── */}
      <section className="relative -mx-4 overflow-hidden px-4 pb-1 pt-2">
        <Ambient />

        <div className="relative flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3">
              <StreakWidget />
            </div>
            <p className="overline text-ink-ember/90">{t('heroLabel')}</p>
            <p className="mt-2 font-mono text-[3.5rem] font-bold leading-[0.85] tabular text-ink">
              {stats.waReady}
            </p>
            <p className="mt-2 max-w-[20ch] text-[0.875rem] leading-snug text-ink-soft">
              {stats.total === 0 ? t('heroEmpty') : t('heroBody')}
            </p>
          </div>

          {stats.total > 0 ? (
            <button
              type="button"
              onClick={onGoToArchive}
              className="shrink-0 space-y-2.5 border-l border-hairline pl-4 text-right"
            >
              <MicroStat value={stats.total} label={t('heroTotal')} />
              <MicroStat value={stats.untouched} label={t('heroUntouched')} tone="ember" />
            </button>
          ) : null}
        </div>
      </section>

      {/* ── Spotlight ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div
          className={cn(
            'relative flex items-center gap-2 rounded-pill bg-surface-sunken pl-4 pr-1.5',
            'shadow-well transition-shadow duration-200 ease-settle',
            'focus-within:shadow-[var(--shadow-well),0_0_0_2px_hsl(26_92%_51%/0.45)]',
          )}
        >
          <Search className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2.2} />
          <input
            ref={fieldRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canSweep) void performSweep(null)
            }}
            placeholder={t('spotlightPlaceholder')}
            aria-label={t('spotlightLabel')}
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
            className={cn(
              'h-[3.25rem] min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink',
              'placeholder:text-ink-faint focus:outline-none',
            )}
          />
          <Button
            ref={submitRef}
            variant="primary"
            size="icon"
            onClick={(event) => void performSweep(event)}
            loading={isPending('sweep')}
            disabled={!canSweep}
            feedback="spend"
            aria-label={t('submit')}
            className="h-11 w-11 shrink-0 rounded-full"
          >
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.6} />
          </Button>
        </div>

        {/* What will actually be searched. Shown rather than assumed —
            a parser the user cannot see is a parser they cannot trust. */}
        <AnimatePresence initial={false}>
          {canSweep ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-1.5 px-1"
            >
              <Badge tone="warning">{parsed.query}</Badge>
              <span className="text-[0.6875rem] text-ink-faint">
                {parsed.city ? t('parsedIn') : t('parsedAnywhere')}
              </span>
              {parsed.city ? <Badge tone="ai">{parsed.city}</Badge> : null}
              <span className="text-[0.6875rem] text-ink-faint">· {radius / 1000} km</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Cold-start suggestions. They teach the "X di Y" shape in one
            tap, which is faster than any placeholder can explain it. */}
        {!text ? (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SUGGESTIONS.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => {
                  haptic('tap')
                  setText(phrase)
                  fieldRef.current?.focus()
                }}
                className={cn(
                  'tactile shrink-0 rounded-pill bg-surface-sunken px-3.5 py-2 text-[0.75rem] font-medium',
                  'text-ink-soft shadow-well transition-colors duration-150',
                  'hover:text-ink active:shadow-pressed',
                )}
              >
                {phrase}
              </button>
            ))}
          </div>
        ) : null}

        {/* ── Secondary controls ────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTuning((open) => !open)}
            aria-expanded={tuning}
            className="px-2.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.3} />
            {t('radiusShort', { radius: radius / 1000 })}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={useMyLocation}
            loading={locating}
            className={cn('px-2.5', center && 'text-ink-pandan')}
          >
            {center ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
            ) : (
              <Crosshair className="h-3.5 w-3.5" strokeWidth={2.3} />
            )}
            {center ? t('locationLocked') : t('useLocation')}
          </Button>

          <span className="ml-auto font-mono text-[0.6875rem] text-ink-faint">
            {t('cost', { amount: CREDIT_COST.scrape, count: LEADS_PER_SWEEP })}
          </span>
        </div>

        <AnimatePresence initial={false}>
          {tuning ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-1.5 px-1 pt-1">
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
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

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
              <p className="font-mono text-4xl font-bold leading-none tabular text-ink-pandan">
                {lastResult.sellable}
              </p>
              <p className="text-[0.875rem] font-semibold text-ink">{t('landedTitle')}</p>
              <p className="text-[0.8125rem] leading-relaxed text-ink-soft">{t('landedBody')}</p>
              {lastResult.cached ? (
                <Badge tone="opportunity">{t('cachedNote', { count: lastResult.total })}</Badge>
              ) : null}
              {onGoToArchive ? (
                <Button variant="surface" size="sm" onClick={onGoToArchive} className="w-full">
                  {t('openArchive')}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
                </Button>
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
                      void performSweep(event, { radius: next })
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

      {/* ── Recent sweeps ───────────────────────────────────────────── */}
      {recent.length > 0 && !lastResult ? (
        <section className="space-y-2">
          <p className="overline flex items-center gap-1.5 px-1">
            <History className="h-3 w-3" strokeWidth={2.4} />
            {t('recentTitle')}
          </p>
          <div className="grid gap-1.5">
            {recent.map((row) => (
              <button
                key={`${row.query}|${row.city}|${row.at}`}
                type="button"
                onClick={(event) => {
                  const phrase = row.city ? `${row.query} di ${row.city}` : row.query
                  setText(phrase)
                  setRadius(row.radius)
                  void performSweep(event, { radius: row.radius, text: phrase })
                }}
                className={cn(
                  'tactile flex items-center gap-3 rounded-well bg-surface px-4 py-3 text-left',
                  'shadow-hairline transition-[box-shadow,transform] duration-150 ease-physical',
                  'active:translate-y-[1.5px] active:shadow-pressed',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-semibold text-ink">{row.query}</p>
                  <p className="truncate text-[0.6875rem] text-ink-faint">
                    {[row.city, `${row.radius / 1000} ${tCommon('km')}`, relativeTime(new Date(row.at).toISOString())]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[0.75rem] font-bold tabular text-ink-soft">
                  {row.found}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

// ── pieces ───────────────────────────────────────────────────────────

function MicroStat({
  value,
  label,
  tone = 'ink',
}: {
  value: number
  label: string
  tone?: 'ink' | 'ember'
}) {
  return (
    <span className="block">
      <span
        className={cn(
          'block font-mono text-lg font-bold leading-none tabular',
          tone === 'ember' ? 'text-ink-ember' : 'text-ink',
        )}
      >
        {value}
      </span>
      <span className="block text-[0.625rem] font-semibold uppercase leading-tight tracking-[0.1em] text-ink-faint">
        {label}
      </span>
    </span>
  )
}

function nextRungOf(current: number): number | null {
  const index = RADIUS_LADDER.findIndex((rung) => rung === current)
  if (index === -1) return RADIUS_LADDER[1] ?? null
  return RADIUS_LADDER[index + 1] ?? null
}
