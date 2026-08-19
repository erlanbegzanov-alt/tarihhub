/**
 * The battle question bank.
 *
 * Both clients in a duel have to resolve the *same* questions from a plain id
 * list carried in the match document, so the bank is a fixed, hand-picked
 * subset of the questions already written for the quiz — nothing here is new
 * content. Picked for battles specifically: every one is answerable in a few
 * seconds, self-contained (it never leans on a lesson or a person's page
 * being open), and its options are short enough to read under a running
 * timer. No question in this app depends on an image, so nothing had to be
 * excluded on that count.
 *
 * Tiered by difficulty for the 3-round duel structure (see `pickRoundQuestionIds`
 * / `ROUND_SIZE` in `lib/battle.ts`). The tiering is positional, not a per-question
 * judgement call from scratch: within a persona's 10 quiz questions, the
 * opening one is the single most iconic fact about them (already the whole of
 * the old, untiered bank), #4 digs one layer deeper (a specific detail a fan
 * would know but a newcomer might not), and #8 is genuinely obscure (an exact
 * unit number, a cited ancient source, a museum's architecture) — verified by
 * hand across a spread of personas from different eras before trusting the
 * pattern, not assumed from one example.
 */
import { quizQuestions } from './quiz'
import type { QuizQuestion } from './types'
import { shuffled } from '../lib/shuffle'

/** The whole general pool plus each battle persona's single most iconic fact. */
const LIGHT_IDS: string[] = [
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

/** One layer more specific per persona than `LIGHT_IDS` — a fan-level detail. */
const MEDIUM_IDS: string[] = [
  'abylai4',
  'alfarabi4',
  'tomiris4',
  'kazybek4',
  'kenesary4',
  'abai4',
  'kurmangazy4',
  'yasawi4',
  'kultegin4',
  'kabanbai4',
  'zhambyl4',
  'aliya-moldagulova4',
  'buminkagan4',
  'kerey-khan4',
  'tauke-khan4',
  'bogenbai-batyr4',
  'shokan-ualikhanov4',
  'makhambet4',
]

/** Genuinely obscure per persona — cited sources, exact numbers, minor facts. */
const HARD_IDS: string[] = [
  'abylai8',
  'alfarabi8',
  'tomiris8',
  'kazybek8',
  'kenesary8',
  'abai8',
  'kurmangazy8',
  'yasawi8',
  'kultegin8',
  'kabanbai8',
  'zhambyl8',
  'aliya-moldagulova8',
  'buminkagan8',
  'kerey-khan8',
  'tauke-khan8',
  'bogenbai-batyr8',
  'shokan-ualikhanov8',
  'makhambet8',
]

function resolve(ids: string[]): QuizQuestion[] {
  return ids
    .map((id) => quizQuestions.find((question) => question.id === id))
    .filter((question): question is QuizQuestion => question !== undefined)
}

const LIGHT = resolve(LIGHT_IDS)
const MEDIUM = resolve(MEDIUM_IDS)
const HARD = resolve(HARD_IDS)

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
