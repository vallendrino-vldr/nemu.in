'use client'

import { create } from 'zustand'
import type { Lead } from '@/lib/database.types'

/**
 * One list of leads, shared by every tab.
 *
 * Hunt writes into it, Leads reads it, Map plots it, and an AI score paid
 * for in one tab is visible in the others immediately.
 *
 * ── WHY THERE ARE NO ARRAY-RETURNING SELECTORS HERE ──
 * Zustand v5 subscribes through useSyncExternalStore, which requires the
 * snapshot a selector returns to be referentially stable. A selector
 * shaped like `state => state.leads.filter(...)` builds a fresh array on
 * every call, so React sees the store change on every render and loops
 * until it throws "Maximum update depth exceeded".
 *
 * That is not theoretical — it took down exactly the three tabs that used
 * such selectors (Archive, Account, Map) while Hunt and God Mode, which
 * do not, kept working. Derivation now happens in the components with
 * useMemo, and everything exported from here returns either raw state or
 * a primitive.
 */
interface LeadState {
  leads: Lead[]
  /** Which tier the Leads tab is filtered to; null means everything. */
  filter: Lead['contact_tier'] | null
  /** Lead the map has focused, so the card can open over the pin. */
  focused: string | null

  hydrate: (leads: Lead[]) => void
  /** New results on top, existing cards keep their paid-for AI fields. */
  merge: (incoming: Lead[]) => void
  patch: (id: string, changes: Partial<Lead>) => void
  remove: (ids: string[]) => void
  setFilter: (tier: Lead['contact_tier'] | null) => void
  focus: (id: string | null) => void
}

export const useLeadStore = create<LeadState>((set) => ({
  leads: [],
  filter: null,
  focused: null,

  hydrate: (leads) => set({ leads }),

  merge: (incoming) =>
    set((state) => {
      const arriving = new Map(incoming.map((lead) => [lead.id, lead]))
      // Anything already on screen keeps its position and its enriched
      // fields; only genuinely new leads are prepended.
      const kept = state.leads.map((lead) => arriving.get(lead.id) ?? lead)
      const keptIds = new Set(kept.map((lead) => lead.id))
      const fresh = incoming.filter((lead) => !keptIds.has(lead.id))
      return { leads: [...fresh, ...kept] }
    }),

  patch: (id, changes) =>
    set((state) => ({
      leads: state.leads.map((lead) => (lead.id === id ? { ...lead, ...changes } : lead)),
    })),

  remove: (ids) =>
    set((state) => {
      const gone = new Set(ids)
      return {
        leads: state.leads.filter((lead) => !gone.has(lead.id)),
        focused: state.focused && gone.has(state.focused) ? null : state.focused,
      }
    }),

  setFilter: (filter) => set({ filter }),
  focus: (focused) => set({ focused }),
}))

// ── Pure derivations ─────────────────────────────────────────────────
// Plain functions over an array, called from useMemo in the component.
// Never pass these to useLeadStore().

/** Leads worth showing: nobody buys a website they already have. */
export function sellableOf(leads: Lead[]): Lead[] {
  return leads.filter((lead) => lead.contact_tier !== 'served')
}

export function visibleOf(leads: Lead[], filter: Lead['contact_tier'] | null): Lead[] {
  const sellable = sellableOf(leads)
  return filter ? sellable.filter((lead) => lead.contact_tier === filter) : sellable
}

/** Only leads with coordinates can be drawn on a map. */
export function mappableOf(leads: Lead[]): Array<Lead & { lat: number; lng: number }> {
  return sellableOf(leads).filter(
    (lead): lead is Lead & { lat: number; lng: number } =>
      typeof lead.lat === 'number' && typeof lead.lng === 'number',
  )
}
