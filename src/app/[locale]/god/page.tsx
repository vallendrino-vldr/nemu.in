import { setRequestLocale } from 'next-intl/server'

import { GodShell } from '@/components/god/god-shell'
// The locale-aware redirect, so an English admin who is bounced lands on
// /en/dashboard rather than being dropped into the Indonesian route.
import { redirect } from '@/i18n/routing'
import { getSessionProfile } from '@/lib/supabase/server'
import { loadGodStats, listAllUsers, listApiKeys } from '@/actions/admin'
import type { Profile } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * God Mode, promoted from a tab to a route.
 *
 * It was a fifth tab in the phone shell, which capped it at whatever fits
 * under a thumb and kept it deliberately thin. Moving the owner's control
 * room off the tab bar frees it to be as wide and as dense as it needs to
 * be, and frees a tab slot in the app the users actually see.
 *
 * The heavy data is fetched here, on the server, in parallel — the tab
 * version fetched it from the browser after mount and took about seven
 * seconds to paint. The stats query is now one RPC instead of four
 * separate aggregates.
 *
 * The role is re-read from the database, never taken from the JWT: a
 * claim can be an hour stale after a demotion, and this is the one screen
 * where that hour matters.
 */
export default async function GodPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const { user, profile } = await getSessionProfile()

  // next-intl's redirect throws, but it is not typed as `never`, so the
  // explicit returns are what narrow `profile` for everything below.
  if (!user || !profile) {
    redirect({ href: '/', locale })
    return null
  }
  if (profile.role !== 'super_admin') {
    redirect({ href: '/dashboard', locale })
    return null
  }

  const [stats, users, keys] = await Promise.all([loadGodStats(), listAllUsers(''), listApiKeys()])

  return (
    <GodShell
      me={profile as Profile}
      initialStats={stats.ok ? stats.data : null}
      initialUsers={users.ok ? users.data : []}
      initialKeys={keys.ok ? keys.data : []}
    />
  )
}
