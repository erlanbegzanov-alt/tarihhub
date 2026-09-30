import { describe, expect, it } from 'vitest'
import { codifierTopics } from './codifier'
import { contextBlocks } from './contextBlocks'
import { entQuestions } from './entQuestions'
import { lessonQuestions } from './lessonQuestions'
import { quizQuestions } from './quiz'
import type { QuizQuestion } from './types'

/**
 * Structural guards for the ҰБТ material.
 *
 * These are not "does the code run" tests — they are the exam format itself,
 * written down so it cannot drift silently. A context block that quietly grew
 * a sixth question, or a question whose Kazakh option was left empty, would
 * otherwise reach a student before anyone noticed.
 *
 * Everything asserted here traces to `history-reference/ent-exam-patterns.md`:
 * 5 questions per context block (§4.1), 4 options with exactly one correct
 * answer (§4.5, §5.1), both languages everywhere (§12.4).
 */

const LEVELS = ['A', 'B', 'C']

function checkQuestionShape(q: QuizQuestion, where: string) {
  expect(q.options, `${where}: option count`).toHaveLength(4)
  const ids = q.options.map((o) => o.id)
  expect(new Set(ids).size, `${where}: option ids unique`).toBe(4)
  expect(ids, `${where}: correctId points at a real option`).toContain(q.correctId)

  expect(q.question.kz.trim(), `${where}: kz question`).not.toBe('')
  expect(q.question.ru.trim(), `${where}: ru question`).not.toBe('')
  expect(q.explanation.kz.trim(), `${where}: kz explanation`).not.toBe('')
  expect(q.explanation.ru.trim(), `${where}: ru explanation`).not.toBe('')
  for (const o of q.options) {
    expect(o.label.kz.trim(), `${where}: kz label of ${o.id}`).not.toBe('')
    expect(o.label.ru.trim(), `${where}: ru label of ${o.id}`).not.toBe('')
  }
}

describe('ҰБТ bank tagging', () => {
  it('tags every question with a codifier topic, a level and a pattern', () => {
    for (const q of entQuestions) {
      expect(q.topicId, `${q.id}: topicId`).toBeTypeOf('number')
      // 1–52 are the subject topics; 53–55 belong to a context block, never to
      // a standalone question.
      expect(q.topicId!, `${q.id}: topicId in 1..52`).toBeGreaterThanOrEqual(1)
      expect(q.topicId!, `${q.id}: topicId in 1..52`).toBeLessThanOrEqual(52)
      expect(LEVELS, `${q.id}: level`).toContain(q.level)
      expect(q.pattern, `${q.id}: pattern`).toMatch(/^P([1-9]|1[0-6])$/)
    }
  })

  it('keeps every bank question to 4 options with one real answer, in both languages', () => {
    for (const q of entQuestions) checkQuestionShape(q, q.id)
  })

  it('never tags a ҰБТ question with lessonIds', () => {
    // Rule from the header of entQuestions.ts: passing a lesson must mean
    // knowing that lesson, so exam-prep questions stay out of lesson gating.
    for (const q of entQuestions) expect(q.lessonIds, `${q.id}`).toBeUndefined()
  })
})

describe('context blocks', () => {
  it('gives every block exactly five questions', () => {
    // §4.1: "5 заданий с выбором одного правильного ответа на основе 2 контекстов".
    expect(contextBlocks.length).toBeGreaterThanOrEqual(2)
    for (const b of contextBlocks) {
      expect(b.questions, `${b.id}: question count`).toHaveLength(5)
    }
  })

  it('files every block under a context topic, 53–55', () => {
    for (const b of contextBlocks) {
      expect(b.topicId, `${b.id}: topicId`).toBeGreaterThanOrEqual(53)
      expect(b.topicId, `${b.id}: topicId`).toBeLessThanOrEqual(55)
    }
  })

  it('gives a document block a passage and a title in both languages', () => {
    for (const b of contextBlocks.filter((x) => x.kind === 'document')) {
      expect(b.passage?.kz.trim(), `${b.id}: kz passage`).toBeTruthy()
      expect(b.passage?.ru.trim(), `${b.id}: ru passage`).toBeTruthy()
      expect(b.title.kz.trim(), `${b.id}: kz title`).not.toBe('')
      expect(b.title.ru.trim(), `${b.id}: ru title`).not.toBe('')
    }
  })

  it('keeps every block question to 4 options with one real answer, in both languages', () => {
    for (const b of contextBlocks) {
      for (const q of b.questions) checkQuestionShape(q, `${b.id}/${q.id}`)
    }
  })

  it('tags block questions with their own subject topic, level and pattern', () => {
    for (const b of contextBlocks) {
      for (const q of b.questions) {
        expect(q.topicId, `${q.id}: topicId`).toBeTypeOf('number')
        expect(LEVELS, `${q.id}: level`).toContain(q.level)
        expect(q.pattern, `${q.id}: pattern`).toMatch(/^P([1-9]|1[0-6])$/)
      }
    }
  })

  it('opens each block by making the reader identify the stimulus', () => {
    // The stimulus never names what it is, so question one always makes the
    // reader work that out. Which pattern that is depends on the stimulus: a
    // document is identified by P12 (official sample, tasks 16 and 19), a map
    // by P10 (tasks 11 and 12). P12 is defined as recognising an event *from a
    // document*, so it is not the right tag for a map and never was — the rule
    // simply predated the first map block.
    for (const b of contextBlocks) {
      expect(b.questions[0].pattern, `${b.id}: first question`).toBe(
        b.kind === 'map' ? 'P10' : 'P12',
      )
    }
  })

  it('tags every context question with a topic the codifier actually has', () => {
    // This does not catch tagging a question with the WRONG real topic — that
    // one is only caught by reading, and it has already happened twice: the
    // Golden Horde block first carried topics 30 and 31 (nineteenth century)
    // and the Soviet block carried 44 and 45 (virgin lands, stagnation). What
    // it does catch is a number that exists nowhere, which is invisible on the
    // page and silently corrupts the coverage the mock reports.
    const known = new Set(codifierTopics.map((t) => t.id))
    for (const b of contextBlocks) {
      for (const q of b.questions) {
        expect(known.has(q.topicId!), `${q.id}: topicId ${q.topicId}`).toBe(true)
      }
    }
  })

  it('gives every block the stimulus its kind promises', () => {
    // A map block with no `map` renders a title and nothing else, and its five
    // tasks become unanswerable — which is exactly the state the bank was in
    // before `ExamMapStimulus` existed.
    for (const b of contextBlocks) {
      if (b.kind === 'map') expect(b.map, `${b.id}: map`).toBeTruthy()
      else expect(b.passage, `${b.id}: passage`).toBeTruthy()
    }
  })

  it('numbers map markers from 1 with no gaps', () => {
    // The questions refer to markers by number («город под №1»), so a gap or a
    // repeat makes a question point at nothing or at two places at once.
    for (const b of contextBlocks) {
      if (!b.map) continue
      const numbers = b.map.markers.map((m) => m.n)
      expect(new Set(numbers).size, `${b.id}: repeated marker number`).toBe(numbers.length)
      expect([...numbers].sort((x, y) => x - y), `${b.id}: marker numbering`).toEqual(
        numbers.map((_, i) => i + 1),
      )
    }
  })

  it('draws routes only through markers that exist', () => {
    // An unknown number is skipped rather than drawn, so a typo here shortens
    // the line silently instead of failing — nobody would notice from the page.
    for (const b of contextBlocks) {
      if (!b.map?.route) continue
      const known = new Set(b.map.markers.map((m) => m.n))
      const unknown = b.map.route.filter((n) => !known.has(n))
      expect(unknown, `${b.id}: route points at missing markers`).toEqual([])
    }
  })

  it('puts map markers somewhere the map actually covers', () => {
    // A swapped lon/lat lands the pin in the Indian Ocean and crops the frame
    // around it, which reads as a broken map rather than a wrong coordinate.
    for (const b of contextBlocks) {
      if (!b.map) continue
      for (const m of b.map.markers) {
        expect(m.lon, `${b.id}: marker ${m.n} lon`).toBeGreaterThan(40)
        expect(m.lon, `${b.id}: marker ${m.n} lon`).toBeLessThan(95)
        expect(m.lat, `${b.id}: marker ${m.n} lat`).toBeGreaterThan(38)
        expect(m.lat, `${b.id}: marker ${m.n} lat`).toBeLessThan(57)
      }
    }
  })

  it('does not let the title or the passage give the answer away', () => {
    // A title reading "Восстание 1916 года" would turn the identification
    // question into a reading exercise.
    for (const b of contextBlocks) {
      const first = b.questions[0]
      const answer = first.options.find((o) => o.id === first.correctId)!
      expect(b.title.ru, `${b.id}: title`).not.toContain(answer.label.ru)
      expect(b.passage?.ru ?? '', `${b.id}: passage`).not.toContain(answer.label.ru)
    }
  })
})

describe('question ids', () => {
  it('stay unique across every bank that feeds the same quiz', () => {
    // `quizQuestions` already spreads in `entQuestions`, so the bank is not
    // added separately here — doing so would report all 98 as duplicates.
    const all = [
      ...quizQuestions.map((q) => q.id),
      ...lessonQuestions.map((q) => q.id),
      ...contextBlocks.flatMap((b) => b.questions.map((q) => q.id)),
    ]
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const id of all) {
      if (seen.has(id)) dupes.push(id)
      seen.add(id)
    }
    expect(dupes).toEqual([])
  })
})
