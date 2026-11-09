import type { ExamAttempt } from './examForecast'

/**
 * The «Тарих» tab of the mock exam: what a student has already sat, read off
 * the same attempt log the forecast uses. The forecast answers "where will I
 * land"; this answers "how much have I done", which is the number that
 * actually rewards coming back — it only ever goes up.
 *
 * Everything here is arithmetic on the stored log, so it is kept out of the
 * screen and tested.
 */

/**
 * The marks the count climbs past. Close together at the start, where a
 * student needs the first reward soon, and further apart after; fifty is
 * roughly one paper every few days from September to June.
 */
export const MILESTONES = [1, 3, 5, 10, 20, 30, 50] as const

export interface HistoryRow {
  attempt: ExamAttempt
  /** Better than every attempt before it — the first attempt counts as one. */
  record: boolean
}

export interface ExamHistory {
  count: number
  best: ExamAttempt | null
  /** Mean score out of 20, or `null` with no attempts. */
  average: number | null
  /** Mean time spent, over the attempts that stored it; `null` if none did. */
  averageMs: number | null
  /** Distinct school booklets sat at least once. */
  bookletsDone: number
  /** The next mark above `count`, or `null` once the last one is passed. */
  nextMilestone: number | null
  /** The mark just passed, so the bar can run from it to the next one. */
  lastMilestone: number
  /** Newest first. */
  rows: HistoryRow[]
}

export function examHistory(attempts: ExamAttempt[]): ExamHistory {
  const count = attempts.length
  let best: ExamAttempt | null = null
  // Compared as a share, so a paper out of a different total still ranks fairly.
  let topSoFar = -1
  const marked: HistoryRow[] = attempts.map((attempt) => {
    const share = attempt.total > 0 ? attempt.correct / attempt.total : 0
    const record = share > topSoFar
    if (record) {
      topSoFar = share
      best = attempt
    }
    return { attempt, record }
  })

  const timed = attempts.filter((a) => typeof a.ms === 'number' && a.ms > 0)
  return {
    count,
    best,
    average: count ? attempts.reduce((sum, a) => sum + a.correct, 0) / count : null,
    averageMs: timed.length ? timed.reduce((sum, a) => sum + (a.ms ?? 0), 0) / timed.length : null,
    bookletsDone: new Set(attempts.flatMap((a) => (a.variant ? [a.variant] : []))).size,
    nextMilestone: MILESTONES.find((m) => m > count) ?? null,
    lastMilestone: [...MILESTONES].reverse().find((m) => m <= count) ?? 0,
    rows: marked.reverse(),
  }
}

const MONTHS = {
  kz: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
} as const

/** `2026-11-09` → «9 қараша» / «9 ноября». Written out, not `Intl`, so both languages read the same everywhere. */
export function dayLabel(day: string, lang: 'kz' | 'ru'): string {
  const [, month, date] = day.split('-').map(Number)
  if (!month || !date) return day
  return `${date} ${MONTHS[lang][month - 1]}`
}

/** Whole minutes, at least one: a paper finished in 40 seconds still reads «1». */
export function minutesOf(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000))
}
