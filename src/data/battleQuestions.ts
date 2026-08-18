/**
 * The battle question bank.
 *
 * A duel is five questions long and both clients have to resolve the *same*
 * five from a plain id list carried in the match document, so the bank is a
 * fixed, hand-picked subset of the questions already written for the quiz —
 * nothing here is new content. Picked for battles specifically: every one is
 * answerable in a few seconds, self-contained (it never leans on a lesson or a
 * person's page being open), and its options are short enough to read under a
 * running timer. No question in this app depends on an image, so nothing had
 * to be excluded on that count.
 */
import { quizQuestions } from './quiz'
import type { QuizQuestion } from './types'
import { shuffled } from '../lib/shuffle'

/**
 * Ids into `quizQuestions`. The five `g*` ids are the whole general pool; the
 * rest are the opening question of each persona set, which are the plainest
 * "one fact, four short options" ones in the whole file.
 */
const BATTLE_QUESTION_IDS: string[] = [
  'g1',
  'g2',
  'g3',
  'g4',
  'g5',
  'abylai1',
  'alfarabi1',
  'tomiris1',
  'kazybek1',
  'kenesary1',
  'abai1',
  'kurmangazy1',
  'yasawi1',
  'kultegin1',
  'kabanbai1',
]

/**
 * The resolved bank. An id that no longer exists is dropped rather than left as
 * a hole, so renaming a question in `quiz.ts` can only shrink the bank — it can
 * never hand a duel an undefined question.
 */
export const battleQuestions: QuizQuestion[] = BATTLE_QUESTION_IDS.map((id) =>
  quizQuestions.find((question) => question.id === id),
).filter((question): question is QuizQuestion => question !== undefined)

/** Resolves one id from a match document against the bank. */
export function battleQuestion(id: string): QuizQuestion | undefined {
  return battleQuestions.find((question) => question.id === id)
}

/** Draws `count` distinct question ids for a new match. */
export function pickBattleQuestionIds(count: number): string[] {
  return shuffled(battleQuestions.map((question) => question.id)).slice(0, count)
}
