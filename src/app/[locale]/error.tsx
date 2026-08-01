'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw, Unplug } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/primitives'

/**
 * The user never sees a stack trace or the number 500. They see a
 * sentence that says it is not their fault and a button that actually
 * retries the render.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  React.useEffect(() => {
    console.error('[nemu] render failed', error)
  }, [error])

  return (
    <div className="container grid min-h-svh place-items-center py-16">
      <Panel pad="lg" className="w-full max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-sunken text-ember-500 shadow-well">
          <Unplug className="h-6 w-6" strokeWidth={2} />
        </span>

        <h1 className="mt-5 font-display text-3xl leading-tight text-ink">{t('genericTitle')}</h1>
        <p className="mx-auto mt-3 max-w-xs text-[0.8125rem] leading-relaxed text-ink-soft">
          {t('genericBody')}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Button variant="primary" size="md" onClick={reset} feedback="tap">
            <RotateCcw className="h-4 w-4" strokeWidth={2.4} />
            {t('retry')}
          </Button>
          <Button variant="surface" size="md" asChild>
            <a href="/">{t('goHome')}</a>
          </Button>
        </div>

        {error.digest ? (
          <p className="mt-6 font-mono text-[0.625rem] text-ink-faint">ref · {error.digest}</p>
        ) : null}
      </Panel>
    </div>
  )
}
