import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, KeyRound, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLang } from '../i18n/useLang'
import { s } from '../i18n/strings'
import { clearApiKey, getApiKey, setApiKey } from '../lib/ai'
import { cn } from '../lib/cn'
import { easeOut, springSoft } from '../lib/motion'

export function ApiKeyModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useLang()
  const [value, setValue] = useState('')

  useEffect(() => {
    if (open) setValue(getApiKey())
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const save = () => {
    setApiKey(value)
    onSaved()
    onClose()
  }

  const remove = () => {
    clearApiKey()
    setValue('')
    onSaved()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label={t(s.common.close)}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t(s.ai.keyTitle)}
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={springSoft}
            className={cn(
              'relative z-10 w-full max-w-md rounded-t-card bg-surface p-5 shadow-lift',
              'sm:rounded-card sm:p-6',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-tint">
                  <KeyRound className="h-5 w-5 text-brand" strokeWidth={2} />
                </span>
                <h2 className="text-[17px] font-semibold text-ink">
                  {t(s.ai.keyTitle)}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t(s.common.close)}
                className="focus-ring -mt-1 -mr-1 grid h-9 w-9 place-items-center rounded-full text-ink-faint hover:text-ink"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
              {t(s.ai.keyDescription)}
            </p>

            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-brand hover:underline"
            >
              {t(s.ai.keyLink)}
              <ExternalLink className="h-[14px] w-[14px]" strokeWidth={2} />
            </a>

            <input
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={t(s.ai.keyPlaceholder)}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'mt-4 w-full rounded-2xl bg-cream px-4 py-3 font-mono text-sm text-ink',
                'ring-1 ring-line outline-none',
                'focus:ring-2 focus:ring-brand/70',
                'placeholder:font-sans placeholder:text-ink-faint',
              )}
            />

            <div className="mt-5 flex items-center gap-2.5">
              <motion.button
                type="button"
                onClick={save}
                whileTap={{ scale: 0.97 }}
                transition={springSoft}
                className="focus-ring flex-1 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-soft hover:bg-brand-dark"
              >
                {t(s.common.save)}
              </motion.button>
              {getApiKey() && (
                <motion.button
                  type="button"
                  onClick={remove}
                  whileTap={{ scale: 0.97 }}
                  transition={springSoft}
                  aria-label={t(s.ai.keyRemove)}
                  title={t(s.ai.keyRemove)}
                  className="focus-ring grid h-11 w-11 place-items-center rounded-full bg-wrong-tint text-wrong ring-1 ring-wrong/20"
                >
                  <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
