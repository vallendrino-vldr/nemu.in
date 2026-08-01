'use client'

import * as React from 'react'
import createGlobe from 'cobe'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

/**
 * The archipelago, held still.
 *
 * Most globe components on the internet spin forever, which says
 * "generic tech company". This one is pinned to Indonesia and only
 * breathes. You can drag it, and it springs back — the product is about
 * one country, and the globe should behave like it knows that.
 *
 * ~5 kB of WebGL, no texture files, no CDN. Renders on the client only.
 */

const INDONESIA = { lat: -2.2, lng: 118.0 }

/** cobe's own convention for pointing a lat/lng at the viewer. */
function focusAngles(lat: number, lng: number): [number, number] {
  return [Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180]
}

const CITY_MARKERS: Array<{ location: [number, number]; size: number }> = [
  { location: [-6.2088, 106.8456], size: 0.09 }, // Jakarta
  { location: [-7.2575, 112.7521], size: 0.06 }, // Surabaya
  { location: [-6.9175, 107.6191], size: 0.06 }, // Bandung
  { location: [-7.7956, 110.3695], size: 0.05 }, // Yogyakarta
  { location: [3.5952, 98.6722], size: 0.05 }, // Medan
  { location: [-5.1477, 119.4327], size: 0.045 }, // Makassar
  { location: [-8.6705, 115.2126], size: 0.04 }, // Denpasar
  { location: [-0.5022, 117.1536], size: 0.035 }, // Samarinda
]

export function Globe({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Drag state kept in refs: touching React state at 60fps would re-render
  // the whole hero on every pointer move.
  const pointerDownAt = React.useRef<number | null>(null)
  const dragOffset = React.useRef(0)
  const renderedOffset = React.useRef(0)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (!mounted || !canvasRef.current) return

    const canvas = canvasRef.current
    const isDark = resolvedTheme === 'dark'
    const [basePhi, baseTheta] = focusAngles(INDONESIA.lat, INDONESIA.lng)

    let width = 0
    let frame = 0

    const measure = () => {
      width = canvas.offsetWidth
    }
    measure()
    window.addEventListener('resize', measure)

    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      width: width * 2,
      height: width * 2,
      phi: basePhi,
      theta: baseTheta,
      dark: isDark ? 1 : 0,
      diffuse: isDark ? 1.35 : 1.15,
      mapSamples: 15_000,
      mapBrightness: isDark ? 5.2 : 8.4,
      baseColor: isDark ? [0.16, 0.14, 0.13] : [0.93, 0.9, 0.86],
      markerColor: [0.98, 0.55, 0.16],
      glowColor: isDark ? [0.28, 0.22, 0.18] : [0.99, 0.94, 0.88],
      opacity: 0.96,
      markers: CITY_MARKERS,
      onRender: (state) => {
        frame += 1
        // Ease the dragged offset back toward zero: the globe always
        // returns home rather than drifting off into the Atlantic.
        renderedOffset.current += (dragOffset.current - renderedOffset.current) * 0.09
        if (pointerDownAt.current === null) dragOffset.current *= 0.94

        // A slow lateral breath so it never looks like a frozen image.
        const breath = Math.sin(frame / 340) * 0.045

        state.phi = basePhi + renderedOffset.current + breath
        state.theta = baseTheta + Math.cos(frame / 420) * 0.02
        state.width = width * 2
        state.height = width * 2
      },
    })

    // Fade in only once WebGL has actually painted something.
    const reveal = window.setTimeout(() => {
      canvas.style.opacity = '1'
    }, 90)

    return () => {
      globe.destroy()
      window.clearTimeout(reveal)
      window.removeEventListener('resize', measure)
    }
  }, [mounted, resolvedTheme])

  return (
    // The clipping fix: the bloom below is intentionally larger than the
    // sphere, and on a narrow screen that overflow was pushing past the
    // viewport and getting sliced by the page edge. Clipping it here
    // keeps the glow but never lets it escape the column.
    <div className={cn('relative isolate w-full overflow-hidden', className)}>
      <div className="relative mx-auto aspect-square w-full max-w-[min(88vw,26rem)]">
        {/* Warm bloom behind the sphere so it sits in the scene rather than on it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[-12%] animate-aurora-drift rounded-full bg-hearth blur-2xl"
        />
        <canvas
          ref={canvasRef}
          aria-label="Peta Indonesia"
          role="img"
          className="relative h-full w-full cursor-grab opacity-0 transition-opacity duration-700 ease-settle active:cursor-grabbing"
          style={{ contain: 'layout paint size', touchAction: 'pan-y' }}
          onPointerDown={(event) => {
            pointerDownAt.current = event.clientX - dragOffset.current * 220
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerUp={() => {
            pointerDownAt.current = null
          }}
          onPointerCancel={() => {
            pointerDownAt.current = null
          }}
          onPointerMove={(event) => {
            if (pointerDownAt.current === null) return
            dragOffset.current = (event.clientX - pointerDownAt.current) / 220
          }}
        />
      </div>
    </div>
  )
}
