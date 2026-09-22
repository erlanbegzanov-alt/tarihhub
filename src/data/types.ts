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
  | 'ancient'
  | 'saka'
  | 'turkic'
  | 'golden'
  | 'goldenHorde'
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

/**
 * Codifier topic, 1–55 — the numbering of the official НЦТ specification for
 * 2026 (`history-reference/ent-exam-patterns.md` §6.2). 1–52 are subject
 * topics grouped into six sections; 53–55 are the three context-task topics
 * (document / person / map) and only ever appear on a `ContextBlock`.
 */
export type TopicId = number

/**
 * Difficulty band from the specification (§4.4). One exam variant is fixed at
 * A 50 % / B 30 % / C 20 % — roughly 10 / 6 / 4 of the 20 questions.
 *
 * A — reproducing a plain fact. B — comparing, generalising, systematising.
 * C — causation, significance, telling a fact apart from its consequence.
 * The C band is the ceiling a student who only memorised dates cannot pass.
 */
export type ExamLevel = 'A' | 'B' | 'C'

/**
 * Question mechanic, from the catalogue in §7.3 — every code there was read off
 * the official sample variant or the official context-task example, so a
 * question tagged with one trains against something НЦТ demonstrably does.
 *
 * P1 date⇄event · P2 person⇄achievement · P3 term⇄definition · P4 place⇄role
 * P5 author of a reform · P6 dating an object to its era · P7 "which statements
 * are true" (answer is a combination) · P8 packed matching · P9 map: object by
 * number · P10 map: period or process · P11 map: second name of a state
 * P12 identify the event from a document · P13 date the identified event
 * P14 cause or consequence from the context · P15 long-term consequence
 * P16 quantifier trap ("only", "wholly", "exclusively")
 */
export type PatternKey =
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'P6'
  | 'P7'
  | 'P8'
  | 'P9'
  | 'P10'
  | 'P11'
  | 'P12'
  | 'P13'
  | 'P14'
  | 'P15'
  | 'P16'

/** Stimulus type of a context block — codifier topics 53 / 54 / 55 (§4.3). */
export type StimulusKind = 'document' | 'person' | 'map'

/**
 * A numbered object on a schematic map: exactly what the exam asks about when
 * it says "determine the state under №2" (sample variant, tasks 13–15).
 *
 * Deliberately a label point, not a boundary. The exam's own map question does
 * not require accurate historical borders — a schema with numbers answers it,
 * which is why this costs far less than reviving the full `/map` screen.
 */
export interface MapMarker {
  n: number
  label: LocalizedText
  /** Real longitude in degrees east — projected via `projectLonLat` in geo.ts. */
  lon: number
  /** Real latitude in degrees north — projected via `projectLonLat` in geo.ts. */
  lat: number
}

/**
 * One context block: a single stimulus plus EXACTLY five questions (§4.1).
 * Two of these are half the exam's marks.
 *
 * The questions are related on purpose. Misreading the stimulus in the first
 * one drags several of the rest down with it, and that cascade is the thing
 * being trained (§12.1) — it cannot be reproduced by standalone questions,
 * which is what all 3117 existing questions in this app are.
 */
export interface ContextBlock {
  id: string
  kind: StimulusKind
  /** Codifier topic of the stimulus itself: 53 document / 54 person / 55 map. */
  topicId: TopicId
  title: LocalizedText
  /** The document or biography text. Usually absent for `kind: 'map'`. */
  passage?: LocalizedText
  /** For `kind: 'map'` — which era to draw and which objects carry numbers. */
  map?: { eraKey: EraKey; markers: MapMarker[] }
  /** Exactly 5. Checked when a variant is assembled. */
  questions: QuizQuestion[]
}

export interface QuizQuestion {
  id: string
  /** When set, the question is only served for these personas. */
  personIds?: string[]
  /**
   * When set, the question belongs to these lessons' gating quizzes
   * (`buildLessonQuiz`). Parallel to `personIds` — a question may be tagged for
   * lessons, for personas, or (rarely) for both.
   */
  lessonIds?: string[]
  category: LocalizedText
  question: LocalizedText
  options: QuizOption[]
  correctId: string
  explanation: LocalizedText
  /**
   * Codifier topic. Required for anything in the ҰБТ bank — it is what lets
   * the result screen say "you are weak on topic 24" instead of only "14/20".
   * Absent on the lesson and persona banks, which are scoped differently.
   */
  topicId?: TopicId
  /** Difficulty band — needed to assemble a variant in the 50/30/20 proportion. */
  level?: ExamLevel
  /** Question mechanic — lets mistakes be broken down by type, not only by topic. */
  pattern?: PatternKey
}

/**
 * One inline "check yourself" question shown right under a lesson section.
 * Unlike `QuizQuestion` it carries no `lessonIds`/`personIds` tags — it is
 * already scoped by living inside that section's own `check` array, and must
 * be answerable from that section's `body` alone (see `LessonSection.check`).
 */
export interface SectionCheckQuestion {
  id: string
  question: LocalizedText
  options: QuizOption[]
  correctId: string
  explanation: LocalizedText
}

/** One readable chunk of a lesson: a heading plus 1–3 short paragraphs. */
export interface LessonSection {
  heading: LocalizedText
  body: LocalizedText
  /**
   * Optional inline mini-quiz (3–5 questions) testing only this section's own
   * content — the Khan-Academy-style "check yourself" step between reading and
   * the lesson's final gating quiz. Never blocks scrolling past; answering it
   * moves `lessonProgress` up (see `recordSectionCheckDone` in progress.ts) but
   * never gates lesson completion — only the gating quiz in `quiz.ts` does that.
   */
  check?: SectionCheckQuestion[]
}

export interface Lesson {
  id: string
  /** Id of the owning course unit — see `src/data/units.ts`. */
  unitId: string
  /** 1-based position inside that unit, following CURRICULUM_PLAN.md's numbering. */
  order: number
  title: LocalizedText
  /** Where the lesson sits in the course, e.g. "4-бөлім · Қазақ хандығы". */
  meta: LocalizedText
  eraKey: EraKey
  /**
   * @deprecated Stale, and no longer read by the app. These strings drifted to
   * roughly three times the real reading time as lessons were edited. The line
   * shown to the reader now comes from `lessonDuration()` in `lessons.ts`,
   * which derives it from the lesson's own text. Kept only so the existing
   * lesson data still typechecks.
   */
  duration: LocalizedText
  /**
   * The lesson itself. Written from `history-reference/*.md`, keeping that
   * material's hedging: a disputed claim stays marked as disputed.
   */
  sections: LessonSection[]
  /** Person page (and quiz) this lesson leads into, when there is a fitting one. */
  relatedPersonId?: string
}

export interface Badge {
  id: string
  title: LocalizedText
  description: LocalizedText
  motif: MotifKey
  eraKey: EraKey
  unlocked: boolean
}
