/**
 * The battle bank is derived, not typed out, so these are the guards that keep
 * the derivation honest: the pools used to be three hand-written id lists of
 * 158 questions in all, which left 455 verified questions unused and made
 * players recognise the ones that kept coming back.
 */
import { describe, expect, it } from 'vitest'
import { battleQuestions, pickRoundQuestionIds } from './battleQuestions'
import { quizQuestions } from './quiz'

const MAX_QUESTION_CHARS = 105
const MAX_OPTION_CHARS = 96

describe('the battle bank', () => {
  it('draws on almost the whole verified quiz bank, not a sample of it', () => {
    // The old hand-picked bank was 158. A regression that silently narrowed
    // the pools again is exactly what this number is here to catch.
    expect(battleQuestions.length).toBeGreaterThan(500)
    expect(battleQuestions.length).toBeLessThanOrEqual(quizQuestions.length)
  })

  it('keeps every question readable inside the duel clock', () => {
    for (const question of battleQuestions) {
      expect(Math.max(question.question.kz.length, question.question.ru.length)).toBeLessThanOrEqual(
        MAX_QUESTION_CHARS,
      )
      for (const option of question.options) {
        expect(Math.max(option.label.kz.length, option.label.ru.length)).toBeLessThanOrEqual(
          MAX_OPTION_CHARS,
        )
      }
    }
  })

  it('has both languages and one right answer everywhere', () => {
    for (const question of battleQuestions) {
      expect(question.question.kz.length).toBeGreaterThan(0)
      expect(question.question.ru.length).toBeGreaterThan(0)
      expect(question.options.filter((o) => o.id === question.correctId)).toHaveLength(1)
    }
  })

  it('never hands one match the same question twice', () => {
    for (const tier of [null, 0, 2, 4]) {
      for (let i = 0; i < 200; i++) {
        const ids = pickRoundQuestionIds(3, tier)
        expect(ids).toHaveLength(9)
        expect(new Set(ids).size).toBe(9)
      }
    }
  })

  it('every id a match document can carry still resolves', () => {
    const known = new Set(battleQuestions.map((q) => q.id))
    for (const id of pickRoundQuestionIds(3, null)) expect(known.has(id)).toBe(true)
  })

  /**
   * The point of the whole change, stated as a number. Three draws per round
   * from each pool; across ten duels a player sees 90 questions, and how many
   * of those are repeats is what "этот вопрос уже приходил" actually measures.
   */
  it('repeats a question about three times less often than the old bank did', () => {
    let repeats = 0
    const trials = 300
    for (let trial = 0; trial < trials; trial++) {
      const seen: string[] = []
      for (let duel = 0; duel < 10; duel++) seen.push(...pickRoundQuestionIds(3, null))
      repeats += seen.length - new Set(seen).size
    }
    // The old 56/51/51 pools put this at ~21 of 90 by the same measurement.
    expect(repeats / trials).toBeLessThan(10)
  })
})
