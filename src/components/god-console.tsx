'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Activity, Coins, Database, Power, Search, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge, Field, Panel } from '@/components/ui/primitives'
import { getBrowserClient } from '@/lib/supabase/client'
import { injectCredits, listAllUsers, setKillSwitch, type GodStats } from '@/actions/admin'
import { haptic } from '@/lib/haptics'
import { cn, relativeTime } from '@/lib/utils'
import type { Profile } from '@/lib/database.types'

interface GodConsoleProps {
  initialStats: GodStats
  initialUsers: Profile[]
}

export function GodConsole({ initialStats, initialUsers }: GodConsoleProps) {
  const t = useTranslations('god')

  const [stats, setStats] = React.useState(initialStats)
  const [users, setUsers] = React.useState(initialUsers)
  const [term, setTerm] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)

  /**
   * The admin's own view is live too. Watching a user's balance change on
   * this screen while it changes on theirs is the whole point of building
   * the injection on Realtime rather than on a refetch.
   */
  React.useEffect(() => {
    const supabase = getBrowserClient()
    const channel = supabase
      .channel('god:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const next = payload.new as Profile
        if (!next?.id) return
        setUsers((prev) => prev.map((row) => (row.id === next.id ? { ...row, ...next } : row)))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  // Debounced search so each keystroke does not become a database round trip.
  React.useEffect(() => {
    const timer = window.setTimeout(async () => {
      const result = await listAllUsers(term)
      if (result.ok) setUsers(result.data)
    }, 320)
    return () => window.clearTimeout(timer)
  }, [term])

  const handleInject = async (target: Profile, amount: number) => {
    setBusy(target.id)
    haptic('spend')
    const result = await injectCredits(target.id, amount, 'god_mode')
    setBusy(null)

    if (!result.ok) {
      toast.error('Gagal menyuntik kredit.')
      return
    }
    haptic('receive')
    toast.success(t('injected', { amount, name: target.full_name ?? target.email }))
  }

  const toggleSwitch = async (service: 'places' | 'gemini') => {
    const next = {
      places: service === 'places' ? !stats.placesEnabled : stats.placesEnabled,
      gemini: service === 'gemini' ? !stats.geminiEnabled : stats.geminiEnabled,
    }
    haptic(next[service] ? 'land' : 'reject')

    setStats((prev) => ({ ...prev, placesEnabled: next.places, geminiEnabled: next.gemini }))
    const result = await setKillSwitch(next.places, next.gemini)
    if (!result.ok) {
      setStats((prev) => ({
        ...prev,
        placesEnabled: !next.places,
        geminiEnabled: !next.gemini,
      }))
      toast.error('Rem darurat gagal diubah.')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Vitals ───────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Vital icon={Users} label={t('users')} value={stats.userCount} />
        <Vital icon={Coins} label={t('totalCredits')} value={stats.creditsInCirculation} />
        <Vital icon={Database} label={t('leadsFound')} value={stats.leadCount} />
        <Vital icon={Activity} label={t('aiCalls')} value={stats.aiCallsToday} />
      </div>

      {/* ── Kill switch ──────────────────────────────────────────── */}
      <Panel pad="lg" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Power className="h-4 w-4 text-ember-500" strokeWidth={2.4} />
          <h2 className="text-[0.9375rem] font-bold text-ink">{t('killSwitch')}</h2>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-ink-soft">{t('killSwitchHint')}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <BreakerSwitch
            name="Pencari Usaha (OSM)"
            live={stats.placesEnabled}
            onLabel={t('killSwitchOn')}
            offLabel={t('killSwitchOff')}
            onToggle={() => void toggleSwitch('places')}
          />
          <BreakerSwitch
            name="Gemini AI"
            live={stats.geminiEnabled}
            onLabel={t('killSwitchOn')}
            offLabel={t('killSwitchOff')}
            onToggle={() => void toggleSwitch('gemini')}
          />
        </div>

        <Badge tone="opportunity">
          {stats.cacheHits} pencarian dilayani dari cache — kuota Google yang tidak terpakai.
        </Badge>
      </Panel>

      {/* ── Users ────────────────────────────────────────────────── */}
      <Panel pad="lg" className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Field
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t('searchUser')}
            className="pl-10"
          />
        </div>

        <ul className="divide-y divide-hairline">
          {users.map((account) => (
            <li key={account.id} className="flex flex-wrap items-center gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[0.875rem] font-semibold text-ink">
                    {account.full_name ?? account.email}
                  </p>
                  {account.role === 'super_admin' ? (
                    <Badge tone="ai">{t('roleAdmin')}</Badge>
                  ) : null}
                </div>
                <p className="truncate text-[0.6875rem] text-ink-faint">
                  {account.email} · {t('lastSeen')} {relativeTime(account.last_seen_at)}
                </p>
              </div>

              <span
                className={cn(
                  'font-mono text-sm font-bold tabular',
                  account.credits <= 0 ? 'text-sambal-500' : 'text-ink',
                )}
              >
                {account.role === 'super_admin' ? '∞' : account.credits}
              </span>

              <div className="flex items-center gap-1.5">
                {[10, 50, 200].map((amount) => (
                  <Button
                    key={amount}
                    variant="sunken"
                    size="sm"
                    loading={busy === account.id}
                    onClick={() => void handleInject(account, amount)}
                    className="px-2.5 font-mono text-[0.6875rem]"
                  >
                    +{amount}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>

        {users.length === 0 ? (
          <p className="py-6 text-center text-[0.8125rem] text-ink-faint">
            Tidak ada pengguna yang cocok.
          </p>
        ) : null}
      </Panel>
    </div>
  )
}

// ── pieces ───────────────────────────────────────────────────────────

function Vital({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  value: number
}) {
  return (
    <Panel pad="md" className="space-y-2.5">
      <div className="flex items-center gap-2 text-ink-faint">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
        <span className="overline">{label}</span>
      </div>
      <motion.p
        key={value}
        initial={{ opacity: 0.4, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="font-mono text-2xl font-bold tabular leading-none text-ink"
      >
        {value.toLocaleString('id-ID')}
      </motion.p>
    </Panel>
  )
}

/**
 * A physical breaker, not a checkbox: green and raised when live, red and
 * pushed in when cut. The state is legible from across the room, which
 * matters for a control whose whole job is preventing a surprise bill.
 */
function BreakerSwitch({
  name,
  live,
  onLabel,
  offLabel,
  onToggle,
}: {
  name: string
  live: boolean
  onLabel: string
  offLabel: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={live}
      className={cn(
        'tactile flex items-center gap-3 rounded-well px-4 py-3.5 text-left',
        'transition-[box-shadow,transform,background-color] duration-200 ease-physical',
        live
          ? 'bg-gradient-to-b from-surface-raised to-surface shadow-relief'
          : 'translate-y-[1.5px] bg-surface-sunken shadow-pressed',
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors duration-200',
          live
            ? 'bg-pandan-500/18 text-pandan-500 shadow-[0_0_14px_-2px_hsl(158_64%_38%/0.7)]'
            : 'bg-sambal-500/18 text-sambal-500',
        )}
      >
        <Power className="h-4 w-4" strokeWidth={2.6} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.8125rem] font-bold text-ink">{name}</span>
        <span
          className={cn(
            'block truncate text-[0.6875rem] font-medium',
            live ? 'text-pandan-500' : 'text-sambal-500',
          )}
        >
          {live ? onLabel : offLabel}
        </span>
      </span>
    </button>
  )
}
