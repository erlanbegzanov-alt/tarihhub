import { motion } from 'framer-motion'
import { CloudOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Wordmark } from '../components/Wordmark'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { staggerContainer, staggerItem } from '../lib/motion'
import { signInWithGoogleIdToken } from '../lib/session'
import { isFirebaseReady } from '../lib/firebase'

/**
 * The "Web client (auto created by Google Service)" OAuth client Firebase
 * itself created when Google sign-in was turned on for this project —
 * public by design (it identifies the app to Google, not a secret).
 */
const GOOGLE_CLIENT_ID =
  '375305653245-dibejs3emfs6v3nilnj174h942so0fmm.apps.googleusercontent.com'

interface GoogleCredentialResponse {
  credential: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: GoogleCredentialResponse) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type: 'standard'
              theme: 'outline'
              size: 'large'
              text: 'signin_with'
              shape: 'pill'
              width: number
              locale: string
            },
          ) => void
        }
      }
    }
  }
}

export function SignIn() {
  const { t, lang } = useLang()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const buttonHostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isFirebaseReady) return

    const handleCredential = (response: GoogleCredentialResponse) => {
      setError(null)
      setPending(true)
      signInWithGoogleIdToken(response.credential)
        .catch(() => setError(t(s.auth.failed)))
        .finally(() => setPending(false))
      // On success the auth listener in session.ts flips the gate to the app.
    }

    let cancelled = false
    let pollId: ReturnType<typeof setInterval> | undefined

    const render = () => {
      const host = buttonHostRef.current
      if (!host || !window.google) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      })
      window.google.accounts.id.renderButton(host, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: Math.min(360, host.offsetWidth || 320),
        locale: lang === 'kz' ? 'kk' : 'ru',
      })
    }

    if (window.google) {
      render()
    } else {
      // The Google Identity Services script (loaded in index.html) fetches
      // async — poll briefly rather than wiring up a load-event listener for
      // a script tag that may have already fired before this effect ran.
      pollId = setInterval(() => {
        if (!window.google) return
        clearInterval(pollId)
        if (!cancelled) render()
      }, 100)
    }

    return () => {
      cancelled = true
      if (pollId) clearInterval(pollId)
    }
  }, [lang, t])

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
            <div className="flex min-h-[44px] w-full items-center justify-center">
              {/* Kept mounted even while pending/hidden — unmounting it would
                  throw away the button Google's script already rendered
                  into it, leaving a permanently empty box on retry. */}
              <div ref={buttonHostRef} className={cn('w-full', pending && 'hidden')} />
              {pending && (
                <p className="text-[14px] font-medium text-ink-soft">
                  {t(s.auth.signingIn)}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-tile bg-wrong-tint px-3.5 py-2.5 text-center text-[12.5px] font-medium text-wrong">
              {error}
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
