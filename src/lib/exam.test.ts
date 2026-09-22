import { describe, expect, it } from 'vitest'
import {
  EXAM_BLOCK_COUNT,
  EXAM_BLOCK_SIZE,
  EXAM_STANDALONE_COUNT,
  EXAM_THRESHOLD,
  EXAM_TOTAL,
  LEVEL_TARGET,
  buildExamVariant,
  formatCountdown,
  scoreExam,
} from './exam'
import type { ExamAnswers, ExamVariant } from './exam'

/** Deterministic stand-in for Math.random, so a variant can be asserted. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

function answerAll(variant: ExamVariant, howMany: number): ExamAnswers {
  const answers: ExamAnswers = {}
  variant.items.forEach((item, i) => {
    if (i < howMany) {
      answers[item.question.id] = item.question.correctId
    } else {
      // A deliberately wrong pick: the first option that is not the answer.
      const wrong = item.question.options.find((o) => o.id !== item.question.correctId)!
      answers[item.question.id] = wrong.id
    }
  })
  return answers
}

describe('buildExamVariant', () => {
  it('always builds 10 standalone + 2 blocks of 5', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const v = buildExamVariant(seeded(seed))
      expect(v.items).toHaveLength(EXAM_TOTAL)
      expect(v.blocks).toHaveLength(EXAM_BLOCK_COUNT)

      const standalone = v.items.filter((i) => i.block === null)
      expect(standalone).toHaveLength(EXAM_STANDALONE_COUNT)

      for (const block of v.blocks) {
        const inBlock = v.items.filter((i) => i.block?.id === block.id)
        expect(inBlock).toHaveLength(EXAM_BLOCK_SIZE)
      }
    }
  })

  it('numbers the tasks 1..20 with the standalone ones first', () => {
    const v = buildExamVariant(seeded(7))
    expect(v.items.map((i) => i.position)).toEqual(
      Array.from({ length: EXAM_TOTAL }, (_, i) => i + 1),
    )
    // № 1–10 standalone, № 11–20 inside the two blocks — §4.2.
    for (const item of v.items) {
      if (item.position <= EXAM_STANDALONE_COUNT) expect(item.block).toBeNull()
      else expect(item.block).not.toBeNull()
    }
  })

  it('keeps every block question together and in its authored order', () => {
    const v = buildExamVariant(seeded(11))
    for (const block of v.blocks) {
      const positions = v.items
        .filter((i) => i.block?.id === block.id)
        .map((i) => i.position)
      // Contiguous: a reader must not meet a block's questions scattered.
      expect(positions[4] - positions[0]).toBe(4)
      const ids = v.items.filter((i) => i.block?.id === block.id).map((i) => i.question.id)
      expect(ids).toEqual(block.questions.map((q) => q.id))
    }
  })

  it('never repeats a question inside one variant', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const v = buildExamVariant(seeded(seed))
      const ids = v.items.map((i) => i.question.id)
      expect(new Set(ids).size).toBe(EXAM_TOTAL)
    }
  })

  it('draws a different variant on three runs in a row', () => {
    const runs = [1, 2, 3].map((s) => buildExamVariant(seeded(s * 97)))
    const signatures = runs.map((v) => v.items.map((i) => i.question.id).join('|'))
    expect(new Set(signatures).size).toBe(3)
  })

  it('takes the scarce C band before the plentiful A band', () => {
    // The bank holds one C question against 76 A ones. If selection ran in
    // A-first order, the C slot would be gone every time.
    const v = buildExamVariant(seeded(3))
    expect(v.levels.C).toBeGreaterThan(0)
  })

  it('reports a shortfall that exactly matches what is missing', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const v = buildExamVariant(seeded(seed))
      for (const level of ['A', 'B', 'C'] as const) {
        const missing = LEVEL_TARGET[level] - v.levels[level]
        if (missing > 0) expect(v.shortfall[level]).toBe(missing)
        else expect(v.shortfall[level]).toBeUndefined()
      }
      // Whatever the mix, the count is always the full variant.
      expect(v.levels.A + v.levels.B + v.levels.C).toBe(EXAM_TOTAL)
    }
  })
})

describe('scoreExam', () => {
  it('counts a fully correct sheet as 20 of 20', () => {
    const v = buildExamVariant(seeded(5))
    const result = scoreExam(v, answerAll(v, EXAM_TOTAL))
    expect(result.correct).toBe(EXAM_TOTAL)
    expect(result.total).toBe(EXAM_TOTAL)
    expect(result.blank).toBe(0)
    expect(result.passedThreshold).toBe(true)
  })

  it('agrees with the number of right answers given', () => {
    const v = buildExamVariant(seeded(13))
    for (const right of [0, 1, 7, 14, 20]) {
      expect(scoreExam(v, answerAll(v, right)).correct).toBe(right)
    }
  })

  it('counts unanswered tasks as blank, not as wrong answers', () => {
    const v = buildExamVariant(seeded(21))
    const answers: ExamAnswers = {}
    v.items.slice(0, 6).forEach((item) => {
      answers[item.question.id] = item.question.correctId
    })
    const result = scoreExam(v, answers)
    expect(result.correct).toBe(6)
    expect(result.blank).toBe(EXAM_TOTAL - 6)
  })

  it('marks the individual threshold at 5 of 20', () => {
    const v = buildExamVariant(seeded(31))
    expect(scoreExam(v, answerAll(v, EXAM_THRESHOLD - 1)).passedThreshold).toBe(false)
    expect(scoreExam(v, answerAll(v, EXAM_THRESHOLD)).passedThreshold).toBe(true)
  })

  it('breaks the result down by topic, pattern and level, weakest first', () => {
    const v = buildExamVariant(seeded(41))
    const result = scoreExam(v, answerAll(v, 10))

    for (const rows of [result.byTopic, result.byPattern, result.byLevel]) {
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.reduce((sum, r) => sum + r.total, 0)).toBe(EXAM_TOTAL)
      expect(rows.reduce((sum, r) => sum + r.correct, 0)).toBe(result.correct)
      const shares = rows.map((r) => r.correct / r.total)
      expect([...shares].sort((a, b) => a - b)).toEqual(shares)
    }
  })
})

describe('formatCountdown', () => {
  it('pads to mm:ss', () => {
    expect(formatCountdown(40 * 60 * 1000)).toBe('40:00')
    expect(formatCountdown(452_000)).toBe('07:32')
    expect(formatCountdown(9_000)).toBe('00:09')
  })

  it('never shows a negative clock', () => {
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(-5_000)).toBe('00:00')
  })
})
