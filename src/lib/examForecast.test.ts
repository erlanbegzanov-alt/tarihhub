import { describe, expect, it } from 'vitest'
import { schoolVariants } from '../data/schoolVariants'
import { bestByVariant, daysUntilExam, forecastExam, stimulusId } from './examForecast'

/** A drawn variant whose two blocks no earlier paper had. */
let fresh = 0
const at = (day: string, correct: number) => ({
  day,
  correct,
  total: 20,
  blocks: [`new-${++fresh}`, `new-${++fresh}`],
})
const drawn = (day: string, correct: number, blocks: string[]) => ({ day, correct, total: 20, blocks })
const width = (b: { low: number; high: number } | null) => b!.high - b!.low

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

describe('the band (Wilson, 95 %)', () => {
  it('stays open at 0 of 20 — one paper is not a certain zero', () => {
    const f = forecastExam([at('2026-11-01', 0)])
    expect(f.now).toBe(0)
    expect(f.nowBand!.low).toBe(0)
    expect(f.nowBand!.high).toBeCloseTo(3.22, 1)
  })

  it('stays open at 20 of 20', () => {
    const f = forecastExam([at('2026-11-01', 20)])
    expect(f.now).toBe(20)
    expect(f.nowBand!.high).toBe(20)
    expect(f.nowBand!.low).toBeCloseTo(16.78, 1)
  })

  it('holds the reading and narrows as papers add up', () => {
    const one = forecastExam([at('2026-11-01', 12)])
    const many = forecastExam(
      Array.from({ length: 8 }, (_, i) => at(i < 4 ? '2026-11-01' : '2026-11-02', 12)),
    )
    expect(many.counted).toBe(8)
    for (const f of [one, many]) {
      expect(f.now).toBe(12)
      expect(f.nowBand!.low).toBeLessThan(12)
      expect(f.nowBand!.high).toBeGreaterThan(12)
    }
    // Eight times the tasks: close to √8 narrower.
    expect(width(many.nowBand)).toBeLessThan(width(one.nowBand) / 2)
  })

  it('keeps a width once there is a line, even through perfect papers', () => {
    const f = forecastExam([at('2026-10-01', 20), at('2026-10-08', 20), at('2026-10-15', 20)])
    expect(f.now).toBe(20)
    expect(width(f.nowBand)).toBeGreaterThan(0)
    expect(f.ahead!.low).toBeLessThan(20)
  })
})

describe('contexts already read', () => {
  /** A booklet that carries a bank block under its own ids, and that block's bank id. */
  const reuse = schoolVariants
    .flatMap((v) => v.blocks.map((b) => ({ booklet: v.id, bank: stimulusId(b), own: b.id })))
    .find((r) => r.bank !== r.own)!

  it('leave out a drawn variant that repeats a block of any earlier mock', () => {
    const f = forecastExam([
      drawn('2026-11-01', 8, ['ctx-1822', 'ctx-1916']),
      drawn('2026-11-02', 15, ['ctx-1916', 'ctx-tyn']),
      // ctx-tyn came in a mock that was itself left out — it was still read.
      drawn('2026-11-03', 16, ['ctx-tyn', 'ctx-zhargy']),
    ])
    expect(f.recorded).toBe(3)
    expect(f.counted).toBe(1)
    expect(f.days).toBe(1)
    expect(f.now).toBe(8)
  })

  it('count drawn variants whose blocks are all new', () => {
    const f = forecastExam([
      drawn('2026-11-01', 8, ['ctx-1822', 'ctx-1916']),
      drawn('2026-11-02', 10, ['ctx-tyn', 'ctx-zhargy']),
    ])
    expect(f.counted).toBe(2)
    expect(f.now).toBe(9)
  })

  it('match a booklet block re-stamped with its own ids to the bank block it copies', () => {
    expect(reuse).toBeDefined()
    const booklet = schoolVariants.find((v) => v.id === reuse.booklet)!
    const block = booklet.blocks.find((b) => b.id === reuse.own)!
    expect(stimulusId({ ...block, id: 'renamed' })).toBe(reuse.bank)
    // A booklet's own text is not in the bank and keeps whatever id it has.
    const own = schoolVariants
      .flatMap((v) => v.blocks)
      .find((b) => b.id.startsWith('sch-') && stimulusId(b) === b.id)!
    expect(stimulusId({ ...own, id: 'renamed' })).toBe('renamed')
  })

  it('treat a booklet sharing a bank block as a repeat, in either order', () => {
    const booklet = { day: '2026-11-02', correct: 18, total: 20, variant: reuse.booklet }
    const after = forecastExam([drawn('2026-11-01', 8, [reuse.bank, 'other']), booklet])
    expect(after.counted).toBe(1)
    expect(after.now).toBe(8)
    const before = forecastExam([
      { ...booklet, day: '2026-11-01', correct: 8 },
      drawn('2026-11-02', 18, [reuse.bank, 'other']),
    ])
    expect(before.counted).toBe(1)
    expect(before.now).toBe(8)
  })
})

describe('records from before blocks were stored', () => {
  it('count a drawn variant only as the first on record, and mark nothing read', () => {
    const f = forecastExam([
      { day: '2026-11-01', correct: 8, total: 20 },
      { day: '2026-11-02', correct: 15, total: 20 },
      drawn('2026-11-03', 10, ['ctx-1822', 'ctx-1916']),
    ])
    expect(f.recorded).toBe(3)
    expect(f.counted).toBe(2)
    expect(f.now).toBe(9)
  })

  it('still show a reading whenever any mock is on record', () => {
    const f = forecastExam([
      { day: '2026-11-01', correct: 8, total: 20 },
      { day: '2026-11-02', correct: 15, total: 20 },
    ])
    expect(f.counted).toBe(1)
    expect(f.now).toBe(8)
  })

  it('read a booklet’s blocks off the booklet itself', () => {
    const [v] = schoolVariants
    const seen = stimulusId(v.blocks[0])
    const f = forecastExam([
      { day: '2026-11-01', correct: 8, total: 20, variant: v.id },
      drawn('2026-11-02', 18, [seen, 'other']),
    ])
    expect(f.counted).toBe(1)
    expect(f.now).toBe(8)
  })
})

describe('school booklets', () => {
  it('counts only the first sitting of a booklet', () => {
    const first = { day: '2026-10-01', correct: 8, total: 20, variant: '93002' }
    const again = { day: '2026-10-08', correct: 18, total: 20, variant: '93002' }
    const f = forecastExam([first, again])
    expect(f.days).toBe(1)
    expect(f.now).toBe(8)
  })

  it('keeps the best score per booklet for the shelf', () => {
    const best = bestByVariant([
      { day: '2026-10-01', correct: 8, total: 20, variant: '93002' },
      { day: '2026-10-08', correct: 12, total: 20, variant: '93002' },
      { day: '2026-10-09', correct: 15, total: 20 },
    ])
    expect(best.get('93002')?.correct).toBe(12)
    expect(best.size).toBe(1)
  })
})

describe('daysUntilExam', () => {
  it('counts calendar days, across a month and a year end', () => {
    expect(daysUntilExam('2026-11-03', '2026-11-02')).toBe(1)
    expect(daysUntilExam('2027-01-01', '2026-12-31')).toBe(1)
    expect(daysUntilExam('2027-06-01', '2026-11-02')).toBe(211)
  })

  it('never goes below zero once the day has passed', () => {
    expect(daysUntilExam('2026-11-02', '2026-11-02')).toBe(0)
    expect(daysUntilExam('2026-10-01', '2026-11-02')).toBe(0)
  })
})
