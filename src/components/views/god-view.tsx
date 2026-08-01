'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { GodConsole } from '@/components/god-console'
import { Panel, Skeleton } from '@/components/ui/primitives'
import { listAllUsers, loadGodStats, type GodStats } from '@/actions/admin'
import type { Profile } from '@/lib/database.types'

/**
 * God Mode as a tab rather than a route.
 *
 * Its data is fetched on first open instead of during the shell's server
 * render: an admin dashboard aggregating every user, lead and ledger row
 * is the heaviest query in the app, and paying for it on every sign-in —
 * including the times nobody opens this tab — is what a slow app is made
 * of.
 */
export function GodView() {
  const t = useTranslations('god')
  const [state, setState] = React.useState<
    { status: 'loading' } | { status: 'ready'; stats: GodStats; users: Profile[] } | { status: 'error' }
  >({ status: 'loading' })

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [stats, users] = await Promise.all([loadGodStats(), listAllUsers('')])
      if (cancelled) return
      if (!stats.ok || !users.ok) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', stats: stats.data, users: users.data })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[86px]" />
          ))}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <Panel pad="lg" className="text-center">
        <p className="text-[0.875rem] font-semibold text-ink">{t('loadFailed')}</p>
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-[1.75rem] leading-none text-ink">{t('title')}</h2>
        <p className="mt-2 text-[0.8125rem] text-ink-soft">{t('subtitle')}</p>
      </div>
      <GodConsole initialStats={state.stats} initialUsers={state.users} />
    </div>
  )
}
