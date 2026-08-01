'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownToLine, RefreshCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { haptic } from '@/lib/haptics'

/**
 * Registers the service worker, offers the install prompt, and — the part
 * that actually matters — tells the user the moment a newer build is
 * ready and swaps to it on one tap.
 *
 * An installed PWA that silently keeps running last week's JavaScript is
 * the classic failure mode, and it is worse than a plain website because
 * the user has no address bar to force-refresh from. The `updatefound`
 * listener below closes that gap.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'nemu-install-dismissed'

export function PwaManager() {
  const [installEvent, setInstallEvent] = React.useState<InstallPromptEvent | null>(null)
  const [updateReady, setUpdateReady] = React.useState<ServiceWorker | null>(null)
  const [dismissed, setDismissed] = React.useState(true)

  // ── Service worker ────────────────────────────────────────────────
  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        if (cancelled) return

        // A worker already waiting means a previous visit downloaded an
        // update that never got applied.
        if (registration.waiting) setUpdateReady(registration.waiting)

        registration.addEventListener('updatefound', () => {
          const incoming = registration.installing
          if (!incoming) return
          incoming.addEventListener('statechange', () => {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(incoming)
            }
          })
        })

        // Check for a new build whenever the app is brought back to the
        // foreground — the moment a user is most likely to notice.
        const recheck = () => {
          if (document.visibilityState === 'visible') void registration.update()
        }
        document.addEventListener('visibilitychange', recheck)
        return () => document.removeEventListener('visibilitychange', recheck)
      } catch {
        // A failed registration must never break the app.
      }
    }

    void register()

    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  // ── Install prompt ────────────────────────────────────────────────
  React.useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setInstallEvent(null))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const install = async () => {
    if (!installEvent) return
    haptic('land')
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  const applyUpdate = () => {
    haptic('tap')
    updateReady?.postMessage('SKIP_WAITING')
    setUpdateReady(null)
  }

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  const showInstall = Boolean(installEvent) && !dismissed

  return (
    <AnimatePresence>
      {updateReady ? (
        <motion.div
          key="update"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 z-[80] flex items-center gap-3 rounded-well border border-white/10 bg-surface-raised/90 p-3 shadow-floating backdrop-blur-xl"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
        >
          <RefreshCw className="h-4 w-4 shrink-0 text-nila-500" strokeWidth={2.4} />
          <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-ink">
            Versi baru sudah siap.
          </p>
          <Button variant="ai" size="sm" onClick={applyUpdate}>
            Muat ulang
          </Button>
        </motion.div>
      ) : showInstall ? (
        <motion.div
          key="install"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 z-[80] flex items-center gap-3 rounded-well border border-white/10 bg-surface-raised/90 p-3 shadow-floating backdrop-blur-xl"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-well bg-gradient-to-b from-ember-400 to-ember-600 shadow-ember-relief">
            <ArrowDownToLine className="h-4 w-4 text-white" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] font-semibold leading-snug text-ink">Pasang di layar utama</p>
            <p className="text-[0.6875rem] leading-snug text-ink-faint">Buka tanpa browser, terasa seperti aplikasi.</p>
          </div>
          <Button variant="primary" size="sm" onClick={install}>
            Pasang
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Tutup"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-faint hover:text-ink"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
