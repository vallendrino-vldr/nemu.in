'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined

/**
 * One browser client per tab. Creating a fresh one on every render would
 * spawn a new realtime socket each time, which is how you end up with
 * eleven live subscriptions and a credit counter that fires eleven times.
 */
export function getBrowserClient() {
  cached ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return cached
}
