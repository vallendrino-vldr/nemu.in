'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Inbox, Trash2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/primitives'
import { LeadCard } from '@/components/lead-card'
import { useLeadStore, sellableOf, visibleOf } from '@/store/lead-store'
import { deleteLeads, scoreLeadsBulk } from '@/actions/enrich'
import { toast } from 'sonner'
import { haptic } from '@/lib/haptics'
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

  // Raw state only — see the note in lead-store.ts. Deriving inside the
  // selector is what crashed this tab.
  const leads = useLeadStore((state) => state.leads)
  const filter = useLeadStore((state) => state.filter)
  const setFilter = useLeadStore((state) => state.setFilter)

  const sellable = React.useMemo(() => sellableOf(leads), [leads])
  const visible = React.useMemo(() => visibleOf(leads, filter), [leads, filter])

  const [limit, setLimit] = React.useState(PAGE)
  const [armed, setArmed] = React.useState(false)
  const [scoringBulk, setScoringBulk] = React.useState(false)
  const removeFromStore = useLeadStore((state) => state.remove)
  const patchLead = useLeadStore((state) => state.patch)

  const unscoredIds = React.useMemo(() => {
    return visible.filter((l) => l.ai_score === null).map((l) => l.id)
  }, [visible])

  const handleBulkScore = async () => {
    if (unscoredIds.length === 0) return
    setScoringBulk(true)
    haptic('tap')
    
    // We only send up to 8 at a time (as BULK_LIMIT = 8 in scoreLeadsBulk)
    const result = await scoreLeadsBulk(unscoredIds)
    setScoringBulk(false)
    
    if (result.ok) {
      if (result.data.scored > 0) {
        toast.success(t('scoredBulk', { count: result.data.scored, defaultMessage: `Scored ${result.data.scored} leads` }))
        result.data.results.forEach((row) => {
          if (row.ok) {
            patchLead(row.leadId, {
              ai_score: row.score,
              ai_verdict: row.verdict,
              ai_angle: row.angle,
            })
          }
        })
      }
      if (result.data.skipped > 0) {
        toast.error(t('skippedBulk', { count: result.data.skipped, defaultMessage: `Skipped ${result.data.skipped} due to insufficient balance` }))
      }
      if (result.data.failed > 0) {
        toast.error(t('failedBulk', { count: result.data.failed, defaultMessage: `Failed ${result.data.failed}` }))
      }
    } else {
      toast.error(t('bulkScoreError', { defaultMessage: 'Bulk score failed' }))
    }
  }

  /**
   * Clears whatever the current filter shows — not the whole archive.
   * Wiping 300 rows when the user was looking at the 5 dead ones would be
   * the kind of destructive surprise that stops people trusting a button.
   */
  const clearVisible = async () => {
    if (!armed) {
      setArmed(true)
      window.setTimeout(() => setArmed(false), 4_000)
      return
    }
    const ids = visible.map((lead) => lead.id)
    haptic('reject')
    removeFromStore(ids)
    setArmed(false)
    void deleteLeads(ids)
    toast.success(t('cleared', { count: ids.length }))
  }

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

      {visible.length > 0 ? (
        <div className="flex gap-2">
          {unscoredIds.length > 0 ? (
            <Button
              variant="ai"
              size="sm"
              onClick={() => void handleBulkScore()}
              loading={scoringBulk}
              className="flex-1 w-full"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
              {t('scoreAll', { defaultMessage: 'Score All Unscored' })}
              <span className="ml-1 opacity-70">({unscoredIds.length})</span>
            </Button>
          ) : null}
          <Button
            variant={armed ? 'danger' : 'ghost'}
            size="sm"
            onClick={() => void clearVisible()}
            className={unscoredIds.length > 0 ? 'w-auto' : 'w-full'}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.3} />
            {armed ? t('clearAllConfirm', { count: visible.length }) : t('clearAll')}
          </Button>
        </div>
      ) : null}

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
