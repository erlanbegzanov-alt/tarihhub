import { useSyncExternalStore } from 'react'
import type { AvatarGender } from '../data/ranks'

// Bumped from 'tarihhub_profile' — the old key held pre-launch seed data
// (fake XP/streak/badges baked in during earlier development) that isn't
// anyone's real progress. Switching keys gives every browser a clean start.
//
// Namespaced per Firebase uid (see `storageKeyFor`) so two accounts signed
// into the same browser never share a cache: without the uid suffix, a
// brand-new signup on a device that already had another account's progress
// sitting in localStorage would inherit those numbers wholesale and — since
// `startProfileSync` merges local into a fresh account's empty cloud doc —
// permanently write them into that new account's Firestore profile too.
const STORAGE_KEY_BASE = 'tarihhub_profile_v2'

function storageKeyFor(uid: string | null): string {
  return uid ? `${STORAGE_KEY_BASE}_${uid}` : STORAGE_KEY_BASE
}

export const XP_PER_LEVEL = 200

/** Awarded once, the first time a lesson's quiz is passed (see `recordLessonQuizResult`). */
export const XP_PER_LESSON = 20

/**
 * Share of a lesson quiz that has to be answered correctly for the lesson to
 * count as passed. This is the only way a lesson is ever completed — reading it
 * to the bottom proves nothing on its own.
 */
export const LESSON_PASS_RATIO = 0.8

/** Recorded when a lesson is opened, so it shows up under "continue". */
const LESSON_STARTED_PERCENT = 10

/** Best attempt at one lesson's quiz — the real numbers, not a percentage. */
export interface LessonQuizScore {
  correct: number
  total: number
}

/** How many of the most recent casual duels `recentCasualDuels` keeps. */
export const RECENT_CASUAL_DUELS_MAX = 8
/** How many of the most recent ranked duels `recentRankedDuels` keeps. */
export const RECENT_RANKED_DUELS_MAX = 10

/**
 * The opponent as they looked at the moment a duel ended.
 *
 * Stored on the record rather than looked up later because there is nowhere to
 * look it up from: `battlePlayers/{uid}` is a live mirror that keeps moving,
 * and a history row wants the face that was actually across the board. The
 * identity fields are written by `BattleDuel.tsx` off the same `BattlePlayer`
 * the duel head already rendered, so a history row draws the identical avatar.
 */
export interface DuelOpponent {
  opponentName: string
  /** Google account photo, or '' — the `PlayerAvatar` fallback handles both. */
  opponentPhotoURL: string
  /** `null` for an opponent who never picked a track on their own profile. */
  opponentAvatarGender: AvatarGender | null
  opponentAvatarTierIndex: number
  /**
   * True when this was the practice bot (`src/lib/battleBot.ts`) rather than a
   * person. Stored rather than inferred so the row can keep saying so months
   * later — a duel the reader can't tell apart from a real one afterwards is a
   * result they were misled about.
   */
  opponentIsBot: boolean
}

/** One finished casual duel, newest first in `recentCasualDuels`. */
export interface CasualDuelRecord extends DuelOpponent {
  won: boolean
  /** This player's XP in that duel. */
  xp: number
  /** The opponent's XP — the other half of the score line. */
  foeXp: number
  at: number
}

/**
 * One finished ranked duel, newest first in `recentRankedDuels`.
 *
 * Kept in the same local/per-device store as the casual list rather than in
 * Firestore: `battlePlayers/{uid}` holds only a player's *current* standing,
 * and giving every duel a document would mean a new collection and new rules
 * for what is, today, a personal log nobody else ever reads. The rating pair
 * is what makes a row explain itself — "1240 → 1258" instead of an opaque
 * "+18" with nothing to read it against.
 */
export interface RankedDuelRecord extends DuelOpponent {
  won: boolean
  xp: number
  foeXp: number
  ratingBefore: number
  ratingAfter: number
  at: number
}

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
  /** Ids of lessons whose quiz was passed — the XP award is keyed off this. */
  completedLessons: string[]
  /**
   * Best quiz attempt per lesson, kept as real correct/total so the UI can show
   * "4/5" rather than a bare percentage. A worse retry never overwrites it.
   */
  lessonQuizBest: Record<string, LessonQuizScore>
  /**
   * `${lessonId}:${sectionIndex}` keys for inline section checks the reader has
   * gone through at least once (see `recordSectionCheckDone`). Never removed —
   * a check answered wrong today can be retried, but "opened it" is permanent,
   * the same non-punishing spirit as `lessonProgress` itself.
   */
  sectionChecksDone: string[]
  /**
   * Which gendered title track the rank is read from (see `src/data/ranks.ts`).
   * `null` until the reader picks one on the profile screen.
   */
  avatarGender: AvatarGender | null
  /**
   * Which rank tier the profile *shows*, when the reader has picked one they
   * already earned instead of their newest. `null` — the default — means "show
   * whatever my XP currently reaches". Purely cosmetic: nothing here ever feeds
   * back into `xp`, so the real progression is untouched by the choice.
   */
  displayedRankTier: number | null
  /**
   * Independent from `displayedRankTier`: which earned tier's *avatar art* the
   * profile shows, when the reader has picked one different from the tier
   * their title reads. Same nullable, defensive-resolution spirit — `null`
   * means "show whatever my XP currently reaches", same default as
   * `displayedRankTier`, resolved separately.
   */
  displayedAvatarTier: number | null
  /** Casual (unranked) 1v1 duels finished — see `src/screens/BattleDuel.tsx`. */
  casualDuels: number
  casualWins: number
  /** Current unbroken casual win streak. Resets to 0 on any loss. */
  casualStreak: number
  /** Newest first, capped to `RECENT_CASUAL_DUELS_MAX`. */
  recentCasualDuels: CasualDuelRecord[]
  /** Ranked 1v1 duels finished. Counted separately from the casual ones so
   *  neither mode's record can flatter the other's. */
  rankedDuels: number
  rankedWins: number
  /** Current unbroken ranked win streak. Resets to 0 on any loss. */
  rankedStreak: number
  /** Newest first, capped to `RECENT_RANKED_DUELS_MAX`. */
  recentRankedDuels: RankedDuelRecord[]
}

export const DEFAULT_STATE: ProfileState = {
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
  lessonQuizBest: {},
  sectionChecksDone: [],
  avatarGender: null,
  displayedRankTier: null,
  displayedAvatarTier: null,
  casualDuels: 0,
  casualWins: 0,
  casualStreak: 0,
  recentCasualDuels: [],
  rankedDuels: 0,
  rankedWins: 0,
  rankedStreak: 0,
  recentRankedDuels: [],
}

/** Share of `lessonProgress` that inline section checks alone can fill — the
 * last stretch to 100 stays reserved for actually passing the gating quiz. */
const SECTION_CHECKS_MAX_PERCENT = 90

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
 * Coerces an untrusted best-score map. An entry survives only as a pair of
 * finite, sane numbers — a total below 1 is meaningless, and `correct` can
 * never exceed it, so a corrupt value can't fake a passed lesson.
 */
function normalizeLessonQuizBest(value: unknown): Record<string, LessonQuizScore> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, LessonQuizScore> = {}
  for (const [id, score] of Object.entries(value as Record<string, unknown>)) {
    if (!score || typeof score !== 'object' || Array.isArray(score)) continue
    const { correct, total } = score as { correct?: unknown; total?: unknown }
    if (typeof correct !== 'number' || !Number.isFinite(correct)) continue
    if (typeof total !== 'number' || !Number.isFinite(total)) continue
    const safeTotal = Math.round(total)
    if (safeTotal < 1) continue
    result[id] = {
      correct: Math.max(0, Math.min(safeTotal, Math.round(correct))),
      total: safeTotal,
    }
  }
  return result
}

/** Non-negative whole number, or `fallback` for anything else. */
function countOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback
}

/**
 * The opponent half of a duel record.
 *
 * Every field here defaults rather than rejecting the row: the avatar fields
 * were added after the first duels were already written, so a real history
 * from before then has to survive the upgrade — it simply falls back to the
 * initial-on-a-disc rendering `PlayerAvatar` already draws for an opponent
 * with no photo.
 */
function normalizeDuelOpponent(entry: Partial<DuelOpponent>): DuelOpponent {
  return {
    opponentName: typeof entry.opponentName === 'string' ? entry.opponentName : '',
    opponentPhotoURL:
      typeof entry.opponentPhotoURL === 'string' ? entry.opponentPhotoURL : '',
    opponentAvatarGender:
      entry.opponentAvatarGender === 'm' || entry.opponentAvatarGender === 'f'
        ? entry.opponentAvatarGender
        : null,
    opponentAvatarTierIndex: countOr(entry.opponentAvatarTierIndex, 0),
    // Absent on every row stored before bot duels existed, and those were all
    // real opponents — so the honest default is `false`, not "unknown".
    opponentIsBot: entry.opponentIsBot === true,
  }
}

/**
 * Coerces an untrusted recent-duels list: only well-shaped entries survive,
 * newest first, capped the same way `recordCasualDuelResult` caps it.
 */
function normalizeRecentCasualDuels(value: unknown): CasualDuelRecord[] {
  if (!Array.isArray(value)) return []
  const result: CasualDuelRecord[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Partial<CasualDuelRecord>
    if (typeof record.opponentName !== 'string') continue
    if (typeof record.won !== 'boolean') continue
    if (typeof record.xp !== 'number' || !Number.isFinite(record.xp)) continue
    if (typeof record.at !== 'number' || !Number.isFinite(record.at)) continue
    result.push({
      ...normalizeDuelOpponent(record),
      won: record.won,
      xp: Math.max(0, Math.round(record.xp)),
      foeXp: countOr(record.foeXp, 0),
      at: record.at,
    })
  }
  return result.slice(0, RECENT_CASUAL_DUELS_MAX)
}

/**
 * Same treatment for the ranked log, plus the rating pair. A row whose ratings
 * are missing (or corrupt) is kept rather than dropped — it still carries a
 * real result — and simply reads as no rating movement.
 */
function normalizeRecentRankedDuels(value: unknown): RankedDuelRecord[] {
  if (!Array.isArray(value)) return []
  const result: RankedDuelRecord[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Partial<RankedDuelRecord>
    if (typeof record.opponentName !== 'string') continue
    if (typeof record.won !== 'boolean') continue
    if (typeof record.xp !== 'number' || !Number.isFinite(record.xp)) continue
    if (typeof record.at !== 'number' || !Number.isFinite(record.at)) continue
    const ratingBefore = countOr(record.ratingBefore, 0)
    result.push({
      ...normalizeDuelOpponent(record),
      won: record.won,
      xp: Math.max(0, Math.round(record.xp)),
      foeXp: countOr(record.foeXp, 0),
      ratingBefore,
      ratingAfter: countOr(record.ratingAfter, ratingBefore),
      at: record.at,
    })
  }
  return result.slice(0, RECENT_RANKED_DUELS_MAX)
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
      ? parsed.unlockedBadges.filter(
          (id): id is string => typeof id === 'string',
        )
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
      ? parsed.peopleViewed.filter(
          (id): id is string => typeof id === 'string',
        )
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
    lessonQuizBest: normalizeLessonQuizBest(parsed.lessonQuizBest),
    sectionChecksDone: Array.isArray(parsed.sectionChecksDone)
      ? parsed.sectionChecksDone.filter(
          (id): id is string => typeof id === 'string',
        )
      : DEFAULT_STATE.sectionChecksDone,
    avatarGender:
      parsed.avatarGender === 'm' || parsed.avatarGender === 'f'
        ? parsed.avatarGender
        : DEFAULT_STATE.avatarGender,
    // Only the shape is checked here. Whether the tier is one this reader has
    // actually earned is decided where it is rendered, against live XP and (for
    // the owner tier) the signed-in identity — so a hand-edited value can't
    // display a rank the account has no claim to.
    displayedRankTier:
      typeof parsed.displayedRankTier === 'number' &&
      Number.isFinite(parsed.displayedRankTier) &&
      parsed.displayedRankTier >= 0
        ? Math.round(parsed.displayedRankTier)
        : DEFAULT_STATE.displayedRankTier,
    // Same shape-only check, resolved the same defensive way at render time.
    displayedAvatarTier:
      typeof parsed.displayedAvatarTier === 'number' &&
      Number.isFinite(parsed.displayedAvatarTier) &&
      parsed.displayedAvatarTier >= 0
        ? Math.round(parsed.displayedAvatarTier)
        : DEFAULT_STATE.displayedAvatarTier,
    casualDuels: countOr(parsed.casualDuels, DEFAULT_STATE.casualDuels),
    casualWins: countOr(parsed.casualWins, DEFAULT_STATE.casualWins),
    casualStreak: countOr(parsed.casualStreak, DEFAULT_STATE.casualStreak),
    recentCasualDuels: normalizeRecentCasualDuels(parsed.recentCasualDuels),
    rankedDuels: countOr(parsed.rankedDuels, DEFAULT_STATE.rankedDuels),
    rankedWins: countOr(parsed.rankedWins, DEFAULT_STATE.rankedWins),
    rankedStreak: countOr(parsed.rankedStreak, DEFAULT_STATE.rankedStreak),
    recentRankedDuels: normalizeRecentRankedDuels(parsed.recentRankedDuels),
  }
}

function readFor(uid: string | null): ProfileState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(storageKeyFor(uid))
    if (!raw) return DEFAULT_STATE
    return normalizeProfile(JSON.parse(raw))
  } catch {
    return DEFAULT_STATE
  }
}

// No uid is known yet at import time (auth hasn't resolved), so the module
// starts neutral rather than eagerly reading the old shared key. `session.ts`
// resolving to a signed-in user is what first calls `loadProfileForUser`,
// through `profileSync.startProfileSync`.
let currentUid: string | null = null
let state: ProfileState = DEFAULT_STATE
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
    window.localStorage.setItem(storageKeyFor(currentUid), JSON.stringify(next))
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

/**
 * Points local reads/writes at one account's own cache — `uid`'s namespaced
 * key, or the neutral default state when `uid` is `null` (signed out).
 * Called from `profileSync.ts` on sign-in (before merging the cloud copy, so
 * the merge only ever sees *this* account's own local history) and on
 * sign-out (so no trace of one account's numbers is left for the next one to
 * sign into on the same device).
 */
export function loadProfileForUser(uid: string | null): void {
  currentUid = uid
  state = readFor(uid)
  emit()
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
 * Records that a lesson was opened. This is the only progress a reader can
 * award themselves, and it deliberately tops out well below 100: opening a
 * lesson can never complete it. A lesson already further along is left alone.
 */
export function recordLessonStarted(id: string): void {
  if ((state.lessonProgress[id] ?? 0) >= LESSON_STARTED_PERCENT) return
  write({
    ...state,
    lessonProgress: { ...state.lessonProgress, [id]: LESSON_STARTED_PERCENT },
  })
}

/**
 * Records that a lesson section's inline "check yourself" mini-quiz was gone
 * through at least once (see `LessonSection.check`). Non-blocking and never
 * punishing — a wrong answer doesn't undo it, and this can only raise
 * `lessonProgress`, never lower it. Progress climbs towards
 * `SECTION_CHECKS_MAX_PERCENT` as more of the lesson's sections get checked;
 * the last stretch to 100 is reserved for `recordLessonQuizResult` passing the
 * real gating quiz, so a section check alone can never mark a lesson complete.
 */
export function recordSectionCheckDone(
  lessonId: string,
  sectionIndex: number,
  totalSections: number,
): void {
  const key = `${lessonId}:${sectionIndex}`
  if (state.sectionChecksDone.includes(key)) return

  const sectionChecksDone = [...state.sectionChecksDone, key]
  const prefix = `${lessonId}:`
  const doneForLesson = sectionChecksDone.filter((k) => k.startsWith(prefix)).length
  const sectionPercent =
    totalSections > 0
      ? Math.round((doneForLesson / totalSections) * SECTION_CHECKS_MAX_PERCENT)
      : 0
  const current = state.lessonProgress[lessonId] ?? 0

  write({
    ...state,
    sectionChecksDone,
    lessonProgress: {
      ...state.lessonProgress,
      [lessonId]: Math.max(current, LESSON_STARTED_PERCENT, sectionPercent),
    },
  })
}

/**
 * Records one attempt at a lesson's gating quiz and returns whether *this*
 * attempt reached `LESSON_PASS_RATIO`.
 *
 * The three things this has to get right:
 * - a worse retry never overwrites a better `lessonQuizBest` entry;
 * - `XP_PER_LESSON` is paid on the first pass only, never again;
 * - a failed attempt leaves `completedLessons` and `lessonProgress` untouched,
 *   so it can't undo a lesson that was already passed.
 *
 * The returned flag is about this attempt alone, so the result screen can say
 * "not this time" honestly even when the lesson was banked on an earlier try.
 */
export function recordLessonQuizResult(
  lessonId: string,
  correct: number,
  total: number,
): boolean {
  // An empty quiz can't be passed — it isn't a real assessment.
  if (!Number.isFinite(total) || total < 1) return false

  const safeTotal = Math.round(total)
  const safeCorrect = Math.max(
    0,
    Math.min(safeTotal, Number.isFinite(correct) ? Math.round(correct) : 0),
  )
  const ratio = safeCorrect / safeTotal
  const passed = ratio >= LESSON_PASS_RATIO

  const best = state.lessonQuizBest[lessonId]
  const beatsBest = !best || ratio > best.correct / best.total
  const completes = passed && !state.completedLessons.includes(lessonId)

  write({
    ...state,
    xp: completes ? state.xp + XP_PER_LESSON : state.xp,
    lessonProgress: passed
      ? { ...state.lessonProgress, [lessonId]: 100 }
      : state.lessonProgress,
    completedLessons: completes
      ? [...state.completedLessons, lessonId]
      : state.completedLessons,
    lessonQuizBest: beatsBest
      ? {
          ...state.lessonQuizBest,
          [lessonId]: { correct: safeCorrect, total: safeTotal },
        }
      : state.lessonQuizBest,
  })

  return passed
}

/**
 * Records the XP one finished battle earned (see `src/lib/battle.ts`).
 *
 * Battle XP is real XP: it feeds the same `xp` field every level and rank in
 * the app is read from, exactly like `XP_PER_LESSON` does. Nothing else about
 * the profile moves — a duel is not a quiz, so `quizzesCompleted` and the badge
 * set are deliberately left alone. A zero or malformed amount is ignored rather
 * than written, so a lost duel can't rewrite the profile for nothing.
 */
export function recordBattleResult(xpEarned: number): void {
  if (!Number.isFinite(xpEarned) || xpEarned <= 0) return
  write({ ...state, xp: state.xp + Math.round(xpEarned) })
}

/**
 * Records one finished casual duel for the Обычный screen's own stats and
 * recent-opponents list. Separate from `recordBattleResult`, which already
 * paid the real profile XP for both casual and ranked duels — this only
 * tracks the casual-specific numbers nothing else in the profile keeps.
 */
export function recordCasualDuelResult(
  opponent: DuelOpponent,
  won: boolean,
  xpEarned: number,
  foeXp: number,
): void {
  const entry: CasualDuelRecord = {
    ...normalizeDuelOpponent(opponent),
    opponentName: opponent.opponentName.trim(),
    won,
    xp: countOr(xpEarned, 0),
    foeXp: countOr(foeXp, 0),
    at: Date.now(),
  }
  write({
    ...state,
    casualDuels: state.casualDuels + 1,
    casualWins: won ? state.casualWins + 1 : state.casualWins,
    casualStreak: won ? state.casualStreak + 1 : 0,
    recentCasualDuels: [entry, ...state.recentCasualDuels].slice(
      0,
      RECENT_CASUAL_DUELS_MAX,
    ),
  })
}

/**
 * Records one finished ranked duel for the Рейтинг screen's own history.
 *
 * The counterpart to `recordCasualDuelResult`, and deliberately the same shape
 * of local-only bookkeeping: the *authoritative* ranked outcome — the rating
 * and this week's XP — is written to Firestore by `applyRankedResult` in
 * `src/lib/battle.ts` and is untouched by this. All this keeps is the personal
 * log that mirror has no room for: who it was against, what the score was, and
 * where the rating stood on either side of the duel.
 */
export function recordRankedDuelResult(params: {
  opponent: DuelOpponent
  won: boolean
  xpEarned: number
  foeXp: number
  ratingBefore: number
  ratingAfter: number
}): void {
  const ratingBefore = countOr(params.ratingBefore, 0)
  const entry: RankedDuelRecord = {
    ...normalizeDuelOpponent(params.opponent),
    opponentName: params.opponent.opponentName.trim(),
    won: params.won,
    xp: countOr(params.xpEarned, 0),
    foeXp: countOr(params.foeXp, 0),
    ratingBefore,
    ratingAfter: countOr(params.ratingAfter, ratingBefore),
    at: Date.now(),
  }
  write({
    ...state,
    rankedDuels: state.rankedDuels + 1,
    rankedWins: params.won ? state.rankedWins + 1 : state.rankedWins,
    rankedStreak: params.won ? state.rankedStreak + 1 : 0,
    recentRankedDuels: [entry, ...state.recentRankedDuels].slice(
      0,
      RECENT_RANKED_DUELS_MAX,
    ),
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

/** Records which gendered title track the rank is read from. */
export function setAvatarGender(gender: AvatarGender): void {
  if (state.avatarGender === gender) return
  write({ ...state, avatarGender: gender })
}

/** Records which earned tier to show off; `null` restores "whatever XP reaches". */
export function setDisplayedRankTier(tier: number | null): void {
  if (state.displayedRankTier === tier) return
  write({ ...state, displayedRankTier: tier })
}

/** Records which earned tier's avatar art to show off; `null` matches the title tier. */
export function setDisplayedAvatarTier(tier: number | null): void {
  if (state.displayedAvatarTier === tier) return
  write({ ...state, displayedAvatarTier: tier })
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
