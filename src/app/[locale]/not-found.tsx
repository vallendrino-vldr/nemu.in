import { getTranslations } from 'next-intl/server'
import { Compass } from 'lucide-react'

import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/primitives'

export default async function NotFound() {
  const t = await getTranslations('errors')

  return (
    <div className="container grid min-h-svh place-items-center py-16">
      <Panel pad="lg" className="w-full max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-sunken text-ink-faint shadow-well">
          <Compass className="h-6 w-6" strokeWidth={2} />
        </span>

        <p className="mt-5 font-mono text-[0.6875rem] font-bold tracking-[0.2em] text-ink-faint">
          404
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink">{t('notFoundTitle')}</h1>
        <p className="mx-auto mt-3 max-w-xs text-[0.8125rem] leading-relaxed text-ink-soft">
          {t('notFoundBody')}
        </p>

        <Button variant="primary" size="md" asChild className="mt-7">
          <Link href="/">{t('goHome')}</Link>
        </Button>
      </Panel>
    </div>
  )
}
