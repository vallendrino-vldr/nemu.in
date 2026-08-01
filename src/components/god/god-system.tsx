'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Megaphone, Power, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge, Field, Panel, Switch } from '@/components/ui/primitives'
import { setAdminBilling, setKillSwitch, type GodStats } from '@/actions/admin'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/database.types'

/**
 * The switches that cost or save money.
 *
 * The breakers are physical objects rather than checkboxes on purpose:
 * their whole job is preventing a surprise bill, and that state has to be
 * legible from across the room.
 */
export function GodSystem({
  stats,
  self,
  onStats,
  onSelfChange,
}: {
  stats: GodStats | null
  self: Profile
  onStats: React.Dispatch<React.SetStateAction<GodStats | null>>
  onSelfChange: (patch: Partial<Profile>) => void
}) {
  const t = useTranslations('god')
  const [notice, setNotice] = React.useState(stats?.notice ?? '')
  const [savingNotice, setSavingNotice] = React.useState(false)

  if (!stats) return null

  const toggleSwitchFor = async (service: 'places' | 'gemini') => {
    const next = {
      places: service === 'places' ? !stats.placesEnabled : stats.placesEnabled,
      gemini: service === 'gemini' ? !stats.geminiEnabled : stats.geminiEnabled,
    }
    haptic(next[service] ? 'land' : 'reject')

    onStats((prev) =>
      prev ? { ...prev, placesEnabled: next.places, geminiEnabled: next.gemini } : prev,
    )

    const result = await setKillSwitch(next.places, next.gemini, stats.notice)
    if (!result.ok) {
      onStats((prev) =>
        prev ? { ...prev, placesEnabled: !next.places, geminiEnabled: !next.gemini } : prev,
      )
      toast.error(t('killSwitchFailed'))
    }
  }

  const saveNotice = async () => {
    setSavingNotice(true)
    const value = notice.trim() || null
    const result = await setKillSwitch(stats.placesEnabled, stats.geminiEnabled, value)
    setSavingNotice(false)

    if (!result.ok) {
      toast.error(t('noticeFailed'))
      return
    }
    onStats((prev) => (prev ? { ...prev, notice: value } : prev))
    toast.success(value ? t('noticeSaved') : t('noticeCleared'))
  }

  const toggleBilling = async (next: boolean) => {
    onSelfChange({ bill_admin: next })
    const result = await setAdminBilling(next)
    if (!result.ok) {
      onSelfChange({ bill_admin: !next })
      toast.error(t('billingFailed'))
      return
    }
    haptic(next ? 'spend' : 'land')
    toast.success(next ? t('billingOn') : t('billingOff'))
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* ── Kill switch ───────────────────────────────────────────── */}
      <Panel pad="md" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Power className="h-4 w-4 text-ink-ember" strokeWidth={2.4} />
          <h2 className="text-[0.9375rem] font-bold text-ink">{t('killSwitch')}</h2>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-ink-soft">{t('killSwitchHint')}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Breaker
            name="Google Places"
            live={stats.placesEnabled}
            onLabel={t('killSwitchOn')}
            offLabel={t('killSwitchOff')}
            onToggle={() => void toggleSwitchFor('places')}
          />
          <Breaker
            name="Gemini AI"
            live={stats.geminiEnabled}
            onLabel={t('killSwitchOn')}
            offLabel={t('killSwitchOff')}
            onToggle={() => void toggleSwitchFor('gemini')}
          />
        </div>

        <Badge tone="opportunity">{t('cacheSaved', { count: stats.cacheHits })}</Badge>
      </Panel>

      {/* ── Tester billing ────────────────────────────────────────── */}
      <Panel pad="md" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Wallet className="h-4 w-4 text-ink-nila" strokeWidth={2.4} />
          <h2 className="text-[0.9375rem] font-bold text-ink">{t('testerTitle')}</h2>
        </div>

        <div className="flex items-start gap-3 rounded-well bg-surface-sunken p-3 shadow-well">
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] font-semibold text-ink">{t('testerToggleLabel')}</p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-soft">{t('testerHint')}</p>
          </div>
          <Switch
            checked={self.bill_admin}
            onChange={(next) => void toggleBilling(next)}
            label={t('testerToggleLabel')}
            tone="nila"
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[0.75rem] text-ink-soft">{t('yourBalance')}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold tabular text-ink">
              {self.credits.toLocaleString('id-ID')}
            </span>
            {!self.bill_admin ? <Badge tone="ai">{t('bypassOn')}</Badge> : null}
          </span>
        </div>
      </Panel>

      {/* ── Broadcast ─────────────────────────────────────────────── */}
      <Panel pad="md" className="space-y-3 xl:col-span-2">
        <div className="flex items-center gap-2.5">
          <Megaphone className="h-4 w-4 text-ink-ember" strokeWidth={2.4} />
          <h2 className="text-[0.9375rem] font-bold text-ink">{t('noticeTitle')}</h2>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-ink-soft">{t('noticeHint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Field
            value={notice}
            onChange={(event) => setNotice(event.target.value)}
            placeholder={t('noticePlaceholder')}
            className="min-w-[16rem] flex-1"
          />
          <Button
            variant="surface"
            size="md"
            onClick={() => void saveNotice()}
            loading={savingNotice}
          >
            {t('noticeSave')}
          </Button>
        </div>
      </Panel>
    </div>
  )
}

/**
 * A physical breaker: green and raised when live, red and pushed in when
 * cut. Legible from across the room, which is the entire requirement.
 */
function Breaker({
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
            ? 'bg-pandan-500/18 text-ink-pandan shadow-[0_0_14px_-2px_hsl(158_64%_38%/0.7)]'
            : 'bg-sambal-500/18 text-ink-sambal',
        )}
      >
        <Power className="h-4 w-4" strokeWidth={2.6} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.8125rem] font-bold text-ink">{name}</span>
        <span
          className={cn(
            'block truncate text-[0.6875rem] font-medium',
            live ? 'text-ink-pandan' : 'text-ink-sambal',
          )}
        >
          {live ? onLabel : offLabel}
        </span>
      </span>
    </button>
  )
}
