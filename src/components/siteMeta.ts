import { FlaskConical, Landmark, Palette } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SiteCategory } from '../data/types'

export const SITE_ICONS: Record<SiteCategory, LucideIcon> = {
  history: Landmark,
  culture: Palette,
  science: FlaskConical,
}

const SITE_COLORS: Record<SiteCategory, string> = {
  history: 'var(--color-era-khanate)',
  culture: 'var(--color-era-saka)',
  science: 'var(--color-era-turkic)',
}

export function siteColor(category: SiteCategory): string {
  return SITE_COLORS[category]
}
