import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'

export const routing = defineRouting({
  locales: ['id', 'en'],
  defaultLocale: 'id',
  // Indonesian is the home language, so it lives at the bare root and only
  // English carries a prefix. Detection still runs off Accept-Language.
  localePrefix: 'as-needed',
})

export type AppLocale = (typeof routing.locales)[number]

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
