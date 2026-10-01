/**
 * The daily set's calendar arithmetic, kept apart from its question bank.
 *
 * These functions are pure date maths — they never look at a question — but
 * they were written inside `daily.ts`, which builds its rings from
 * `battleQuestions` at module scope. That made the home screen's little
 * "today's five / streak" card, and `progress.ts` alongside it, reach through
 * the duel bank into `data/quiz.ts` and so into `lessonQuestions.ts`: about
 * two megabytes of questions downloaded before anything painted, to ask
 * whether two date strings are one day apart.
 *
 * So the rule for this file is simply: it imports nothing. Anything that
 * needs a question belongs in `daily.ts`, which only the quiz screen loads.
 */

/** Questions in one daily set. */
export const DAILY_SIZE = 5

/**
 * How many of the five come from each difficulty pool, easiest first.
 * Sums to `DAILY_SIZE` — asserted in the test rather than trusted to whoever
 * edits this next.
 */
export const DAILY_MIX: readonly [number, number, number] = [2, 2, 1]

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
