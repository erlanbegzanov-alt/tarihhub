import { useSyncExternalStore } from 'react'

// Bumped from 'tarihhub_profile' — the old key held pre-launch seed data
// (fake XP/streak/badges baked in during earlier development) that isn't
// anyone's real progress. Switching keys gives every browser a clean start.
const STORAGE_KEY = 'tarihhub_profile_v2'

export const XP_PER_LEVEL = 200

/** Awarded once, the first time a lesson is finished (see `recordLessonProgress`). */
export const XP_PER_LESSON = 20

export interface ProfileState {
  xp: number
  streak: number
  quizzesCompleted: number
  unlockedBadges: string[]
  /** Number of distinct calendar days the app has been opened. */
  totalVisits: number
  /** Local `YYYY-MM-DD` date of the most recent recorded visit, or '' if never. */
  lastVisitDate: string
  /** Ids of person detail pages actually opened, deduped. */
  peopleViewed: string[]
  /** Whether the full timeline page has been opened at least once. */
  timelineViewed: boolean
  /** Real per-lesson progress: lesson id → 0-100. Absent id means "not started". */
  lessonProgress: Record<string, number>
  /** Ids of lessons finished at least once — the XP award is keyed off this. */
  completedLessons: string[]
}

const DEFAULT_STATE: ProfileState = {
  xp: 0,
  streak: 0,
  quizzesCompleted: 0,
  unlockedBadges: [],
  totalVisits: 0,
  lastVisitDate: '',
  peopleViewed: [],
  timelineViewed: false,
  lessonProgress: {},
  completedLessons: [],
}

/**
 * Coerces an untrusted lesson-progress map: only finite numbers survive, and
 * every one is clamped into 0-100 so a corrupt value can't fake a full bar.
 */
function normalizeLessonProgress(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, number> = {}
  for (const [id, percent] of Object.entries(value as Record<string, unknown>)) {
    if (typeof percent === 'number' && Number.isFinite(percent)) {
      result[id] = Math.max(0, Math.min(100, Math.round(percent)))
    }
  }
  return result
}

/**
 * Coerces an untrusted object (localStorage JSON, or a Firestore document)
 * into a complete `ProfileState`, dropping anything malformed.
 */
export function normalizeProfile(value: unknown): ProfileState {
  if (!value || typeof value !== 'object') return DEFAULT_STATE
  const parsed = value as Partial<ProfileState>
  return {
    xp: typeof parsed.xp === 'number' ? parsed.xp : DEFAULT_STATE.xp,
    streak:
      typeof parsed.streak === 'number' ? parsed.streak : DEFAULT_STATE.streak,
    quizzesCompleted:
      typeof parsed.quizzesCompleted === 'number'
        ? parsed.quizzesCompleted
        : DEFAULT_STATE.quizzesCompleted,
    unlockedBadges: Array.isArray(parsed.unlockedBadges)
      ? parsed.unlockedBadges
      : DEFAULT_STATE.unlockedBadges,
    totalVisits:
      typeof parsed.totalVisits === 'number'
        ? parsed.totalVisits
        : DEFAULT_STATE.totalVisits,
    lastVisitDate:
      typeof parsed.lastVisitDate === 'string'
        ? parsed.lastVisitDate
        : DEFAULT_STATE.lastVisitDate,
    peopleViewed: Array.isArray(parsed.peopleViewed)
      ? parsed.peopleViewed
      : DEFAULT_STATE.peopleViewed,
    timelineViewed:
      typeof parsed.timelineViewed === 'boolean'
        ? parsed.timelineViewed
        : DEFAULT_STATE.timelineViewed,
    lessonProgress: normalizeLessonProgress(parsed.lessonProgress),
    completedLessons: Array.isArray(parsed.completedLessons)
      ? parsed.completedLessons.filter(
          (id): id is string => typeof id === 'string',
        )
      : DEFAULT_STATE.completedLessons,
  }
}

function read(): ProfileState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    return normalizeProfile(JSON.parse(raw))
  } catch {
    return DEFAULT_STATE
  }
}

let state: ProfileState = read()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

/**
 * Optional cloud mirror. `src/lib/profileSync.ts` registers a writer while a
 * Firebase user is signed in; with no Firebase config it stays `null` and
 * this module is localStorage-only.
 */
type RemoteWriter = (next: ProfileState) => void
let remoteWriter: RemoteWriter | null = null

export function setRemoteWriter(writer: RemoteWriter | null): void {
  remoteWriter = writer
}

function write(next: ProfileState) {
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
  // localStorage is the fast local cache; the cloud copy is best-effort and
  // must never break a local update if it fails.
  try {
    remoteWriter?.(next)
  } catch {
    /* offline / permission denied — the local write already succeeded */
  }
  emit()
}

/** Current profile, for non-React callers (the cloud sync layer). */
export function getProfile(): ProfileState {
  return state
}

/** Replaces the whole profile (used after merging the cloud copy on sign-in). */
export function replaceProfile(next: ProfileState): void {
  write(normalizeProfile(next))
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ProfileState {
  return state
}

export function useProfile(): ProfileState {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_STATE)
}

/** Local (not UTC) `YYYY-MM-DD` for the given date, so day boundaries follow the user's clock. */
function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Whole-day difference between two local `YYYY-MM-DD` strings (b - a). */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const dateA = new Date(ay, am - 1, ad)
  const dateB = new Date(by, bm - 1, bd)
  return Math.round((dateB.getTime() - dateA.getTime()) / 86_400_000)
}

/**
 * Records that the app was opened today. A "visit" only counts once per
 * local calendar day. Recomputes the real consecutive-day streak:
 * same day → no change, exactly one day later → streak+1, any bigger
 * gap → streak resets to 1.
 */
export function recordVisit(): void {
  if (typeof window === 'undefined') return
  const today = localDateString()
  if (state.lastVisitDate === today) return

  const nextStreak =
    state.lastVisitDate && dayDiff(state.lastVisitDate, today) === 1
      ? state.streak + 1
      : 1

  const unlocked = new Set(state.unlockedBadges)
  if (nextStreak >= 7) unlocked.add('flame')

  write({
    ...state,
    streak: nextStreak,
    totalVisits: state.totalVisits + 1,
    lastVisitDate: today,
    unlockedBadges: [...unlocked],
  })
}

/** Records a finished quiz: adds XP, bumps the counter, unlocks badges. */
export function completeQuiz(correct: number, total: number, xp: number): void {
  const unlocked = new Set(state.unlockedBadges)
  if (state.quizzesCompleted + 1 >= 5) unlocked.add('strategist')
  if (correct === total) unlocked.add('sage')
  if (state.streak >= 7) unlocked.add('flame')

  write({
    ...state,
    xp: state.xp + xp,
    quizzesCompleted: state.quizzesCompleted + 1,
    unlockedBadges: [...unlocked],
  })
}

/** Records that a person's detail page was actually opened (deduped). */
export function recordPersonView(id: string): void {
  if (state.peopleViewed.includes(id)) return
  const peopleViewed = [...state.peopleViewed, id]

  const unlocked = new Set(state.unlockedBadges)
  if (peopleViewed.length >= 10) unlocked.add('explorer')

  write({ ...state, peopleViewed, unlockedBadges: [...unlocked] })
}

/**
 * Records real progress through a lesson. Progress only ever moves forward —
 * re-opening a finished lesson can't drop it back to "just started". Reaching
 * 100 marks the lesson completed and pays `XP_PER_LESSON`, but only the first
 * time: finishing an already-finished lesson again awards nothing.
 */
export function recordLessonProgress(id: string, percent: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const current = state.lessonProgress[id] ?? 0
  const next = Math.max(current, clamped)
  const alreadyCompleted = state.completedLessons.includes(id)

  // Nothing new to record: same percentage, and the completion (if any) is
  // already banked.
  if (next === current && (next < 100 || alreadyCompleted)) return

  const completes = next >= 100 && !alreadyCompleted

  write({
    ...state,
    xp: completes ? state.xp + XP_PER_LESSON : state.xp,
    lessonProgress: { ...state.lessonProgress, [id]: next },
    completedLessons: completes
      ? [...state.completedLessons, id]
      : state.completedLessons,
  })
}

/** Records that the (unpaginated, full) timeline page was opened. */
export function recordTimelineViewed(): void {
  if (state.timelineViewed) return
  const unlocked = new Set(state.unlockedBadges)
  unlocked.add('chronicler')
  write({ ...state, timelineViewed: true, unlockedBadges: [...unlocked] })
}

export function unlockBadge(id: string): void {
  if (state.unlockedBadges.includes(id)) return
  write({ ...state, unlockedBadges: [...state.unlockedBadges, id] })
}

export interface LevelInfo {
  level: number
  nextLevel: number
  xpInLevel: number
  xpForLevel: number
  percent: number
}

export function levelInfo(xp: number): LevelInfo {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInLevel = xp % XP_PER_LEVEL
  return {
    level,
    nextLevel: level + 1,
    xpInLevel,
    xpForLevel: XP_PER_LEVEL,
    percent: Math.round((xpInLevel / XP_PER_LEVEL) * 100),
  }
}
