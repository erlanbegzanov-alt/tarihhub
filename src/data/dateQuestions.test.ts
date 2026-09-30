/**
 * The date questions are generated from a source sheet rather than typed by
 * hand, so these guards check the two things a generator can quietly get
 * wrong: a question that never reaches a player, and a question that reaches
 * one in a bank it was never meant for.
 */
import { describe, expect, it } from 'vitest'
import { battleQuestions } from './battleQuestions'
import { dateQuestions } from './dateQuestions'
import { entQuestions } from './entQuestions'
import { quizQuestions } from './quiz'

describe('the date questions', () => {
  it('is a real batch, not a stub left behind by a half-finished run', () => {
    expect(dateQuestions.length).toBeGreaterThanOrEqual(60)
  })

  it('every one of them actually reaches the duel and the team match', () => {
    // `battleQuestions` drops anything too long to read inside the clock. A
    // question generated a little too wordy would vanish silently, so this is
    // the check that the whole batch is really in play.
    const inBattle = new Set(battleQuestions.map((question) => question.id))
    const missing = dateQuestions.filter((question) => !inBattle.has(question.id))
    expect(missing.map((question) => question.id)).toEqual([])
  })

  it('carries a deliberate difficulty, because that is what sorts the pools', () => {
    // `tierOf` reads `level` first; without it these would all fall through to
    // the id-pattern branch and land in whichever pool their number implied.
    for (const question of dateQuestions) {
      expect(['A', 'B', 'C']).toContain(question.level)
    }
    // The hard pool is the thinnest one, so the batch has to feed it.
    expect(dateQuestions.filter((question) => question.level === 'C').length).toBeGreaterThan(15)
  })

  it('stays out of the ҰБТ bank', () => {
    // The exam assembles variants from `entQuestions` alone, and a `topicId` is
    // what marks a question as belonging there. These are battle questions:
    // they must not turn up in a mock exam through a stray tag.
    const entIds = new Set(entQuestions.map((question) => question.id))
    for (const question of dateQuestions) {
      expect(question.topicId).toBeUndefined()
      expect(entIds.has(question.id)).toBe(false)
    }
  })

  it('is answerable: both languages filled, and the right answer is on the list', () => {
    for (const question of dateQuestions) {
      expect(question.question.kz.length).toBeGreaterThan(0)
      expect(question.question.ru.length).toBeGreaterThan(0)
      expect(question.explanation.kz.length).toBeGreaterThan(0)
      expect(question.explanation.ru.length).toBeGreaterThan(0)
      expect(question.options).toHaveLength(4)
      expect(question.options.map((option) => option.id)).toContain(question.correctId)
      // Two identical years among the four would make the question a coin toss.
      const labels = question.options.map((option) => option.label.ru)
      expect(new Set(labels).size).toBe(labels.length)
      for (const option of question.options) {
        expect(option.label.kz.length).toBeGreaterThan(0)
        expect(option.label.ru.length).toBeGreaterThan(0)
      }
    }
  })

  it('does not reuse an id already taken elsewhere in the bank', () => {
    const dates = new Set(dateQuestions.map((question) => question.id))
    const others = quizQuestions.filter((question) => !dates.has(question.id))
    const takenIds = new Set(others.map((question) => question.id))
    for (const question of dateQuestions) {
      expect(takenIds.has(question.id)).toBe(false)
    }
    expect(dates.size).toBe(dateQuestions.length)
  })
})
