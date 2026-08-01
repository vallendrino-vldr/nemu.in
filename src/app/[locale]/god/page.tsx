import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import { SiteHeader } from '@/components/site-header'
import { GodConsole } from '@/components/god-console'
import { listAllUsers, loadGodStats } from '@/actions/admin'
import { getSessionProfile } from '@/lib/supabase/server'
import type { Profile } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export default async function GodModePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const { user, profile } = await getSessionProfile()
  if (!user) redirect('/')

  const typedProfile = profile as Profile | null
  // A non-admin gets a 404, not a 403. Confirming that this route exists
  // is itself information we would rather not hand out.
  if (typedProfile?.role !== 'super_admin') notFound()

  const [t, stats, users] = await Promise.all([
    getTranslations('god'),
    loadGodStats(),
    listAllUsers(''),
  ])

  if (!stats.ok || !users.ok) notFound()

  return (
    <div className="min-h-svh">
      <SiteHeader profile={typedProfile} />

      <main className="container max-w-5xl py-8 lg:py-12">
        <header className="mb-8">
          <h1 className="font-display text-display-md leading-none text-ink">{t('title')}</h1>
          <p className="mt-2 text-[0.875rem] text-ink-soft">{t('subtitle')}</p>
        </header>

        <GodConsole initialStats={stats.data} initialUsers={users.data} />
      </main>
    </div>
  )
}
