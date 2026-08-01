'use client'

import * as React from 'react'
import { Flame } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'

import { loadStreak, type StreakSummary } from '@/actions/streak'

export function StreakWidget() {
  const t = useTranslations('hunt') // or create a common translation if needed
  const [streak, setStreak] = React.useState<StreakSummary | null>(null)

  React.useEffect(() => {
    let mounted = true
    loadStreak().then((result) => {
      if (mounted && result.ok) setStreak(result.data)
    })
    return () => { mounted = false }
  }, [])

  return (
    <AnimatePresence>
      {streak && streak.current > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-ember-500/10 to-transparent px-2.5 py-1"
        >
          <Flame className="h-4 w-4 text-ember-500" strokeWidth={2.5} />
          <span className="text-[0.75rem] font-semibold text-ink-ember">
            {streak.current} {t('dayStreak', { defaultMessage: 'Hari berturut-turut' })}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
