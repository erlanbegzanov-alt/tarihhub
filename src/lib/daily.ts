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
 */
import { battlePools } from '../data/battleQuestions'

/** Questions in one daily set. */
export const DAILY_SIZE = 5

/**
 * How many of the five come from each difficulty pool, easiest first.
 * Sums to `DAILY_SIZE` — asserted in the test rather than trusted to whoever
 * edits this next.
 */
export const DAILY_MIX: readonly [number, number, number] = [2, 2, 1]

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
 * Whole days since the Unix epoch for a local `YYYY-MM-DD` string.
 *
 * Built from the string's own numbers through `Date.UTC`, not by parsing it
 * into a local `Date`: the caller has already decided which calendar day this
 * is in *their* timezone, and re-reading it through a local constructor would
 * shift the answer for anyone east or west of UTC, so two readers looking at
 * the same date could be handed different sets.
 */
export function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

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

/** Whether today's set has already been finished. */
export function dailyDone(dailyDate: string, today: string): boolean {
  return dailyDate === today
}

/**
 * The streak after finishing the set on `today`.
 *
 * Same rule as `recordVisit`'s, deliberately: finished yesterday → one more,
 * any bigger gap → back to 1. Missing a day costs the whole number, which is
 * the point — a streak that decays gently is one nobody hurries home for.
 */
export function nextDailyStreak(
  previousDate: string,
  previousStreak: number,
  today: string,
): number {
  if (previousDate === today) return previousStreak
  if (!previousDate) return 1
  return dayNumber(today) - dayNumber(previousDate) === 1 ? previousStreak + 1 : 1
}

/**
 * Whether a streak last touched on `dailyDate` is still alive as of `today`.
 *
 * Finished today, or finished yesterday with today still open. Anything older
 * is already lost, and the UI says so rather than carrying a number that the
 * next finish would silently reset to 1 anyway.
 */
export function streakAlive(dailyDate: string, today: string): boolean {
  if (!dailyDate) return false
  const gap = dayNumber(today) - dayNumber(dailyDate)
  return gap === 0 || gap === 1
}
