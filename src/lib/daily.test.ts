/**
 * The daily set's two promises fail silently if they ever break — a reader
 * would just see a different question from their classmate, or one they
 * answered last week, and neither surfaces as an error. So they are asserted
 * here rather than trusted to the implementation reading correctly.
 */
import { describe, expect, it } from 'vitest'
import { battleQuestions } from '../data/battleQuestions'
import {
  DAILY_MIX,
  DAILY_SIZE,
  dailyDone,
  dailyQuestionIds,
  dayNumber,
  nextDailyStreak,
  streakAlive,
} from './daily'

/** A run of consecutive `YYYY-MM-DD` strings starting at `from`. */
function days(from: string, count: number): string[] {
  const [year, month, day] = from.split('-').map(Number)
  const start = Date.UTC(year, month - 1, day)
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  )
}

describe('the daily set', () => {
  it('draws exactly the advertised number of questions', () => {
    expect(DAILY_MIX.reduce((a, b) => a + b, 0)).toBe(DAILY_SIZE)
    expect(dailyQuestionIds('2026-09-30')).toHaveLength(DAILY_SIZE)
  })

  it('gives the same five for the same date, every time it is asked', () => {
    // The whole point: two classmates on two devices must be able to argue
    // about question 3. Anything reaching for `Math.random` breaks here.
    const first = dailyQuestionIds('2026-10-01')
    const second = dailyQuestionIds('2026-10-01')
    expect(second).toEqual(first)
  })

  it('serves questions that actually exist in the bank', () => {
    // An id with no question behind it renders as a blank card rather than an
    // error, so it would reach a reader before it reached anyone else.
    const known = new Set(battleQuestions.map((question) => question.id))
    for (const date of days('2026-10-01', 30)) {
      for (const id of dailyQuestionIds(date)) expect(known.has(id)).toBe(true)
    }
  })

  it('never repeats a question inside one day', () => {
    for (const date of days('2026-10-01', 60)) {
      const ids = dailyQuestionIds(date)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('does not come round again for at least 100 days', () => {
    // The ring is what buys this. An independent random draw per day would
    // collide within weeks out of pools this size, and a reader who meets a
    // question they answered on Tuesday stops believing the set is new.
    const seen = new Map<string, string>()
    for (const date of days('2026-10-01', 100)) {
      for (const id of dailyQuestionIds(date)) {
        expect(seen.get(id), `${id} repeated on ${date}, first seen ${seen.get(id)}`).toBeUndefined()
        seen.set(id, date)
      }
    }
    expect(seen.size).toBe(100 * DAILY_SIZE)
  })

  it('moves on from one day to the next', () => {
    const today = dailyQuestionIds('2026-10-01')
    const tomorrow = dailyQuestionIds('2026-10-02')
    expect(tomorrow).not.toEqual(today)
    expect(tomorrow.filter((id) => today.includes(id))).toEqual([])
  })
})

describe('dayNumber', () => {
  it('counts consecutive calendar days as one apart, across month and year ends', () => {
    expect(dayNumber('2026-10-02') - dayNumber('2026-10-01')).toBe(1)
    expect(dayNumber('2026-11-01') - dayNumber('2026-10-31')).toBe(1)
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1)
    // A leap day is the case a hand-rolled month table gets wrong.
    expect(dayNumber('2028-03-01') - dayNumber('2028-02-29')).toBe(1)
  })
})

describe('the daily streak', () => {
  it('grows by one when yesterday was done', () => {
    expect(nextDailyStreak('2026-09-29', 4, '2026-09-30')).toBe(5)
  })

  it('starts at one for a reader who has never finished a set', () => {
    expect(nextDailyStreak('', 0, '2026-09-30')).toBe(1)
  })

  it('resets to one after a missed day, however long the streak was', () => {
    // Deliberately harsh: a streak that survives a gap is not a reason to come
    // back, and this is the only behaviour in the module a reader really feels.
    expect(nextDailyStreak('2026-09-28', 40, '2026-09-30')).toBe(1)
  })

  it('does not double-count a second finish on the same day', () => {
    expect(nextDailyStreak('2026-09-30', 5, '2026-09-30')).toBe(5)
  })

  it('knows when the streak is still alive and when it is already gone', () => {
    expect(streakAlive('2026-09-30', '2026-09-30')).toBe(true)
    // Finished yesterday, today not started yet — still standing, and this is
    // the state the home screen has to nag in rather than show as broken.
    expect(streakAlive('2026-09-29', '2026-09-30')).toBe(true)
    expect(streakAlive('2026-09-28', '2026-09-30')).toBe(false)
    expect(streakAlive('', '2026-09-30')).toBe(false)
  })

  it('reports today as done only for today', () => {
    expect(dailyDone('2026-09-30', '2026-09-30')).toBe(true)
    expect(dailyDone('2026-09-29', '2026-09-30')).toBe(false)
    expect(dailyDone('', '2026-09-30')).toBe(false)
  })
})
