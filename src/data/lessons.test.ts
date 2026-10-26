/**
 * Nothing used to validate `lessons.ts`, which is why a round of fact-checking
 * could rewrite 57 section bodies and leave every one of their `check` arrays
 * byte-identical — so a scored answer went on asserting what its own body had
 * just stopped saying. `tsc` cannot see that and no test looked, so eleven
 * questions taught the wrong thing until a review read the diff by hand.
 *
 * These guards are the invariants that review actually caught bugs with. They
 * are deliberately about meaning, not shape: a question whose key contradicts
 * its lesson is the defect that matters here, because a reader who learned the
 * body correctly is then marked wrong by the gate that decides completion.
 */
import { describe, expect, it } from 'vitest'
import { allLessons } from './lessons'
import { lessonQuestions } from './lessonQuestions'
import { lessonsMeta } from './lessonsMeta'

const everyCheck = allLessons.flatMap((lesson) =>
  lesson.sections.flatMap((section, sectionIndex) =>
    (section.check ?? []).map((check) => ({ lesson, section, sectionIndex, check })),
  ),
)

/** Thin spaces inside grouped figures ("188 800") must not split a number. */
const digitsOf = (text: string) =>
  new Set(text.replace(/[    ]/g, '').match(/\d{3,}/g) ?? [])

describe('the lesson course', () => {
  it('is summarised by lessonsMeta entry for entry', () => {
    // Home renders `passedLessons / lessonsMeta.length` while CourseOutline
    // counts `allLessons`. When this file went stale at 62 against 64, a
    // student who finished everything saw "62 / 62" and a full bar with two
    // lessons untouched, and the two newest never appeared in the
    // continue-learning list at all. There is no generator, so only this
    // catches it.
    expect(lessonsMeta.map((meta) => meta.id)).toEqual(allLessons.map((lesson) => lesson.id))
    for (const [index, lesson] of allLessons.entries()) {
      expect(lessonsMeta[index]).toEqual({
        id: lesson.id,
        unitId: lesson.unitId,
        order: lesson.order,
        title: lesson.title,
        eraKey: lesson.eraKey,
      })
    }
  })

  it('is studied in an unbroken order inside every unit', () => {
    // The course is sequenced by unit rank then `order`, not by array
    // position, so a gap or a collision silently reorders or hides a lesson.
    const byUnit = new Map<string, number[]>()
    for (const lesson of allLessons) {
      const orders = byUnit.get(lesson.unitId) ?? []
      orders.push(lesson.order)
      byUnit.set(lesson.unitId, orders)
    }
    for (const [unitId, orders] of byUnit) {
      const expected = orders.map((_, index) => index + 1)
      expect([...orders].sort((a, b) => a - b), `${unitId} runs 1..n`).toEqual(expected)
    }
  })

  it('gives every lesson its own gating questions', () => {
    // `buildLessonQuiz` reserves 60% of the quiz for dedicated questions and
    // fills the rest from section checks. A lesson with none serves a quiz
    // built only from the widget the reader just answered, and its pass mark
    // gets harsher because the mark is a ratio of however many it could find.
    const covered = new Set(lessonQuestions.flatMap((question) => question.lessonIds ?? []))
    const uncovered = allLessons.filter((lesson) => !covered.has(lesson.id)).map((lesson) => lesson.id)
    expect(uncovered).toEqual([])
  })
})

describe('every inline section check', () => {
  it('exists under a unique id', () => {
    const ids = everyCheck.map(({ check }) => check.id)
    expect(ids.length).toBe(new Set(ids).size)
    expect(allLessons.length).toBe(new Set(allLessons.map((lesson) => lesson.id)).size)
  })

  it('offers four distinct options with exactly one of them scored', () => {
    for (const { check } of everyCheck) {
      const ids = check.options.map((option) => option.id)
      expect(ids.length, check.id).toBe(4)
      expect(new Set(ids).size, check.id).toBe(4)
      expect(ids, check.id).toContain(check.correctId)
      for (const lang of ['kz', 'ru'] as const) {
        const labels = check.options.map((option) => option.label[lang])
        expect(new Set(labels).size, `${check.id} ${lang} has no duplicate options`).toBe(4)
        for (const label of labels) expect(label.trim(), check.id).not.toBe('')
        expect(check.question[lang].trim(), check.id).not.toBe('')
        expect(check.explanation[lang].trim(), check.id).not.toBe('')
      }
    }
  })

  it('never scores an answer carrying a figure its own section does not state', () => {
    // This is the invariant that caught the real bugs: a body corrected to
    // "Менгу-Тимур (1266–1280)" left a sibling check still scoring
    // "1267–1280", and a body giving "точно — 1720" left one scoring "более
    // 1700". A reader who absorbed the section then has no matching option.
    // SectionCheckQuestion's own contract in types.ts requires the answer to
    // come from that section's body alone, so a figure appearing nowhere in
    // the section, its heading, the question or the explanation is a defect.
    const unsupported: string[] = []
    for (const { lesson, section, sectionIndex, check } of everyCheck) {
      const correct = check.options.find((option) => option.id === check.correctId)
      if (!correct) continue // the previous test owns this failure
      for (const lang of ['kz', 'ru'] as const) {
        const stated = digitsOf(
          [section.heading[lang], section.body[lang], check.question[lang], check.explanation[lang]].join(' '),
        )
        for (const figure of digitsOf(correct.label[lang])) {
          if (!stated.has(figure)) {
            unsupported.push(`${lesson.id} §${sectionIndex + 1} ${check.id} [${lang}] — ${figure}`)
          }
        }
      }
    }
    expect(unsupported).toEqual([])
  })

  it('does not put the scored answer in a predictable slot', () => {
    // The data was safe only as long as every renderer shuffled: 1873 of 1874
    // checks scored option 'a', so any surface that rendered them in
    // declaration order would hand over the whole bank at once. Note that
    // "never first" is not a fix either — a reader learns that rule just as
    // fast, and it lifts a blind guess from 25% to 33%. What this pins is an
    // even spread, which is why the bound is two-sided.
    const spread = new Map<string, number>()
    for (const { check } of everyCheck) {
      spread.set(check.correctId, (spread.get(check.correctId) ?? 0) + 1)
    }
    expect([...spread.keys()].sort()).toEqual(['a', 'b', 'c', 'd'])
    for (const [id, count] of spread) {
      const share = count / everyCheck.length
      expect(share, `option ${id} holds ${(share * 100).toFixed(1)}% of the keys`).toBeGreaterThan(0.15)
      expect(share, `option ${id} holds ${(share * 100).toFixed(1)}% of the keys`).toBeLessThan(0.35)
    }
  })
})
