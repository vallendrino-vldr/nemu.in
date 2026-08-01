'use client'

import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import { usePathname, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * A two-position physical switch rather than a dropdown. There are exactly
 * two languages; a select element for two options is a form control
 * pretending to be a decision.
 */
export function LocaleSwitch({ className }: { className?: string }) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const switchTo = (next: 'id' | 'en') => {
    if (next === locale) return
    startTransition(() => router.replace(pathname, { locale: next }))
  }

  return (
    <div
      className={cn(
        'relative inline-flex items-center rounded-pill bg-surface-sunken p-1 shadow-well',
        pending && 'opacity-60',
        className,
      )}
    >
      {(['id', 'en'] as const).map((code) => (
        <Button
          key={code}
          variant={locale === code ? 'surface' : 'ghost'}
          size="sm"
          onClick={() => switchTo(code)}
          aria-pressed={locale === code}
          className={cn(
            'h-7 rounded-pill px-3 text-[0.6875rem] font-bold uppercase tracking-[0.1em]',
            locale === code ? 'text-ink' : 'text-ink-faint',
          )}
        >
          {code}
        </Button>
      ))}
    </div>
  )
}
