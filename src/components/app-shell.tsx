'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Archive, Map as MapIcon, Radar, ShieldHalf, User } from 'lucide-react'

import { CreditMeter } from '@/components/credit-meter'
import { HuntView } from '@/components/views/hunt-view'
import { LeadsView } from '@/components/views/leads-view'
import { MapView } from '@/components/views/map-view'
import { SafeWidget } from '@/components/safe-widget'
import { ProfileView } from '@/components/views/profile-view'
import { UserNotice } from '@/components/user-notice'
// Locale-aware Link — a bare next/link href would strip the /en prefix.
import { Link } from '@/i18n/routing'
import { useLeadStore } from '@/store/lead-store'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { Lead, Profile } from '@/lib/database.types'

/**
 * The native shell.
 *
 * WHY THIS REPLACED PAGE NAVIGATION
 * ─────────────────────────────────
 * Every tab used to be a route, so every tap paid for a server round
 * trip, a middleware auth check and a cold start — several seconds on a
 * phone. Here the tabs swap a client component. Nothing navigates, so
 * switching is a repaint, not a request.
 *
 * The layout is deliberately not a scrolling document:
 *   - the shell is exactly one viewport tall (`100dvh`, which accounts
 *     for mobile browser chrome that `100vh` famously does not)
 *   - only the content column scrolls, with `overscroll-contain` so a
 *     flick at the end of a list cannot bounce the whole page
 *   - the tab bar sits inside the safe area, clear of the iOS home
 *     indicator and Android gesture bar
 *
 * GOD MODE IS NO LONGER A TAB. It is a route now, reached from the shield
 * button in the header. A control room capped at what fits under a thumb
 * could never hold the powers the owner actually needs, and spending one
 * of five tab slots on a screen only one account can open was a poor
 * trade for everybody else.
 */

type TabKey = 'hunt' | 'leads' | 'map' | 'profile'

interface AppShellProps {
  profile: Profile
  initialLeads: Lead[]
}

export function AppShell({ profile, initialLeads }: AppShellProps) {
  const t = useTranslations('shell')
  const [tab, setTab] = React.useState<TabKey>('hunt')
  const hydrate = useLeadStore((state) => state.hydrate)
  const leadCount = useLeadStore((state) => state.leads.length)

  React.useEffect(() => {
    hydrate(initialLeads)
  }, [hydrate, initialLeads])

  const isAdmin = profile.role === 'super_admin'

  const tabs = React.useMemo(
    () => [
      { key: 'hunt' as const, icon: Radar, label: t('hunt') },
      { key: 'leads' as const, icon: Archive, label: t('leads'), badge: leadCount },
      { key: 'map' as const, icon: MapIcon, label: t('map') },
      { key: 'profile' as const, icon: User, label: t('profile') },
    ],
    [t, leadCount],
  )

  const select = (next: TabKey) => {
    if (next === tab) return
    haptic('tap')
    setTab(next)
  }

  return (
    <div className="flex h-[100dvh] flex-col lg:flex-row overflow-hidden bg-canvas">
      {/* ── Sidebar (Desktop) / Tab bar (Mobile) ──────────────────────── */}
      <nav
        className={cn(
          'order-last shrink-0 border-t border-hairline/60 bg-canvas/90 backdrop-blur-xl',
          'lg:order-first lg:w-[15rem] lg:border-r lg:border-t-0 lg:pt-6',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex h-16 items-stretch lg:h-auto lg:flex-col lg:gap-2 lg:px-3">
          {tabs.map((entry) => {
            const active = tab === entry.key
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => select(entry.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-1',
                  'min-w-[44px] select-none transition-colors duration-150',
                  'lg:flex-row lg:justify-start lg:gap-3 lg:rounded-well lg:px-4 lg:py-3',
                  active
                    ? 'text-ink-ember lg:bg-ember-500/10'
                    : 'text-ink-faint hover:text-ink-soft active:text-ink lg:hover:bg-surface/60',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="tab-indicator"
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    className={cn(
                      'absolute bg-ember-500 rounded-pill',
                      'inset-x-4 top-0 h-0.5',
                      'lg:inset-y-2 lg:left-0 lg:h-auto lg:w-0.5 lg:inset-x-auto'
                    )}
                  />
                ) : null}

                <span className="relative">
                  <entry.icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.5 : 2} />
                  {'badge' in entry && entry.badge ? (
                    <span className="absolute -right-2.5 -top-1.5 min-w-[16px] rounded-pill bg-ember-500 px-1 text-center font-mono text-[0.5625rem] font-bold leading-4 text-white">
                      {entry.badge > 99 ? '99+' : entry.badge}
                    </span>
                  ) : null}
                </span>

                <span className="text-[0.625rem] font-semibold leading-none lg:text-[0.8125rem]">
                  {entry.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* ── Compact header. Fixed height, never scrolls away. ───────── */}
        <div
          className="shrink-0 border-b border-hairline/60 bg-canvas/85 backdrop-blur-xl"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <header className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4">
            <div className="flex h-14 flex-1 items-center gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-chip bg-gradient-to-b from-ember-400 to-ember-600 shadow-ember-relief">
                <span className="font-display text-sm leading-none text-white">N</span>
              </span>
              <span className="truncate font-display text-lg leading-none tracking-tight text-ink">
                Nemu<span className="text-ink-ember">.in</span>
              </span>
            </div>

            {isAdmin ? (
              <Link
                href="/god"
                aria-label={t('god')}
                title={t('god')}
                onClick={() => haptic('tap')}
                className={cn(
                  'tactile grid h-9 w-9 shrink-0 place-items-center rounded-well',
                  'bg-nila-500/14 text-ink-nila shadow-well',
                  'transition-[box-shadow,transform] duration-150 ease-physical',
                  'hover:shadow-nila-glow active:translate-y-[1.5px] active:shadow-pressed',
                )}
              >
                <ShieldHalf className="h-[18px] w-[18px]" strokeWidth={2.3} />
              </Link>
            ) : null}

            <SafeWidget label="credit-meter">
              <CreditMeter
                userId={profile.id}
                initialBalance={profile.credits}
                role={profile.role}
                billed={profile.bill_admin}
              />
            </SafeWidget>
          </header>

          <SafeWidget label="user-notice">
            <UserNotice userId={profile.id} initial={profile.notice} />
          </SafeWidget>
        </div>

        {/* ── The only scrolling region in the app. ───────────────────── */}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto w-full max-w-3xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="px-4 pb-6 pt-4"
              >
                {tab === 'hunt' ? <HuntView onGoToArchive={() => select('leads')} /> : null}
                {tab === 'leads' ? <LeadsView /> : null}
                {tab === 'map' ? (
                  <SafeWidget label="map">
                    <MapView />
                  </SafeWidget>
                ) : null}
                {tab === 'profile' ? <ProfileView profile={profile} /> : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
