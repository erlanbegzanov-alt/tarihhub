import { describe, expect, it } from 'vitest'
import { forecastExam } from './examForecast'

const at = (day: string, correct: number) => ({ day, correct, total: 20 })

describe('forecastExam', () => {
  it('says nothing with no mock at all', () => {
    const f = forecastExam([])
    expect(f.now).toBeNull()
    expect(f.ahead).toBeNull()
    expect(f.daysNeeded).toBe(3)
  })

  it('counts days, not attempts — three mocks in one evening are one reading', () => {
    const f = forecastExam([at('2026-11-01', 10), at('2026-11-01', 12), at('2026-11-01', 14)])
    expect(f.days).toBe(1)
    expect(f.daysNeeded).toBe(2)
    expect(f.now).toBe(12)
    expect(f.ahead).toBeNull()
  })

  it('projects a steady weekly rise forward a month, inside a band', () => {
    const f = forecastExam([at('2026-10-01', 8), at('2026-10-08', 9), at('2026-10-15', 10), at('2026-10-22', 11)])
    expect(f.now).toBeCloseTo(11)
    // ~1 task a week, a little over four weeks ahead.
    expect(f.ahead!.score).toBe(15)
    expect(f.ahead!.low).toBeLessThan(15)
    expect(f.ahead!.high).toBeGreaterThan(15)
    expect(f.ahead!.high).toBeLessThanOrEqual(20)
  })

  it('refuses to extrapolate three mocks on consecutive days a month ahead', () => {
    // A line through three neighbouring days is pure noise thirty days out.
    const f = forecastExam([at('2026-11-01', 9), at('2026-11-02', 11), at('2026-11-03', 13)])
    expect(f.ahead).not.toBeNull()
    expect(f.unclear).toBe(true)
  })

  it('never forecasts outside 0–20', () => {
    const f = forecastExam([at('2026-09-01', 14), at('2026-09-15', 17), at('2026-10-01', 20)])
    expect(f.ahead!.score).toBeLessThanOrEqual(20)
    expect(f.ahead!.low).toBeGreaterThanOrEqual(0)
  })
})
