/**
 * The practice opponent — a bot duel for when nobody is in the queue.
 *
 * There is no server here (see `lib/battle.ts`), so an empty queue used to mean
 * an indefinite spinner: two players have to be searching at the same second for
 * a duel to happen at all. A bot duel is the way out of that, and it is
 * deliberately *entirely local* — no `battleQueue`, `battleClaims` or
 * `battleMatches` document is written for it. It builds the same `BattleMatch`
 * shape the real flow builds, so `BattleDuel.tsx` renders it with the code it
 * already has (the racing bars, the round banner, the result screen); only the
 * two writes that would reach Firestore are skipped.
 *
 * Casual only. A rating ladder that can be climbed against a script is not a
 * ladder, so `Рейтинг` never offers this — see the call site in `BattleDuel.tsx`.
 *
 * Nothing here pretends to be a person: the duel head, the result screen and the
 * stored history row all carry a "Бот" label. The bot gets a real name and real
 * rank art (the app's own `ranks.ts` / `public/avatars`) so the opponent card
 * isn't a grey placeholder — not so the reader can be fooled about who they
 * played.
 */
import { pickRoundQuestionIds } from '../data/battleQuestions'
import type { AvatarGender } from '../data/ranks'
import { ranks } from '../data/ranks'
import {
  BATTLE_QUESTIONS,
  QUESTION_SECONDS,
  ROUND_SIZE,
  answerXp,
  isoWeekStart,
} from './battle'
import type { BattleMatch, BattlePlayer } from './battle'

/** Uid of the bot's side of a duel. Never a real account — `/^[A-Za-z0-9]{20,}$/`
 *  Firebase uids can't collide with it, and nothing is ever written under it. */
export const BOT_UID = 'bot-opponent'

/** Prefix of a bot match's id, so one glance at `matchId` says which flow this
 *  duel is on before the match document (which doesn't exist) is consulted. */
const BOT_MATCH_PREFIX = 'bot-match-'

export function isBotMatchId(matchId: string): boolean {
  return matchId.startsWith(BOT_MATCH_PREFIX)
}

/* ------------------------------ how it plays ------------------------------ */

/**
 * One bot's skill. Three of them, picked at random per duel, so back-to-back
 * bot matches don't play out the same way: a weak opponent the reader beats
 * comfortably, a mid one, and a strong one that punishes a slow round.
 */
interface BotSkill {
  /** Share of questions answered correctly, before the per-round handicap. */
  accuracy: number
  /** Response time window, in ms. */
  minMs: number
  maxMs: number
}

const BOT_SKILLS: BotSkill[] = [
  { accuracy: 0.5, minMs: 3800, maxMs: 10_000 },
  { accuracy: 0.7, minMs: 2600, maxMs: 7600 },
  { accuracy: 0.88, minMs: 1700, maxMs: 5200 },
]

/**
 * The bot's accuracy per round, matching the duel's own light → medium → hard
 * climb (`pickRoundQuestionIds`): it misses more in round 3 for the same reason
 * the reader does, rather than holding one flat hit rate across a match whose
 * questions visibly get harder.
 */
const ROUND_ACCURACY = [1, 0.88, 0.74]

/** One planned answer: whether it lands, and how long the bot "thinks". */
export interface BotAnswer {
  correct: boolean
  afterMs: number
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * The whole duel, decided up front rather than question by question, so the
 * runner in `BattleDuel.tsx` is only a timer chain and a duel can never stall
 * halfway through waiting on a coin flip that didn't happen.
 */
function planAnswers(skill: BotSkill): BotAnswer[] {
  return Array.from({ length: BATTLE_QUESTIONS }, (_, index) => {
    const round = Math.min(ROUND_ACCURACY.length - 1, Math.floor(index / ROUND_SIZE))
    const correct = Math.random() < skill.accuracy * ROUND_ACCURACY[round]
    // A question it gets wrong reads as hesitation: slower than its usual pace,
    // and once in a while slow enough that the clock beats it outright.
    const ceiling = QUESTION_SECONDS * 1000
    const thinking = randomBetween(skill.minMs, skill.maxMs) * (correct ? 1 : 1.25)
    const afterMs =
      !correct && Math.random() < 0.08 ? ceiling : Math.min(ceiling - 300, thinking)
    return { correct, afterMs: Math.round(afterMs) }
  })
}

/** XP one planned answer is worth, on the duel's own scoring (`answerXp`). */
export function botAnswerXp(answer: BotAnswer): number {
  // The reader's clock ticks down in whole seconds from `QUESTION_SECONDS`, so
  // the bot is scored off the same integer count rather than a finer one.
  const secondsLeft = Math.max(0, QUESTION_SECONDS - Math.ceil(answer.afterMs / 1000))
  return answerXp(answer.correct, secondsLeft)
}

/* ------------------------------ who it is ------------------------------ */

/** Plain Kazakh given names, spelled the same in both of the app's languages. */
const BOT_NAMES: Record<AvatarGender, string[]> = {
  m: [
    'Алихан',
    'Данияр',
    'Ерасыл',
    'Тимур',
    'Нурлан',
    'Арман',
    'Санжар',
    'Мирас',
    'Дамир',
    'Бекзат',
  ],
  f: [
    'Айдана',
    'Аружан',
    'Диана',
    'Мадина',
    'Камила',
    'Дана',
    'Жанель',
    'Алина',
    'Сабина',
    'Инкар',
  ],
}

/**
 * A plausible opponent card: a real name, a real rank tier, and a level that
 * fits that tier. Built as an ordinary `BattlePlayer` so every place the duel
 * draws an opponent — avatar, rank title, level chip — works unchanged.
 */
function createBotPlayer(): BattlePlayer {
  const avatarGender: AvatarGender = Math.random() < 0.5 ? 'm' : 'f'
  // Never the owner tier (`ranks.length`), which has no avatar art of its own.
  const tierIndex = 1 + Math.floor(Math.random() * (ranks.length - 2))
  return {
    uid: BOT_UID,
    displayName: pick(BOT_NAMES[avatarGender]),
    photoURL: '',
    level: 3 + tierIndex * 4 + Math.floor(Math.random() * 4),
    rating: 0,
    weekXp: 0,
    weekStart: isoWeekStart(),
    updatedAt: Date.now(),
    avatarGender,
    avatarTierIndex: tierIndex,
    titleTierIndex: tierIndex,
  }
}

/* -------------------------------- the duel -------------------------------- */

export interface BotDuel {
  /** The same shape a real match has, minus the Firestore document. */
  match: BattleMatch
  opponent: BattlePlayer
  answers: BotAnswer[]
}

/**
 * Builds one local casual duel against a bot. The caller is seated as `p1`
 * (`players[0]`), which is what `slotKeyFor` reads, so the bot always owns `p2`.
 */
export function createBotDuel(uid: string): BotDuel {
  const emptySlot = () => ({
    answers: Array.from({ length: BATTLE_QUESTIONS }, () => null),
    xp: 0,
    doneAt: null,
  })
  return {
    match: {
      id: `${BOT_MATCH_PREFIX}${Date.now()}`,
      mode: 'casual',
      players: [uid, BOT_UID],
      questionIds: pickRoundQuestionIds(ROUND_SIZE, null),
      p1: emptySlot(),
      p2: emptySlot(),
      createdAt: Date.now(),
      status: 'active',
    },
    opponent: createBotPlayer(),
    answers: planAnswers(pick(BOT_SKILLS)),
  }
}
