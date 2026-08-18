import {
  BookOpen,
  GraduationCap,
  House,
  Search,
  Sparkles,
  Swords,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LocalizedText } from '../data/types'
import { s } from '../i18n/strings'

export interface NavItem {
  to: string
  label: LocalizedText
  icon: LucideIcon
  /** Extra path prefixes that should keep this tab highlighted. */
  match: string[]
}

export const navItems: NavItem[] = [
  { to: '/', label: s.nav.home, icon: House, match: [] },
  {
    to: '/course',
    label: s.nav.course,
    icon: GraduationCap,
    match: ['/lesson', '/quiz/lesson'],
  },
  { to: '/explore', label: s.nav.explore, icon: Search, match: ['/person'] },
  { to: '/ai', label: s.nav.ai, icon: Sparkles, match: [] },
  {
    to: '/timeline',
    label: s.nav.timeline,
    icon: BookOpen,
    match: ['/map', '/quiz'],
  },
  { to: '/battle', label: s.nav.battle, icon: Swords, match: [] },
  { to: '/profile', label: s.nav.profile, icon: User, match: [] },
]

export function activeNavPath(pathname: string): string {
  const direct = navItems.find(
    (item) => item.to !== '/' && pathname.startsWith(item.to),
  )
  if (direct) return direct.to

  const byMatch = navItems.find((item) =>
    item.match.some((prefix) => pathname.startsWith(prefix)),
  )
  if (byMatch) return byMatch.to

  return '/'
}
