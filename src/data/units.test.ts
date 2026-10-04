/**
 * The Course screen used to pick a unit's accent colour by position in the
 * list: `ACCENTS[unit.order % 10]`. `eras` has ten entries, the course has
 * nine units, and `goldenHorde` owns no unit — so everything after it wore the
 * previous era's colour. The Kazakh Khanate was painted Golden Horde brick and
 * Independence was painted Soviet slate, in an ЕНТ history app, at full
 * saturation on the unit's left border and its number.
 *
 * The fix was to give each unit its own `eraKey`. These tests exist so the
 * next unit anybody inserts cannot quietly shift the palette back.
 */
import { describe, expect, it } from 'vitest'
import { eras } from './eras'
import type { EraKey } from './types'
import { units } from './units'

describe('course units', () => {
  it('names its own era rather than borrowing one by position', () => {
    // Eight of the nine unit titles are the era label verbatim, so a student
    // reading "Қазақ хандығы" in Golden Horde brick is reading a mistake, not
    // a decorative choice. Any title that matches an era label must carry that
    // era's key.
    const byLabel = new Map<string, EraKey>(
      Object.values(eras).map((era) => [era.label.kz, era.key]),
    )

    const matched: string[] = []
    for (const unit of units) {
      const expected = byLabel.get(unit.title.kz)
      if (!expected) continue
      matched.push(unit.id)
      expect(unit.eraKey, `${unit.id} «${unit.title.kz}»`).toBe(expected)
    }

    // Guards the guard: if the titles are ever reworded, the loop above would
    // silently test nothing at all.
    expect(matched).toHaveLength(8)
  })

  it('gives the one unit whose title is not an era label the era it teaches', () => {
    // "Ғұндар мен Түрік қағанаты" is the only title that is not a verbatim era
    // label, so it cannot be checked by matching. It teaches the Turkic era.
    const unit = units.find((u) => u.id === 'unit-2')
    expect(unit?.title.kz).toBe('Ғұндар мен Түрік қағанаты')
    expect(unit?.eraKey).toBe('turkic')
  })

  it('never paints two units the same colour', () => {
    const keys = units.map((unit) => unit.eraKey)
    expect(new Set(keys).size).toBe(units.length)
  })

  it('is studied in an unbroken order', () => {
    // `CourseOutline` sorts by `order`, so a duplicate or a gap would put two
    // units in one slot or leave a hole in the numbering a student can see.
    expect(units.map((unit) => unit.order)).toEqual(units.map((_, index) => index))
  })
})
