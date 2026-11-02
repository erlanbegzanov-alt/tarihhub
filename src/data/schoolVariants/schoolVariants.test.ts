import { describe, expect, it } from 'vitest'
import { buildSchoolVariant } from '../../lib/exam'
import type { LocalizedText, QuizQuestion, SchoolVariant } from '../types'
import { schoolVariants } from '.'

const tasks = (v: SchoolVariant): QuizQuestion[] => [
  ...v.standalone,
  ...v.blocks.flatMap((b) => b.questions),
]
const filled = (text: LocalizedText | undefined) =>
  !!text && text.kz.trim() !== '' && text.ru.trim() !== ''

describe('school booklets', () => {
  it('are papers of 10 standalone tasks and two contexts of 5', () => {
    expect(schoolVariants.map((v) => v.id)).toEqual(['93002', '93006', '93707'])
    for (const v of schoolVariants) {
      expect(v.standalone).toHaveLength(10)
      for (const block of v.blocks) {
        expect(block.questions).toHaveLength(5)
        expect(filled(block.title) && filled(block.passage)).toBe(true)
      }
    }
  })

  it('have every task complete in both languages, with its answer among the options', () => {
    for (const v of schoolVariants) {
      for (const q of tasks(v)) {
        expect(q.options, q.id).toHaveLength(4)
        expect(q.options.map((o) => o.id), q.id).toContain(q.correctId)
        expect(filled(q.question) && filled(q.explanation), q.id).toBe(true)
        expect(q.options.every((o) => filled(o.label)), q.id).toBe(true)
        expect(q.topicId && q.level && q.pattern, q.id).toBeTruthy()
      }
    }
  })

  it('show the same letters on every sitting, without the right answer always first', () => {
    for (const v of schoolVariants) {
      const order = (x: ReturnType<typeof buildSchoolVariant>) =>
        x.items.map((i) => i.question.options.map((o) => o.id).join('')).join('|')
      const once = buildSchoolVariant(v)
      expect(order(buildSchoolVariant(v))).toBe(order(once))
      const first = once.items.filter((i) => i.question.options[0].id === i.question.correctId)
      expect(first.length, v.id).toBeLessThan(10)
    }
  })

  it('never repeat a task or a context across booklets', () => {
    const ids = new Map<string, string>()
    const texts = new Map<string, string>()
    const blocks = new Map<string, string>()
    for (const v of schoolVariants) {
      for (const q of tasks(v)) {
        expect(ids.get(q.id), `${q.id} in ${v.id}`).toBeUndefined()
        expect(texts.get(q.question.kz.trim()), `${q.id} in ${v.id}`).toBeUndefined()
        ids.set(q.id, v.id)
        texts.set(q.question.kz.trim(), v.id)
      }
      for (const b of v.blocks) {
        expect(blocks.get(b.id), `${b.id} in ${v.id}`).toBeUndefined()
        blocks.set(b.id, v.id)
      }
    }
  })
})
