'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Copy,
  Globe2,
  MapPin,
  MessageCircle,
  Phone,
  PhoneOff,
  Sparkles,
  Star,
  Stethoscope,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge, Panel } from '@/components/ui/primitives'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { GhostSite } from '@/components/ghost-site'
import { usePaidAction } from '@/hooks/use-paid-action'
import {
  deepAuditAction,
  deleteLeads,
  markContacted,
  scoreLeadAction,
  writePitchAction,
} from '@/actions/enrich'
import { useLeadStore } from '@/store/lead-store'
import { CREDIT_COST } from '@/lib/pricing'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { Lead } from '@/lib/database.types'

export function LeadCard({ lead: initial, index = 0 }: { lead: Lead; index?: number }) {
  const t = useTranslations('lead')
  const tPitch = useTranslations('pitch')
  const tGhost = useTranslations('ghost')
  const { run, isPending } = usePaidAction()

  const [lead, setLead] = React.useState(initial)
  const [ghostOpen, setGhostOpen] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const removeFromStore = useLeadStore((state) => state.remove)

  /**
   * Two taps, not a dialog. A modal for a single reversible-by-re-sweeping
   * row is heavier than the action deserves; arming the button in place
   * still makes an accidental tap impossible.
   */
  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      window.setTimeout(() => setConfirmDelete(false), 3_000)
      return
    }
    haptic('reject')
    removeFromStore([lead.id])
    void deleteLeads([lead.id])
    toast.success(t('deleted'))
  }

  const unserved = !lead.website
  const tier = lead.contact_tier

  // Only a mobile number produces a wa.me link. Rendering one for a
  // landline would look identical and silently fail — worse than not
  // offering the button at all.
  const waLink =
    tier === 'whatsapp' && lead.phone_e164
      ? `https://wa.me/${lead.phone_e164}${lead.pitch ? `?text=${encodeURIComponent(lead.pitch)}` : ''}`
      : null

  const telLink = lead.phone_dial ? `tel:+${lead.phone_dial}` : null

  // ── paid handlers ─────────────────────────────────────────────────

  const handleScore = async (event: React.MouseEvent) => {
    const result = await run(`score:${lead.id}`, event, () => scoreLeadAction(lead.id))
    if (result) {
      setLead((prev) => ({
        ...prev,
        ai_score: result.score,
        ai_verdict: result.verdict,
        ai_angle: result.angle,
      }))
    }
  }

  const handlePitch = async (event: React.MouseEvent) => {
    const result = await run(`pitch:${lead.id}`, event, () => writePitchAction(lead.id, 'warm'))
    if (result) setLead((prev) => ({ ...prev, pitch: result.message, pitch_tone: result.tone }))
  }

  const handleAudit = async (event: React.MouseEvent) => {
    const result = await run(`audit:${lead.id}`, event, () => deepAuditAction(lead.id))
    if (result) setLead((prev) => ({ ...prev, pitch: result.message, pitch_tone: 'audit' }))
  }

  const handleCopy = async () => {
    if (!lead.pitch) return
    await navigator.clipboard.writeText(lead.pitch)
    haptic('tap')
    toast.success(t('copied'))
  }

  const handleOpenWhatsApp = () => {
    haptic('land')
    void markContacted(lead.id)
    setLead((prev) => ({ ...prev, status: 'contacted' }))
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: Math.min(index * 0.035, 0.28), ease: [0.16, 1, 0.3, 1] }}
    >
      <Panel tone="flat" pad="none" className="group overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-relief">
        <div className="flex gap-4 p-5 sm:p-6">
          <ScoreDial score={lead.ai_score} />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[1.0625rem] font-bold leading-snug text-ink transition-colors group-hover:text-ink-ember">
                  {lead.name}
                </h3>
                <p className="mt-1 truncate text-[0.8125rem] text-ink-faint">
                  {[lead.category, lead.area].filter(Boolean).join(' · ') || lead.address}
                </p>
              </div>
              {lead.status === 'contacted' ? (
                <Badge tone="opportunity" className="shrink-0">
                  <BadgeCheck className="h-3 w-3" />
                  {t('contacted')}
                </Badge>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone={unserved ? 'opportunity' : 'neutral'}>
                <Globe2 className="h-3 w-3" />
                {unserved ? t('noWebsite') : t('hasWebsite')}
              </Badge>

              {lead.rating ? (
                <Badge tone="neutral">
                  <Star className="h-3 w-3 fill-ember-400 text-ember-400" />
                  {lead.rating.toFixed(1)}
                  <span className="text-ink-faint">· {t('reviews', { count: lead.review_count ?? 0 })}</span>
                </Badge>
              ) : null}

              {tier === 'whatsapp' ? (
                <Badge tone="opportunity">
                  <MessageCircle className="h-3 w-3" />
                  {t('tierWhatsapp')}
                </Badge>
              ) : tier === 'phone' ? (
                <Badge tone="warning">
                  <Phone className="h-3 w-3" />
                  {t('tierPhone')}
                </Badge>
              ) : tier === 'visit' ? (
                <Badge tone="neutral">
                  <PhoneOff className="h-3 w-3" />
                  {t('tierVisit')}
                </Badge>
              ) : null}
            </div>

            {lead.ai_verdict ? (
              <p className="mt-3 rounded-lg bg-surface-sunken p-3 text-[0.8125rem] leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">Verdict: </span>
                {lead.ai_verdict}
              </p>
            ) : null}
          </div>
        </div>

        {/* Action rail — sunken so it reads as a separate machined part. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline/50 bg-surface-sunken/50 px-5 py-3.5 sm:px-6">
          {lead.ai_score === null ? (
            <Button
              variant="ai"
              size="sm"
              onClick={handleScore}
              loading={isPending(`score:${lead.id}`)}
              feedback="spend"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
              {t('scoreCta')}
              <CostTag amount={CREDIT_COST.score} />
            </Button>
          ) : null}

          <Button
            variant={lead.pitch ? 'surface' : 'primary'}
            size="sm"
            onClick={handlePitch}
            loading={isPending(`pitch:${lead.id}`)}
            feedback="spend"
          >
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
            {lead.pitch ? tPitch('regenerate') : t('pitchCta')}
            <CostTag amount={CREDIT_COST.pitch} />
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={handleAudit}
            loading={isPending(`audit:${lead.id}`)}
            feedback="spend"
          >
            <Stethoscope className="h-3.5 w-3.5" strokeWidth={2.4} />
            {t('pitchDeepCta')}
            <CostTag amount={CREDIT_COST.deep_pitch} />
          </Button>

          <Sheet open={ghostOpen} onOpenChange={setGhostOpen}>
            <SheetTrigger asChild>
              <Button variant="sunken" size="sm" feedback="tap">
                👻 {tGhost('cta')}
              </Button>
            </SheetTrigger>
            <SheetContent title={tGhost('title')} description={tGhost('body')}>
              <GhostSite
                subject={{
                  name: lead.name,
                  category: lead.category,
                  area: lead.area,
                  address: lead.address,
                  rating: lead.rating,
                  reviewCount: lead.review_count ?? 0,
                  phone: lead.phone,
                }}
              />
            </SheetContent>
          </Sheet>

          {lead.maps_uri ? (
            <Button variant="ghost" size="sm" asChild>
              <a href={lead.maps_uri} target="_blank" rel="noopener noreferrer">
                <MapPin className="h-3.5 w-3.5" strokeWidth={2.4} />
                {t('openMaps')}
              </a>
            </Button>
          ) : null}

          <Button
            variant={confirmDelete ? 'danger' : 'ghost'}
            size="sm"
            onClick={handleDelete}
            className="ml-auto"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
            {confirmDelete ? t('deleteConfirm') : t('delete')}
          </Button>
        </div>

        {/* Generated pitch */}
        <AnimatePresence initial={false}>
          {lead.pitch ? (
            <motion.div
              key="pitch"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-3 p-5">
                <p className="whitespace-pre-wrap rounded-well bg-surface-sunken p-4 text-[0.8125rem] leading-relaxed text-ink shadow-well">
                  {lead.pitch}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {waLink ? (
                    <Button variant="primary" size="sm" asChild onClick={handleOpenWhatsApp}>
                      <a href={waLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {t('openWhatsapp')}
                      </a>
                    </Button>
                  ) : telLink ? (
                    <Button variant="primary" size="sm" asChild onClick={handleOpenWhatsApp}>
                      <a href={telLink}>
                        <Phone className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {t('callCta')} {lead.phone}
                      </a>
                    </Button>
                  ) : null}
                  <Button variant="surface" size="sm" onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5" strokeWidth={2.4} />
                    {t('copy')}
                  </Button>
                </div>

                {tier === 'visit' ? (
                  <p className="text-[0.6875rem] leading-relaxed text-ink-faint">
                    {t('noPhoneHint')}
                  </p>
                ) : null}

                <p className="text-[0.6875rem] leading-relaxed text-ink-faint">
                  {tPitch('disclaimer')}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Panel>
    </motion.div>
  )
}

// ── Score dial ──────────────────────────────────────────────────────

function ScoreDial({ score }: { score: number | null }) {
  const t = useTranslations('lead')
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const filled = score === null ? 0 : (score / 100) * circumference

  const tone =
    score === null
      ? 'hsl(var(--ink-faint))'
      : score >= 70
        ? 'hsl(158 64% 38%)'
        : score >= 45
          ? 'hsl(26 92% 51%)'
          : 'hsl(3 78% 53%)'

  return (
    <div
      className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface-sunken shadow-well"
      title={t('scoreLabel')}
    >
      <svg viewBox="0 0 56 56" className="absolute h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="hsl(var(--hairline))" strokeWidth="4" />
        <motion.circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - filled }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="relative font-mono text-sm font-bold tabular" style={{ color: tone }}>
        {score ?? '—'}
      </span>
    </div>
  )
}

function CostTag({ amount }: { amount: number }) {
  return (
    <span
      className={cn(
        'ml-0.5 rounded-pill bg-black/12 px-1.5 py-0.5 font-mono text-[0.625rem] font-bold tabular',
        'dark:bg-white/12',
      )}
    >
      {amount}
    </span>
  )
}
