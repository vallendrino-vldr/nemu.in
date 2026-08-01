import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

/**
 * Nemu.in design tokens.
 *
 * Two rules govern this file:
 *
 * 1. Every colour is an HSL channel triplet held in a CSS variable so that
 *    `bg-ember-500/40` still resolves alpha correctly, and so the light and
 *    dark palettes swap without a single duplicated utility class.
 * 2. Every elevation is a *named physical state* (`relief`, `pressed`, `well`),
 *    not a t-shirt size. Skeuomorphism means a surface either catches light,
 *    is pushed in, or is carved out — there is no "shadow-md" in physics.
 *    The actual multi-layer shadow strings live in globals.css because the
 *    highlight/shadow ratio has to invert between themes.
 */
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
        /* Structural */
        canvas: 'hsl(var(--canvas) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        'surface-raised': 'hsl(var(--surface-raised) / <alpha-value>)',
        'surface-sunken': 'hsl(var(--surface-sunken) / <alpha-value>)',
        'surface-float': 'hsl(var(--surface-float) / <alpha-value>)',
        hairline: 'hsl(var(--hairline) / <alpha-value>)',
        ink: 'hsl(var(--ink) / <alpha-value>)',
        'ink-soft': 'hsl(var(--ink-soft) / <alpha-value>)',
        'ink-faint': 'hsl(var(--ink-faint) / <alpha-value>)',

        /* Accents that are safe to set as TEXT.
           The ember/nila/pandan/sambal ramps below stay as they are for
           fills, gradients and glows. These four swap per theme so a
           label never lands under 4.5:1 — use `text-ink-nila`, not
           `text-nila-500`, whenever the colour carries words. */
        'ink-ember': 'hsl(var(--ink-ember) / <alpha-value>)',
        'ink-nila': 'hsl(var(--ink-nila) / <alpha-value>)',
        'ink-pandan': 'hsl(var(--ink-pandan) / <alpha-value>)',
        'ink-sambal': 'hsl(var(--ink-sambal) / <alpha-value>)',

        /* Ember — the brand. Copper heated just past the point of glowing. */
        ember: {
          50: 'hsl(36 100% 96% / <alpha-value>)',
          100: 'hsl(36 96% 90% / <alpha-value>)',
          200: 'hsl(35 95% 80% / <alpha-value>)',
          300: 'hsl(33 94% 69% / <alpha-value>)',
          400: 'hsl(30 94% 59% / <alpha-value>)',
          500: 'hsl(26 92% 51% / <alpha-value>)',
          600: 'hsl(21 88% 45% / <alpha-value>)',
          700: 'hsl(18 82% 37% / <alpha-value>)',
          800: 'hsl(16 74% 30% / <alpha-value>)',
          900: 'hsl(15 68% 24% / <alpha-value>)',
        },
        /* Pandan — money in, deals closed. */
        pandan: {
          100: 'hsl(152 60% 90% / <alpha-value>)',
          300: 'hsl(156 52% 62% / <alpha-value>)',
          500: 'hsl(158 64% 38% / <alpha-value>)',
          700: 'hsl(162 68% 25% / <alpha-value>)',
        },
        /* Nila — anything the AI touched. */
        nila: {
          100: 'hsl(250 90% 94% / <alpha-value>)',
          300: 'hsl(250 84% 76% / <alpha-value>)',
          500: 'hsl(252 74% 60% / <alpha-value>)',
          700: 'hsl(254 66% 43% / <alpha-value>)',
        },
        /* Sambal — destructive, rejected, out of credit. */
        sambal: {
          100: 'hsl(4 90% 94% / <alpha-value>)',
          300: 'hsl(4 84% 72% / <alpha-value>)',
          500: 'hsl(3 78% 53% / <alpha-value>)',
          700: 'hsl(2 72% 38% / <alpha-value>)',
        },
      },

      fontFamily: {
        sans: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-instrument)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        /* Optical scale — display sizes get negative tracking so large serif
           headings don't read as airy at 72px. */
        'display-xl': ['clamp(3rem, 8vw, 5.75rem)', { lineHeight: '0.95', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(2.25rem, 5.5vw, 3.75rem)', { lineHeight: '1.0', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.75rem, 3.5vw, 2.5rem)', { lineHeight: '1.08', letterSpacing: '-0.022em' }],
        overline: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.18em' }],
      },

      borderRadius: {
        /* Squircle-adjacent. Nothing in this app is a 4px rectangle. */
        pill: '999px',
        card: '1.375rem',
        well: '1rem',
        chip: '0.75rem',
      },

      boxShadow: {
        relief: 'var(--shadow-relief)',
        'relief-lg': 'var(--shadow-relief-lg)',
        pressed: 'var(--shadow-pressed)',
        well: 'var(--shadow-well)',
        floating: 'var(--shadow-floating)',
        'ember-glow': 'var(--shadow-ember-glow)',
        'ember-relief': 'var(--shadow-ember-relief)',
        'ember-pressed': 'var(--shadow-ember-pressed)',
        'nila-glow': 'var(--shadow-nila-glow)',
        'nila-relief': 'var(--shadow-nila-relief)',
        hairline: 'var(--shadow-hairline)',
      },

      backgroundImage: {
        /* Generated grain. No image assets ship with this app, by policy. */
        grain:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)' opacity='0.5'/%3E%3C/svg%3E\")",
        /* The faint vertical sheen on a brushed metal control. */
        brushed:
          'linear-gradient(180deg, hsl(var(--sheen) / 0.14) 0%, hsl(var(--sheen) / 0.03) 42%, transparent 58%, hsl(var(--void) / 0.05) 100%)',
        /* Warm bloom behind hero content. */
        hearth:
          'radial-gradient(120% 88% at 50% -10%, hsl(26 92% 51% / 0.22) 0%, transparent 62%)',
      },

      keyframes: {
        /* The scraper's heartbeat. */
        'sonar-ping': {
          '0%': { transform: 'scale(0.35)', opacity: '0.75' },
          '70%': { opacity: '0.12' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'sonar-sweep': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        /* RPG damage number, but for your wallet. */
        'credit-drain': {
          '0%': { transform: 'translate3d(0,0,0) scale(0.7)', opacity: '0' },
          '18%': { transform: 'translate3d(0,-8px,0) scale(1.12)', opacity: '1' },
          '100%': { transform: 'translate3d(0,-62px,0) scale(0.92)', opacity: '0' },
        },
        'credit-gain': {
          '0%': { transform: 'translate3d(0,0,0) scale(0.7)', opacity: '0' },
          '18%': { transform: 'translate3d(0,8px,0) scale(1.14)', opacity: '1' },
          '100%': { transform: 'translate3d(0,58px,0) scale(0.92)', opacity: '0' },
        },
        'counter-pop': {
          '0%,100%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.16)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'aurora-drift': {
          '0%,100%': { transform: 'translate3d(-4%,0,0) scale(1)' },
          '50%': { transform: 'translate3d(4%,-3%,0) scale(1.08)' },
        },
        'ember-breathe': {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        /* The two ambient blobs. Deliberately different periods and paths
           so they never fall into lockstep — a light source that pulses
           in time with another one reads as an animation, not as a room. */
        'drift-a': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(8%,6%,0) scale(1.14)' },
        },
        'drift-b': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1.06)' },
          '50%': { transform: 'translate3d(-7%,-5%,0) scale(0.94)' },
        },
      },

      animation: {
        'sonar-ping': 'sonar-ping 2.6s cubic-bezier(0.16,1,0.3,1) infinite',
        'sonar-sweep': 'sonar-sweep 2.8s linear infinite',
        'credit-drain': 'credit-drain 1.1s cubic-bezier(0.22,1,0.36,1) forwards',
        'credit-gain': 'credit-gain 1.1s cubic-bezier(0.22,1,0.36,1) forwards',
        'counter-pop': 'counter-pop 380ms cubic-bezier(0.34,1.56,0.64,1)',
        shimmer: 'shimmer 1.9s infinite',
        'aurora-drift': 'aurora-drift 18s ease-in-out infinite',
        'ember-breathe': 'ember-breathe 3.4s ease-in-out infinite',
        'drift-a': 'drift-a 22s ease-in-out infinite',
        'drift-b': 'drift-b 29s ease-in-out infinite',
      },

      transitionTimingFunction: {
        /* Heavy objects don't ease-in-out. They overshoot and settle. */
        physical: 'cubic-bezier(0.34, 1.4, 0.5, 1)',
        settle: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [animate],
}

export default config
