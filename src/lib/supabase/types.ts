import type { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

/**
 * The one canonical client type.
 *
 * Inferred from `createServerClient` rather than written as
 * `SupabaseClient<Database>` — those two are *not* the same type in
 * supabase-js v2, and hand-writing the second one makes every helper that
 * accepts a client reject the client the app actually builds.
 */
export type AppSupabaseClient = ReturnType<typeof createServerClient<Database>>
