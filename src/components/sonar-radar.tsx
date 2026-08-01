'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The scraping animation.
 *
 * A sweep arm, three expanding pings, and blips that fade in behind the
 * arm as it passes them — so the motion reads as *detecting* rather than
 * as a spinner with extra steps. Blip positions are deterministic (golden
 * angle, not Math.random) so the server and client agree and it never
 * flickers on hydration.
 */

const BLIP_COUNT = 7
const GOLDEN_ANGLE = 137.508

const BLIPS = Array.from({ length: BLIP_COUNT }, (_, index) => {
  const angle = (index * GOLDEN_ANGLE * Math.PI) / 180
  const radius = 0.22 + (index / BLIP_COUNT) * 0.26
  return {
    left: `${50 + Math.cos(angle) * radius * 100}%`,
    top: `${50 + Math.sin(angle) * radius * 100}%`,
    delay: `${(index * 2.8) / BLIP_COUNT}s`,
  }
})

export function SonarRadar({
  label,
  sublabel,
  className,
}: {
  label: string
  sublabel?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-6 py-10', className)} role="status" aria-live="polite">
      <div className="relative aspect-square w-56 sm:w-64">
        {/* Carved dish */}
        <div className="absolute inset-0 rounded-full bg-surface-sunken shadow-well" />

        {/* Range rings */}
        {[0.34, 0.62, 0.9].map((scale) => (
          <div
            key={scale}
            aria-hidden
            className="absolute rounded-full border border-ember-500/18"
            style={{
              inset: `${((1 - scale) / 2) * 100}%`,
            }}
          />
        ))}

        {/* Crosshair */}
        <div aria-hidden className="absolute left-1/2 top-[8%] h-[84%] w-px -translate-x-1/2 bg-ember-500/12" />
        <div aria-hidden className="absolute top-1/2 left-[8%] h-px w-[84%] -translate-y-1/2 bg-ember-500/12" />

        {/* Expanding pings */}
        {[0, 0.85, 1.7].map((delay) => (
          <div
            key={delay}
            aria-hidden
            className="absolute inset-0 animate-sonar-ping rounded-full border-2 border-ember-500/55"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}

        {/* Sweep arm — a conic wedge, so the trailing edge fades like phosphor */}
        <div
          aria-hidden
          className="absolute inset-0 animate-sonar-sweep rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, hsl(26 92% 51% / 0.42) 0deg, hsl(26 92% 51% / 0.12) 26deg, transparent 62deg, transparent 360deg)',
            maskImage: 'radial-gradient(circle, black 62%, transparent 71%)',
            WebkitMaskImage: 'radial-gradient(circle, black 62%, transparent 71%)',
          }}
        />

        {/* Detected blips */}
        {BLIPS.map((blip) => (
          <span
            key={blip.left + blip.top}
            aria-hidden
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 animate-ember-breathe rounded-full bg-ember-400 shadow-[0_0_10px_2px_hsl(26_92%_51%/0.7)]"
            style={{ left: blip.left, top: blip.top, animationDelay: blip.delay }}
          />
        ))}

        {/* Hub */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember-500 shadow-[0_0_16px_4px_hsl(26_92%_51%/0.6)]"
        />
      </div>

      <div className="max-w-xs text-center">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {sublabel ? <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-soft">{sublabel}</p> : null}
      </div>
    </div>
  )
}
