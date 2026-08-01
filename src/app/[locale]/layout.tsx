import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'

import { Providers } from '@/components/providers'
import { routing, type AppLocale } from '@/i18n/routing'
import '../globals.css'

/**
 * Plus Jakarta Sans is the working typeface of the city this product is
 * built for, and it carries Indonesian diacritics properly. Instrument
 * Serif handles display sizes where a geometric sans would read as a
 * dashboard. Both are self-hosted by next/font — no external requests,
 * no layout shift, no third-party CSS.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4efe6' },
    { media: '(prefers-color-scheme: dark)', color: '#12100e' },
  ],
  width: 'device-width',
  initialScale: 1,
  // An installed app must not rubber-band or pinch-zoom like a document,
  // and `cover` is what lets the shell paint under the notch and the
  // home indicator instead of leaving grey bars.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })

  return {
    title: { default: t('title'), template: '%s · Nemu.in' },
    description: t('description'),
    applicationName: 'Nemu.in',
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/icon.svg' }],
    },
    appleWebApp: {
      capable: true,
      title: 'Nemu.in',
      // Translucent lets the shell's own header paint behind the status
      // bar, which is what separates an installed app from a bookmark.
      statusBarStyle: 'black-translucent',
    },
    formatDetection: { telephone: false },
    openGraph: { title: t('title'), description: t('description'), type: 'website', locale },
    robots: { index: true, follow: true },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as AppLocale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning className={`${jakarta.variable} ${instrument.variable} ${mono.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
