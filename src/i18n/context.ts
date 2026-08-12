import { createContext } from 'react'
import type { Lang, LocalizedText } from '../data/types'

export interface LanguageValue {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
  /** Resolve a bilingual string to the active language. */
  t: (text: LocalizedText) => string
}

export const LanguageContext = createContext<LanguageValue | null>(null)

export const LANG_STORAGE_KEY = 'tarihhub_lang'
