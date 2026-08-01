# Shared UI primitives — `src/components/ui/`

Custom CVA-based primitives. No shadcn, no MUI. Radix is used only for `Slot` and `Dialog`.

---

## Button — `src/components/ui/button.tsx`

Variants `primary | surface | sunken | ghost | danger | ai`, sizes `sm | md | lg | icon | pill`.
Props: `asChild`, `loading`, `feedback` (haptic intent, `null` to silence).
The press is three simultaneous things: relief→pressed shadow swap, 1.5px translate, sheen strip fading out. Remove any one and it reads as a coloured rectangle.

```tsx
const buttonVariants = cva(
  [
    'tactile relative inline-flex select-none items-center justify-center gap-2',
    'font-semibold tracking-[-0.01em] whitespace-nowrap',
    'transition-[transform,box-shadow,background-color,color] duration-150 ease-physical',
    'disabled:pointer-events-none disabled:opacity-45 disabled:saturate-50',
    'active:translate-y-[1.5px]',
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]',
    'before:bg-brushed before:opacity-100 active:before:opacity-0',
    'before:transition-opacity before:duration-150',
  ],
  {
    variants: {
      variant: {
        primary: ['bg-gradient-to-b from-ember-400 to-ember-600 text-white',
                  'shadow-ember-relief active:shadow-ember-pressed',
                  'hover:from-ember-300 hover:to-ember-500'],
        surface: ['bg-gradient-to-b from-surface-raised to-surface text-ink',
                  'shadow-relief active:shadow-pressed', 'hover:brightness-[1.03]'],
        sunken:  ['bg-surface-sunken text-ink-soft shadow-well',
                  'hover:text-ink active:shadow-pressed'],
        ghost:   ['bg-transparent text-ink-soft shadow-none before:hidden',
                  'hover:bg-surface-sunken hover:text-ink active:translate-y-0'],
        danger:  ['bg-gradient-to-b from-sambal-300 to-sambal-500 text-white',
                  'shadow-relief active:shadow-pressed'],
        ai:      ['bg-gradient-to-b from-nila-300 to-nila-500 text-white',
                  'shadow-relief active:shadow-pressed'],
      },
      size: {
        sm:   'h-9 rounded-chip px-3.5 text-[0.8125rem]',
        md:   'h-11 rounded-well px-5 text-sm',
        lg:   'h-14 rounded-well px-7 text-base',
        icon: 'h-11 w-11 rounded-well',
        pill: 'h-12 rounded-pill px-7 text-sm',
      },
    },
    defaultVariants: { variant: 'surface', size: 'md' },
  },
)
```

---

## Panel / Field / Badge / Skeleton / Eyebrow — `src/components/ui/primitives.tsx`

```tsx
const panelVariants = cva('relative', {
  variants: {
    tone: {
      raised: 'surface-relief',
      sunken: 'surface-well',
      flat:   'rounded-card bg-surface shadow-hairline',
      glass:  'rounded-card border border-white/10 bg-surface-raised/70 shadow-relief backdrop-blur-xl backdrop-saturate-150',
    },
    pad: { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' },
  },
  defaultVariants: { tone: 'raised', pad: 'md' },
})

// Inputs are carved INTO the surface, never raised out of it. That
// inversion separates a control you press from a slot you fill.
export const Field = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(
      'h-12 w-full rounded-well bg-surface-sunken px-4 text-sm text-ink shadow-well',
      'placeholder:text-ink-faint',
      'transition-shadow duration-200 ease-settle',
      'focus:outline-none focus-visible:shadow-[var(--shadow-well),0_0_0_2px_hsl(26_92%_51%/0.5)]',
      'disabled:opacity-50', className)} {...props} />
  ),
)

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[0.6875rem] font-semibold leading-none tracking-[0.01em]',
  { variants: { tone: {
      neutral:     'bg-surface-sunken text-ink-soft shadow-hairline',
      opportunity: 'bg-pandan-500/14 text-pandan-700 dark:text-pandan-300',
      warning:     'bg-ember-500/16 text-ember-700 dark:text-ember-300',
      danger:      'bg-sambal-500/14 text-sambal-700 dark:text-sambal-300',
      ai:          'bg-nila-500/14 text-nila-700 dark:text-nila-300',
  } }, defaultVariants: { tone: 'neutral' } },
)

export function Skeleton({ className, ...props }) {
  return <div className={cn('shimmer-track rounded-chip', className)} {...props} />
}
export function Eyebrow({ className, ...props }) {
  return <p className={cn('overline', className)} {...props} />
}
```

---

## Sheet — `src/components/ui/sheet.tsx`

Radix Dialog dressed as a bottom sheet on mobile / side panel on desktop. Used by the Ghost Site preview.

---

## SafeWidget — `src/components/safe-widget.tsx`

**Load-bearing blast door.** Any decorative component (WebGL globe, sonar radar, credit meter, map) is wrapped in it. A hardened browser refusing WebGL or a third-party WebSocket must cost the widget, never the page. Historically an unwrapped throw painted the global error screen over a perfectly healthy server render.

---

## CreditMeter — `src/components/credit-meter.tsx`

Glowing pill in the header. Subscribed to the user's own `profiles` row over Supabase Realtime, so a God Mode injection lands mid-session with no refresh. Shows `∞` for `super_admin`. Realtime failure is swallowed — the number still renders.

```tsx
'group relative inline-flex select-none items-center gap-2 rounded-pill py-2 pl-3 pr-4',
'border border-white/12 bg-surface-raised/60 shadow-relief backdrop-blur-xl backdrop-saturate-150',
'transition-shadow duration-300 ease-settle',
!depleted && 'hover:shadow-ember-glow',
// plus an inner animate-ember-breathe radial-gradient glow ring
```

---

## LeadCard — `src/components/lead-card.tsx`

The product's real unit. Raised panel, no padding, `overflow-hidden`, containing:
1. Body row — 56px `ScoreDial` (SVG ring, colour keyed to score: ≥70 pandan, ≥45 ember, else sambal) + name + `category · area` + tier/rating/website badges + optional AI verdict quote with a `border-l-2 border-nila-500/40` rule.
2. Action rail — **sunken** strip (`bg-surface-sunken shadow-well`) so it reads as a separate machined part: Score (ai), Pitch (primary), Deep audit, Ghost Site, Open Maps, Delete (arms on first tap, 3s window).
3. Generated pitch — height-animated reveal, message in a `surface-well`, then WhatsApp/Call + Copy.

Each paid button carries a `CostTag` — a mono pill showing the credit price, `bg-black/12 dark:bg-white/12`.
