'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field, Panel } from '@/components/ui/primitives'
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/actions/auth'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { FailureCode } from '@/lib/result'

/**
 * Email and password, with Google kept as the secondary option.
 *
 * The order is deliberate: Google is the nicer flow, but it depends on a
 * provider secret configured outside this codebase, and when that secret
 * is wrong the user is simply locked out. Email always works, so it goes
 * first and the app is never unusable because of a dashboard field.
 */
type Mode = 'signin' | 'signup'

export function AuthPanel({ className, id }: { className?: string; id?: string }) {
  const t = useTranslations('auth')
  const router = useRouter()

  const [mode, setMode] = React.useState<Mode>('signin')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<FailureCode | null>(null)
  const [busy, setBusy] = React.useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return

    setBusy(true)
    setError(null)
    haptic('tap')

    const result =
      mode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password, name)

    if (!result.ok) {
      setBusy(false)
      setError(result.code)
      haptic('reject')
      return
    }

    haptic('land')
    // A full navigation, not a client push: the session cookie was set
    // during the action and the shell must be re-rendered by the server
    // with it present.
    window.location.assign(result.data.next)
  }

  const swap = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  return (
    <Panel id={id} pad="lg" className={cn('space-y-5', className)}>
      <div>
        <h2 className="font-display text-[1.75rem] leading-none text-ink">
          {mode === 'signin' ? t('signInTitle') : t('signUpTitle')}
        </h2>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
          {mode === 'signin' ? t('signInBody') : t('signUpBody')}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <AnimatePresence initial={false}>
          {mode === 'signup' ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <label className="block space-y-1.5 pb-3">
                <span className="overline">{t('nameLabel')}</span>
                <Field
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  autoComplete="name"
                  enterKeyHint="next"
                />
              </label>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <label className="block space-y-1.5">
          <span className="overline">{t('emailLabel')}</span>
          <Field
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kamu@email.com"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="overline">{t('passwordLabel')}</span>
          <Field
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            enterKeyHint="go"
            minLength={8}
            required
          />
        </label>

        <AnimatePresence>
          {error ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-chip bg-sambal-500/12 px-3 py-2 text-[0.75rem] leading-relaxed text-sambal-700 dark:text-sambal-300"
            >
              {messageFor(error, t)}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          <Mail className="h-4 w-4" strokeWidth={2.4} />
          {mode === 'signin' ? t('signInCta') : t('signUpCta')}
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </Button>
      </form>

      <button
        type="button"
        onClick={() => swap(mode === 'signin' ? 'signup' : 'signin')}
        className="w-full text-center text-[0.8125rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
      >
        {mode === 'signin' ? t('toSignUp') : t('toSignIn')}
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
          {t('or')}
        </span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <form action={signInWithGoogle.bind(null, '/dashboard')}>
        <Button type="submit" variant="surface" size="md" className="w-full">
          <GoogleMark />
          {t('google')}
        </Button>
      </form>
    </Panel>
  )
}

/**
 * Only the failure codes this form can actually produce get their own
 * sentence; anything else falls back rather than rendering a raw code at
 * the user.
 */
function messageFor(
  code: FailureCode,
  t: ReturnType<typeof useTranslations<'auth'>>,
): string {
  switch (code) {
    case 'bad_credentials':
      return t('err.badCredentials')
    case 'bad_email':
      return t('err.badEmail')
    case 'weak_password':
      return t('err.weakPassword')
    case 'email_taken':
      return t('err.emailTaken')
    case 'rate_limited':
      return t('err.rateLimited')
    default:
      return t('err.unknown')
  }
}

/** Google's mark, inline — no remote asset, no extra request. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.82-.07-1.6-.21-2.36H12v4.47h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.49Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.75H1.71v2.98A11.5 11.5 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.67a6.9 6.9 0 0 1 0-4.4V7.29H1.71a11.5 11.5 0 0 0 0 10.36l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.3-3.29C17.71 1.24 15.1 0 12 0 7.48 0 3.57 2.6 1.71 6.39l3.84 2.98C6.46 6.77 9 4.75 12 4.75Z"
      />
    </svg>
  )
}
