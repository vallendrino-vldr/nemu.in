'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import {
  Activity,
  Coins,
  Database,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Ambient, Panel, Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import type { GodStats } from '@/actions/admin'

/**
 * The masthead.
 *
 * Every number here arrives from one `god_stats()` call. The previous
 * version fired four separate aggregates from the browser on tab open and
 * took roughly seven seconds to paint, which is long enough that the
 * owner assumed the screen was broken.
 */
export function GodOverview({
  stats,
  onRefresh,
}: {
  stats: GodStats | null
  onRefresh: () => Promise<void>
}) {
  const t = useTranslations('god')
  const [refreshing, setRefreshing] = React.useState(false)

  const refresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  if (!stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-[104px]" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      icon: Users,
      label: t('users'),
      value: stats.userCount,
      delta: stats.newUsersToday ? `+${stats.newUsersToday} ${t('todaySuffix')}` : null,
      tone: 'up' as const,
    },
    {
      icon: Activity,
      label: t('activeToday'),
      value: stats.activeToday,
      delta: `${t('ofTotal', { total: stats.userCount })}`,
      tone: 'flat' as const,
    },
    {
      icon: Coins,
      label: t('totalCredits'),
      value: stats.creditsInCirculation,
      delta: stats.creditsSpentToday
        ? `−${stats.creditsSpentToday} ${t('todaySuffix')}`
        : null,
      tone: 'down' as const,
    },
    {
      icon: Database,
      label: t('leadsFound'),
      value: stats.leadCount,
      delta: stats.leadsToday ? `+${stats.leadsToday} ${t('todaySuffix')}` : null,
      tone: 'up' as const,
    },
    {
      icon: MessageCircle,
      label: t('waReady'),
      value: stats.waReadyCount,
      delta: t('contactedCount', { count: stats.contactedCount }),
      tone: 'flat' as const,
    },
    {
      icon: Activity,
      label: t('aiCalls'),
      value: stats.aiCallsToday,
      delta: t('sweepsToday', { count: stats.sweepsToday }),
      tone: 'flat' as const,
    },
    {
      icon: Search,
      label: t('cacheServed'),
      value: stats.cacheHits,
      delta: t('cachedQueries', { count: stats.cachedQueries }),
      tone: 'up' as const,
    },
    {
      icon: ShieldAlert,
      label: t('banned'),
      value: stats.bannedCount,
      delta: t('keysActiveOf', { active: stats.keysActive, total: stats.keysTotal }),
      tone: stats.bannedCount > 0 ? ('down' as const) : ('flat' as const),
    },
  ]

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-card">
        <Ambient tone="nila" />
        <div className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="max-w-md text-[0.875rem] leading-relaxed text-ink-soft">
            {t('subtitle')}
          </p>
          <Button variant="sunken" size="sm" onClick={() => void refresh()} loading={refreshing}>
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />
            {t('refresh')}
          </Button>
        </div>
      </section>

      {/* Quota Warning */}
      {stats.aiCallsToday >= 1000 ? (
        <Panel tone="flat" pad="sm" className="border-sambal-500/20 bg-sambal-500/5">
          <div className="flex items-center justify-between text-[0.8125rem]">
            <span className="font-bold text-ink-sambal">{t('quotaWarningTitle', { defaultMessage: 'Gemini Quota Warning' })}</span>
            <span className="font-mono font-bold tabular text-ink-soft">
              {stats.aiCallsToday} <span className="font-sans font-normal opacity-70">/ 1500 (Free Tier)</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken shadow-well">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (stats.aiCallsToday / 1500) * 100)}%` }}
              className="h-full bg-gradient-to-r from-ember-500 to-sambal-500"
            />
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Vital key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}

function Vital({
  icon: Icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  value: number
  delta: string | null
  tone: 'up' | 'down' | 'flat'
}) {
  return (
    <Panel tone="flat" pad="md" className="space-y-2.5 transition-colors duration-200 hover:bg-surface-raised">
      <div className="flex items-center justify-between text-ink-faint">
        <span className="overline">{label}</span>
        <Icon className="h-4 w-4 opacity-50" strokeWidth={2} />
      </div>
      <motion.p
        key={value}
        initial={{ opacity: 0.4, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="font-mono text-[1.875rem] font-bold leading-none tabular text-ink"
      >
        {value.toLocaleString('id-ID')}
      </motion.p>
      {delta ? (
        <p
          className={cn(
            'text-[0.6875rem] font-semibold leading-none',
            tone === 'up' ? 'text-ink-pandan' : tone === 'down' ? 'text-ink-sambal' : 'text-ink-faint',
          )}
        >
          {delta}
        </p>
      ) : null}
    </Panel>
  )
}
