'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useCreditStore } from '@/store/credit-store'
import { haptic } from '@/lib/haptics'
import type { ActionResult, Failure } from '@/lib/result'

/**
 * One place where every paid button behaves identically:
 *
 *  - remembers exactly where the press happened, so the floating credit
 *    number leaves the finger rather than a fixed corner
 *  - reconciles the balance from the server's number, never from local
 *    arithmetic, so two tabs can never disagree
 *  - turns a typed failure into a designed message instead of a 500
 *
 * The coordinates are read from the event synchronously. React pools
 * nothing in 19, but the event object still cannot be referenced after an
 * await, so this must happen before the action is called.
 */
export function usePaidAction() {
  const tErrors = useTranslations('errors')
  const reconcile = useCreditStore((state) => state.reconcile)

  const [pending, setPending] = React.useState<string | null>(null)

  const run = React.useCallback(
    async <T extends { balance: number }>(
      key: string,
      event: React.MouseEvent | React.PointerEvent | null,
      action: () => Promise<ActionResult<T>>,
    ): Promise<T | null> => {
      const origin = event ? { x: event.clientX, y: event.clientY } : undefined

      setPending(key)
      try {
        const result = await action()

        if (!result.ok) {
          haptic('reject')
          announce(result, tErrors)
          return null
        }

        reconcile(result.data.balance, origin)
        haptic('land')
        return result.data
      } catch {
        haptic('reject')
        toast.error(tErrors('genericTitle'), { description: tErrors('genericBody') })
        return null
      } finally {
        setPending(null)
      }
    },
    [reconcile, tErrors],
  )

  return { run, pending, isPending: (key: string) => pending === key }
}

type Translator = ReturnType<typeof useTranslations<'errors'>>

function announce(failure: Failure, t: Translator) {
  switch (failure.code) {
    case 'insufficient_credits':
      toast.error(t('insufficientTitle'), {
        description: t('insufficientBody', {
          needed: failure.needed ?? 0,
          have: failure.have ?? 0,
        }),
      })
      return
    case 'api_disabled':
      toast.error(t('apiDownTitle'), { description: t('apiDownBody') })
      return
    case 'quota':
      toast.error(t('quotaTitle'), { description: t('quotaBody') })
      return
    case 'ai_busy':
      toast.error(t('aiBusyTitle'), { description: t('aiBusyBody') })
      return
    case 'auth':
      toast.error(t('genericTitle'), { description: t('genericBody') })
      return
    default:
      toast.error(t('genericTitle'), { description: t('genericBody') })
  }
}
