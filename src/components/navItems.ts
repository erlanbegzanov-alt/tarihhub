import {
  BookOpen,
  ClipboardCheck,
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
import { FEATURE_EXAM_MOCK } from '../lib/environment'

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
  // The ҰБТ mock is a section of its own, not one of the games under Батл.
  // Sitting it in that mode picker beside Кахут and the duels said it was one
  // game among several; it is the thing the whole course is preparation for.
  // Right after Курс — learn, then check yourself — and above Батл.
  ...(FEATURE_EXAM_MOCK
    ? [{ to: '/exam', label: s.nav.exam, icon: ClipboardCheck, match: [] }]
    : []),
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
