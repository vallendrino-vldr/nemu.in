'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * The small structural pieces. Grouped in one file because each is under
 * twenty lines and splitting them across seven files would be filing, not
 * architecture.
 */

// ── Panel ───────────────────────────────────────────────────────────

const panelVariants = cva('relative', {
  variants: {
    tone: {
      raised: 'surface-relief',
      sunken: 'surface-well',
      flat: 'rounded-card bg-surface shadow-hairline',
      glass:
        'rounded-card border border-white/10 bg-surface-raised/70 shadow-relief backdrop-blur-xl backdrop-saturate-150',
    },
    pad: { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' },
  },
  defaultVariants: { tone: 'raised', pad: 'md' },
})

export interface PanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof panelVariants> {}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, tone, pad, ...props }, ref) => (
    <div ref={ref} className={cn(panelVariants({ tone, pad }), className)} {...props} />
  ),
)
Panel.displayName = 'Panel'

// ── Field ───────────────────────────────────────────────────────────
// Inputs are carved *into* the surface, never raised out of it. That
// inversion is what separates a control you press from a slot you fill.

export const Field = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full rounded-well bg-surface-sunken px-4 text-sm text-ink shadow-well',
        'placeholder:text-ink-faint',
        'transition-shadow duration-200 ease-settle',
        'focus:outline-none focus-visible:shadow-[var(--shadow-well),0_0_0_2px_hsl(26_92%_51%/0.5)]',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Field.displayName = 'Field'

// ── Badge ───────────────────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[0.6875rem] font-semibold leading-none tracking-[0.01em]',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-sunken text-ink-soft shadow-hairline',
        opportunity: 'bg-pandan-500/14 text-pandan-700 dark:text-pandan-300',
        warning: 'bg-ember-500/16 text-ember-700 dark:text-ember-300',
        danger: 'bg-sambal-500/14 text-sambal-700 dark:text-sambal-300',
        ai: 'bg-nila-500/14 text-nila-700 dark:text-nila-300',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

// ── Skeleton ────────────────────────────────────────────────────────

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shimmer-track rounded-chip', className)} {...props} />
}

// ── Section heading ─────────────────────────────────────────────────

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('overline', className)} {...props} />
}
