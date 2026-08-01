import { getTranslations } from 'next-intl/server'
import { ShieldHalf } from 'lucide-react'

import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { CreditMeter } from '@/components/credit-meter'
import { SafeWidget } from '@/components/safe-widget'
import { ThemeToggle } from '@/components/theme-toggle'
import { LocaleSwitch } from '@/components/locale-switch'
import { signOut } from '@/actions/auth'
import type { Profile } from '@/lib/database.types'

/**
 * The header carries the wallet, so it is deliberately a server component
 * that receives an already-verified profile. The credit meter then takes
 * over on the client and keeps itself live over Realtime.
 */
export async function SiteHeader({ profile }: { profile: Profile | null }) {
  const t = await getTranslations('nav')

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/60 bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="container flex h-16 items-center gap-3">
        <Link href="/" className="mr-auto flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-well bg-gradient-to-b from-ember-400 to-ember-600 shadow-ember-relief">
            <span className="font-display text-base leading-none text-white">N</span>
          </span>
          <span className="font-display text-xl leading-none tracking-tight text-ink">
            Nemu<span className="text-ember-500">.in</span>
          </span>
        </Link>

        {profile ? (
          <>
            <SafeWidget label="credit-meter">
              <CreditMeter
                userId={profile.id}
                initialBalance={profile.credits}
                role={profile.role}
                className="hidden sm:inline-flex"
              />
            </SafeWidget>

            {profile.role === 'super_admin' ? (
              <Button variant="sunken" size="icon" asChild aria-label={t('godMode')}>
                <Link href="/god">
                  <ShieldHalf className="h-4 w-4" strokeWidth={2.3} />
                </Link>
              </Button>
            ) : null}

            <LocaleSwitch className="hidden md:inline-flex" />
            <ThemeToggle />

            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                {t('signOut')}
              </Button>
            </form>
          </>
        ) : (
          <>
            <LocaleSwitch className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Button variant="primary" size="sm" asChild>
              <Link href="/#masuk">{t('signIn')}</Link>
            </Button>
          </>
        )}
      </div>

      {/* Mobile wallet row — the balance is too important to hide behind a menu. */}
      {profile ? (
        <div className="container flex justify-end pb-2.5 sm:hidden">
          <SafeWidget label="credit-meter">
            <CreditMeter userId={profile.id} initialBalance={profile.credits} role={profile.role} />
          </SafeWidget>
        </div>
      ) : null}
    </header>
  )
}
