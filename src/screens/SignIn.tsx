import { AnimatePresence, motion } from 'framer-motion'
import { CloudOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Wordmark } from '../components/Wordmark'
import type { LocalizedText } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { canHover, easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import {
  sendPasswordReset,
  signInWithEmail,
  signInWithGooglePopup,
  signUpWithEmail,
} from '../lib/session'
import { isFirebaseReady } from '../lib/firebase'

/** Firebase's own floor for a password — worth saying out loud, not guessing at. */
const MIN_PASSWORD = 6

type Tab = 'signin' | 'signup'

const TABS: { value: Tab; label: LocalizedText }[] = [
  { value: 'signin', label: s.auth.tabSignIn },
  { value: 'signup', label: s.auth.tabSignUp },
]

/**
 * Firebase reports failures through `error.code`, never through a stable
 * message, so that is what this switches on. `auth/invalid-credential` is the
 * newer SDK's replacement for `auth/wrong-password` — both still turn up
 * depending on the project's settings, so both land on the same line.
 */
const ERROR_TEXT: Record<string, LocalizedText> = {
  'auth/email-already-in-use': s.auth.errEmailInUse,
  'auth/weak-password': s.auth.errWeakPassword,
  'auth/invalid-email': s.auth.errInvalidEmail,
  'auth/user-not-found': s.auth.errUserNotFound,
  'auth/wrong-password': s.auth.errWrongPassword,
  'auth/invalid-credential': s.auth.errWrongPassword,
  'auth/invalid-login-credentials': s.auth.errWrongPassword,
  'auth/too-many-requests': s.auth.errTooManyRequests,
  'auth/operation-not-allowed': s.auth.errNotAllowed,
}

/** Closing the Google chooser is a decision, not a failure — nothing to report. */
const SILENT_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
])

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : ''
}

/** Falls back to the generic line for anything not in the table above. */
function errorText(error: unknown): LocalizedText {
  return ERROR_TEXT[errorCode(error)] ?? s.auth.failed
}

const FIELD =
  'w-full rounded-tile bg-cream px-3.5 py-3 text-[15px] text-ink outline-none ring-[1.5px] ring-line placeholder:text-ink-faint focus:ring-brand transition-shadow duration-200'

const LABEL = 'mb-1.5 block text-[12.5px] font-semibold text-ink-soft'

/* ------------------------------------------------------------------ */

/** Google's four-colour "G" — lucide has no logomark, so it is inlined here. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */

export function SignIn() {
  const { t } = useLang()
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<'google' | 'email' | 'reset' | null>(null)
  const [error, setError] = useState<LocalizedText | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const busy = pending !== null

  /** Clears whatever the last attempt said, so a retry starts from silence. */
  function reset() {
    setError(null)
    setResetSent(false)
  }

  function switchTab(next: Tab) {
    if (next === tab) return
    setTab(next)
    reset()
    setResetOpen(false)
  }

  function google() {
    reset()
    setPending('google')
    signInWithGooglePopup()
      .catch((cause: unknown) => {
        if (!SILENT_CODES.has(errorCode(cause))) setError(errorText(cause))
      })
      .finally(() => setPending(null))
    // On success the auth listener in session.ts flips the gate to the app.
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    reset()

    // Catch what we can before spending a round trip on it — the fastest
    // error is the one Firebase never has to be asked about.
    const address = email.trim()
    if (!address || !address.includes('@')) {
      setError(s.auth.errInvalidEmail)
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(s.auth.errWeakPassword)
      return
    }

    setPending('email')
    const run = tab === 'signup' ? signUpWithEmail : signInWithEmail
    run(address, password)
      .catch((cause: unknown) => setError(errorText(cause)))
      .finally(() => setPending(null))
  }

  function requestReset() {
    reset()
    const address = email.trim()
    if (!address || !address.includes('@')) {
      setError(s.auth.errInvalidEmail)
      return
    }
    setPending('reset')
    sendPasswordReset(address)
      // Deliberately the same outcome either way: whether the address has an
      // account is not this screen's to reveal.
      .then(() => {
        setResetSent(true)
        setResetOpen(false)
      })
      .catch((cause: unknown) => {
        const code = errorCode(cause)
        if (code === 'auth/user-not-found') {
          setResetSent(true)
          setResetOpen(false)
          return
        }
        setError(errorText(cause))
      })
      .finally(() => setPending(null))
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-cream px-5 py-10 sm:px-6">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="mx-auto w-full max-w-sm"
      >
        <motion.div variants={staggerItem} className="flex flex-col items-center">
          <Wordmark className="h-11" />
          <h1 className="mt-6 text-center text-[22px] font-bold tracking-tight text-ink">
            {t(s.auth.title)}
          </h1>
          <p className="mt-2 max-w-[18rem] text-center text-[14.5px] leading-relaxed text-ink-soft">
            {t(s.auth.subtitle)}
          </p>
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="mt-8 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
        >
          {/*
            Sign-in is the only way in, so with no Firebase project attached
            there is nothing to render — the notice says exactly why, with
            no bypass to fall back to.
          */}
          {!isFirebaseReady && (
            <p className="flex gap-2.5 rounded-tile bg-gold-tint px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
              <CloudOff
                className="mt-0.5 h-4 w-4 shrink-0 text-gold"
                strokeWidth={2}
              />
              {t(s.auth.notConfigured)}
            </p>
          )}

          {isFirebaseReady && (
            <>
              {/* ---------------------- tabs ---------------------- */}
              <div className="flex rounded-full bg-cream p-1">
                {TABS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => switchTab(option.value)}
                    aria-pressed={tab === option.value}
                    className={cn(
                      'focus-ring relative flex-1 rounded-full py-2 text-[13.5px] font-bold',
                      'transition-colors duration-200',
                      tab === option.value ? 'text-white' : 'text-ink-faint hover:text-ink',
                    )}
                  >
                    {tab === option.value && (
                      <motion.span
                        layoutId="auth-tab"
                        className="absolute inset-0 rounded-full bg-brand"
                        transition={springSoft}
                      />
                    )}
                    <span className="relative z-10">{t(option.label)}</span>
                  </button>
                ))}
              </div>

              {/* --------------------- Google --------------------- */}
              <motion.button
                type="button"
                onClick={google}
                disabled={busy}
                whileHover={canHover && !busy ? { y: -2 } : undefined}
                whileTap={busy ? undefined : { scale: 0.97 }}
                transition={springSoft}
                className={cn(
                  'focus-ring mt-5 flex w-full items-center justify-center gap-2.5 rounded-full',
                  'bg-surface px-5 py-3.5 text-[15px] font-semibold text-ink',
                  'shadow-soft ring-1 ring-line transition-colors duration-200',
                  busy ? 'cursor-default opacity-60' : 'hover:ring-brand/50',
                )}
              >
                {pending === 'google' ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin text-ink-soft" />
                ) : (
                  <GoogleMark className="h-[18px] w-[18px]" />
                )}
                {pending === 'google' ? t(s.auth.signingIn) : t(s.auth.google)}
              </motion.button>

              {/* --------------------- divider -------------------- */}
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line-soft" />
                <span className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">
                  {t(s.auth.or)}
                </span>
                <span className="h-px flex-1 bg-line-soft" />
              </div>

              {/* ------------------ email + password ------------------ */}
              <form onSubmit={submit} noValidate>
                <label className={LABEL} htmlFor="auth-email">
                  {t(s.auth.emailLabel)}
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t(s.auth.emailPlaceholder)}
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  className={FIELD}
                />

                <label className={cn(LABEL, 'mt-3.5')} htmlFor="auth-password">
                  {t(s.auth.passwordLabel)}
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t(s.auth.passwordPlaceholder)}
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  className={FIELD}
                />

                <motion.button
                  type="submit"
                  disabled={busy}
                  whileHover={canHover && !busy ? { y: -2 } : undefined}
                  whileTap={busy ? undefined : { scale: 0.97 }}
                  transition={springSoft}
                  className={cn(
                    'focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-full',
                    'px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft',
                    busy ? 'cursor-default bg-ink-faint' : 'bg-brand hover:bg-brand-dark',
                  )}
                >
                  {pending === 'email' && <Loader2 className="h-[18px] w-[18px] animate-spin" />}
                  {pending === 'email'
                    ? t(tab === 'signup' ? s.auth.signingUp : s.auth.signingIn)
                    : t(tab === 'signup' ? s.auth.submitSignUp : s.auth.submitSignIn)}
                </motion.button>
              </form>

              {/* ------------------ forgot password ------------------ */}
              {tab === 'signin' && (
                <div className="mt-3.5 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      reset()
                      setResetOpen((open) => !open)
                    }}
                    className="focus-ring rounded-full px-2 py-1 text-[13px] font-semibold text-ink-soft hover:text-brand"
                  >
                    {t(s.auth.forgot)}
                  </button>

                  <AnimatePresence initial={false}>
                    {resetOpen && (
                      <motion.div
                        key="reset"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.24, ease: easeOut }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2.5 rounded-tile bg-cream px-3.5 py-3 text-left">
                          <p className="text-[12.5px] leading-relaxed text-ink-soft">
                            {t(s.auth.resetHint)}
                          </p>
                          {/* The email field above is usually already filled,
                              so this only asks for it when it isn't. */}
                          {!email.trim() && (
                            <input
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              placeholder={t(s.auth.emailPlaceholder)}
                              autoComplete="email"
                              inputMode="email"
                              spellCheck={false}
                              className={cn(FIELD, 'mt-2.5 bg-surface')}
                            />
                          )}
                          <button
                            type="button"
                            onClick={requestReset}
                            disabled={busy}
                            className={cn(
                              'focus-ring mt-2.5 w-full rounded-full px-4 py-2.5',
                              'text-[13.5px] font-semibold text-white',
                              busy ? 'cursor-default bg-ink-faint' : 'bg-brand hover:bg-brand-dark',
                            )}
                          >
                            {t(s.auth.resetSend)}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {resetSent && (
                <p className="mt-3 rounded-tile bg-brand-tint px-3.5 py-2.5 text-center text-[12.5px] leading-relaxed font-medium text-brand">
                  {t(s.auth.resetSent)}
                </p>
              )}
            </>
          )}

          {error && (
            <p className="mt-3 rounded-tile bg-wrong-tint px-3.5 py-2.5 text-center text-[12.5px] leading-relaxed font-medium text-wrong">
              {t(error)}
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
