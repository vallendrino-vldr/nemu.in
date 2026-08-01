'use client'

import { useTranslations } from 'next-intl'
import { LogOut, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge, Panel } from '@/components/ui/primitives'
import { ThemeToggle } from '@/components/theme-toggle'
import { LocaleSwitch } from '@/components/locale-switch'
import { signOut } from '@/actions/auth'
import { useCreditStore } from '@/store/credit-store'
import { useLeadStore, selectSellable } from '@/store/lead-store'
import { CREDIT_COST } from '@/lib/pricing'
import { initialsOf } from '@/lib/utils'
import type { Profile } from '@/lib/database.types'

export function ProfileView({ profile }: { profile: Profile }) {
  const t = useTranslations('profile')
  const tCredits = useTranslations('credits')

  const balance = useCreditStore((state) => state.balance)
  const leads = useLeadStore(selectSellable)
  const waReady = leads.filter((lead) => lead.contact_tier === 'whatsapp').length

  const unlimited = profile.role === 'super_admin'

  return (
    <div className="space-y-4">
      <Panel pad="lg" className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-b from-ember-400 to-ember-600 font-display text-xl text-white shadow-ember-relief">
          {initialsOf(profile.full_name ?? profile.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-bold text-ink">
            {profile.full_name ?? profile.email.split('@')[0]}
          </p>
          <p className="truncate text-[0.75rem] text-ink-faint">{profile.email}</p>
          {unlimited ? (
            <Badge tone="ai" className="mt-1.5">
              {t('roleAdmin')}
            </Badge>
          ) : null}
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat value={unlimited ? '∞' : String(balance)} label={tCredits('label')} />
        <Stat value={String(leads.length)} label={t('statLeads')} />
        <Stat value={String(waReady)} label={t('statWaReady')} />
      </div>

      <Panel pad="lg" className="space-y-3">
        <p className="overline">{t('prefs')}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.8125rem] text-ink">{t('theme')}</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.8125rem] text-ink">{t('language')}</span>
          <LocaleSwitch />
        </div>
      </Panel>

      <Panel tone="sunken" pad="lg" className="space-y-2.5">
        <p className="overline">{tCredits('ledgerTitle')}</p>
        <ul className="divide-y divide-hairline">
          {(
            [
              ['scrape', CREDIT_COST.scrape],
              ['pitch', CREDIT_COST.pitch],
              ['score', CREDIT_COST.score],
              ['deep_pitch', CREDIT_COST.deep_pitch],
            ] as const
          ).map(([action, cost]) => (
            <li key={action} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[0.8125rem] text-ink">{tCredits(`actions.${action}`)}</span>
              <span className="flex items-center gap-1 font-mono text-[0.8125rem] font-bold tabular text-ink-soft">
                <Zap className="h-3 w-3 text-ember-500" fill="currentColor" />
                {cost}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-[0.8125rem] text-ink">👻 Website Hantu</span>
            <span className="rounded-pill bg-pandan-500/14 px-2.5 py-1 text-[0.6875rem] font-bold text-pandan-700 dark:text-pandan-300">
              {t('free')}
            </span>
          </li>
        </ul>
      </Panel>

      <form action={signOut}>
        <Button type="submit" variant="surface" size="md" className="w-full">
          <LogOut className="h-4 w-4" strokeWidth={2.3} />
          {t('signOut')}
        </Button>
      </form>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Panel pad="none" className="flex flex-col items-center gap-1 py-4">
      <span className="font-mono text-xl font-bold leading-none tabular text-ink">{value}</span>
      <span className="px-1 text-center text-[0.5625rem] font-bold uppercase leading-tight tracking-[0.1em] text-ink-faint">
        {label}
      </span>
    </Panel>
  )
}
