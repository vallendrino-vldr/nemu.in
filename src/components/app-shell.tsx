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
import { GodView } from '@/components/views/god-view'
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
 */

type TabKey = 'hunt' | 'leads' | 'map' | 'profile' | 'god'

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
    () =>
      [
        { key: 'hunt' as const, icon: Radar, label: t('hunt') },
        { key: 'leads' as const, icon: Archive, label: t('leads'), badge: leadCount },
        { key: 'map' as const, icon: MapIcon, label: t('map') },
        ...(isAdmin ? [{ key: 'god' as const, icon: ShieldHalf, label: t('god') }] : []),
        { key: 'profile' as const, icon: User, label: t('profile') },
      ].filter(Boolean),
    [t, leadCount, isAdmin],
  )

  const select = (next: TabKey) => {
    if (next === tab) return
    haptic('tap')
    setTab(next)
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-canvas">
      {/* ── Compact header. Fixed height, never scrolls away. ───────── */}
      <header
        className="flex shrink-0 items-center gap-3 border-b border-hairline/60 bg-canvas/85 px-4 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-14 flex-1 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-chip bg-gradient-to-b from-ember-400 to-ember-600 shadow-ember-relief">
            <span className="font-display text-sm leading-none text-white">N</span>
          </span>
          <span className="truncate font-display text-lg leading-none tracking-tight text-ink">
            Nemu<span className="text-ember-500">.in</span>
          </span>
        </div>

        <SafeWidget label="credit-meter">
          <CreditMeter userId={profile.id} initialBalance={profile.credits} role={profile.role} />
        </SafeWidget>
      </header>

      {/* ── The only scrolling region in the app. ───────────────────── */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="px-4 pb-6 pt-4"
          >
            {tab === 'hunt' ? <HuntView /> : null}
            {tab === 'leads' ? <LeadsView /> : null}
            {tab === 'map' ? (
              <SafeWidget label="map">
                <MapView />
              </SafeWidget>
            ) : null}
            {tab === 'profile' ? <ProfileView profile={profile} /> : null}
            {tab === 'god' && isAdmin ? <GodView /> : null}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <nav
        className="shrink-0 border-t border-hairline/60 bg-canvas/90 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex h-16 items-stretch">
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
                  // A 44px minimum touch target is the difference between
                  // a tab bar that works one-handed and one that does not.
                  'min-w-[44px] select-none transition-colors duration-150',
                  active ? 'text-ember-500' : 'text-ink-faint active:text-ink',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="tab-indicator"
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    className="absolute inset-x-4 top-0 h-0.5 rounded-pill bg-ember-500"
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

                <span className="text-[0.625rem] font-semibold leading-none">{entry.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
