import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { getSessionProfile } from '@/lib/supabase/server'
import type { Lead, Profile } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

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
