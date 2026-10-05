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

/**
 * The stored language, or Kazakh.
 *
 * Guarded, and not out of caution: with site data blocked, or in a private
 * window on some browsers, `window.localStorage` throws on *access* rather
 * than returning an empty store. This ran during the very first render of the
 * provider that wraps the entire app, so that throw was a blank page before
 * anything existed to catch it — the one crash no error boundary could ever
 * have reported, because every boundary is inside the tree this call builds.
 */
export function readStoredLang(): Lang {
  if (typeof window === 'undefined') return 'kz'
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY)
    return stored === 'ru' || stored === 'kz' ? stored : 'kz'
  } catch {
    return 'kz'
  }
}

/** Remembers the language. A browser that refuses storage simply forgets. */
export function writeStoredLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    /* the choice holds for this tab; nothing else is lost */
  }
}
