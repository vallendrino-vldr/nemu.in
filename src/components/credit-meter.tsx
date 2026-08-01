'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Zap } from 'lucide-react'

import { getBrowserClient } from '@/lib/supabase/client'
import { useCreditStore } from '@/store/credit-store'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { AccountRole, Profile } from '@/lib/database.types'

interface CreditMeterProps {
  userId: string
  initialBalance: number
  role: AccountRole
  /**
   * Set when an admin has flipped God Mode's "bill me like a user"
   * switch. Without it the meter shows `∞` and never moves, which made
   * the owner's own account useless as a test subject — the whole point
   * of the switch is watching the number actually fall.
   */
  billed?: boolean
  className?: string
}

/**
 * The glowing balance badge.
 *
 * Subscribed to this user's own profile row over Supabase Realtime, so a
 * God Mode credit injection lands on their screen mid-session with no
 * refresh and no polling. That live channel is also what makes the "+30"
 * burst possible — the client is told the new number, not asked to guess.
 */
export function CreditMeter({
  userId,
  initialBalance,
  role,
  billed = false,
  className,
}: CreditMeterProps) {
  const t = useTranslations('credits')
  const badgeRef = React.useRef<HTMLDivElement>(null)
  const [pulsing, setPulsing] = React.useState(false)

  const balance = useCreditStore((state) => state.balance)
  const ready = useCreditStore((state) => state.ready)
  const hydrate = useCreditStore((state) => state.hydrate)
  const reconcile = useCreditStore((state) => state.reconcile)

  const unlimited = role === 'super_admin' && !billed

  React.useEffect(() => {
    hydrate(initialBalance, role)
  }, [hydrate, initialBalance, role])

  /**
   * The live balance is a luxury, not a requirement.
   *
   * This opens a WebSocket to a third-party origin, and hardened browsers
   * — Brave with shields up is the one that caught us — refuse exactly
   * that. When the refusal threw inside this effect there was no boundary
   * between it and the route, so a blocked socket painted the global
   * error screen over a page whose server render was perfectly fine, on
   * every screen the user could reach while signed in.
   *
   * Everything here is now best-effort. Lose the socket and you lose live
   * updates; the number still renders, and every paid action reconciles
   * the balance from its own server response anyway.
   */
  React.useEffect(() => {
    let channel: ReturnType<ReturnType<typeof getBrowserClient>['channel']> | null = null
    let supabase: ReturnType<typeof getBrowserClient> | null = null

    try {
      supabase = getBrowserClient()
      channel = supabase
        .channel(`wallet:${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload) => {
            try {
              const next = (payload.new as Profile).credits
              const rect = badgeRef.current?.getBoundingClientRect()
              const origin = rect
                ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                : undefined

              const previous = useCreditStore.getState().balance
              reconcile(next, origin)

              if (next > previous) haptic('receive')
              setPulsing(true)
              window.setTimeout(() => setPulsing(false), 420)
            } catch {
              /* a malformed payload must not take the header down */
            }
          },
        )
        .subscribe()
    } catch (error) {
      console.warn('[credit-meter] realtime unavailable:', (error as Error)?.message)
    }

    return () => {
      try {
        if (supabase && channel) void supabase.removeChannel(channel)
      } catch {
        /* already torn down */
      }
    }
  }, [userId, reconcile])

  const shown = ready ? balance : initialBalance
  const depleted = !unlimited && shown <= 0
  const low = !unlimited && shown > 0 && shown <= 5

  return (
    <div
      ref={badgeRef}
      title={unlimited ? t('unlimited') : t('remaining', { count: shown })}
      className={cn(
        'group relative inline-flex select-none items-center gap-2 rounded-pill py-2 pl-3 pr-4',
        'border border-white/12 bg-surface-raised/60 shadow-relief backdrop-blur-xl backdrop-saturate-150',
        'transition-shadow duration-300 ease-settle',
        !depleted && 'hover:shadow-ember-glow',
        depleted && 'border-sambal-500/30',
        className,
      )}
    >
      {/* Inner glow ring — the "charged" look, made of light not an image. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 rounded-pill opacity-70 transition-opacity duration-500',
          depleted
            ? 'bg-[radial-gradient(120%_100%_at_50%_120%,hsl(3_78%_53%/0.22),transparent_70%)]'
            : 'animate-ember-breathe bg-[radial-gradient(120%_100%_at_50%_120%,hsl(26_92%_51%/0.28),transparent_70%)]',
        )}
      />

      <span
        className={cn(
          'relative grid h-6 w-6 place-items-center rounded-full',
          depleted ? 'bg-sambal-500/20 text-ink-sambal' : 'bg-ember-500/20 text-ink-ember',
        )}
      >
        {/* The bolt always means "credits". The infinity used to live here
            AND in the value slot, so an admin saw ∞ twice in one pill. */}
        <Zap className="h-3.5 w-3.5" strokeWidth={2.5} fill="currentColor" />
      </span>

      <span className="relative flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-mono text-[0.9375rem] font-bold leading-none tabular',
            pulsing && 'animate-counter-pop',
            depleted ? 'text-ink-sambal' : low ? 'text-ink-ember' : 'text-ink',
          )}
        >
          {unlimited ? '∞' : shown}
        </span>
        <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {t('label')}
        </span>
      </span>
    </div>
  )
}
