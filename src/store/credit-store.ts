'use client'

import { create } from 'zustand'
import type { AccountRole } from '@/lib/database.types'

export interface CreditBurst {
  id: number
  /** Negative = spent, positive = received. */
  amount: number
  x: number
  y: number
}

interface CreditState {
  balance: number
  role: AccountRole
  ready: boolean
  bursts: CreditBurst[]
  hydrate: (balance: number, role: AccountRole) => void
  /** Sets the balance and, when it moved, fires a burst at the meter. */
  reconcile: (balance: number, origin?: { x: number; y: number }) => void
  emitBurst: (amount: number, x: number, y: number) => void
  dismissBurst: (id: number) => void
}

let burstSequence = 0

export const useCreditStore = create<CreditState>((set, get) => ({
  balance: 0,
  role: 'user',
  ready: false,
  bursts: [],

  hydrate: (balance, role) => set({ balance, role, ready: true }),

  reconcile: (balance, origin) => {
    const previous = get().balance
    const delta = balance - previous
    set({ balance, ready: true })

    // Only animate a real movement, and only when we know where on screen
    // it should appear. A burst with no anchor is worse than no burst.
    if (delta !== 0 && origin) get().emitBurst(delta, origin.x, origin.y)
  },

  emitBurst: (amount, x, y) => {
    const id = ++burstSequence
    set((state) => ({ bursts: [...state.bursts, { id, amount, x, y }] }))
    // Self-cleanup matches the CSS animation duration; nothing accumulates.
    window.setTimeout(() => get().dismissBurst(id), 1_200)
  },

  dismissBurst: (id) =>
    set((state) => ({ bursts: state.bursts.filter((burst) => burst.id !== id) })),
}))

/** Super admins spend nothing, so the meter should never read as depleting. */
export const selectIsUnlimited = (state: CreditState) => state.role === 'super_admin'
