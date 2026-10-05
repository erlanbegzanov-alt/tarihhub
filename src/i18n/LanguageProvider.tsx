import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Lang, LocalizedText } from '../data/types'
import { LanguageContext, readStoredLang, writeStoredLang } from './context'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  useEffect(() => {
    writeStoredLang(lang)
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
