import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Lang, LocalizedText } from '../data/types'
import { LANG_STORAGE_KEY, LanguageContext } from './context'

function readStoredLang(): Lang {
  if (typeof window === 'undefined') return 'kz'
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY)
  return stored === 'ru' || stored === 'kz' ? stored : 'kz'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  useEffect(() => {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang)
    document.documentElement.lang = lang === 'kz' ? 'kk' : 'ru'
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggleLang = useCallback(
    () => setLangState((prev) => (prev === 'kz' ? 'ru' : 'kz')),
    [],
  )

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggleLang,
      t: (text: LocalizedText) => text[lang],
    }),
    [lang, setLang, toggleLang],
  )

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  )
}
