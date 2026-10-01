/**
 * The daily set — five questions, the same five for everyone, once a day.
 *
 * Why this exists: `recordVisit` has counted a consecutive-day streak since
 * the app shipped, but nothing ever asked the reader to come back, so the
 * number counted app *opens* rather than work done. Measured on the live
 * database on 2026-09-30: of 53 accounts, 45 had never signed in on a day
 * other than the one they registered. A streak only changes behaviour when
 * breaking it costs something visible, and that needs a daily thing to break.
 *
 * Two properties this module guarantees, both covered by tests:
 *
 * - **Same day, same five, every device.** The set comes from the date alone —
 *   never `Math.random`, never what this reader has already seen — so two
 *   classmates can argue about question 3. It also means nothing has to be
 *   stored for the set itself; only "did I finish today's" is saved.
 * - **No repeat for months.** Each difficulty pool is shuffled once under a
 *   fixed seed and then read as a ring, `count` ids a day. The light pool is
 *   the first to come round, and at two a day out of 242 that is 121 days.
 *   A plain independent draw per day would instead repeat within weeks.
 *
 * The mix is 2 light / 2 medium / 1 hard. Five is deliberately small: the
 * point is something finished while the bus is coming, not a study session —
 * a set long enough to feel like homework is a set that gets skipped, and a
 * skipped day breaks the streak this whole module exists to protect.
 *
 * **Importing this module costs about two megabytes**, because the rings are
 * built from the whole duel bank at module scope and that bank is built from
 * `data/quiz.ts`. Only the quiz screen, which is lazy, may import it. The
 * calendar half lives in `dailyStreak.ts` and imports nothing — that is what
 * the home screen and `progress.ts` use, and the split exists precisely
 * because they used to come through here for two lines of date arithmetic.
 */
import { battlePools } from '../data/battleQuestions'
import { DAILY_MIX, dayNumber } from './dailyStreak'

export {
  DAILY_MIX,
  DAILY_SIZE,
  dailyDone,
  dayNumber,
  nextDailyStreak,
  streakAlive,
} from './dailyStreak'

/**
 * Fixed for the life of the feature. Changing it reshuffles every future set —
 * harmless in itself, but it would also hand a reader mid-streak a day they
 * have already answered, so treat it as frozen.
 */
const DAILY_SEED = 20_260_930

/** Deterministic 32-bit PRNG (mulberry32) — same seed, same sequence, forever. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/**
 * Each pool in one fixed order, decided once at module load.
 *
 * Shuffling first is what stops the ring serving questions in bank order,
 * which would march through one persona and then the next. Each pool gets its
 * own seed offset so the three rings are uncorrelated — without that, the same
 * relative position would be read from all three every day.
 */
const RINGS: readonly (readonly string[])[] = battlePools.map((pool, index) => {
  const random = seededRandom(DAILY_SEED + index * 7919)
  const ids = pool.map((question) => question.id)
  // Fisher–Yates, inlined rather than borrowed from `shuffle.ts`, because this
  // one must never be handed a different `random` by a caller.
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
})

/**
 * The five question ids for a local `YYYY-MM-DD`.
 *
 * Reads each ring at `day * count` and takes `count` consecutive entries,
 * wrapping — so consecutive days never overlap and a pool is exhausted before
 * anything comes round again.
 */
export function dailyQuestionIds(date: string): string[] {
  const day = dayNumber(date)
  return RINGS.flatMap((ring, index) => {
    const count = DAILY_MIX[index]
    if (ring.length === 0) return []
    const start = (((day * count) % ring.length) + ring.length) % ring.length
    return Array.from({ length: count }, (_, k) => ring[(start + k) % ring.length])
  })
}
