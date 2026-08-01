'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useCreditStore } from '@/store/credit-store'
import { cn } from '@/lib/utils'

/**
 * Floating credit numbers, RPG-style.
 *
 * Rendered into a portal at the document root so a burst can never be
 * clipped by an `overflow: hidden` card, and positioned with `fixed` at
 * the exact viewport coordinate where the finger or cursor was — the
 * number leaves the button the user actually pressed, not some generic
 * corner of the layout.
 */
export function CreditBurstLayer() {
  const bursts = useCreditStore((state) => state.bursts)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      {bursts.map((burst) => {
        const gained = burst.amount > 0
        return (
          <span
            key={burst.id}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 font-mono text-lg font-bold tabular',
              'drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]',
              gained
                ? 'animate-credit-gain text-pandan-300'
                : 'animate-credit-drain text-ember-300',
            )}
            style={{ left: burst.x, top: burst.y }}
          >
            {gained ? `+${burst.amount}` : burst.amount}
          </span>
        )
      })}
    </div>,
    document.body,
  )
}
