import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ArrowRight, Radar, Sparkles, Send } from 'lucide-react'

import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Badge, Eyebrow, Panel } from '@/components/ui/primitives'
import { Globe } from '@/components/globe'
import { SafeWidget } from '@/components/safe-widget'
import { AuthPanel } from '@/components/auth-panel'
import { SiteHeader } from '@/components/site-header'
import { getSessionProfile } from '@/lib/supabase/server'
import { CREDIT_COST, SIGNUP_BONUS } from '@/lib/pricing'
import type { Profile } from '@/lib/database.types'

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const [t, tHow, tGhost] = await Promise.all([
    getTranslations('hero'),
    getTranslations('how'),
    getTranslations('ghost'),
  ])
  const { profile } = await getSessionProfile()

  return (
    <div className="min-h-svh">
      <SiteHeader profile={profile as Profile | null} />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-hearth"
        />

        <div className="container relative grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="max-w-xl">
            <Badge tone="warning" className="mb-6">
              <Radar className="h-3 w-3" />
              {t('eyebrow')}
            </Badge>

            <h1 className="text-balance font-display text-display-xl text-ink">{t('title')}</h1>

            <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-ink-soft sm:text-[1.0625rem]">
              {t('subtitle')}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              {profile ? (
                <Button variant="primary" size="lg" asChild>
                  <Link href="/dashboard">
                    {t('ctaPrimary')}
                    <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                  </Link>
                </Button>
              ) : (
                <Button variant="primary" size="lg" asChild>
                  <a href="#masuk">
                    {t('ctaPrimary')}
                    <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                  </a>
                </Button>
              )}

              <Button variant="surface" size="lg" asChild>
                <a href="#cara-kerja">{t('ctaSecondary')}</a>
              </Button>
            </div>

            <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-faint">{t('trust')}</p>
          </div>

          {/* Signed out, the hero's second column is the way in. Signed
              in, it goes back to being the globe. A login form the user
              has to scroll for is a login form they do not use. */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            {profile ? (
              <SafeWidget label="globe">
                <Globe />
              </SafeWidget>
            ) : (
              <AuthPanel className="scroll-mt-24" id="masuk" />
            )}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section id="cara-kerja" className="container scroll-mt-24 py-16 lg:py-24">
        <h2 className="max-w-2xl text-balance font-display text-display-md text-ink">
          {tHow('title')}
        </h2>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { icon: Radar, title: tHow('step1Title'), body: tHow('step1Body') },
            { icon: Sparkles, title: tHow('step2Title'), body: tHow('step2Body') },
            { icon: Send, title: tHow('step3Title'), body: tHow('step3Body') },
          ].map((step, index) => (
            <Panel key={step.title} pad="lg" className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-well bg-surface-sunken text-ember-500 shadow-well">
                  <step.icon className="h-[18px] w-[18px]" strokeWidth={2.3} />
                </span>
                <span className="font-mono text-[0.6875rem] font-bold tabular text-ink-faint">
                  0{index + 1}
                </span>
              </div>
              <h3 className="text-[0.9375rem] font-bold leading-snug text-ink">{step.title}</h3>
              <p className="text-[0.8125rem] leading-relaxed text-ink-soft">{step.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* ── Ghost Site ──────────────────────────────────────────── */}
      <section className="container py-16 lg:py-24">
        <Panel tone="raised" pad="none" className="overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1fr_1fr]">
            <div className="p-8 sm:p-12">
              <Badge tone="ai" className="mb-5">
                👻 {tGhost('badge')}
              </Badge>
              <h2 className="text-balance font-display text-display-md text-ink">
                {tGhost('title')}
              </h2>
              <p className="mt-5 max-w-md text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">
                {tGhost('body')}
              </p>
              <p className="mt-6 inline-flex rounded-pill bg-pandan-500/12 px-3.5 py-1.5 text-[0.75rem] font-semibold text-pandan-700 dark:text-pandan-300">
                {tGhost('hint')}
              </p>
            </div>

            {/* A frozen slice of the real component, so the promise on the
                landing page and the product itself cannot drift apart. */}
            <div className="relative min-h-[280px] bg-surface-sunken p-8 sm:p-12">
              <div className="pointer-events-none select-none">
                <div className="overflow-hidden rounded-well shadow-relief-lg">
                  <div className="flex items-center gap-1.5 bg-surface px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-sambal-300" />
                    <span className="h-2 w-2 rounded-full bg-ember-300" />
                    <span className="h-2 w-2 rounded-full bg-pandan-300" />
                    <span className="ml-2 rounded-pill bg-surface-sunken px-2 py-0.5 font-mono text-[0.5625rem] text-ink-faint">
                      kopikenangansenja.com
                    </span>
                  </div>
                  <div className="bg-gradient-to-br from-[hsl(168_66%_28%)] to-[hsl(168_62%_44%)] px-6 py-9">
                    <p className="text-[0.5625rem] font-bold uppercase tracking-[0.18em] text-white/85">
                      Kopi Kenangan Senja
                    </p>
                    <h3 className="mt-5 font-display text-2xl leading-tight text-white">
                      Kopi Kenangan Senja
                    </h3>
                    <p className="mt-1.5 text-[0.6875rem] text-white/75">Kedai Kopi · Sleman</p>
                    <span className="mt-5 inline-flex rounded-pill bg-white px-4 py-2 text-[0.6875rem] font-bold text-[hsl(168_66%_28%)]">
                      Pesan Sekarang
                    </span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-hairline bg-surface-raised py-4">
                    {[
                      ['4.7', 'Rating'],
                      ['128', 'Ulasan'],
                      ['24/7', 'Order'],
                    ].map(([value, label]) => (
                      <div key={label} className="flex flex-col items-center gap-0.5">
                        <span className="font-mono text-sm font-bold tabular text-ink">{value}</span>
                        <span className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      {/* ── Credits ─────────────────────────────────────────────── */}
      <section className="container pb-20 lg:pb-28">
        <Eyebrow className="mb-4">Kredit</Eyebrow>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel pad="lg" className="flex flex-col justify-between gap-6">
            <div>
              <p className="font-display text-display-lg leading-none text-ember-500">
                {SIGNUP_BONUS}
              </p>
              <p className="mt-3 text-[0.9375rem] font-semibold text-ink">
                kredit gratis begitu daftar
              </p>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
                Cukup buat nyisir lima area dan nulis belasan pesan pembuka. Pencarian yang gagal
                atau kosong tidak pernah dihitung.
              </p>
            </div>
            {!profile ? (
              <Button variant="primary" size="md" className="w-full" asChild>
                <a href="#masuk">{t('ctaPrimary')}</a>
              </Button>
            ) : null}
          </Panel>

          <Panel tone="sunken" pad="lg">
            <ul className="divide-y divide-hairline">
              {[
                ['Sisir Google Maps (10 lead)', CREDIT_COST.scrape],
                ['Pesan pembuka WhatsApp', CREDIT_COST.pitch],
                ['Skor potensi AI', CREDIT_COST.score],
                ['Tanya Kopilot', CREDIT_COST.copilot],
                ['Audit mendalam', CREDIT_COST.deep_pitch],
                ['Website Hantu', 0],
              ].map(([label, cost]) => (
                <li key={String(label)} className="flex items-center justify-between gap-4 py-3.5">
                  <span className="text-[0.875rem] text-ink">{label}</span>
                  <span
                    className={
                      cost === 0
                        ? 'rounded-pill bg-pandan-500/14 px-2.5 py-1 text-[0.6875rem] font-bold text-pandan-700 dark:text-pandan-300'
                        : 'font-mono text-sm font-bold tabular text-ink-soft'
                    }
                  >
                    {cost === 0 ? 'GRATIS' : `${cost} kredit`}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="container flex flex-col items-center gap-2 py-10 text-center">
          <p className="font-display text-lg text-ink">
            Nemu<span className="text-ember-500">.in</span>
          </p>
          <p className="text-[0.75rem] text-ink-faint">Mesin Pencari Klien, Bukan Alasan.</p>
        </div>
      </footer>
    </div>
  )
}
