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
  const [unsupported, setUnsupported] = React.useState(false)

  // Drag state kept in refs: touching React state at 60fps would re-render
  // the whole hero on every pointer move.
  const pointerDownAt = React.useRef<number | null>(null)
  const dragOffset = React.useRef(0)
  const renderedOffset = React.useRef(0)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (!mounted || !canvasRef.current) return

    const canvas = canvasRef.current

    // Brave and Firefox's strict modes can refuse a WebGL context as an
    // anti-fingerprinting measure. Asking first — and bailing to the CSS
    // fallback — is the difference between a missing ornament and a
    // white screen, because cobe throws if it cannot get a context.
    const probe =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext('webgl')
    if (!probe) {
      setUnsupported(true)
      return
    }

    const isDark = resolvedTheme === 'dark'
    const [basePhi, baseTheta] = focusAngles(INDONESIA.lat, INDONESIA.lng)

    let width = 0
    let frame = 0

    const measure = () => {
      width = canvas.offsetWidth
    }
    measure()
    window.addEventListener('resize', measure)

    let globe: ReturnType<typeof createGlobe>
    try {
      globe = createGlobe(canvas, {
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
    } catch (error) {
      // A refused or poisoned context surfaces here rather than as a
      // blank page. The CSS fallback below takes over.
      console.warn('[globe] WebGL unavailable:', (error as Error)?.message)
      setUnsupported(true)
      return
    }

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

        {unsupported ? <GlobeFallback /> : null}

        <canvas
          ref={canvasRef}
          aria-label="Peta Indonesia"
          role="img"
          className="relative h-full w-full cursor-grab opacity-0 transition-opacity duration-700 ease-settle active:cursor-grabbing"
          style={{
            contain: 'layout paint size',
            touchAction: 'pan-y',
            display: unsupported ? 'none' : undefined,
          }}
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

/**
 * What stands in when WebGL is refused — most often Brave with shields up.
 *
 * Pure CSS: a lit sphere with the same ember rim and the same city dots,
 * placed by the same coordinates as the real markers. It is not the globe,
 * but it is unmistakably the same object, and it cannot fail.
 */
function GlobeFallback() {
  const project = (lat: number, lng: number) => ({
    left: `${50 + ((lng - INDONESIA.lng) / 60) * 42}%`,
    top: `${50 - ((lat - INDONESIA.lat) / 60) * 42}%`,
  })

  return (
    <div aria-hidden className="absolute inset-0 grid place-items-center">
      <div className="relative h-[86%] w-[86%] rounded-full bg-[radial-gradient(circle_at_32%_26%,hsl(36_30%_28%),hsl(24_16%_9%)_62%)] shadow-[inset_0_-18px_44px_hsl(24_30%_4%/0.85),0_0_70px_-14px_hsl(26_92%_51%/0.42)] dark:bg-[radial-gradient(circle_at_32%_26%,hsl(30_18%_22%),hsl(24_18%_6%)_62%)]">
        {/* Grid lines, so it reads as a globe rather than a ball. */}
        <div className="absolute inset-0 overflow-hidden rounded-full opacity-30">
          {[22, 38, 50, 62, 78].map((top) => (
            <span
              key={top}
              className="absolute inset-x-0 border-t border-ember-300/40"
              style={{ top: `${top}%` }}
            />
          ))}
          {[26, 42, 58, 74].map((left) => (
            <span
              key={left}
              className="absolute inset-y-0 border-l border-ember-300/25"
              style={{ left: `${left}%` }}
            />
          ))}
        </div>

        {CITY_MARKERS.map((marker) => {
          const [lat, lng] = marker.location
          return (
            <span
              key={`${lat},${lng}`}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 animate-ember-breathe rounded-full bg-ember-400 shadow-[0_0_10px_2px_hsl(26_92%_51%/0.75)]"
              style={project(lat, lng)}
            />
          )
        })}

        {/* Specular highlight — the detail that makes it feel spherical. */}
        <div className="absolute left-[24%] top-[18%] h-[26%] w-[34%] rounded-full bg-white/10 blur-xl" />
      </div>
    </div>
  )
}
