export type Lang = 'kz' | 'ru'

/** Every user-facing string in the app is stored in both languages. */
export interface LocalizedText {
  kz: string
  ru: string
}

/**
 * Era accent groups. Each key owns one colour (see `--color-era-*` in index.css)
 * that is reused for that era's dots, tags and portrait gradients everywhere.
 */
export type EraKey =
  | 'saka'
  | 'turkic'
  | 'golden'
  | 'khanate'
  | 'modern'
  | 'alash'
  | 'soviet'
  | 'independence'

/** Categories used by the Explore filter chips. */
export type PersonCategory =
  | 'khans'
  | 'batyrs'
  | 'biys'
  | 'scholars'
  | 'akyns'
  | 'alash'
  | 'ww2'
  | 'leaders'

/** Decorative line-art motif drawn behind a person's portrait placeholder. */
export type MotifKey =
  | 'crown'
  | 'scroll'
  | 'sword'
  | 'scale'
  | 'feather'
  | 'music'
  | 'star'
  | 'compass'

/** Rough intent buckets used by the offline scripted chat engine. */
export type CannedKey = 'greeting' | 'bio' | 'legacy' | 'default'

export interface Person {
  id: string
  eraBadge: LocalizedText
  eraKey: EraKey
  category: PersonCategory
  name: LocalizedText
  role: LocalizedText
  /** One-line summary shown on cards and search results. */
  tagline: LocalizedText
  /** First-person biography paragraph, also used to ground the AI persona. */
  bio: LocalizedText
  /** Birth year (and place, when known) as shown text — keeps any disputed-date hedging from the bio. */
  born: LocalizedText
  /** Death year (and place, when known). Absent for a person who is still alive. */
  died?: LocalizedText
  /** 3–4 short, concrete achievement statements — scannable headlines, not a repeat of the bio. */
  achievements: LocalizedText[]
  /** What remains of them today — museum, mausoleum, monument, namesakes — or an honest "not found" note. */
  legacyToday: LocalizedText
  /** Large letter shown on the gradient portrait panel when no `portrait` image exists. */
  initial: string
  motif: MotifKey
  /**
   * Freely licensed image of the person, served from `public/portraits/`.
   * Absent when no such image could be sourced — the gradient panel is used instead.
   * `kind: 'monument'` marks a statue, mausoleum or later artistic depiction rather
   * than a real likeness, so the UI can caption it honestly. See
   * `public/portraits/SOURCES.md` for the source and licence of every file.
   */
  portrait?: { src: string; kind: 'portrait' | 'monument' }
  /** Offline fallback answers for the AI chat, keyed by rough question intent. */
  canned: Record<CannedKey, LocalizedText>
}

export interface TimelineEntry {
  id: string
  year: LocalizedText
  eraKey: EraKey
  title: LocalizedText
  description: LocalizedText
  motif: MotifKey
}

export type SiteCategory = 'history' | 'culture' | 'science'

export interface MapSite {
  id: string
  name: LocalizedText
  category: SiteCategory
  /** Human-readable real coordinates, shown in the detail sheet. */
  coords: string
  /** Real longitude in degrees east — projected via `projectLonLat` in geo.ts. */
  lon: number
  /** Real latitude in degrees north — projected via `projectLonLat` in geo.ts. */
  lat: number
  description: LocalizedText
  /** Optional link to a person detail page. */
  personId?: string
}

export interface QuizOption {
  id: string
  label: LocalizedText
}

export interface QuizQuestion {
  id: string
  /** When set, the question is only served for these personas. */
  personIds?: string[]
  category: LocalizedText
  question: LocalizedText
  options: QuizOption[]
  correctId: string
  explanation: LocalizedText
}

export interface Lesson {
  id: string
  title: LocalizedText
  /** e.g. "3-сабақ · 7-бөлім" */
  meta: LocalizedText
  eraKey: EraKey
  /** 0-100, only meaningful for in-progress lessons. */
  progress: number
  /** e.g. "12 мин · 4 бөлім" — used by the "new lessons" list. */
  duration: LocalizedText
  isNew: boolean
}

export interface Badge {
  id: string
  title: LocalizedText
  description: LocalizedText
  motif: MotifKey
  eraKey: EraKey
  unlocked: boolean
}
