'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/primitives'
import { LeadCard } from '@/components/lead-card'
import { useLeadStore, selectSellable, selectVisible } from '@/store/lead-store'
import type { ContactTierDb } from '@/lib/database.types'

/**
 * The archive.
 *
 * Long lists are windowed rather than rendered whole: a sweep can return
 * three hundred leads, and mounting three hundred cards — each with its
 * own animated score dial and sheet — is what turns a scroll into a
 * stutter on a mid-range phone. Twenty at a time, extended on demand.
 */
const PAGE = 20

export function LeadsView() {
  const t = useTranslations('leads')
  const tLead = useTranslations('lead')

  const visible = useLeadStore(selectVisible)
  const sellable = useLeadStore(selectSellable)
  const filter = useLeadStore((state) => state.filter)
  const setFilter = useLeadStore((state) => state.setFilter)

  const [limit, setLimit] = React.useState(PAGE)

  // A filter change should always start from the top of the new list.
  React.useEffect(() => setLimit(PAGE), [filter])

  const counts = React.useMemo(() => {
    const tally = { whatsapp: 0, phone: 0, visit: 0 }
    for (const lead of sellable) {
      if (lead.contact_tier in tally) tally[lead.contact_tier as keyof typeof tally] += 1
    }
    return tally
  }, [sellable])

  const chips: Array<{ key: ContactTierDb | null; label: string; count: number }> = [
    { key: null, label: t('filterAll'), count: sellable.length },
    { key: 'whatsapp', label: tLead('tierWhatsapp'), count: counts.whatsapp },
    { key: 'phone', label: tLead('tierPhone'), count: counts.phone },
    { key: 'visit', label: tLead('tierVisit'), count: counts.visit },
  ]

  if (sellable.length === 0) {
    return (
      <Panel pad="lg" className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-sunken text-ink-faint shadow-well">
          <Inbox className="h-5 w-5" strokeWidth={2} />
        </span>
        <h3 className="mt-4 font-display text-2xl text-ink">{t('emptyTitle')}</h3>
        <p className="mx-auto mt-2 max-w-xs text-[0.8125rem] leading-relaxed text-ink-soft">
          {t('emptyBody')}
        </p>
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      {/* Horizontal chip rail — scrolls sideways so four filters never
          wrap onto two lines and shove the list down the screen. */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => (
          <Button
            key={chip.label}
            variant={filter === chip.key ? 'primary' : 'sunken'}
            size="sm"
            onClick={() => setFilter(chip.key)}
            aria-pressed={filter === chip.key}
            className="shrink-0"
          >
            {chip.label}
            <span className="font-mono text-[0.625rem] opacity-75">{chip.count}</span>
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Panel pad="lg" className="text-center">
          <p className="text-[0.8125rem] text-ink-soft">{t('noneInFilter')}</p>
        </Panel>
      ) : (
        <div className="grid gap-3">
          {visible.slice(0, limit).map((lead, index) => (
            <LeadCard key={lead.id} lead={lead} index={index} />
          ))}
        </div>
      )}

      {limit < visible.length ? (
        <Button
          variant="surface"
          size="md"
          className="w-full"
          onClick={() => setLimit((current) => current + PAGE)}
        >
          {t('loadMore', { remaining: visible.length - limit })}
        </Button>
      ) : null}
    </div>
  )
}
