'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { AlertTriangle, KeyRound, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge, Field, Panel, Switch } from '@/components/ui/primitives'
import { addApiKey, deleteApiKey, toggleApiKey } from '@/actions/admin'
import { haptic } from '@/lib/haptics'
import { cn, relativeTime } from '@/lib/utils'
import type { ApiKeyView } from '@/lib/database.types'

/**
 * Gemini keys, managed from the app instead of from Vercel.
 *
 * Free-tier rate limits are per key, so every key added is another whole
 * quota — which is exactly why rotating one should not require a
 * redeploy. Keys live in `api_keys`, a table with RLS on and no policies
 * at all: service_role is the only thing that can read it. What comes
 * back here is a masked preview computed inside the database. The secret
 * itself never crosses the network after it is written.
 */
export function GodKeys({
  keys,
  onKeys,
}: {
  keys: ApiKeyView[]
  onKeys: React.Dispatch<React.SetStateAction<ApiKeyView[]>>
}) {
  const t = useTranslations('god')

  const [adding, setAdding] = React.useState(false)
  const [label, setLabel] = React.useState('')
  const [secret, setSecret] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)

  const submit = async () => {
    if (!secret.trim()) return
    setBusy('new')
    const result = await addApiKey(label, secret)
    setBusy(null)

    if (!result.ok) {
      toast.error(result.code === 'not_configured' ? t('keyBadShape') : t('keyAddFailed'))
      return
    }
    onKeys(result.data)
    setLabel('')
    setSecret('')
    setAdding(false)
    haptic('land')
    toast.success(t('keyAdded'))
  }

  const flip = async (row: ApiKeyView) => {
    setBusy(row.id)
    const result = await toggleApiKey(row.id, !row.active)
    setBusy(null)
    if (!result.ok) {
      toast.error(t('keyToggleFailed'))
      return
    }
    onKeys(result.data)
  }

  const drop = async (row: ApiKeyView) => {
    setBusy(row.id)
    const result = await deleteApiKey(row.id)
    setBusy(null)
    if (!result.ok) {
      toast.error(t('keyDeleteFailed'))
      return
    }
    onKeys(result.data)
    haptic('reject')
    toast.success(t('keyDeleted'))
  }

  const activeCount = keys.filter((row) => row.active).length

  return (
    <div className="space-y-4">
      <Panel pad="md" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.9375rem] font-bold text-ink">{t('keysTitle')}</h2>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-soft">{t('keysHint')}</p>
          </div>
          <Badge tone={activeCount > 0 ? 'opportunity' : 'danger'}>
            {t('keysActiveOf', { active: activeCount, total: keys.length })}
          </Badge>
        </div>

        <ul className="divide-y divide-hairline">
          {keys.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-chip',
                  row.active
                    ? 'bg-nila-500/16 text-ink-nila shadow-well'
                    : 'bg-surface-sunken text-ink-faint shadow-well',
                )}
              >
                <KeyRound className="h-4 w-4" strokeWidth={2.3} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem] font-semibold text-ink">{row.label}</p>
                <p className="truncate font-mono text-[0.6875rem] text-ink-faint">
                  {row.preview}
                  {row.last_used_at ? ` · ${t('lastUsed')} ${relativeTime(row.last_used_at)}` : ''}
                </p>
                {row.last_error ? (
                  <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-ink-sambal">
                    <AlertTriangle className="h-3 w-3" strokeWidth={2.4} />
                    {row.last_error}
                  </p>
                ) : null}
              </div>

              <Switch
                checked={row.active}
                onChange={() => void flip(row)}
                label={row.active ? t('keyOn') : t('keyOff')}
                tone="nila"
                disabled={busy === row.id}
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => void drop(row)}
                loading={busy === row.id}
                aria-label={t('keyDelete')}
                className="px-2 text-ink-sambal"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
              </Button>
            </li>
          ))}
        </ul>

        {keys.length === 0 ? (
          <p className="py-4 text-center text-[0.8125rem] text-ink-faint">{t('keysEmpty')}</p>
        ) : null}

        <AnimatePresence initial={false}>
          {adding ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-2.5 rounded-well bg-surface-sunken p-3 shadow-well">
                <Field
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder={t('keyLabelPlaceholder')}
                  autoComplete="off"
                  className="h-10 bg-surface"
                />
                <Field
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="AIza…"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 bg-surface font-mono text-[0.8125rem]"
                />
                <p className="text-[0.6875rem] leading-relaxed text-ink-faint">{t('keySafety')}</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void submit()}
                    loading={busy === 'new'}
                    disabled={!secret.trim()}
                  >
                    {t('keySave')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-well border border-dashed border-hairline',
                'px-4 py-3 text-[0.8125rem] font-semibold text-ink-faint',
                'transition-colors duration-150 hover:border-nila-500/50 hover:text-ink',
              )}
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              {t('keyAdd')}
            </button>
          )}
        </AnimatePresence>
      </Panel>
    </div>
  )
}
