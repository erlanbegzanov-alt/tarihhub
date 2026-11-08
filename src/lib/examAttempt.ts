import type { ContextBlock, ExamLevel, QuizQuestion, SchoolVariant } from '../data/types'
import { LEVEL_TARGET } from './exam'
import type { ExamAnswers, ExamItem, ExamVariant } from './exam'

/**
 * The mock attempt in progress, kept in `sessionStorage` so that a reload, a
 * new build taking over the tab, or a trip to another screen and back does
 * not wipe forty minutes of answers. Per tab, as the attempt is, and keyed
 * per account so that a second account signing in on the same tab never
 * inherits someone else's paper.
 *
 * What is stored is the paper itself, not a seed: which question sits at each
 * position, under which block, with its options in the order shown. A seed
 * would re-draw a different paper the moment the bank grew a block, and that
 * is exactly what a deploy does. If anything stored is no longer in the bank,
 * the attempt cannot be rebuilt faithfully and is dropped rather than patched.
 */

const STORAGE_KEY_BASE = 'tarihhub_exam_attempt'

export interface SavedAttempt {
  v: 1
  /** The school booklet's id, or `null` for a drawn TarihHub variant. */
  booklet: string | null
  /** Each task in order: question id, block id (`null` for № 1–10), option ids as shown. */
  items: { q: string; b: string | null; o: string[] }[]
  answers: ExamAnswers
  /** The task on screen. */
  index: number
  /** Wall-clock end of the time budget, in ms since the epoch. */
  deadline: number
}

export interface RestoredAttempt {
  booklet: SchoolVariant | null
  variant: ExamVariant
  answers: ExamAnswers
  index: number
  deadline: number
  /** The deadline passed while the tab was away: finish it as a timeout. */
  expired: boolean
}

/** Where a stored paper's ids are looked up again. */
export interface AttemptSources {
  booklets: SchoolVariant[]
  /** The standalone bank a drawn variant takes № 1–10 from. */
  questions: QuizQuestion[]
  /** The blocks a drawn variant takes its two contexts from. */
  blocks: ContextBlock[]
}

export function serialiseAttempt(attempt: {
  bookletId: string | null
  variant: ExamVariant
  answers: ExamAnswers
  index: number
  deadline: number
}): string {
  const saved: SavedAttempt = {
    v: 1,
    booklet: attempt.bookletId,
    items: attempt.variant.items.map((item) => ({
      q: item.question.id,
      b: item.block?.id ?? null,
      o: item.question.options.map((option) => option.id),
    })),
    answers: attempt.answers,
    index: attempt.index,
    deadline: attempt.deadline,
  }
  return JSON.stringify(saved)
}

function isSaved(value: unknown): value is SavedAttempt {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<SavedAttempt>
  return (
    v.v === 1 &&
    (v.booklet === null || typeof v.booklet === 'string') &&
    Array.isArray(v.items) &&
    v.items.length > 0 &&
    v.items.every(
      (item) =>
        typeof item?.q === 'string' &&
        (item.b === null || typeof item.b === 'string') &&
        Array.isArray(item.o),
    ) &&
    typeof v.answers === 'object' &&
    v.answers !== null &&
    Number.isInteger(v.index) &&
    typeof v.deadline === 'number' &&
    Number.isFinite(v.deadline)
  )
}

/**
 * Rebuilds the stored attempt exactly as it was drawn, or `null` when there is
 * none, it is unreadable, or the bank no longer holds what it was built from.
 */
export function restoreAttempt(
  raw: string | null,
  sources: AttemptSources,
  now: number,
): RestoredAttempt | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isSaved(parsed)) return null
  const saved = parsed

  let booklet: SchoolVariant | null = null
  let standalone = sources.questions
  let blockPool = sources.blocks
  if (saved.booklet !== null) {
    booklet = sources.booklets.find((b) => b.id === saved.booklet) ?? null
    if (!booklet) return null
    standalone = booklet.standalone
    blockPool = booklet.blocks
  }

  const items: ExamItem[] = []
  const blocks: ContextBlock[] = []
  for (const stored of saved.items) {
    const block = stored.b === null ? null : blockPool.find((b) => b.id === stored.b)
    if (block === undefined) return null
    const question = (block ? block.questions : standalone).find((q) => q.id === stored.q)
    if (!question) return null
    // The same options in the same order — or the paper is not the one sat.
    if (stored.o.length !== question.options.length) return null
    const options = stored.o.map((id) => question.options.find((o) => o.id === id))
    if (options.some((o) => o === undefined) || new Set(stored.o).size !== stored.o.length) {
      return null
    }
    if (block && !blocks.includes(block)) blocks.push(block)
    items.push({
      position: items.length + 1,
      question: { ...question, options: options as QuizQuestion['options'] },
      block,
    })
  }

  // Only answers that are one of the task's own options survive.
  const answers: ExamAnswers = {}
  for (const item of items) {
    const picked = saved.answers[item.question.id]
    if (typeof picked === 'string' && item.question.options.some((o) => o.id === picked)) {
      answers[item.question.id] = picked
    }
  }

  const levels: Record<ExamLevel, number> = { A: 0, B: 0, C: 0 }
  for (const item of items) if (item.question.level) levels[item.question.level] += 1
  const shortfall: Partial<Record<ExamLevel, number>> = {}
  for (const level of ['A', 'B', 'C'] as ExamLevel[]) {
    if (LEVEL_TARGET[level] > levels[level]) shortfall[level] = LEVEL_TARGET[level] - levels[level]
  }

  return {
    booklet,
    variant: { items, blocks, levels, levelTarget: LEVEL_TARGET, shortfall },
    answers,
    index: Math.min(Math.max(saved.index, 0), items.length - 1),
    deadline: saved.deadline,
    expired: now >= saved.deadline,
  }
}

/*
 * Storage. Every access is wrapped: in a private window or with site data
 * blocked, the `sessionStorage` getter itself throws, and the exam must still
 * run — it simply cannot survive a reload there.
 */

function storageKey(uid: string | null): string {
  return uid ? `${STORAGE_KEY_BASE}_${uid}` : STORAGE_KEY_BASE
}

export function readSavedAttempt(uid: string | null): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(uid))
  } catch {
    return null
  }
}

export function writeSavedAttempt(uid: string | null, raw: string): void {
  try {
    window.sessionStorage.setItem(storageKey(uid), raw)
  } catch {
    /* no storage: the attempt still runs, it just cannot survive a reload */
  }
}

export function clearSavedAttempt(uid: string | null): void {
  try {
    window.sessionStorage.removeItem(storageKey(uid))
  } catch {
    /* nothing was stored, then */
  }
}
