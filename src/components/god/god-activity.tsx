'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Panel, Skeleton } from '@/components/ui/primitives'
import { loadActivity } from '@/actions/admin'
import { cn, initialsOf, relativeTime } from '@/lib/utils'
import type { GodActivityRow } from '@/lib/database.types'

/**
 * The ledger, read backwards.
 *
 * Every credit movement in the app is already append-only, so this is
 * just a window onto it — which makes it the fastest way to answer "what
 * is actually happening right now", including whether a paid action
 * charged and then failed to refund.
 */
export function GodActivity() {
  const t = useTranslations('god')
  const tCredits = useTranslations('credits')

  const [rows, setRows] = React.useState<GodActivityRow[] | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const load = React.useCallback(async () => {
    const result = await loadActivity(60)
    setRows(result.ok ? result.data : [])
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (rows === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    )
  }

  return (
    <Panel pad="md" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.9375rem] font-bold text-ink">{t('navActivity')}</h2>
        <Button variant="sunken" size="sm" onClick={() => void refresh()} loading={refreshing}>
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />
          {t('refresh')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-[0.8125rem] text-ink-faint">{t('activityEmpty')}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {rows.map((row) => {
            const gained = row.amount > 0
            return (
              <li key={row.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-[0.625rem] font-bold text-ink-soft shadow-well">
                  {initialsOf(row.full_name ?? row.email)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-semibold text-ink">
                    {labelFor(row.action, tCredits)}
                  </p>
                  <p className="truncate text-[0.6875rem] text-ink-faint">
                    {row.full_name ?? row.email} · {relativeTime(row.created_at)}
                  </p>
                </div>

                <span
                  className={cn(
                    'shrink-0 font-mono text-[0.8125rem] font-bold tabular',
                    row.amount === 0
                      ? 'text-ink-faint'
                      : gained
                        ? 'text-ink-pandan'
                        : 'text-ink-ember',
                  )}
                >
                  {row.amount === 0 ? '0' : gained ? `+${row.amount}` : row.amount}
                </span>

                <span className="w-12 shrink-0 text-right font-mono text-[0.6875rem] tabular text-ink-faint">
                  {row.balance_after}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/**
 * The ledger stores enum values; the credits namespace already carries a
 * human label for most of them. `refund` has no entry there because it
 * never appears in the user-facing price list, so it falls through to the
 * raw action name rather than throwing a missing-message error.
 */
function labelFor(
  action: GodActivityRow['action'],
  translateCredits: ReturnType<typeof useTranslations>,
): string {
  const known = ['scrape', 'score', 'pitch', 'deep_pitch', 'copilot', 'grant', 'signup_bonus']
  return known.includes(action) ? translateCredits(`actions.${action}`) : action
}
