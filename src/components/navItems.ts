import {
  BookOpen,
  ClipboardCheck,
  Flame,
  GraduationCap,
  House,
  Sparkles,
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
  // Поиск and AI were two tabs over one list — the same `people`, differing
  // only in what a tap did. Erlan asked what the difference was, and there
  // wasn't one worth a tab: the search now sits inside AI, and `/person` keeps
  // this tab lit because that is where a search result leads.
  { to: '/ai', label: s.nav.ai, icon: Sparkles, match: ['/person'] },
  {
    to: '/timeline',
    label: s.nav.timeline,
    icon: BookOpen,
    match: ['/map', '/quiz'],
  },
  // Flame, not crossed swords: the swords now mark the one mode where two
  // sides actually face each other, and a section and one of its modes sharing
  // a glyph on the same screen read as a bug.
  { to: '/battle', label: s.nav.battle, icon: Flame, match: [] },
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
