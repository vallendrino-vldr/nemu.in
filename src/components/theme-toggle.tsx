'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { haptic } from '@/lib/haptics'

/**
 * Two icons crossfading inside one physical key, rather than a swap that
 * pops. The button keeps its footprint in both states so the header never
 * reflows on toggle.
 */
export function ThemeToggle() {
  const t = useTranslations('nav')
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <Button
      variant="surface"
      size="icon"
      aria-label={t('theme')}
      feedback="tap"
      onClick={() => {
        haptic('tap')
        setTheme(isDark ? 'light' : 'dark')
      }}
      className="relative overflow-hidden"
    >
      <Sun
        className="absolute h-[18px] w-[18px] transition-all duration-400 ease-physical"
        style={{
          opacity: isDark ? 0 : 1,
          transform: isDark ? 'rotate(-70deg) scale(0.5)' : 'rotate(0deg) scale(1)',
        }}
        strokeWidth={2.2}
        aria-hidden
      />
      <Moon
        className="absolute h-[18px] w-[18px] transition-all duration-400 ease-physical"
        style={{
          opacity: isDark ? 1 : 0,
          transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(70deg) scale(0.5)',
        }}
        strokeWidth={2.2}
        aria-hidden
      />
    </Button>
  )
}
