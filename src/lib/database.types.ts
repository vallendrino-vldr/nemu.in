/**
 * Hand-maintained mirror of supabase/migrations.
 *
 * Kept by hand rather than generated so the app never silently drifts
 * onto a schema that only exists on someone's laptop.
 *
 * TWO SHAPE RULES, BOTH LOAD-BEARING
 * ──────────────────────────────────
 *  1. Every row shape is a `type` alias, never an `interface`. Interfaces
 *     do not get an implicit index signature, so they fail supabase-js's
 *     `Record<string, unknown>` constraint and every query in the app
 *     silently collapses to `never` with no error at the definition site.
 *  2. `Views` and `CompositeTypes` use `Record<string, never>` rather than
 *     `{}`, for the same constraint reason.
 */

export type AccountRole = 'user' | 'super_admin'
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'won' | 'dead'
export type ContactTierDb = 'whatsapp' | 'phone' | 'visit' | 'served'
export type CreditAction =
  | 'signup_bonus'
  | 'grant'
  | 'scrape'
  | 'score'
  | 'pitch'
  | 'deep_pitch'
  | 'copilot'
  | 'refund'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: AccountRole
  credits: number
  lifetime_spent: number
  locale: string
  created_at: string
  last_seen_at: string
  /** Set by God Mode. Enforced inside `consume_credits`, not at sign-in. */
  banned_at: string | null
  ban_reason: string | null
  /** Admin's message to this user. Rides the existing Realtime channel. */
  notice: string | null
  notice_at: string | null
  /** Admin opt-in to paying like everyone else, so a tester can watch the
   *  balance actually fall instead of always reading `∞`. */
  bill_admin: boolean
}

/** What God Mode is allowed to know about a key. Never the secret itself. */
export type ApiKeyView = {
  id: string
  provider: 'gemini'
  label: string
  preview: string
  active: boolean
  created_at: string
  last_used_at: string | null
  last_error: string | null
}

export type GodActivityRow = {
  id: number
  user_id: string
  email: string
  full_name: string | null
  action: CreditAction
  amount: number
  balance_after: number
  created_at: string
}

export type Lead = {
  id: string
  user_id: string
  place_id: string
  name: string
  category: string | null
  address: string | null
  area: string | null
  phone: string | null
  phone_e164: string | null
  phone_dial: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  lat: number | null
  lng: number | null
  maps_uri: string | null
  ai_score: number | null
  ai_verdict: string | null
  ai_angle: string | null
  pitch: string | null
  pitch_tone: string | null
  contact_tier: ContactTierDb
  status: LeadStatus
  created_at: string
  updated_at: string
}

export type CreditLedgerEntry = {
  id: number
  user_id: string
  action: CreditAction
  amount: number
  balance_after: number
  meta: Record<string, unknown>
  created_at: string
}

export type AppSettings = {
  id: number
  places_enabled: boolean
  gemini_enabled: boolean
  owner_email: string | null
  notice: string | null
  /** God Mode's warning line for daily Gemini calls. */
  ai_daily_budget: number
  updated_at: string
  updated_by: string | null
}

export type PlaceCacheRow = {
  place_id: string
  payload: Record<string, unknown>
  refreshed_at: string
}

export type SearchCacheRow = {
  query_hash: string
  query_text: string
  city: string | null
  place_ids: string[]
  hit_count: number
  created_at: string
}

/**
 * The row behind God Mode's key manager.
 *
 * `api_keys` has RLS enabled and zero policies, which means service_role
 * is the only thing that can read `secret`. Everything user-facing goes
 * through `admin_list_api_keys()`, which returns `ApiKeyView` — a masked
 * preview, never the value.
 */
export type ApiKeyRow = {
  id: string
  provider: 'gemini'
  label: string
  secret: string
  active: boolean
  created_at: string
  created_by: string | null
  last_used_at: string | null
  last_error: string | null
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; email: string }
        Update: Partial<Profile>
        Relationships: []
      }
      leads: {
        Row: Lead
        Insert: Partial<Lead> & { user_id: string; place_id: string; name: string }
        Update: Partial<Lead>
        Relationships: []
      }
      credit_ledger: {
        Row: CreditLedgerEntry
        Insert: Partial<CreditLedgerEntry>
        Update: Partial<CreditLedgerEntry>
        Relationships: []
      }
      app_settings: {
        Row: AppSettings
        Insert: Partial<AppSettings>
        Update: Partial<AppSettings>
        Relationships: []
      }
      place_cache: {
        Row: PlaceCacheRow
        Insert: Partial<PlaceCacheRow>
        Update: Partial<PlaceCacheRow>
        Relationships: []
      }
      search_cache: {
        Row: SearchCacheRow
        Insert: Partial<SearchCacheRow>
        Update: Partial<SearchCacheRow>
        Relationships: []
      }
      api_keys: {
        Row: ApiKeyRow
        Insert: Partial<ApiKeyRow> & { label: string; secret: string }
        Update: Partial<ApiKeyRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      consume_credits: {
        Args: { p_action: CreditAction; p_amount: number; p_meta?: Record<string, unknown> }
        Returns: { balance: number; was_free: boolean }[]
      }
      refund_credits: {
        Args: { p_user: string; p_amount: number; p_reason?: string }
        Returns: number
      }
      grant_credits: {
        Args: { p_target: string; p_amount: number; p_note?: string | null }
        Returns: number
      }
      set_api_switch: {
        Args: { p_places: boolean; p_gemini: boolean; p_notice?: string | null }
        Returns: undefined
      }
      is_super_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      record_sweep: {
        Args: {
          p_query_hash: string
          p_query_text: string
          p_city: string | null
          p_places: unknown
        }
        Returns: undefined
      }
      touch_sweep_cache: {
        Args: { p_query_hash: string }
        Returns: undefined
      }
      claim_signup_slot: {
        Args: { p_ip_hash: string; p_email: string; p_limit?: number; p_window?: string }
        Returns: boolean
      }
      /* ── God Mode (0005) ─────────────────────────────────────────── */
      god_stats: {
        Args: Record<string, never>
        Returns: Record<string, unknown>
      }
      god_recent_activity: {
        Args: { p_limit?: number }
        Returns: GodActivityRow[]
      }
      admin_set_ban: {
        Args: { p_target: string; p_reason?: string | null }
        Returns: undefined
      }
      admin_set_notice: {
        Args: { p_target: string; p_message?: string | null }
        Returns: undefined
      }
      admin_set_billing: {
        Args: { p_enabled: boolean }
        Returns: boolean
      }
      admin_list_api_keys: {
        Args: Record<string, never>
        Returns: ApiKeyView[]
      }
      admin_toggle_api_key: {
        Args: { p_id: string; p_active: boolean }
        Returns: undefined
      }
      admin_delete_api_key: {
        Args: { p_id: string }
        Returns: undefined
      }
      mark_api_key: {
        Args: { p_id: string; p_error?: string | null }
        Returns: undefined
      }
      /* ── Streak & budget (0006) ──────────────────────────────────── */
      my_streak: {
        Args: Record<string, never>
        Returns: Record<string, unknown>
      }
      admin_set_ai_budget: {
        Args: { p_budget: number }
        Returns: number
      }
    }
    Enums: {
      account_role: AccountRole
      lead_status: LeadStatus
      credit_action: CreditAction
      contact_tier: ContactTierDb
    }
    CompositeTypes: Record<string, never>
  }
}
