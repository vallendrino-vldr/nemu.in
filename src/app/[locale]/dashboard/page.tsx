import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { getSessionProfile } from '@/lib/supabase/server'
import type { Lead, Profile } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

/**
 * Server Actions inherit the containing page's duration budget, and a
 * sweep queries two map providers before it can answer.
 *
 * Vercel's default is 10 seconds. Overpass alone routinely takes longer
 * than that from a cold function, so the platform was killing the request
 * mid-flight: the credit had already been charged, the refund never ran
 * because the process was gone, and the browser saw only a dead socket —
 * which is exactly the "everything fails with a generic error" symptom.
 */
export const maxDuration = 60

/**
 * The only server work the app shell needs: who is this, and what did
 * they already collect. Everything after this is client-side, so tapping
 * between tabs costs nothing.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const { user, profile, supabase } = await getSessionProfile()
  if (!user || !profile) redirect('/')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .order('contact_tier', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(300)

  return <AppShell profile={profile as Profile} initialLeads={(leads ?? []) as Lead[]} />
}
