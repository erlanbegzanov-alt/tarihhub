import type { QuizQuestion } from './types'

/**
 * Questions that gate lesson completion.
 *
 * A lesson is only ever marked as passed by answering its own quiz correctly
 * (see `LESSON_PASS_RATIO` in `src/lib/progress.ts`), so everything here is
 * load-bearing: a question tagged for a lesson decides whether that lesson can
 * be completed at all.
 *
 * Rules for anything added to this array:
 *
 * - `lessonIds` is required and must name real lesson ids from
 *   `src/data/lessons.ts`. A question with no `lessonIds` is never served.
 * - Aim for at least `QUIZ_LENGTH` (5) questions per lesson. Fewer is allowed —
 *   `buildLessonQuiz` serves a shorter quiz — but the pass mark then gets
 *   harsh (with 2 questions, 80% means both must be right).
 * - `id` must be unique across this file *and* `src/data/quiz.ts`.
 * - Every question must be answerable from that lesson's own `sections`. Do not
 *   test facts the lesson never states.
 * - Where the lesson marks a fact as disputed, the question must not turn it
 *   into a settled one — ask what the sources say, not what "really happened".
 * - `options` are 4 per question, exactly one of them `correctId`.
 * - `explanation` says *why*, in both languages, and is what the reader sees
 *   after answering — it is teaching material, not a verdict.
 *
 * The general/persona pools in `src/data/quiz.ts` stay separate: those feed the
 * practice quiz and the per-person quizzes and award XP without gating anything.
 */
export const lessonQuestions: QuizQuestion[] = []
