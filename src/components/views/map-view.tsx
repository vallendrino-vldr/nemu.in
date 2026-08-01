'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl'

import { Badge, Panel } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { LeadCard } from '@/components/lead-card'
import { useLeadStore, selectMappable } from '@/store/lead-store'
import { haptic } from '@/lib/haptics'
import type { ContactTierDb, Lead } from '@/lib/database.types'

/**
 * Leads on a real vector map.
 *
 * WHY MAPBOX AND NOT RASTER TILES
 * ───────────────────────────────
 * Vector tiles render at any zoom without the blur of scaled bitmaps,
 * and — the part that matters here — every layer's paint can be
 * rewritten at runtime. That is what lets the map wear this app's own
 * palette instead of looking like a generic map someone embedded.
 *
 * The whole library is ~230 kB, so it is imported dynamically on first
 * open of this tab. Most sessions never come here and should not pay
 * for it.
 *
 * Pins are one GeoJSON source with clustering rather than N marker
 * elements: a sweep can return 300 leads, and 300 absolutely-positioned
 * DOM nodes re-projected on every frame is what makes a map stutter on
 * a mid-range phone.
 */

const TIER_COLOR: Record<ContactTierDb, string> = {
  whatsapp: 'hsl(158 64% 38%)',
  phone: 'hsl(26 92% 51%)',
  visit: 'hsl(30 7% 47%)',
  served: 'hsl(3 78% 53%)',
}

const SOURCE = 'leads'
const FALLBACK: [number, number] = [118, -2.2] // Indonesia, lng/lat

/**
 * Layers whose colour we override so the basemap reads as part of the
 * app. Mapbox's own ids are stable across style versions; anything not
 * present is skipped rather than throwing.
 */
const TINT: Record<'light' | 'dark', Array<[string, string, string]>> = {
  // [layer id, paint property, colour]
  light: [
    ['land', 'background-color', 'hsl(38 32% 95%)'],
    ['water', 'fill-color', 'hsl(200 30% 82%)'],
    ['landuse', 'fill-color', 'hsl(36 24% 91%)'],
    ['building', 'fill-color', 'hsl(32 18% 88%)'],
  ],
  dark: [
    ['land', 'background-color', 'hsl(24 14% 8%)'],
    ['water', 'fill-color', 'hsl(210 30% 14%)'],
    ['landuse', 'fill-color', 'hsl(24 12% 11%)'],
    ['building', 'fill-color', 'hsl(26 11% 14%)'],
  ],
}

export function MapView() {
  const t = useTranslations('map')
  const { resolvedTheme } = useTheme()

  const leads = useLeadStore(selectMappable)
  const focused = useLeadStore((state) => state.focused)
  const focus = useLeadStore((state) => state.focus)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<MapboxMap | null>(null)
  const [ready, setReady] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  const isDark = resolvedTheme === 'dark'
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const selected = React.useMemo(
    () => leads.find((lead) => lead.id === focused) ?? null,
    [leads, focused],
  )

  // Kept in a ref so the map's own event handlers always see the latest
  // list without the map having to be rebuilt when leads change.
  const leadsRef = React.useRef(leads)
  leadsRef.current = leads

  // ── Boot ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!token) {
      setFailed(true)
      return
    }

    let cancelled = false
    let instance: MapboxMap | null = null

    const boot = async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default
        if (cancelled || !containerRef.current) return

        mapboxgl.accessToken = token

        instance = new mapboxgl.Map({
          container: containerRef.current,
          style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
          center: FALLBACK,
          zoom: 3.6,
          attributionControl: false,
          // Pitch and rotate are lovely on desktop and a nuisance on a
          // phone, where a two-finger pan becomes an accidental tilt.
          pitchWithRotate: false,
          dragRotate: false,
          cooperativeGestures: false,
        })

        instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
        instance.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')

        instance.on('load', () => {
          if (cancelled || !instance) return
          applyTint(instance, isDark ? 'dark' : 'light')
          installLeadLayers(instance, () => leadsRef.current, focus)
          mapRef.current = instance
          setReady(true)
        })

        instance.on('error', () => setFailed(true))
      } catch {
        setFailed(true)
      }
    }

    void boot()

    return () => {
      cancelled = true
      instance?.remove()
      mapRef.current = null
      setReady(false)
    }
    // Theme is handled by a separate effect; rebuilding the map on every
    // toggle would lose the user's pan and zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // ── Theme swap without losing the viewport ────────────────────────
  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const mode = isDark ? 'dark' : 'light'
    map.setStyle(`mapbox://styles/mapbox/${mode}-v11`)
    map.once('styledata', () => {
      applyTint(map, mode)
      installLeadLayers(map, () => leadsRef.current, focus)
      pushLeads(map, leadsRef.current)
    })
  }, [isDark, ready, focus])

  // ── Data follows the store ────────────────────────────────────────
  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    pushLeads(map, leads)

    if (leads.length === 0) {
      map.easeTo({ center: FALLBACK, zoom: 3.6 })
      return
    }

    const lngs = leads.map((l) => l.lng)
    const lats = leads.map((l) => l.lat)
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 15, duration: 600 },
    )
  }, [leads, ready])

  if (failed) {
    return (
      <Panel pad="lg" className="text-center">
        <p className="text-[0.875rem] font-semibold text-ink">{t('unavailableTitle')}</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[0.8125rem] leading-relaxed text-ink-soft">
          {t('unavailableBody')}
        </p>
      </Panel>
    )
  }

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

// ── map helpers ──────────────────────────────────────────────────────

function applyTint(map: MapboxMap, mode: 'light' | 'dark') {
  for (const [layer, property, colour] of TINT[mode]) {
    // A style version can drop or rename a layer; that must never take
    // the whole map down with it.
    if (!map.getLayer(layer)) continue
    try {
      if (property === 'background-color') map.setPaintProperty(layer, 'background-color', colour)
      else if (property === 'fill-color') map.setPaintProperty(layer, 'fill-color', colour)
    } catch {
      /* layer exists but does not take this paint property — skip */
    }
  }
}

function toFeatureCollection(leads: Array<Lead & { lat: number; lng: number }>) {
  return {
    type: 'FeatureCollection' as const,
    features: leads.map((lead) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [lead.lng, lead.lat] },
      properties: {
        id: lead.id,
        name: lead.name,
        colour: TIER_COLOR[lead.contact_tier],
        // Numeric so the cluster layer can rank a cluster by its best lead.
        rank: lead.contact_tier === 'whatsapp' ? 3 : lead.contact_tier === 'phone' ? 2 : 1,
      },
    })),
  }
}

function pushLeads(map: MapboxMap, leads: Array<Lead & { lat: number; lng: number }>) {
  const source = map.getSource(SOURCE) as GeoJSONSource | undefined
  if (source) source.setData(toFeatureCollection(leads))
}

/**
 * Adds the source and the three layers. Idempotent, because a style swap
 * wipes them and they have to be reinstalled onto the new style.
 */
function installLeadLayers(
  map: MapboxMap,
  getLeads: () => Array<Lead & { lat: number; lng: number }>,
  onPick: (id: string) => void,
) {
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, {
      type: 'geojson',
      data: toFeatureCollection(getLeads()),
      cluster: true,
      clusterRadius: 46,
      clusterMaxZoom: 13,
      // Carries the best tier in a cluster up to the cluster itself, so a
      // group containing a WhatsApp-ready lead is visibly worth opening.
      clusterProperties: { best: ['max', ['get', 'rank']] },
    })
  }

  if (!map.getLayer('lead-clusters')) {
    map.addLayer({
      id: 'lead-clusters',
      type: 'circle',
      source: SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'case',
          ['>=', ['get', 'best'], 3],
          TIER_COLOR.whatsapp,
          ['>=', ['get', 'best'], 2],
          TIER_COLOR.phone,
          TIER_COLOR.visit,
        ],
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 40, 30],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    })
  }

  if (!map.getLayer('lead-cluster-count')) {
    map.addLayer({
      id: 'lead-cluster-count',
      type: 'symbol',
      source: SOURCE,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
      paint: { 'text-color': '#fff' },
    })
  }

  if (!map.getLayer('lead-points')) {
    map.addLayer({
      id: 'lead-points',
      type: 'circle',
      source: SOURCE,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'colour'],
        'circle-radius': ['case', ['>=', ['get', 'rank'], 3], 9, 7],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    })
  }

  // Tapping a pin selects it; tapping a cluster zooms into it.
  map.on('click', 'lead-points', (event) => {
    const props = (event.features?.[0] as { properties?: Record<string, unknown> } | undefined)
      ?.properties
    const id = props?.id
    if (typeof id === 'string') {
      haptic('tap')
      onPick(id)
    }
  })

  map.on('click', 'lead-clusters', (event) => {
    const feature = event.features?.[0] as
      | { properties?: Record<string, unknown>; geometry?: { coordinates?: number[] } }
      | undefined
    const clusterId = feature?.properties?.cluster_id
    const coordinates = feature?.geometry?.coordinates
    if (typeof clusterId !== 'number' || !coordinates) return

    haptic('tap')
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined
    // Mapbox GL v3 keeps the callback signature here rather than the
    // promise one the docs show for newer minor versions.
    source?.getClusterExpansionZoom(clusterId, (error, zoom) => {
      if (error || typeof zoom !== 'number') return
      map.easeTo({
        center: [coordinates[0]!, coordinates[1]!],
        zoom,
        duration: 450,
      })
    })
  })

  for (const layer of ['lead-points', 'lead-clusters']) {
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = ''
    })
  }
}

function Dot({ color }: { color: string }) {
  return <span className="h-2 w-2 rounded-full" style={{ background: color }} />
}
