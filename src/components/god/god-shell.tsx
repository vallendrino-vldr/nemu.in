'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Gauge,
  KeyRound,
  Minus,
  Plus,
  ScrollText,
  ShieldHalf,
  SlidersHorizontal,
  Users,
} from 'lucide-react'

import { GodOverview } from '@/components/god/god-overview'
import { GodUsers } from '@/components/god/god-users'
import { GodKeys } from '@/components/god/god-keys'
import { GodSystem } from '@/components/god/god-system'
import { GodActivity } from '@/components/god/god-activity'
// The locale-aware Link, not next/link. With `localePrefix: 'as-needed'`
// a bare href drops the /en prefix, so an English session would be
// bounced into the Indonesian route on every navigation.
import { Link } from '@/i18n/routing'
import { getBrowserClient } from '@/lib/supabase/client'
import { injectCredits, loadGodStats, type GodStats } from '@/actions/admin'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { ApiKeyView, Profile } from '@/lib/database.types'

type Section = 'overview' | 'users' | 'keys' | 'system' | 'activity'

interface GodShellProps {
  me: Profile
  initialStats: GodStats | null
  initialUsers: Profile[]
  initialKeys: ApiKeyView[]
}

/**
 * The control room.
 *
 * Deliberately does NOT reuse the user app's shell. An admin console that
 * looks like the product with extra buttons is how people fat-finger a
 * ban while thinking they are in their own account. This room is led by
 * nila indigo instead of ember, is denser, and keeps exactly one obvious
 * way out — pinned to the bottom of the sidebar where it cannot be
 * confused with a destructive control.
 */
export function GodShell({ me, initialStats, initialUsers, initialKeys }: GodShellProps) {
  const t = useTranslations('god')

  const [section, setSection] = React.useState<Section>('overview')
  const [stats, setStats] = React.useState<GodStats | null>(initialStats)
  const [users, setUsers] = React.useState<Profile[]>(initialUsers)
  const [keys, setKeys] = React.useState<ApiKeyView[]>(initialKeys)
  const [live, setLive] = React.useState(false)

  // The admin's own row, kept fresh so the balance stepper and the tester
  // switch both read from one truth.
  const self = React.useMemo(
    () => users.find((row) => row.id === me.id) ?? me,
    [users, me],
  )

  /**
   * Live user table. A blocked WebSocket costs live updates and nothing
   * else — the table already arrived over HTTP from the server render.
   */
  React.useEffect(() => {
    let supabase: ReturnType<typeof getBrowserClient> | null = null
    let channel: ReturnType<ReturnType<typeof getBrowserClient>['channel']> | null = null

    try {
      supabase = getBrowserClient()
      channel = supabase
        .channel('god:profiles')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
          const next = payload.new as Profile
          if (!next?.id) return
          setUsers((prev) => prev.map((row) => (row.id === next.id ? { ...row, ...next } : row)))
        })
        .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    } catch (error) {
      console.warn('[god] realtime unavailable:', (error as Error)?.message)
    }

    return () => {
      try {
        if (supabase && channel) void supabase.removeChannel(channel)
      } catch {
        /* already torn down */
      }
    }
  }, [])

  const refreshStats = React.useCallback(async () => {
    const result = await loadGodStats()
    if (result.ok) setStats(result.data)
  }, [])

  /**
   * The owner tops up or burns down his own balance from here. Negative
   * amounts are the point: he uses his own account as the test subject
   * and needs to watch the number actually fall.
   */
  const stepOwnCredits = async (amount: number) => {
    haptic(amount > 0 ? 'receive' : 'spend')
    const result = await injectCredits(me.id, amount, 'god_self')
    if (!result.ok) {
      toast.error(t('selfCreditFailed'))
      return
    }
    setUsers((prev) =>
      prev.map((row) => (row.id === me.id ? { ...row, credits: result.data.balance } : row)),
    )
    void refreshStats()
  }

  const sections: Array<{ key: Section; icon: typeof Gauge; label: string }> = [
    { key: 'overview', icon: Gauge, label: t('navOverview') },
    { key: 'users', icon: Users, label: t('navUsers') },
    { key: 'keys', icon: KeyRound, label: t('navKeys') },
    { key: 'system', icon: SlidersHorizontal, label: t('navSystem') },
    { key: 'activity', icon: ScrollText, label: t('navActivity') },
  ]

  const title = sections.find((entry) => entry.key === section)?.label ?? ''

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas lg:flex-row">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'relative z-20 shrink-0 border-b border-hairline bg-surface-sunken',
          'lg:h-[100dvh] lg:w-[15rem] lg:border-b-0 lg:border-r',
          'lg:sticky lg:top-0 lg:flex lg:flex-col',
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-chip bg-gradient-to-b from-nila-300 to-nila-500 shadow-nila-relief">
            <ShieldHalf className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[1.0625rem] leading-none text-ink">
              {t('title')}
            </span>
            <span className="mt-1 block truncate text-[0.6875rem] text-ink-faint">{me.email}</span>
          </span>
        </div>

        {/* Horizontal rail on phones, vertical list from lg up. */}
        <nav
          className={cn(
            '-mx-0 flex gap-1 overflow-x-auto px-3 pb-3',
            '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0',
          )}
        >
          {sections.map((entry) => {
            const active = section === entry.key
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  haptic('tap')
                  setSection(entry.key)
                }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'tactile relative flex shrink-0 items-center gap-2.5 rounded-well px-3 py-2.5 text-left',
                  'text-[0.8125rem] font-semibold transition-colors duration-150',
                  'lg:w-full',
                  active
                    ? 'bg-nila-500/12 text-ink'
                    : 'text-ink-faint hover:bg-surface/60 hover:text-ink-soft',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="god-section-rule"
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    className={cn(
                      'absolute rounded-pill bg-nila-500',
                      'inset-x-3 bottom-0 h-0.5 lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-2 lg:h-[calc(100%-1rem)] lg:w-0.5',
                    )}
                  />
                ) : null}
                <entry.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
                {entry.label}
              </button>
            )
          })}
        </nav>

        <div className="hidden px-3 pb-4 lg:mt-auto lg:block">
          <Link
            href="/dashboard"
            className={cn(
              'tactile flex w-full items-center justify-center gap-2 rounded-well bg-surface px-4 py-3',
              'text-[0.8125rem] font-semibold text-ink-soft shadow-hairline',
              'transition-[box-shadow,transform,color] duration-150 ease-physical',
              'hover:text-ink active:translate-y-[1.5px] active:shadow-pressed',
            )}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.3} />
            {t('backToApp')}
          </Link>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-3 border-b border-hairline/70 bg-canvas/85 px-4 py-3 backdrop-blur-xl sm:px-6">
          <h1 className="min-w-0 flex-1 truncate font-display text-[1.5rem] leading-none text-ink">
            {title}
          </h1>

          <span className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                live ? 'animate-ember-breathe bg-pandan-500' : 'bg-ink-faint/50',
              )}
            />
            {live ? t('realtimeOn') : t('realtimeOff')}
          </span>

          {/* The owner's own wallet, adjustable in place. */}
          <div className="flex items-center gap-1 rounded-pill bg-surface-sunken py-1 pl-3 pr-1 shadow-well">
            <span className="font-mono text-[0.875rem] font-bold tabular text-ink">
              {self.credits.toLocaleString('id-ID')}
            </span>
            <span className="mr-1 text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
              {t('creditShort')}
            </span>
            <Stepper icon={Minus} label={t('creditDown')} onClick={() => void stepOwnCredits(-10)} />
            <Stepper icon={Plus} label={t('creditUp')} onClick={() => void stepOwnCredits(50)} />
          </div>

          <Link
            href="/dashboard"
            aria-label={t('backToApp')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-well bg-surface text-ink-soft shadow-hairline lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.3} />
          </Link>
        </header>

        <div className="px-4 pb-16 pt-5 sm:px-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {section === 'overview' ? (
                <GodOverview stats={stats} onRefresh={refreshStats} />
              ) : null}
              {section === 'users' ? (
                <GodUsers
                  meId={me.id}
                  users={users}
                  onUsers={setUsers}
                  onMutated={refreshStats}
                />
              ) : null}
              {section === 'keys' ? <GodKeys keys={keys} onKeys={setKeys} /> : null}
              {section === 'system' ? (
                <GodSystem
                  stats={stats}
                  self={self}
                  onStats={setStats}
                  onSelfChange={(patch) =>
                    setUsers((prev) =>
                      prev.map((row) => (row.id === me.id ? { ...row, ...patch } : row)),
                    )
                  }
                />
              ) : null}
              {section === 'activity' ? <GodActivity /> : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

function Stepper({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'tactile grid h-7 w-7 place-items-center rounded-full bg-surface-raised text-ink-soft shadow-relief',
        'transition-[box-shadow,transform,color] duration-150 ease-physical',
        'hover:text-ink active:translate-y-[1.5px] active:shadow-pressed',
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.6} />
    </button>
  )
}
