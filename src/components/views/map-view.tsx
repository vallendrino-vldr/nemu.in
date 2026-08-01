'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import type { Map as LeafletMap, Marker } from 'leaflet'

import { Badge, Panel } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { LeadCard } from '@/components/lead-card'
import { useLeadStore, selectMappable } from '@/store/lead-store'
import { haptic } from '@/lib/haptics'
import type { ContactTierDb } from '@/lib/database.types'

/**
 * Leads plotted on a real map.
 *
 * Leaflet is loaded dynamically on first render of this tab, not at page
 * load: it is ~40 kB of JavaScript plus a stylesheet that most sessions
 * never open, and shipping it in the initial bundle would slow down the
 * one screen everybody does see.
 *
 * Tiles come from CARTO's OpenStreetMap basemaps, swapped between
 * `light_all` and `dark_all` so the map belongs to the theme instead of
 * glowing white in a dark room. Free for non-commercial use, and the
 * service worker caches tiles so panning does not re-download them.
 */

const TIER_COLOR: Record<ContactTierDb, string> = {
  whatsapp: 'hsl(158 64% 38%)',
  phone: 'hsl(26 92% 51%)',
  visit: 'hsl(30 7% 47%)',
  served: 'hsl(3 78% 53%)',
}

/** Indonesia, when there is nothing to fit the view to yet. */
const FALLBACK_CENTER: [number, number] = [-2.2, 118]

export function MapView() {
  const t = useTranslations('map')
  const { resolvedTheme } = useTheme()

  const leads = useLeadStore(selectMappable)
  const focused = useLeadStore((state) => state.focused)
  const focus = useLeadStore((state) => state.focus)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<LeafletMap | null>(null)
  const markersRef = React.useRef<Marker[]>([])
  const tileRef = React.useRef<ReturnType<typeof import('leaflet').tileLayer> | null>(null)

  const [ready, setReady] = React.useState(false)
  const isDark = resolvedTheme === 'dark'

  const selected = React.useMemo(
    () => leads.find((lead) => lead.id === focused) ?? null,
    [leads, focused],
  )

  // ── Boot the map once ─────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false

    const boot = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        center: FALLBACK_CENTER,
        zoom: 5,
        zoomControl: false,
        attributionControl: true,
        // Canvas rendering keeps hundreds of pins at one draw call rather
        // than hundreds of DOM nodes — the difference between a map that
        // pans smoothly on a mid-range phone and one that stutters.
        preferCanvas: true,
      })

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      mapRef.current = map
      setReady(true)
    }

    void boot()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current = []
      tileRef.current = null
    }
  }, [])

  // ── Theme-aware tiles ─────────────────────────────────────────────
  React.useEffect(() => {
    if (!ready || !mapRef.current) return

    const apply = async () => {
      const L = (await import('leaflet')).default
      const map = mapRef.current
      if (!map) return

      tileRef.current?.remove()
      tileRef.current = L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/${isDark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`,
        {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
        },
      ).addTo(map)
    }

    void apply()
  }, [ready, isDark])

  // ── Markers follow the store ──────────────────────────────────────
  React.useEffect(() => {
    if (!ready || !mapRef.current) return

    const draw = async () => {
      const L = (await import('leaflet')).default
      const map = mapRef.current
      if (!map) return

      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []

      if (leads.length === 0) {
        map.setView(FALLBACK_CENTER, 5)
        return
      }

      for (const lead of leads) {
        const color = TIER_COLOR[lead.contact_tier]
        const marker = L.circleMarker([lead.lat, lead.lng], {
          radius: lead.contact_tier === 'whatsapp' ? 9 : 7,
          color: '#fff',
          weight: 2,
          fillColor: color,
          fillOpacity: 0.92,
        })
          .addTo(map)
          .on('click', () => {
            haptic('tap')
            focus(lead.id)
          })

        marker.bindTooltip(lead.name, { direction: 'top', offset: [0, -8] })
        markersRef.current.push(marker as unknown as Marker)
      }

      // Frame every pin with room to spare, capped so a single lead does
      // not zoom to street level.
      const bounds = L.latLngBounds(leads.map((lead) => [lead.lat, lead.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 })
    }

    void draw()
  }, [ready, leads, focus])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="opportunity">
          <Dot color={TIER_COLOR.whatsapp} /> {t('legendWhatsapp')}
        </Badge>
        <Badge tone="warning">
          <Dot color={TIER_COLOR.phone} /> {t('legendPhone')}
        </Badge>
        <Badge tone="neutral">
          <Dot color={TIER_COLOR.visit} /> {t('legendVisit')}
        </Badge>
      </div>

      <Panel tone="raised" pad="none" className="overflow-hidden">
        <div
          ref={containerRef}
          className="h-[52vh] min-h-[300px] w-full bg-surface-sunken"
          // Leaflet paints into this node directly; isolating it keeps its
          // internal transforms from fighting the shell's animations.
          style={{ isolation: 'isolate' }}
        />
      </Panel>

      {leads.length === 0 ? (
        <Panel pad="lg" className="text-center">
          <p className="text-[0.875rem] font-semibold text-ink">{t('emptyTitle')}</p>
          <p className="mx-auto mt-1.5 max-w-xs text-[0.8125rem] leading-relaxed text-ink-soft">
            {t('emptyBody')}
          </p>
        </Panel>
      ) : null}

      {selected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="overline">{t('selected')}</p>
            <Button variant="ghost" size="sm" onClick={() => focus(null)}>
              {t('clear')}
            </Button>
          </div>
          <LeadCard lead={selected} />
        </div>
      ) : null}
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return <span className="h-2 w-2 rounded-full" style={{ background: color }} />
}
