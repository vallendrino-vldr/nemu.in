'use client'

import { create } from 'zustand'
import type { Lead } from '@/lib/database.types'

/**
 * One list of leads, shared by every tab.
 *
 * Hunt writes into it, Leads reads it, Map plots it, and an AI score paid
 * for in one tab is visible in the others immediately. Without this the
 * tabs would each hold their own copy and drift apart the moment the user
 * spent a credit.
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

  setFilter: (filter) => set({ filter }),
  focus: (focused) => set({ focused }),
}))

/** Leads worth showing: a business that already has a website is not a lead. */
export const selectSellable = (state: LeadState) =>
  state.leads.filter((lead) => lead.contact_tier !== 'served')

export const selectVisible = (state: LeadState) => {
  const sellable = selectSellable(state)
  return state.filter ? sellable.filter((lead) => lead.contact_tier === state.filter) : sellable
}

/** Only leads with coordinates can be drawn on the map. */
export const selectMappable = (state: LeadState) =>
  selectSellable(state).filter(
    (lead): lead is Lead & { lat: number; lng: number } =>
      typeof lead.lat === 'number' && typeof lead.lng === 'number',
  )
