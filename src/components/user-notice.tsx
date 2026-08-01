'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { Megaphone, X } from 'lucide-react'

import { getBrowserClient } from '@/lib/supabase/client'
import { dismissMyNotice } from '@/actions/admin'
import type { Profile } from '@/lib/database.types'

/**
 * The admin's message to this user.
 *
 * It rides the Realtime subscription that already exists on `profiles`
 * rather than opening a second channel — a warning sent from God Mode
 * appears on the target's screen mid-session, without a refresh and
 * without polling.
 *
 * Like every other realtime feature in this app it fails soft: a browser
 * that blocks the socket simply sees the notice on next load.
 */
export function UserNotice({ userId, initial }: { userId: string; initial: string | null }) {
  const t = useTranslations('notice')
  const [message, setMessage] = React.useState(initial)

  React.useEffect(() => {
    let supabase: ReturnType<typeof getBrowserClient> | null = null
    let channel: ReturnType<ReturnType<typeof getBrowserClient>['channel']> | null = null

    try {
      supabase = getBrowserClient()
      channel = supabase
        .channel(`notice:${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload) => {
            try {
              setMessage((payload.new as Profile).notice ?? null)
            } catch {
              /* a malformed payload must not take the shell down */
            }
          },
        )
        .subscribe()
    } catch (error) {
      console.warn('[notice] realtime unavailable:', (error as Error)?.message)
    }

    return () => {
      try {
        if (supabase && channel) void supabase.removeChannel(channel)
      } catch {
        /* already torn down */
      }
    }
  }, [userId])

  const dismiss = () => {
    setMessage(null)
    void dismissMyNotice()
  }

  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2.5 border-b border-ember-500/25 bg-ember-500/10 px-4 py-3">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-ink-ember" strokeWidth={2.4} />
            <p className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed text-ink">{message}</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('dismiss')}
              className="-m-2 shrink-0 p-2 text-ink-faint transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
