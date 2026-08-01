import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { SiteHeader } from '@/components/site-header'
import { HuntConsole } from '@/components/hunt-console'
import { Panel } from '@/components/ui/primitives'
import { getSessionProfile } from '@/lib/supabase/server'
import type { Lead, Profile } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const { user, profile, supabase } = await getSessionProfile()
  if (!user || !profile) redirect('/')

  const [tCredits, { data: leads }] = await Promise.all([
    getTranslations('credits'),
    supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const typedProfile = profile as Profile
  const depleted = typedProfile.role !== 'super_admin' && typedProfile.credits <= 0

  return (
    <div className="min-h-svh">
      <SiteHeader profile={typedProfile} />

      <main className="container max-w-3xl py-8 lg:py-12">
        {depleted ? (
          <Panel pad="lg" className="mb-6 border-l-4 border-sambal-500">
            <h2 className="text-[0.9375rem] font-bold text-ink">{tCredits('emptyTitle')}</h2>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-soft">
              {tCredits('emptyBody')}
            </p>
          </Panel>
        ) : null}

        <HuntConsole initialLeads={(leads ?? []) as Lead[]} />
      </main>
    </div>
  )
}
