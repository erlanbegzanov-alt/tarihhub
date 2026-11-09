import { describe, expect, it } from 'vitest'
import type { ExamAttempt } from './examForecast'
import { dayLabel, examHistory, minutesOf } from './examHistory'

const at = (day: string, correct: number, extra: Partial<ExamAttempt> = {}): ExamAttempt => ({
  day,
  correct,
  total: 20,
  ...extra,
})

describe('examHistory', () => {
  it('is empty and waiting for the first mark with no attempts', () => {
    const h = examHistory([])
    expect(h.count).toBe(0)
    expect(h.best).toBeNull()
    expect(h.average).toBeNull()
    expect(h.averageMs).toBeNull()
    expect(h.nextMilestone).toBe(1)
    expect(h.lastMilestone).toBe(0)
    expect(h.rows).toEqual([])
  })

  it('marks a record only when a paper beats every one before it', () => {
    const h = examHistory([at('2026-11-01', 9), at('2026-11-02', 12), at('2026-11-03', 12), at('2026-11-04', 10)])
    // Newest first on screen.
    expect(h.rows.map((r) => [r.attempt.correct, r.record])).toEqual([
      [10, false],
      [12, false],
      [12, true],
      [9, true],
    ])
    expect(h.best?.day).toBe('2026-11-02')
    expect(h.average).toBe(10.75)
  })

  it('counts distinct booklets and leaves drawn variants out of that count', () => {
    const h = examHistory([
      at('2026-11-01', 8, { variant: '93002' }),
      at('2026-11-02', 9, { variant: '93002' }),
      at('2026-11-03', 9, { variant: '93506' }),
      at('2026-11-04', 9),
    ])
    expect(h.bookletsDone).toBe(2)
  })

  it('averages time only over the attempts that stored it', () => {
    // Records from before the field existed have no `ms` and must not count as zero.
    const h = examHistory([at('2026-11-01', 8), at('2026-11-02', 9, { ms: 30 * 60_000 }), at('2026-11-03', 9, { ms: 40 * 60_000 })])
    expect(h.averageMs).toBe(35 * 60_000)
  })

  it('runs the milestone bar from the mark just passed to the next', () => {
    const four = examHistory(Array.from({ length: 4 }, (_, i) => at(`2026-11-0${i + 1}`, 10)))
    expect([four.lastMilestone, four.nextMilestone]).toEqual([3, 5])
    const sixty = examHistory(Array.from({ length: 60 }, () => at('2026-11-01', 10)))
    expect([sixty.lastMilestone, sixty.nextMilestone]).toEqual([50, null])
  })
})

describe('labels', () => {
  it('writes the day out in both languages', () => {
    expect(dayLabel('2026-11-09', 'kz')).toBe('9 қараша')
    expect(dayLabel('2026-01-31', 'ru')).toBe('31 января')
  })

  it('never shows zero minutes', () => {
    expect(minutesOf(40_000)).toBe(1)
    expect(minutesOf(31.6 * 60_000)).toBe(32)
  })
})
