import { AnimatePresence, motion } from 'framer-motion'
import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLang } from '../i18n/useLang'
import { s } from '../i18n/strings'
import { cn } from '../lib/cn'
import { easeOut, springSoft } from '../lib/motion'

const DISMISSED_KEY = 'tarihhub-install-dismissed'

/** Non-standard event Chrome/Android fires when the app becomes installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function InstallPrompt() {
  const { t } = useLang()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(wasDismissed())
    if (isStandalone()) return

    if (isIosSafari()) {
      setShowIosHint(true)
      return
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      /* storage unavailable — the in-memory dismissal still holds this session */
    }
    setDismissed(true)
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
    dismiss()
  }

  const visible = !dismissed && (deferredPrompt !== null || showIosHint)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: easeOut }}
          className={cn(
            'fixed inset-x-4 bottom-20 z-30 mx-auto max-w-md',
            'rounded-card bg-surface p-4 shadow-lift ring-1 ring-line/60',
            'md:right-6 md:bottom-6 md:left-auto',
          )}
          style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-tint">
              {showIosHint ? (
                <Share className="h-5 w-5 text-brand" strokeWidth={2} />
              ) : (
                <Download className="h-5 w-5 text-brand" strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">{t(s.pwa.installTitle)}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
                {showIosHint ? t(s.pwa.iosText) : t(s.pwa.installText)}
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t(s.pwa.dismiss)}
              className="focus-ring -mt-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {!showIosHint && (
            <motion.button
              type="button"
              onClick={install}
              whileTap={{ scale: 0.97 }}
              transition={springSoft}
              className="focus-ring mt-3 w-full rounded-full bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft hover:bg-brand-dark"
            >
              {t(s.pwa.installAction)}
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
