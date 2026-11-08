/**
 * The in-progress attempt's round trip: what goes into `sessionStorage`, what
 * comes back out, and when it comes back as a timeout instead of a resume.
 * Synthetic papers throughout, so a growing bank can never move these.
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { ContextBlock, QuizQuestion, SchoolVariant } from '../data/types'
import type { ExamItem, ExamVariant } from './exam'
import {
  clearSavedAttempt,
  readSavedAttempt,
  restoreAttempt,
  serialiseAttempt,
  writeSavedAttempt,
} from './examAttempt'
import type { AttemptSources } from './examAttempt'

const text = (s: string) => ({ kz: s, ru: s })

function question(id: string, level: 'A' | 'B' | 'C' = 'A'): QuizQuestion {
  return {
    id,
    category: text('c'),
    question: text(`q ${id}`),
    options: ['a', 'b', 'c', 'd'].map((o) => ({ id: o, label: text(`${id}-${o}`) })),
    correctId: 'a',
    explanation: text('e'),
    level,
  }
}

function block(id: string): ContextBlock {
  return {
    id,
    kind: 'document',
    topicId: 53,
    title: text(id),
    passage: text('p'),
    questions: [1, 2, 3, 4, 5].map((n) => question(`${id}-${n}`, 'C')),
  }
}

const bank = [question('s1'), question('s2'), question('s3', 'B')]
const blocks = [block('k1'), block('k2'), block('k3')]
const booklet: SchoolVariant = {
  id: '90001',
  standalone: [question('b-s1'), question('b-s2')],
  blocks: [block('bk1'), block('bk2')],
}
const sources: AttemptSources = { booklets: [booklet], questions: bank, blocks }

/** A paper as `buildExamVariant` would hand it over: options already reordered. */
function paper(standalone: QuizQuestion[], withBlocks: ContextBlock[]): ExamVariant {
  const reorder = (q: QuizQuestion): QuizQuestion => ({ ...q, options: [...q.options].reverse() })
  const items: ExamItem[] = standalone.map((q, i) => ({ position: i + 1, question: reorder(q), block: null }))
  for (const b of withBlocks) {
    for (const q of b.questions) items.push({ position: items.length + 1, question: reorder(q), block: b })
  }
  return { items, blocks: withBlocks, levels: { A: 0, B: 0, C: 0 }, levelTarget: { A: 0, B: 0, C: 0 }, shortfall: {} }
}

const NOW = 1_762_600_000_000
const drawn = paper([bank[2], bank[0]], [blocks[1], blocks[0]])

describe('restoreAttempt', () => {
  it('rebuilds a drawn paper exactly: order, blocks, option order, answers, task, deadline', () => {
    const raw = serialiseAttempt({
      bookletId: null,
      variant: drawn,
      answers: { s3: 'b', 'k2-4': 'd' },
      index: 5,
      deadline: NOW + 60_000,
    })
    const back = restoreAttempt(raw, sources, NOW)
    expect(back).not.toBeNull()
    expect(back!.booklet).toBeNull()
    expect(back!.variant.items.map((i) => [i.position, i.question.id, i.block?.id ?? null])).toEqual(
      drawn.items.map((i) => [i.position, i.question.id, i.block?.id ?? null]),
    )
    expect(back!.variant.items.map((i) => i.question.options.map((o) => o.id))).toEqual(
      drawn.items.map((i) => i.question.options.map((o) => o.id)),
    )
    // The real block objects, in paper order — the forecast reads them.
    expect(back!.variant.blocks).toEqual([blocks[1], blocks[0]])
    expect(back!.answers).toEqual({ s3: 'b', 'k2-4': 'd' })
    expect(back!.index).toBe(5)
    expect(back!.deadline).toBe(NOW + 60_000)
    expect(back!.expired).toBe(false)
    expect(back!.variant.levels).toEqual({ A: 1, B: 1, C: 10 })
  })

  it('rebuilds a school booklet from its own tasks, not the bank', () => {
    const sat = paper(booklet.standalone, [...booklet.blocks])
    const raw = serialiseAttempt({ bookletId: '90001', variant: sat, answers: {}, index: 0, deadline: NOW + 1 })
    const back = restoreAttempt(raw, sources, NOW)
    expect(back?.booklet).toBe(booklet)
    expect(back?.variant.items[0].question.id).toBe('b-s1')
    expect(back?.variant.blocks).toEqual(booklet.blocks)
  })

  it('reports a deadline that passed while away as expired, keeping the answers for the record', () => {
    const raw = serialiseAttempt({ bookletId: null, variant: drawn, answers: { s1: 'c' }, index: 2, deadline: NOW })
    expect(restoreAttempt(raw, sources, NOW)?.expired).toBe(true)
    expect(restoreAttempt(raw, sources, NOW + 3_600_000)?.answers).toEqual({ s1: 'c' })
    expect(restoreAttempt(raw, sources, NOW - 1)?.expired).toBe(false)
  })

  it('drops an attempt the bank can no longer rebuild faithfully', () => {
    const raw = serialiseAttempt({ bookletId: null, variant: drawn, answers: {}, index: 0, deadline: NOW + 1 })
    // A block taken out by a deploy.
    expect(restoreAttempt(raw, { ...sources, blocks: [blocks[0]] }, NOW)).toBeNull()
    // A standalone question taken out.
    expect(restoreAttempt(raw, { ...sources, questions: [bank[0]] }, NOW)).toBeNull()
    // A booklet that is gone.
    const sat = serialiseAttempt({
      bookletId: '90001',
      variant: paper(booklet.standalone, [...booklet.blocks]),
      answers: {},
      index: 0,
      deadline: NOW + 1,
    })
    expect(restoreAttempt(sat, { ...sources, booklets: [] }, NOW)).toBeNull()
    // An option that changed id.
    const edited = JSON.parse(raw) as { items: { o: string[] }[] }
    edited.items[0].o = ['a', 'b', 'c', 'x']
    expect(restoreAttempt(JSON.stringify(edited), sources, NOW)).toBeNull()
  })

  it('returns null for nothing stored, broken JSON and foreign shapes', () => {
    expect(restoreAttempt(null, sources, NOW)).toBeNull()
    expect(restoreAttempt('{not json', sources, NOW)).toBeNull()
    expect(restoreAttempt('{"v":2,"items":[]}', sources, NOW)).toBeNull()
    expect(restoreAttempt('[]', sources, NOW)).toBeNull()
  })

  it('keeps only answers that are one of the task’s options, and clamps the task index', () => {
    const raw = JSON.parse(
      serialiseAttempt({ bookletId: null, variant: drawn, answers: {}, index: 0, deadline: NOW + 1 }),
    ) as { answers: Record<string, unknown>; index: number }
    raw.answers = { s1: 'z', s2: 'b', ghost: 'a', s3: 42 }
    raw.index = 99
    const back = restoreAttempt(JSON.stringify(raw), sources, NOW)
    expect(back?.answers).toEqual({})
    expect(back?.index).toBe(drawn.items.length - 1)
  })
})

describe('saved-attempt storage', () => {
  const g = globalThis as { window?: unknown }
  afterEach(() => {
    delete g.window
  })

  it('round-trips per uid and clears', () => {
    const store = new Map<string, string>()
    g.window = {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    }
    writeSavedAttempt('u1', 'one')
    writeSavedAttempt('u2', 'two')
    expect(readSavedAttempt('u1')).toBe('one')
    expect(readSavedAttempt('u2')).toBe('two')
    clearSavedAttempt('u1')
    expect(readSavedAttempt('u1')).toBeNull()
    expect(readSavedAttempt('u2')).toBe('two')
  })

  it('never throws when the storage getter itself throws', () => {
    g.window = {
      get sessionStorage(): never {
        throw new DOMException('denied', 'SecurityError')
      },
    }
    expect(() => writeSavedAttempt('u1', 'x')).not.toThrow()
    expect(readSavedAttempt('u1')).toBeNull()
    expect(() => clearSavedAttempt('u1')).not.toThrow()
  })
})
