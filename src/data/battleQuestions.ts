/**
 * The battle question bank.
 *
 * Both clients in a duel have to resolve the *same* questions from a plain id
 * list carried in the match document, so the bank is drawn from the questions
 * already written for the quiz — nothing here is new content.
 *
 * It used to be three hand-typed id lists: every persona's question #1, #4 and
 * #8, 158 questions in all. That was a sample taken to prove the tiering, and
 * it got left in as the bank — so 455 of the 613 verified questions never
 * appeared in a duel at all, and players started recognising the ones that did.
 * The lists are gone; the pools are now derived by the same rules the sample
 * was chosen under, which is what lets the whole bank in.
 *
 * Two rules decide what gets in and where it lands:
 *
 * - **Readable under the clock.** A duel gives 12 seconds a question, so
 *   anything longer than the longest question that already shipped in a duel
 *   stays out. Those ceilings are measured, not guessed — see the constants.
 * - **Difficulty comes from the question, not from taste.** The ҰБТ bank
 *   declares its own A/B/C level and that is used as-is. A persona's ten climb
 *   by position: #1 is the single most iconic fact about them, #4 digs a layer
 *   deeper, #8 is genuinely obscure — verified by hand across personas from
 *   different eras when the first bank was picked, and now applied to all ten
 *   instead of to three samples.
 *
 * No question in this app depends on an image, so nothing had to be excluded on
 * that count, and `quiz.ts` carries no lesson-gated questions, so nothing here
 * can lean on a lesson being open.
 */
import { quizQuestions } from './quiz'
import type { QuizQuestion } from './types'
import { shuffled } from '../lib/shuffle'

/**
 * The longest a question and an option may be to stay readable in the 12
 * seconds a duel allows.
 *
 * Both numbers are the longest that already shipped in a duel under the old
 * hand-picked bank. Using the measured ceiling rather than a fresh opinion
 * means widening the pools cannot smuggle in anything slower to read than what
 * players have been answering all along.
 */
const MAX_QUESTION_CHARS = 105
const MAX_OPTION_CHARS = 96

function fitsTheClock(question: QuizQuestion): boolean {
  if (Math.max(question.question.kz.length, question.question.ru.length) > MAX_QUESTION_CHARS) {
    return false
  }
  return question.options.every(
    (option) => Math.max(option.label.kz.length, option.label.ru.length) <= MAX_OPTION_CHARS,
  )
}

/** 0 light, 1 medium, 2 hard — the three rounds of a duel. */
type Tier = 0 | 1 | 2

function tierOf(question: QuizQuestion): Tier {
  // A declared level beats anything inferred: the ҰБТ bank states A/B/C per
  // question against the exam codifier (see `entQuestions.ts`).
  if (question.level === 'A') return 0
  if (question.level === 'B') return 1
  if (question.level === 'C') return 2
  // The five general questions are a hand-written set, not a ladder — their
  // numbers say nothing about difficulty, so they stay where they always were.
  if (/^g\d+$/.test(question.id)) return 0
  const position = Number(/(\d+)$/.exec(question.id)?.[1] ?? 0)
  if (position >= 8) return 2
  if (position >= 4) return 1
  return 0
}

const eligible = quizQuestions.filter(fitsTheClock)

const LIGHT = eligible.filter((question) => tierOf(question) === 0)
const MEDIUM = eligible.filter((question) => tierOf(question) === 1)
const HARD = eligible.filter((question) => tierOf(question) === 2)

/**
 * The resolved bank, all three tiers combined. An id that no longer exists is
 * dropped rather than left as a hole, so renaming a question in `quiz.ts` can
 * only shrink the bank — it can never hand a duel an undefined question.
 */
export const battleQuestions: QuizQuestion[] = [...LIGHT, ...MEDIUM, ...HARD]

/** Resolves one id from a match document against the bank. */
export function battleQuestion(id: string): QuizQuestion | undefined {
  return battleQuestions.find((question) => question.id === id)
}

/**
 * Which difficulty pool each of the 3 rounds draws from, by rating league.
 * `null` (casual, or no rating yet) gets the plain light → medium → hard
 * climb. Bronze/Silver (0) softens that a step so round 3 isn't a wall;
 * Platinum/Diamond (3+) raises the floor so round 1 already isn't free —
 * "на топ-лигах должно быть реально тяжело".
 */
const POOLS = [LIGHT, MEDIUM, HARD] as const

/**
 * The same three pools, in the same ascending order, for readers that need to
 * choose questions by some rule other than a duel round — the daily set picks
 * a fixed count from each (see `src/lib/daily.ts`). Exposed `readonly` rather
 * than as a copy so the daily ring is built over exactly the arrays a duel
 * draws from: a question that stops fitting the clock has to disappear from
 * both at once, not from one of them.
 */
export const battlePools: readonly (readonly QuizQuestion[])[] = POOLS

function poolPlanForTier(tierIndex: number | null): readonly [number, number, number] {
  if (tierIndex === null) return [0, 1, 2]
  if (tierIndex <= 0) return [0, 0, 1]
  if (tierIndex >= 3) return [1, 2, 2]
  return [0, 1, 2]
}

/**
 * Builds the flat, round-ordered id sequence for a new match: `roundSize`
 * ids from round 1's pool, then `roundSize` from round 2's, then round 3's —
 * still just a plain `string[]`, so nothing about how a match document
 * stores or resolves its question list has to change for rounds to exist.
 *
 * Bronze/Silver and Platinum/Diamond both repeat the same pool across two
 * rounds (see `poolPlanForTier`) — picked without replacement *across the
 * whole match*, not per round, so the same question can never turn up twice
 * in one duel just because its tier leaned on one pool twice.
 */
export function pickRoundQuestionIds(roundSize: number, tierIndex: number | null): string[] {
  const used = new Set<string>()
  return poolPlanForTier(tierIndex).flatMap((poolIndex) => {
    const picked = shuffled(POOLS[poolIndex].map((question) => question.id))
      .filter((id) => !used.has(id))
      .slice(0, roundSize)
    for (const id of picked) used.add(id)
    return picked
  })
}
