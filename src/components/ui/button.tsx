'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { haptic, type HapticIntent } from '@/lib/haptics'

/**
 * The press is the whole point.
 *
 * A real button has three states you can feel: at rest it catches light on
 * its top edge; under a finger it sinks and the highlight flips to the
 * bottom; released, it overshoots slightly on the way back up. That is
 * what `shadow-relief → shadow-pressed`, the 1px translate, and the
 * `ease-physical` curve are reproducing. Remove any one of the three and
 * it immediately reads as a coloured rectangle again.
 */
const buttonVariants = cva(
  [
    'tactile relative inline-flex select-none items-center justify-center gap-2',
    'font-semibold tracking-[-0.01em] whitespace-nowrap',
    'transition-[transform,box-shadow,background-color,color] duration-150 ease-physical',
    'disabled:pointer-events-none disabled:opacity-45 disabled:saturate-50',
    'active:translate-y-[1.5px]',
    // The sheen strip. Sits above the fill, below the label.
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]',
    'before:bg-brushed before:opacity-100 active:before:opacity-0',
    'before:transition-opacity before:duration-150',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-gradient-to-b from-ember-400 to-ember-600 text-white',
          'shadow-ember-relief active:shadow-ember-pressed',
          'hover:from-ember-300 hover:to-ember-500',
        ],
        surface: [
          'bg-gradient-to-b from-surface-raised to-surface text-ink',
          'shadow-relief active:shadow-pressed',
          'hover:brightness-[1.03]',
        ],
        sunken: [
          'bg-surface-sunken text-ink-soft shadow-well',
          'hover:text-ink active:shadow-pressed',
        ],
        ghost: [
          'bg-transparent text-ink-soft shadow-none before:hidden',
          'hover:bg-surface-sunken hover:text-ink active:translate-y-0',
        ],
        danger: [
          'bg-gradient-to-b from-sambal-300 to-sambal-500 text-white',
          'shadow-relief active:shadow-pressed',
        ],
        ai: [
          'bg-gradient-to-b from-nila-300 to-nila-500 text-white',
          'shadow-relief active:shadow-pressed',
        ],
      },
      size: {
        sm: 'h-9 rounded-chip px-3.5 text-[0.8125rem]',
        md: 'h-11 rounded-well px-5 text-sm',
        lg: 'h-14 rounded-well px-7 text-base',
        icon: 'h-11 w-11 rounded-well',
        pill: 'h-12 rounded-pill px-7 text-sm',
      },
    },
    defaultVariants: { variant: 'surface', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  /** Vibration pattern fired on press. Set to null to stay silent. */
  feedback?: HapticIntent | null
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild, loading, feedback = 'tap', children, onClick, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (feedback) haptic(feedback)
        onClick?.(event)
      },
      [feedback, onClick],
    )

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        onClick={handleClick}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span className="opacity-90">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
