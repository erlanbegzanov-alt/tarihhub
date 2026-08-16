import { motion } from 'framer-motion'
import { CloudOff } from 'lucide-react'
import { useState } from 'react'
import { Wordmark } from '../components/Wordmark'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { pressable, staggerContainer, staggerItem } from '../lib/motion'
import { signInWithGoogle, useSession } from '../lib/session'
import { isFirebaseReady } from '../lib/firebase'

/** Google's brand mark, inlined so the screen needs no external assets. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.97-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export function SignIn() {
  const { t } = useLang()
  const session = useSession()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogle = async () => {
    setError(null)
    setPending(true)
    try {
      await signInWithGoogle()
      // The page navigates away to Google from here; on return,
      // `redirectError` below (or the auth listener, on success) takes over.
    } catch (cause) {
      const code =
        typeof cause === 'object' && cause !== null && 'code' in cause
          ? String((cause as { code: unknown }).code)
          : ''
      const cancelled = code === 'auth/cancelled-popup-request'
      setError(t(cancelled ? s.auth.cancelled : s.auth.failed))
      setPending(false)
    }
  }

  // Set once, on the load right after a failed round trip through Google —
  // `signInWithGoogle` above only ever gets to see a network-level throw,
  // never a rejection Google/Firebase itself issued after the redirect.
  const redirectFailed = session.redirectError !== null
  const redirectCancelled = session.redirectError?.code === 'auth/cancelled-popup-request'
  const displayedError =
    error ?? (redirectFailed ? t(redirectCancelled ? s.auth.cancelled : s.auth.failed) : null)

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
            the button is disabled and the notice says exactly why — there is
            no bypass to fall back to.
          */}
          {!isFirebaseReady && (
            <p className="mb-4 flex gap-2.5 rounded-tile bg-gold-tint px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
              <CloudOff
                className="mt-0.5 h-4 w-4 shrink-0 text-gold"
                strokeWidth={2}
              />
              {t(s.auth.notConfigured)}
            </p>
          )}

          <motion.button
            type="button"
            onClick={handleGoogle}
            disabled={!isFirebaseReady || pending}
            {...(isFirebaseReady && !pending ? pressable : {})}
            className={cn(
              'focus-ring flex w-full items-center justify-center gap-3 rounded-full',
              'bg-surface px-5 py-3.5 text-[15px] font-semibold text-ink',
              'ring-1 ring-line shadow-soft transition-colors',
              isFirebaseReady && !pending
                ? 'hover:bg-cream'
                : 'cursor-not-allowed opacity-55',
            )}
          >
            <GoogleMark className="h-[18px] w-[18px]" />
            {pending ? t(s.auth.signingIn) : t(s.auth.google)}
          </motion.button>

          {displayedError && (
            <p className="mt-3 rounded-tile bg-wrong-tint px-3.5 py-2.5 text-center text-[12.5px] font-medium text-wrong">
              {displayedError}
            </p>
          )}
          {/* Raw Firebase error code + message — small print, so a report
              back names the exact cause instead of just "не удалось войти". */}
          {session.redirectError && (
            <p className="mt-1.5 px-2 text-center text-[10.5px] leading-snug break-words text-ink-faint">
              {session.redirectError.code}
              {session.redirectError.message &&
              session.redirectError.message !== session.redirectError.code
                ? ` — ${session.redirectError.message}`
                : ''}
            </p>
          )}
          {/* Diagnostic-only, shown regardless of error: tells apart a
              silent "no pending redirect" from an actual thrown failure. */}
          {session.redirectDebug && (
            <p className="mt-1.5 px-2 text-center text-[10.5px] leading-snug break-words text-ink-faint opacity-70">
              {session.redirectDebug}
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
