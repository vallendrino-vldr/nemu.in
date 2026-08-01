'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Ban,
  Megaphone,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge, Field, Panel } from '@/components/ui/primitives'
import {
  deleteUser,
  injectCredits,
  listAllUsers,
  setUserBan,
  setUserNotice,
} from '@/actions/admin'
import { haptic } from '@/lib/haptics'
import { cn, initialsOf, relativeTime } from '@/lib/utils'
import type { Profile } from '@/lib/database.types'

type Drawer = { id: string; mode: 'warn' | 'ban' | 'delete' } | null

/**
 * Every power the owner asked for, on one row.
 *
 * The three destructive ones each open a drawer rather than firing on a
 * tap, and each drawer asks for something the finger cannot supply by
 * accident: a message for a warning, a reason for a ban, and — for the
 * one action nothing can undo — the account's own email typed out.
 */
export function GodUsers({
  meId,
  users,
  onUsers,
  onMutated,
}: {
  meId: string
  users: Profile[]
  onUsers: React.Dispatch<React.SetStateAction<Profile[]>>
  onMutated: () => Promise<void>
}) {
  const t = useTranslations('god')

  const [term, setTerm] = React.useState('')
  const [drawer, setDrawer] = React.useState<Drawer>(null)
  const [draft, setDraft] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)

  // Debounced so each keystroke is not a database round trip.
  React.useEffect(() => {
    const timer = window.setTimeout(async () => {
      const result = await listAllUsers(term)
      if (result.ok) onUsers(result.data)
    }, 320)
    return () => window.clearTimeout(timer)
  }, [term, onUsers])

  const openDrawer = (id: string, mode: NonNullable<Drawer>['mode']) => {
    haptic('tap')
    setDraft('')
    setDrawer((current) => (current?.id === id && current.mode === mode ? null : { id, mode }))
  }

  const patch = (id: string, changes: Partial<Profile>) =>
    onUsers((prev) => prev.map((row) => (row.id === id ? { ...row, ...changes } : row)))

  const step = async (target: Profile, amount: number) => {
    setBusy(target.id)
    haptic(amount > 0 ? 'receive' : 'spend')
    const result = await injectCredits(target.id, amount, 'god_mode')
    setBusy(null)

    if (!result.ok) {
      toast.error(t('injectFailed'))
      return
    }
    patch(target.id, { credits: result.data.balance })
    void onMutated()
    toast.success(
      amount > 0
        ? t('injected', { amount, name: target.full_name ?? target.email })
        : t('deducted', { amount: Math.abs(amount), name: target.full_name ?? target.email }),
    )
  }

  const warn = async (target: Profile) => {
    const message = draft.trim()
    if (!message) return
    setBusy(target.id)
    const result = await setUserNotice(target.id, message)
    setBusy(null)

    if (!result.ok) {
      toast.error(t('warnFailed'))
      return
    }
    patch(target.id, { notice: message, notice_at: new Date().toISOString() })
    setDrawer(null)
    toast.success(t('warned', { name: target.full_name ?? target.email }))
  }

  const toggleBan = async (target: Profile) => {
    const lifting = Boolean(target.banned_at)
    const reason = lifting ? null : draft.trim()
    if (!lifting && !reason) return

    setBusy(target.id)
    const result = await setUserBan(target.id, reason)
    setBusy(null)

    if (!result.ok) {
      toast.error(result.code === 'forbidden' ? t('banAdminRefused') : t('banFailed'))
      return
    }
    patch(target.id, {
      banned_at: lifting ? null : new Date().toISOString(),
      ban_reason: reason,
    })
    setDrawer(null)
    void onMutated()
    haptic(lifting ? 'land' : 'reject')
    toast.success(
      lifting
        ? t('unbanned', { name: target.full_name ?? target.email })
        : t('banned2', { name: target.full_name ?? target.email }),
    )
  }

  const destroy = async (target: Profile) => {
    // The email must be typed out. An irreversible action should cost
    // more than the muscle memory of a second tap.
    if (draft.trim().toLowerCase() !== target.email.toLowerCase()) return

    setBusy(target.id)
    const result = await deleteUser(target.id)
    setBusy(null)

    if (!result.ok) {
      toast.error(result.code === 'forbidden' ? t('deleteRefused') : t('deleteFailed'))
      return
    }
    onUsers((prev) => prev.filter((row) => row.id !== target.id))
    setDrawer(null)
    void onMutated()
    haptic('reject')
    toast.success(t('deleted', { name: target.full_name ?? target.email }))
  }

  return (
    <Panel pad="md" className="space-y-4">
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
        {users.map((account) => {
          const isMe = account.id === meId
          const isAdmin = account.role === 'super_admin'
          const isBanned = Boolean(account.banned_at)
          const open = drawer?.id === account.id ? drawer.mode : null

          return (
            <li key={account.id} className={cn('py-3', isBanned && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.75rem] font-bold text-white',
                    isBanned
                      ? 'bg-gradient-to-b from-sambal-300 to-sambal-500'
                      : isAdmin
                        ? 'bg-gradient-to-b from-nila-300 to-nila-500'
                        : 'bg-gradient-to-b from-ember-400 to-ember-600',
                  )}
                >
                  {initialsOf(account.full_name ?? account.email)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[0.875rem] font-semibold text-ink">
                      {account.full_name ?? account.email}
                    </p>
                    {isAdmin ? <Badge tone="ai">{t('roleAdmin')}</Badge> : null}
                    {isMe ? <Badge tone="neutral">{t('you')}</Badge> : null}
                    {isBanned ? <Badge tone="danger">{t('bannedTag')}</Badge> : null}
                    {account.notice ? <Badge tone="warning">{t('warnedTag')}</Badge> : null}
                  </div>
                  <p className="truncate text-[0.6875rem] text-ink-faint">
                    {account.email} · {t('lastSeen')} {relativeTime(account.last_seen_at)}
                  </p>
                </div>

                <span
                  className={cn(
                    'font-mono text-sm font-bold tabular',
                    account.credits <= 0 ? 'text-ink-sambal' : 'text-ink',
                  )}
                >
                  {account.credits.toLocaleString('id-ID')}
                </span>

                <div className="flex items-center gap-1">
                  <RowAction
                    icon={Minus}
                    label={t('creditDown')}
                    disabled={busy === account.id}
                    onClick={() => void step(account, -10)}
                  />
                  <RowAction
                    icon={Plus}
                    label={t('creditUp')}
                    disabled={busy === account.id}
                    onClick={() => void step(account, 50)}
                  />
                  <RowAction
                    icon={Megaphone}
                    label={t('warnCta')}
                    active={open === 'warn'}
                    onClick={() => openDrawer(account.id, 'warn')}
                  />
                  <RowAction
                    icon={isBanned ? ShieldCheck : Ban}
                    label={isBanned ? t('unbanCta') : t('banCta')}
                    tone={isBanned ? 'pandan' : 'sambal'}
                    active={open === 'ban'}
                    disabled={isAdmin && !isBanned}
                    onClick={() => {
                      // Lifting a ban needs no reason, so it can fire flat.
                      if (isBanned) void toggleBan(account)
                      else openDrawer(account.id, 'ban')
                    }}
                  />
                  <RowAction
                    icon={Trash2}
                    label={t('deleteCta')}
                    tone="sambal"
                    active={open === 'delete'}
                    disabled={isAdmin || isMe}
                    onClick={() => openDrawer(account.id, 'delete')}
                  />
                </div>
              </div>

              {/* Current warning, visible so it can be cleared. */}
              {account.notice && open !== 'warn' ? (
                <div className="mt-2.5 flex items-start gap-2 rounded-well bg-surface-sunken px-3 py-2 shadow-well">
                  <Megaphone className="mt-0.5 h-3 w-3 shrink-0 text-ink-ember" strokeWidth={2.4} />
                  <p className="min-w-0 flex-1 text-[0.75rem] leading-relaxed text-ink-soft">
                    {account.notice}
                  </p>
                  <button
                    type="button"
                    aria-label={t('clearWarning')}
                    onClick={async () => {
                      const result = await setUserNotice(account.id, null)
                      if (result.ok) patch(account.id, { notice: null, notice_at: null })
                    }}
                    className="shrink-0 text-ink-faint hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </button>
                </div>
              ) : null}

              {isBanned && account.ban_reason ? (
                <p className="mt-2 px-1 text-[0.6875rem] text-ink-sambal">
                  {t('banReasonLabel')}: {account.ban_reason}
                </p>
              ) : null}

              {/* ── Action drawer ──────────────────────────────────── */}
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2.5 rounded-well bg-surface-sunken p-3 shadow-well">
                      <p className="text-[0.75rem] leading-relaxed text-ink-soft">
                        {open === 'warn'
                          ? t('warnHint')
                          : open === 'ban'
                            ? t('banHint')
                            : t('deleteHint', { email: account.email })}
                      </p>
                      <Field
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={
                          open === 'warn'
                            ? t('warnPlaceholder')
                            : open === 'ban'
                              ? t('banPlaceholder')
                              : account.email
                        }
                        autoComplete="off"
                        className="h-10 bg-surface"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant={open === 'warn' ? 'primary' : 'danger'}
                          size="sm"
                          loading={busy === account.id}
                          disabled={
                            open === 'delete'
                              ? draft.trim().toLowerCase() !== account.email.toLowerCase()
                              : !draft.trim()
                          }
                          onClick={() => {
                            if (open === 'warn') void warn(account)
                            else if (open === 'ban') void toggleBan(account)
                            else void destroy(account)
                          }}
                        >
                          {open === 'warn'
                            ? t('warnConfirm')
                            : open === 'ban'
                              ? t('banConfirm')
                              : t('deleteConfirm')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDrawer(null)}>
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>

      {users.length === 0 ? (
        <p className="py-6 text-center text-[0.8125rem] text-ink-faint">{t('noUsers')}</p>
      ) : null}
    </Panel>
  )
}

function RowAction({
  icon: Icon,
  label,
  onClick,
  tone = 'neutral',
  active,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  onClick: () => void
  tone?: 'neutral' | 'sambal' | 'pandan'
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'tactile grid h-8 w-8 place-items-center rounded-chip transition-all duration-150 ease-physical',
        'disabled:pointer-events-none disabled:opacity-30',
        'active:translate-y-[1.5px] active:shadow-pressed',
        active
          ? 'bg-surface-raised shadow-relief'
          : 'bg-surface-sunken shadow-well hover:bg-surface-raised hover:shadow-relief',
        tone === 'sambal'
          ? 'text-ink-sambal'
          : tone === 'pandan'
            ? 'text-ink-pandan'
            : 'text-ink-soft',
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
    </button>
  )
}
