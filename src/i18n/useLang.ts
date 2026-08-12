import { useContext } from 'react'
import { LanguageContext } from './context'
import type { LanguageValue } from './context'

export function useLang(): LanguageValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>')
  return ctx
}
