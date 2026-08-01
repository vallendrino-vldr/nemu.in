'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A modal that behaves like a drawer on phones and a centred panel on
 * desktop, because a 700px-wide dialog on a 390px screen is the single
 * most common tell of a UI that was only ever opened on a laptop.
 */

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }
>(({ className, children, title, description, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-[hsl(24_30%_6%/0.55)] backdrop-blur-sm',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 flex flex-col bg-surface shadow-floating focus:outline-none',
        // phone: bottom drawer
        'inset-x-0 bottom-0 max-h-[92svh] rounded-t-card',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
        // desktop: centred panel
        'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86vh] sm:w-full sm:max-w-lg',
        'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card',
        'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
        'sm:data-[state=open]:slide-in-from-bottom-2 sm:data-[state=closed]:slide-out-to-bottom-2',
        className,
      )}
      {...props}
    >
      {/* Grab handle. Purely affordance — the sheet is not draggable, but
          its presence tells a thumb where the top of the panel is. */}
      <div aria-hidden className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-pill bg-ink-faint/30 sm:hidden" />

      <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5 sm:pt-6">
        <div className="min-w-0">
          <DialogPrimitive.Title className="truncate font-display text-2xl leading-tight text-ink">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>

        <DialogPrimitive.Close
          className={cn(
            'tactile grid h-9 w-9 shrink-0 place-items-center rounded-well bg-surface-sunken text-ink-soft',
            'shadow-well transition-transform duration-150 ease-physical active:translate-y-[1.5px]',
            'hover:text-ink',
          )}
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
          <span className="sr-only">Tutup</span>
        </DialogPrimitive.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'
