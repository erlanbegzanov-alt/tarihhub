import { contextBlocks } from '../data/contextBlocks'
import { entQuestions } from '../data/entQuestions'
import type { ContextBlock, ExamLevel, PatternKey, QuizQuestion, TopicId } from '../data/types'
import { shuffled } from './shuffle'

/**
 * Assembling one ҰБТ variant — and reporting honestly when the bank cannot.
 *
 * Shape of a real variant (`history-reference/ent-exam-patterns.md` §4.2):
 *
 *     № 1–10   standalone questions, one correct answer, eras mixed
 *     № 11–15  CONTEXT 1 — five questions on one stimulus
 *     № 16–20  CONTEXT 2 — five questions on another stimulus
 *
 * The specification also fixes the difficulty mix at A 50 % / B 30 % / C 20 %
 * (§4.4). Our bank is nowhere near it: 76 of its 98 questions are level A and
 * exactly one is level C. So `buildExamVariant` aims at the proportion, takes
 * the scarcest band first, and then states in `shortfall` what it could not
 * fill. Quietly serving ten A-level questions and calling the result a ҰБТ
 * mock is the one failure mode that actually misleads a student about where
 * their score would land.
 */

/** № 1–10 of the variant. */
export const EXAM_STANDALONE_COUNT = 10
/** Two stimuli, five questions each — §4.1. */
export const EXAM_BLOCK_COUNT = 2
export const EXAM_BLOCK_SIZE = 5
export const EXAM_TOTAL = EXAM_STANDALONE_COUNT + EXAM_BLOCK_COUNT * EXAM_BLOCK_SIZE

/**
 * Our own time budget, not a rule of the exam. ЕНТ gives 240 minutes for all
 * subjects together and runs no separate clock for history; ~2 minutes per
 * question is the §3.4 estimate, so 40 minutes is what an even pace looks
 * like. The UI must label it as ours, never as the exam's rule.
 */
export const EXAM_TIME_BUDGET_MS = 40 * 60 * 1000

/**
 * The individual threshold: below 5 of 20 the whole ЕНТ result is not counted,
 * whatever the other subjects scored (§3.2). This one is official.
 */
export const EXAM_THRESHOLD = 5

/** A 50 % / B 30 % / C 20 % of twenty questions (§4.4). */
export const LEVEL_TARGET: Record<ExamLevel, number> = { A: 10, B: 6, C: 4 }

const LEVEL_ORDER: ExamLevel[] = ['A', 'B', 'C']

export interface ExamItem {
  /** 1-based position in the variant, the way the exam numbers its tasks. */
  position: number
  question: QuizQuestion
  /** The block this question belongs to, or `null` for № 1–10. */
  block: ContextBlock | null
}

export interface ExamVariant {
  items: ExamItem[]
  blocks: ContextBlock[]
  /** How many questions of each level the variant actually holds. */
  levels: Record<ExamLevel, number>
  levelTarget: Record<ExamLevel, number>
  /**
   * Levels the bank could not supply enough of, e.g. `{ C: 3 }` meaning the
   * variant is three C-level questions short of the specification's mix.
   * Empty when the proportion was met.
   */
  shortfall: Partial<Record<ExamLevel, number>>
}

function emptyLevels(): Record<ExamLevel, number> {
  return { A: 0, B: 0, C: 0 }
}

function countLevels(questions: QuizQuestion[]): Record<ExamLevel, number> {
  const counts = emptyLevels()
  for (const q of questions) if (q.level) counts[q.level] += 1
  return counts
}

/**
 * Builds one variant: two context blocks plus ten standalone questions chosen
 * to bring the whole thing as close to 50/30/20 as the bank allows.
 *
 * The blocks are drawn first and their levels counted, because a block is a
 * fixed package of five — there is nothing to choose inside one. What is left
 * of each quota is then filled from the bank scarcest band first (C, then B,
 * then A): taking the plentiful A questions first would eat the slots the rare
 * harder ones need.
 */
export function buildExamVariant(random: () => number = Math.random): ExamVariant {
  const blocks = shuffled(contextBlocks, random).slice(0, EXAM_BLOCK_COUNT)
  const fromBlocks = countLevels(blocks.flatMap((b) => b.questions))

  const pool = shuffled(entQuestions, random)
  const taken: QuizQuestion[] = []
  const used = new Set<string>()

  for (const level of ['C', 'B', 'A'] as ExamLevel[]) {
    const need = Math.max(0, LEVEL_TARGET[level] - fromBlocks[level])
    let got = 0
    for (const q of pool) {
      if (taken.length >= EXAM_STANDALONE_COUNT || got >= need) break
      if (used.has(q.id) || q.level !== level) continue
      used.add(q.id)
      taken.push(q)
      got += 1
    }
  }

  // Whatever slots the quotas did not claim — because the bank ran out of a
  // level, or because the blocks already over-filled one — go to any question
  // still unused. A variant is 20 questions even when the mix is off.
  for (const q of pool) {
    if (taken.length >= EXAM_STANDALONE_COUNT) break
    if (used.has(q.id)) continue
    used.add(q.id)
    taken.push(q)
  }

  const items: ExamItem[] = []
  shuffled(taken, random).forEach((question) => {
    items.push({ position: items.length + 1, question, block: null })
  })
  blocks.forEach((block) => {
    block.questions.forEach((question) => {
      items.push({ position: items.length + 1, question, block })
    })
  })

  const levels = countLevels(items.map((i) => i.question))
  const shortfall: Partial<Record<ExamLevel, number>> = {}
  for (const level of LEVEL_ORDER) {
    const missing = LEVEL_TARGET[level] - levels[level]
    if (missing > 0) shortfall[level] = missing
  }

  return { items, blocks, levels, levelTarget: LEVEL_TARGET, shortfall }
}

/** One answer sheet. A missing key, or `null`, means the task was left blank. */
export type ExamAnswers = Record<string, string | null>

export interface BreakdownRow<K> {
  key: K
  correct: number
  total: number
}

export interface ExamResult {
  correct: number
  total: number
  /**
   * Tasks left without an answer. ЕНТ has no negative marking (§3.3), so a
   * blank is strictly worse than a guess and the UI warns before finishing.
   */
  blank: number
  /** True when the score clears the individual threshold of 5. */
  passedThreshold: boolean
  byTopic: BreakdownRow<TopicId>[]
  byPattern: BreakdownRow<PatternKey>[]
  byLevel: BreakdownRow<ExamLevel>[]
}

function tally<K>(
  items: ExamItem[],
  answers: ExamAnswers,
  keyOf: (q: QuizQuestion) => K | undefined,
): BreakdownRow<K>[] {
  const rows = new Map<K, BreakdownRow<K>>()
  for (const item of items) {
    const key = keyOf(item.question)
    if (key === undefined) continue
    const row = rows.get(key) ?? { key, correct: 0, total: 0 }
    row.total += 1
    if (answers[item.question.id] === item.question.correctId) row.correct += 1
    rows.set(key, row)
  }
  // Weakest first: the whole point of a breakdown is showing where marks went.
  return [...rows.values()].sort(
    (a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total,
  )
}

export function scoreExam(variant: ExamVariant, answers: ExamAnswers): ExamResult {
  let correct = 0
  let blank = 0
  for (const item of variant.items) {
    const picked = answers[item.question.id] ?? null
    if (picked === null) blank += 1
    else if (picked === item.question.correctId) correct += 1
  }
  return {
    correct,
    total: variant.items.length,
    blank,
    passedThreshold: correct >= EXAM_THRESHOLD,
    byTopic: tally(variant.items, answers, (q) => q.topicId),
    byPattern: tally(variant.items, answers, (q) => q.pattern),
    byLevel: tally(variant.items, answers, (q) => q.level),
  }
}

/** "07:32" — the countdown label. Clamped at zero, never negative. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000))
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
