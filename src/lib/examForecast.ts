import { contextBlocks } from '../data/contextBlocks'
import { schoolVariants } from '../data/schoolVariants'
import type { ContextBlock } from '../data/types'
import { EXAM_TOTAL } from './exam'
import { localDateString, profileUid } from './progress'

/**
 * "If you keep going at this pace" — the idea carried over from Nysana
 * (`C:\Users\erlan\nysana`), rebuilt on the one measurement TarihHub actually
 * has: finished ҰБТ mocks. A mock is the same twenty tasks as the history
 * part of the real paper, so its score is the most direct reading there is;
 * the forecast is a straight line through those readings.
 *
 * Kept on the device, per account, the way Nysana kept its whole state — not
 * in the synced profile, whose Firestore rules list every key and would reject
 * the whole profile write over one unknown field.
 */

export interface ExamAttempt {
  /** Local `YYYY-MM-DD` the mock was finished on. */
  day: string
  correct: number
  total: number
  /** The school booklet's number; absent for a drawn TarihHub variant. */
  variant?: string
  /**
   * The paper's two stimuli, as `stimulusId`s. Absent on records written
   * before it was stored — `blocksOf` says what such a record is taken for.
   */
  blocks?: string[]
}

export interface ExamForecast {
  /** Distinct days with a counted mock. */
  days: number
  /** Finished mocks on record, and how many of them count toward the forecast. */
  recorded: number
  counted: number
  /** Days still needed before a pace exists. 0 once `ahead` can be computed. */
  daysNeeded: number
  /** Current level out of `EXAM_TOTAL`, or `null` with no mock at all. */
  now: number | null
  /** How sure `now` is — the band drawn on the scale. */
  nowBand: { low: number; high: number } | null
  /** Where the line lands `HORIZON_DAYS` from the latest mock; `null` until enough days. */
  ahead: { score: number; low: number; high: number } | null
  /** True when the band is too wide to say anything — mocks too close together or too uneven. */
  unclear: boolean
}

/** A pace needs a line, and a line through two points has no error to show. */
export const FORECAST_MIN_DAYS = 3
/** Fixed and named in the UI — no exam date is assumed anywhere. */
export const HORIZON_DAYS = 30
/** Wider than this (in tasks) and the band says nothing a student can use. */
const MAX_USEFUL_BAND = 8
/** Only the recent pace matters; a September score says little about November. */
const MAX_POINTS = 10
const MAX_STORED = 60
const STORAGE_KEY_BASE = 'tarihhub_exam_attempts_v1'

const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

const clamp = (v: number) => Math.max(0, Math.min(EXAM_TOTAL, v))

/** 95 % — the Wilson interval's z. */
const Z = 1.96

/**
 * Wilson score interval for `k` right out of `n` tasks, on the 0–20 scale.
 * Unlike mean ± z·sd it stays open at 0 and at the maximum — one paper at 20
 * of 20 is not proof of a certain 20 — and it narrows as the tasks add up.
 */
function wilsonBand(k: number, n: number): { low: number; high: number } {
  const p = k / n
  const z2 = Z * Z
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n)
  const half = (Z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return { low: clamp((centre - half) * EXAM_TOTAL), high: clamp((centre + half) * EXAM_TOTAL) }
}

/** The share right, pulled off 0 and 1 to the Wilson centre: a paper of 20/20 still has noise. */
const wilsonCentre = (k: number, n: number) => (k + (Z * Z) / 2) / (n + Z * Z)

/*
 * A block's identity as a text, not as an id. A booklet that reuses a bank
 * block re-stamps it with its own task numbers (`sch-93710-ctx2` is
 * `ctx-1916`), so the id alone would call a passage already read new. Matched
 * against the bank by the stimulus itself; a booklet's own text keeps its id.
 */
const stimulusKey = (b: ContextBlock) =>
  JSON.stringify([b.kind, b.title, b.passage, b.map, b.mapImage, b.figures])
const bankByStimulus = new Map(contextBlocks.map((b) => [stimulusKey(b), b.id]))

export function stimulusId(block: ContextBlock): string {
  return bankByStimulus.get(stimulusKey(block)) ?? block.id
}

/**
 * The stimuli an attempt's paper carried. A record from before `blocks` was
 * stored still names its booklet, and a booklet is fixed, so its blocks are
 * read off the booklet. A drawn variant from then is unknown: `null`.
 */
function blocksOf(a: ExamAttempt): string[] | null {
  if (a.blocks) return a.blocks
  const booklet = a.variant ? schoolVariants.find((v) => v.id === a.variant) : undefined
  return booklet ? booklet.blocks.map(stimulusId) : null
}

export function forecastExam(attempts: ExamAttempt[], horizon = HORIZON_DAYS): ExamForecast {
  // One point per day: three mocks in one evening are one reading, not a trend.
  // A paper whose context the student has already read measures memory of
  // that passage, not the student: drawn variants share a small pool of
  // blocks, and booklets reuse bank blocks too. So a mock counts only if none
  // of its blocks was in an earlier mock on record, counted or not — and a
  // booklet only on its first sitting, whose standalone tasks are new too.
  // A record that cannot name its blocks (a drawn variant from before they
  // were stored) counts only as the first on record, where nothing came
  // before it, and marks nothing as read; that leak is confined to histories
  // from before the change, which exist only on the test contour.
  const byDay = new Map<string, { k: number; tasks: number; scores: number[] }>()
  const sat = new Set<string>()
  const seen = new Set<string>()
  let recorded = 0
  for (const a of attempts) {
    if (a.total <= 0) continue
    recorded += 1
    const blocks = blocksOf(a)
    const fresh = blocks ? blocks.every((b) => !seen.has(b)) : recorded === 1
    for (const b of blocks ?? []) seen.add(b)
    const repeat = a.variant !== undefined && sat.has(a.variant)
    if (a.variant) sat.add(a.variant)
    if (!fresh || repeat) continue
    const day = byDay.get(a.day) ?? { k: 0, tasks: 0, scores: [] }
    day.k += a.correct
    day.tasks += a.total
    day.scores.push((a.correct / a.total) * EXAM_TOTAL)
    byDay.set(a.day, day)
  }
  const counted = [...byDay.values()].reduce((s, d) => s + d.scores.length, 0)
  const points = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-MAX_POINTS)
    .map(([day, { k, tasks, scores }]) => ({
      x: dayNumber(day),
      y: scores.reduce((s, v) => s + v, 0) / scores.length,
      n: scores.length,
      k,
      tasks,
    }))

  const n = points.length
  const empty = { days: n, recorded, counted, ahead: null, unclear: false }
  if (n === 0) return { ...empty, daysNeeded: FORECAST_MIN_DAYS, now: null, nowBand: null }
  if (n < FORECAST_MIN_DAYS) {
    // No line yet: the level is the share of every counted task answered
    // right, and its band the Wilson interval of that share.
    const k = points.reduce((s, p) => s + p.k, 0)
    const tasks = points.reduce((s, p) => s + p.tasks, 0)
    return {
      ...empty,
      daysNeeded: FORECAST_MIN_DAYS - n,
      now: (k / tasks) * EXAM_TOTAL,
      nowBand: wilsonBand(k, tasks),
    }
  }

  const xBar = points.reduce((s, p) => s + p.x, 0) / n
  const yBar = points.reduce((s, p) => s + p.y, 0) / n
  const sxx = points.reduce((s, p) => s + (p.x - xBar) ** 2, 0)
  const slope = points.reduce((s, p) => s + (p.x - xBar) * (p.y - yBar), 0) / sxx
  const at = (x: number) => yBar + slope * (x - xBar)

  // A day's score is never exact: one twenty-task paper alone swings by
  // binomial noise. So the scatter around the line is floored at that noise —
  // three points that happen to sit on a line do not make a certain forecast.
  // The share is taken at its Wilson centre, or three perfect papers would
  // floor the noise at zero and draw a band of no width.
  const residual = points.reduce((s, p) => s + (p.y - at(p.x)) ** 2, 0) / (n - 2)
  const paperNoise =
    points.reduce((s, p) => {
      const q = wilsonCentre(p.k, p.tasks)
      return s + (EXAM_TOTAL * q * (1 - q)) / p.n
    }, 0) / n
  const scatter = Math.max(residual, paperNoise)

  const last = points[n - 1].x
  const target = last + horizon
  const score = clamp(at(target))
  const q = wilsonCentre(score, EXAM_TOTAL)
  // Uncertainty of the line at the target plus the noise of the one paper sat there.
  const sd = Math.sqrt(scatter * (1 / n + (target - xBar) ** 2 / sxx) + EXAM_TOTAL * q * (1 - q))
  const low = clamp(score - 1.28 * sd)
  const high = clamp(score + 1.28 * sd)

  const now = clamp(at(last))
  const nowSd = Math.sqrt(scatter * (1 / n + (last - xBar) ** 2 / sxx))

  return {
    days: n,
    recorded,
    counted,
    daysNeeded: 0,
    now,
    nowBand: { low: clamp(now - 1.28 * nowSd), high: clamp(now + 1.28 * nowSd) },
    ahead: { score: Math.round(score), low: Math.round(low), high: Math.round(high) },
    unclear: high - low > MAX_USEFUL_BAND,
  }
}

const storageKey = () => {
  const uid = profileUid()
  return uid ? `${STORAGE_KEY_BASE}_${uid}` : STORAGE_KEY_BASE
}

export function readExamAttempts(): ExamAttempt[] {
  try {
    const raw = window.localStorage.getItem(storageKey())
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.filter(
      (a): a is ExamAttempt =>
        typeof a?.day === 'string' &&
        typeof a?.correct === 'number' &&
        typeof a?.total === 'number' &&
        (a.variant === undefined || typeof a.variant === 'string') &&
        (a.blocks === undefined ||
          (Array.isArray(a.blocks) && a.blocks.every((b: unknown) => typeof b === 'string'))),
    )
  } catch {
    return []
  }
}

/**
 * Appends one finished mock and returns the history including it. `blocks`
 * are the paper's context blocks; without them a drawn variant cannot prove
 * its passages were new and stays out of the forecast unless it is the first.
 */
export function recordExamAttempt(
  correct: number,
  total: number,
  variant?: string,
  blocks?: ContextBlock[],
): ExamAttempt[] {
  const attempt: ExamAttempt = { day: localDateString(), correct, total }
  if (variant) attempt.variant = variant
  if (blocks) attempt.blocks = blocks.map(stimulusId)
  const next = [...readExamAttempts(), attempt].slice(-MAX_STORED)
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(next))
  } catch {
    /* storage unavailable — the forecast still shows this session's history */
  }
  return next
}

/** Best score per school booklet, for the shelf. */
export function bestByVariant(attempts: ExamAttempt[]): Map<string, ExamAttempt> {
  const best = new Map<string, ExamAttempt>()
  for (const a of attempts) {
    if (!a.variant) continue
    const prev = best.get(a.variant)
    if (!prev || a.correct > prev.correct) best.set(a.variant, a)
  }
  return best
}

/*
 * The student's own exam day, for the "N days left" line. Nysana defaulted it
 * to 15 June, a guess; the real date is on the student's own ҰБТ pass, so here
 * there is no default and the screen asks for it.
 */
const DATE_KEY_BASE = 'tarihhub_exam_date_v1'

const dateKey = () => {
  const uid = profileUid()
  return uid ? `${DATE_KEY_BASE}_${uid}` : DATE_KEY_BASE
}

/** The saved exam day as local `YYYY-MM-DD`, or `null` if never set. */
export function readExamDate(): string | null {
  try {
    const raw = window.localStorage.getItem(dateKey())
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
  } catch {
    return null
  }
}

export function saveExamDate(day: string | null): void {
  try {
    if (day) window.localStorage.setItem(dateKey(), day)
    else window.localStorage.removeItem(dateKey())
  } catch {
    /* storage unavailable — the line simply stays hidden */
  }
}

/** Whole days from `today` to `day`, both local `YYYY-MM-DD`; never negative. */
export function daysUntilExam(day: string, today = localDateString()): number {
  const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000))
}
