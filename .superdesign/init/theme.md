# Theme — Nemu.in

Stack: Next.js 15 (App Router) · React 19 · Tailwind CSS 3 · framer-motion · next-intl · next-themes (class strategy).
Component library: custom (CVA + Radix Slot/Dialog). No shadcn.

## Part 1 — Compact token summary

### Structural colours (HSL triplets in CSS vars, consumed as `hsl(var(--x) / <alpha>)`)

| Token | Light | Dark |
|---|---|---|
| `--canvas` | `38 32% 95%` | `24 14% 6%` |
| `--surface` | `40 40% 98%` | `24 12% 9%` |
| `--surface-raised` | `0 0% 100%` | `26 11% 13%` |
| `--surface-sunken` | `36 24% 91%` | `24 16% 4%` |
| `--hairline` | `32 18% 85%` | `28 8% 20%` |
| `--ink` | `24 18% 11%` | `36 34% 95%` |
| `--ink-soft` | `24 9% 38%` | `32 10% 66%` |
| `--ink-faint` | `26 8% 56%` | `30 7% 47%` |
| `--sheen` | `0 0% 100%` | `36 44% 86%` |
| `--void` | `24 30% 10%` | `0 0% 0%` |

### Brand ramps (static, identical in both themes)

- **ember** (brand / primary CTA — heated copper): 50 `36 100% 96%`, 100 `36 96% 90%`, 200 `35 95% 80%`, 300 `33 94% 69%`, 400 `30 94% 59%`, **500 `26 92% 51%`**, 600 `21 88% 45%`, 700 `18 82% 37%`, 800 `16 74% 30%`, 900 `15 68% 24%`
- **pandan** (money in, deals closed): 100 `152 60% 90%`, 300 `156 52% 62%`, **500 `158 64% 38%`**, 700 `162 68% 25%`
- **nila** (anything AI touched): 100 `250 90% 94%`, 300 `250 84% 76%`, **500 `252 74% 60%`**, 700 `254 66% 43%`
- **sambal** (destructive / out of credit): 100 `4 90% 94%`, 300 `4 84% 72%`, **500 `3 78% 53%`**, 700 `2 72% 38%`

### Typography

- `font-sans` → Plus Jakarta Sans (`--font-jakarta`) — all UI text
- `font-display` → Instrument Serif (`--font-instrument`) — headings only
- `font-mono` → JetBrains Mono (`--font-mono`) — every number, always with `.tabular`
- Optical scale: `display-xl` `clamp(3rem,8vw,5.75rem)`/0.95/-0.035em · `display-lg` `clamp(2.25rem,5.5vw,3.75rem)`/1.0/-0.03em · `display-md` `clamp(1.75rem,3.5vw,2.5rem)`/1.08/-0.022em · `overline` 0.6875rem/1/0.18em uppercase

### Radii

`pill 999px` · `card 1.375rem` · `well 1rem` · `chip 0.75rem`. Nothing in this app is a 4px rectangle.

### Elevation — named physical states, not t-shirt sizes

Every elevation is one authored multi-layer shadow string; components never stack ad-hoc shadows.

- `shadow-relief` / `shadow-relief-lg` — sits on the canvas, catches light on its top edge
- `shadow-pressed` — pushed in under a finger (highlight flips to the bottom)
- `shadow-well` — carved into a panel (inputs, code blocks, empty slots)
- `shadow-floating` — modal / sheet
- `shadow-ember-relief` / `shadow-ember-pressed` / `shadow-ember-glow` — the same three states, lit from inside by the brand colour
- `shadow-hairline` — 1px ring, used instead of `border`

The highlight/shadow ratio **inverts between themes**: light mode is lit from directly above (crisp white top highlight), dark mode has no ambient light so the highlight drops to a whisper and the shadows do the lifting.

### Motion

- `ease-physical` `cubic-bezier(0.34,1.4,0.5,1)` — heavy objects overshoot and settle
- `ease-settle` `cubic-bezier(0.16,1,0.3,1)` — expo-out, everything else
- Keyframes: `sonar-ping`, `sonar-sweep`, `credit-drain`, `credit-gain`, `counter-pop`, `shimmer`, `aurora-drift`, `ember-breathe`
- Press interaction: `active:translate-y-[1.5px]` + relief→pressed shadow swap + sheen strip fading to 0
- `prefers-reduced-motion` is globally honoured in `globals.css`

### Textures — POLICY: no image assets ship with this app

Grain, sheen and glow are all CSS/SVG-data-URI generated.

- `bg-grain` — inline SVG `feTurbulence` fractal noise, applied full-viewport via `body::before` at `mix-blend-mode: soft-light`, opacity 0.5 light / 0.34 dark. This is the single detail that stops flat colour fields reading as "generated in a browser".
- `bg-brushed` — vertical sheen on a machined control
- `bg-hearth` — warm radial bloom behind hero content

### Breakpoints

Tailwind defaults. Container centred, padding 1.25rem / 2rem at lg, max 1320px at 2xl. The app shell itself is mobile-first and **not** a scrolling document: `100dvh`, single scrolling column, tab bar inside `env(safe-area-inset-bottom)`.

## Part 2 — Raw source

### `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.25rem', lg: '2rem' },
      screens: { '2xl': '1320px' },
    },
    extend: {
      colors: {
        canvas: 'hsl(var(--canvas) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        'surface-raised': 'hsl(var(--surface-raised) / <alpha-value>)',
        'surface-sunken': 'hsl(var(--surface-sunken) / <alpha-value>)',
        hairline: 'hsl(var(--hairline) / <alpha-value>)',
        ink: 'hsl(var(--ink) / <alpha-value>)',
        'ink-soft': 'hsl(var(--ink-soft) / <alpha-value>)',
        'ink-faint': 'hsl(var(--ink-faint) / <alpha-value>)',
        ember: {
          50: 'hsl(36 100% 96% / <alpha-value>)', 100: 'hsl(36 96% 90% / <alpha-value>)',
          200: 'hsl(35 95% 80% / <alpha-value>)', 300: 'hsl(33 94% 69% / <alpha-value>)',
          400: 'hsl(30 94% 59% / <alpha-value>)', 500: 'hsl(26 92% 51% / <alpha-value>)',
          600: 'hsl(21 88% 45% / <alpha-value>)', 700: 'hsl(18 82% 37% / <alpha-value>)',
          800: 'hsl(16 74% 30% / <alpha-value>)', 900: 'hsl(15 68% 24% / <alpha-value>)',
        },
        pandan: { 100: 'hsl(152 60% 90% / <alpha-value>)', 300: 'hsl(156 52% 62% / <alpha-value>)', 500: 'hsl(158 64% 38% / <alpha-value>)', 700: 'hsl(162 68% 25% / <alpha-value>)' },
        nila:   { 100: 'hsl(250 90% 94% / <alpha-value>)', 300: 'hsl(250 84% 76% / <alpha-value>)', 500: 'hsl(252 74% 60% / <alpha-value>)', 700: 'hsl(254 66% 43% / <alpha-value>)' },
        sambal: { 100: 'hsl(4 90% 94% / <alpha-value>)',  300: 'hsl(4 84% 72% / <alpha-value>)',  500: 'hsl(3 78% 53% / <alpha-value>)',  700: 'hsl(2 72% 38% / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-instrument)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(3rem, 8vw, 5.75rem)', { lineHeight: '0.95', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(2.25rem, 5.5vw, 3.75rem)', { lineHeight: '1.0', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.75rem, 3.5vw, 2.5rem)', { lineHeight: '1.08', letterSpacing: '-0.022em' }],
        overline: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.18em' }],
      },
      borderRadius: { pill: '999px', card: '1.375rem', well: '1rem', chip: '0.75rem' },
      boxShadow: {
        relief: 'var(--shadow-relief)', 'relief-lg': 'var(--shadow-relief-lg)',
        pressed: 'var(--shadow-pressed)', well: 'var(--shadow-well)',
        floating: 'var(--shadow-floating)', 'ember-glow': 'var(--shadow-ember-glow)',
        'ember-relief': 'var(--shadow-ember-relief)', 'ember-pressed': 'var(--shadow-ember-pressed)',
        hairline: 'var(--shadow-hairline)',
      },
      transitionTimingFunction: {
        physical: 'cubic-bezier(0.34, 1.4, 0.5, 1)',
        settle: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [animate],
}
export default config
```

### `src/app/globals.css` — `:root` and `.dark` blocks

```css
:root {
  --canvas: 38 32% 95%; --surface: 40 40% 98%; --surface-raised: 0 0% 100%;
  --surface-sunken: 36 24% 91%; --hairline: 32 18% 85%;
  --ink: 24 18% 11%; --ink-soft: 24 9% 38%; --ink-faint: 26 8% 56%;
  --sheen: 0 0% 100%; --void: 24 30% 10%;

  --shadow-hairline: 0 0 0 1px hsl(var(--void) / 0.07);
  --shadow-relief:
    inset 0 1px 0 0 hsl(var(--sheen) / 0.95),
    inset 0 -1px 1px 0 hsl(var(--void) / 0.05),
    0 1px 1.5px -0.5px hsl(var(--void) / 0.09),
    0 3px 6px -1.5px hsl(var(--void) / 0.08),
    0 8px 18px -5px hsl(var(--void) / 0.09);
  --shadow-pressed:
    inset 0 2px 4px 0 hsl(var(--void) / 0.14),
    inset 0 1px 1px 0 hsl(var(--void) / 0.10),
    inset 0 -1px 0 0 hsl(var(--sheen) / 0.55),
    0 1px 0 0 hsl(var(--sheen) / 0.6);
  --shadow-well:
    inset 0 2px 5px -1px hsl(var(--void) / 0.13),
    inset 0 1px 1px 0 hsl(var(--void) / 0.07),
    0 1px 0 0 hsl(var(--sheen) / 0.85);
  --shadow-ember-relief:
    inset 0 1px 0 0 hsl(36 100% 78% / 0.9),
    inset 0 -2px 2px 0 hsl(16 74% 26% / 0.4),
    0 1px 2px 0 hsl(18 82% 30% / 0.28),
    0 6px 14px -4px hsl(22 88% 42% / 0.42),
    0 14px 30px -12px hsl(22 88% 42% / 0.45);
  --shadow-ember-glow: 0 0 0 1px hsl(26 92% 51% / 0.35), 0 0 28px -4px hsl(26 92% 51% / 0.5);
  --grain-opacity: 0.5;
}

.dark {
  --canvas: 24 14% 6%; --surface: 24 12% 9%; --surface-raised: 26 11% 13%;
  --surface-sunken: 24 16% 4%; --hairline: 28 8% 20%;
  --ink: 36 34% 95%; --ink-soft: 32 10% 66%; --ink-faint: 30 7% 47%;
  --sheen: 36 44% 86%; --void: 0 0% 0%;

  --shadow-relief:
    inset 0 1px 0 0 hsl(var(--sheen) / 0.10),
    inset 0 -1px 1px 0 hsl(var(--void) / 0.5),
    0 1px 2px 0 hsl(var(--void) / 0.6),
    0 5px 14px -4px hsl(var(--void) / 0.6),
    0 14px 32px -12px hsl(var(--void) / 0.7);
  --shadow-well:
    inset 0 2px 6px -1px hsl(var(--void) / 0.75),
    inset 0 1px 2px 0 hsl(var(--void) / 0.5),
    0 1px 0 0 hsl(var(--sheen) / 0.07);
  --shadow-ember-glow: 0 0 0 1px hsl(26 92% 51% / 0.45), 0 0 36px -4px hsl(26 92% 51% / 0.65);
  --grain-opacity: 0.34;
}
```

### Component-layer helpers

```css
.surface-relief { @apply rounded-card bg-surface-raised bg-brushed shadow-relief; }
.surface-well   { @apply rounded-well bg-surface-sunken shadow-well; }
.overline       { @apply text-overline font-semibold uppercase text-ink-faint; }
.shimmer-track  { @apply relative overflow-hidden bg-surface-sunken; }  /* ::after sweeps a light band */
.tabular        { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
.tactile        { will-change: transform, box-shadow; transform: translateZ(0); }
```
