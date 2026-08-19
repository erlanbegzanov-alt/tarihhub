/**
 * The 1v1 battle backend.
 *
 * There is no server in this project — no Cloud Functions, no matchmaker — so
 * everything here runs in the two players' browsers against four Firestore
 * collections (see `firestore.rules`, which is written around exactly this
 * flow):
 *
 * - `battlePlayers/{uid}` — a small public mirror of a player: the name,
 *   avatar, level, battle rating and this week's battle XP. Only its owner
 *   writes it; any signed-in user may read it, which is what makes an opponent
 *   card and the weekly board possible without exposing the private profile.
 * - `battleQueue/{uid}`   — "I am waiting for a duel", one slot per player.
 * - `battleClaims/{uid}`  — the matchmaking lock: created inside a transaction
 *   that first proves it is absent, so two players can never grab the same
 *   candidate and end up in different matches.
 * - `battleMatches/{id}`  — the duel itself. Each player writes only their own
 *   half (`p1` / `p2`) and watches the other half arrive over a snapshot
 *   listener; the rules enforce that split.
 *
 * Like every other module that touches Firebase, nothing here throws when the
 * app runs unconfigured: `db` is `null`, every call turns into a no-op, and the
 * battle screen shows its "not available" state instead of crashing.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { pickRoundQuestionIds } from '../data/battleQuestions'
import type { AvatarGender } from '../data/ranks'
import type { LocalizedText } from '../data/types'
import { db } from './firebase'

/* ----------------------------- the rules of a duel ----------------------------- */

export type BattleMode = 'casual' | 'ranked'

/** Questions per round — round 1 light, round 2 medium, round 3 hard (see `pickRoundQuestionIds`). */
export const ROUND_SIZE = 3
/** Rounds in one duel. */
export const ROUNDS = 3
/** Questions in one duel. */
export const BATTLE_QUESTIONS = ROUND_SIZE * ROUNDS
/** Seconds allowed per question before it is answered as a miss. */
export const QUESTION_SECONDS = 12
/** Flat XP for a correct answer, before the speed bonus. */
export const XP_PER_CORRECT = 30
/** Extra XP per whole second left on the clock when the answer lands. */
export const XP_PER_SECOND_LEFT = 3
/**
 * The XP a perfect, instant duel would score — the full length of the racing
 * bars, so both are read against the same fixed track rather than against each
 * other (a bar that shrank when the opponent pulled ahead would be a lie).
 */
export const MAX_BATTLE_XP =
  BATTLE_QUESTIONS * (XP_PER_CORRECT + QUESTION_SECONDS * XP_PER_SECOND_LEFT)
/** Rating gained on a ranked win. */
export const RATING_WIN = 18
/** Rating lost on a ranked defeat — deliberately smaller than the win. */
export const RATING_LOSS = 9

/**
 * The Рейтинг screen's own league ladder, read off `BattlePlayer.rating` —
 * separate from Profile.tsx's XP-based rank ladder (`src/data/ranks.ts`):
 * this one only ever moves on a ranked win or loss, so it tracks competitive
 * standing rather than lifetime progress.
 */
export interface RatingTier {
  name: LocalizedText
  min: number
}

export const RATING_TIERS: RatingTier[] = [
  { name: { kz: 'Қола', ru: 'Бронза' }, min: 0 },
  { name: { kz: 'Күміс', ru: 'Серебро' }, min: 120 },
  { name: { kz: 'Алтын', ru: 'Золото' }, min: 300 },
  { name: { kz: 'Платина', ru: 'Платина' }, min: 600 },
  { name: { kz: 'Алмас', ru: 'Алмаз' }, min: 1000 },
]

export interface RatingTierInfo {
  index: number
  tier: RatingTier
  /** `null` at the top tier — there is nothing further to climb toward. */
  next: RatingTier | null
  /** 0-100 progress toward `next`; 100 when already at the top tier. */
  progress: number
}

export function ratingTierFor(rating: number): RatingTierInfo {
  let index = 0
  for (let i = RATING_TIERS.length - 1; i >= 0; i -= 1) {
    if (rating >= RATING_TIERS[i].min) {
      index = i
      break
    }
  }
  const tier = RATING_TIERS[index]
  const next = RATING_TIERS[index + 1] ?? null
  const progress = next
    ? Math.max(
        0,
        Math.min(100, Math.round(((rating - tier.min) / (next.min - tier.min)) * 100)),
      )
    : 100
  return { index, tier, next, progress }
}

/**
 * How long a queue entry counts as somebody actually waiting.
 *
 * Nothing sweeps these collections — a tab closed mid-search never runs its own
 * cleanup — so an entry older than this is treated as abandoned rather than
 * matched into a duel against a player who isn't there.
 */
export const QUEUE_TTL_MS = 120_000

/** XP earned for one answer, given the seconds still on the clock. */
export function answerXp(correct: boolean, secondsLeft: number): number {
  if (!correct) return 0
  const seconds = Math.max(0, Math.min(QUESTION_SECONDS, Math.floor(secondsLeft)))
  return XP_PER_CORRECT + seconds * XP_PER_SECOND_LEFT
}

/* --------------------------------- shapes --------------------------------- */

/** One player's half of a match. `answers` holds the option index they picked,
 *  `-1` for a question the clock ran out on and `null` for one not reached. */
export interface BattleSlot {
  answers: (number | null)[]
  xp: number
  doneAt: number | null
}

export interface BattleMatch {
  id: string
  mode: BattleMode
  /** Fixed order: index 0 is the player who created the match, and owns `p1`. */
  players: string[]
  questionIds: string[]
  p1: BattleSlot
  p2: BattleSlot
  createdAt: number
  status: 'active' | 'done'
}

export interface BattlePlayer {
  uid: string
  displayName: string
  photoURL: string
  level: number
  rating: number
  weekXp: number
  /** `YYYY-MM-DD` of the Monday whose week `weekXp` was accumulated in. */
  weekStart: string
  updatedAt: number
  /** Same rank identity Profile.tsx shows — see `src/lib/rankIdentity.ts`.
   *  `null` when this player never picked a gender on their own profile. */
  avatarGender: AvatarGender | null
  avatarTierIndex: number
  titleTierIndex: number
}

/** Which half of the match doc a given player owns. */
export type SlotKey = 'p1' | 'p2'

export function slotKeyFor(match: BattleMatch, uid: string): SlotKey {
  return match.players[0] === uid ? 'p1' : 'p2'
}

/* ------------------------------- the week ------------------------------- */

/**
 * Local `YYYY-MM-DD` of the Monday that starts the ISO week `date` falls in.
 *
 * The weekly board resets the same lazy way the visit streak does in
 * `progress.ts`: nothing is scheduled anywhere, a stored week-start is simply
 * compared against today's and a stale one reads as zero. Local, not UTC, so
 * the week turns over on the reader's own clock.
 */
export function isoWeekStart(date: Date = new Date()): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // getDay() is 0 on Sunday; ISO weeks start on Monday.
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const month = String(monday.getMonth() + 1).padStart(2, '0')
  const day = String(monday.getDate()).padStart(2, '0')
  return `${monday.getFullYear()}-${month}-${day}`
}

/* ------------------------------ normalising ------------------------------ */

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

/**
 * Coerces an untrusted `battlePlayers` document, applying the lazy weekly
 * reset: a row still carrying last week's `weekStart` reads as zero XP for this
 * week, whether or not its owner has been back since.
 */
export function normalizeBattlePlayer(uid: string, value: unknown): BattlePlayer {
  const data = (value ?? {}) as Record<string, unknown>
  const weekStart = stringOr(data.weekStart, '')
  const currentWeek = isoWeekStart()
  return {
    uid,
    displayName: stringOr(data.displayName, ''),
    photoURL: stringOr(data.photoURL, ''),
    level: Math.max(1, Math.round(numberOr(data.level, 1))),
    rating: Math.max(0, Math.round(numberOr(data.rating, 0))),
    weekXp:
      weekStart === currentWeek
        ? Math.max(0, Math.round(numberOr(data.weekXp, 0)))
        : 0,
    weekStart: currentWeek,
    updatedAt: numberOr(data.updatedAt, 0),
    avatarGender:
      data.avatarGender === 'm' || data.avatarGender === 'f' ? data.avatarGender : null,
    avatarTierIndex: Math.max(0, Math.round(numberOr(data.avatarTierIndex, 0))),
    titleTierIndex: Math.max(0, Math.round(numberOr(data.titleTierIndex, 0))),
  }
}

function normalizeSlot(value: unknown, questions: number): BattleSlot {
  const data = (value ?? {}) as Record<string, unknown>
  const answers = Array.isArray(data.answers) ? data.answers : []
  return {
    answers: Array.from({ length: questions }, (_, index) => {
      const answer = answers[index]
      return typeof answer === 'number' && Number.isFinite(answer) ? answer : null
    }),
    xp: Math.max(0, Math.round(numberOr(data.xp, 0))),
    doneAt: typeof data.doneAt === 'number' ? data.doneAt : null,
  }
}

function normalizeMatch(id: string, value: unknown): BattleMatch | null {
  const data = (value ?? {}) as Record<string, unknown>
  const players = Array.isArray(data.players)
    ? data.players.filter((uid): uid is string => typeof uid === 'string')
    : []
  const questionIds = Array.isArray(data.questionIds)
    ? data.questionIds.filter((qid): qid is string => typeof qid === 'string')
    : []
  // A match without two players or a question list is not playable — the UI
  // must see `null` rather than a half-built duel.
  if (players.length !== 2 || questionIds.length === 0) return null
  return {
    id,
    mode: data.mode === 'ranked' ? 'ranked' : 'casual',
    players,
    questionIds,
    p1: normalizeSlot(data.p1, questionIds.length),
    p2: normalizeSlot(data.p2, questionIds.length),
    createdAt: numberOr(data.createdAt, 0),
    status: data.status === 'done' ? 'done' : 'active',
  }
}

function emptySlot(): BattleSlot {
  return {
    answers: Array.from({ length: BATTLE_QUESTIONS }, () => null),
    xp: 0,
    doneAt: null,
  }
}

/* ------------------------------ the mirror ------------------------------ */

export interface BattlePlayerMeta {
  displayName: string
  photoURL: string
  level: number
  avatarGender: AvatarGender | null
  avatarTierIndex: number
  titleTierIndex: number
}

/** Reads one player's public mirror, or `null` when there isn't one yet. */
export async function fetchBattlePlayer(uid: string): Promise<BattlePlayer | null> {
  if (!db) return null
  try {
    const snapshot = await getDoc(doc(db, 'battlePlayers', uid))
    if (!snapshot.exists()) return null
    return normalizeBattlePlayer(uid, snapshot.data())
  } catch (error) {
    console.warn('[tarihhub] Could not read a battle player.', error)
    return null
  }
}

/**
 * Publishes (or refreshes) the caller's own mirror, so an opponent and the
 * weekly board have a name, an avatar and a level to show. Rating and this
 * week's XP are carried over from whatever is already stored — this only ever
 * updates the identity half of the row.
 */
export async function syncBattlePlayer(
  uid: string,
  meta: BattlePlayerMeta,
): Promise<BattlePlayer | null> {
  if (!db) return null
  const current = await fetchBattlePlayer(uid)
  const next: BattlePlayer = {
    uid,
    displayName: meta.displayName,
    photoURL: meta.photoURL,
    level: meta.level,
    rating: current?.rating ?? 0,
    // `fetchBattlePlayer` already zeroed a stale week on the way in.
    weekXp: current?.weekXp ?? 0,
    weekStart: isoWeekStart(),
    updatedAt: Date.now(),
    avatarGender: meta.avatarGender,
    avatarTierIndex: meta.avatarTierIndex,
    titleTierIndex: meta.titleTierIndex,
  }
  try {
    await setDoc(doc(db, 'battlePlayers', uid), next)
    return next
  } catch (error) {
    console.warn('[tarihhub] Could not publish the battle player.', error)
    return current
  }
}

/**
 * Applies one finished ranked duel to the caller's own mirror: the rating moves
 * by `RATING_WIN` / `RATING_LOSS` (never below zero) and the XP earned is added
 * to this week's total, on top of the lazy weekly reset. Casual duels never
 * reach this — they pay real profile XP and nothing else.
 */
export async function applyRankedResult(
  uid: string,
  meta: BattlePlayerMeta,
  xpEarned: number,
  won: boolean,
): Promise<void> {
  if (!db) return
  const current = await fetchBattlePlayer(uid)
  const next: BattlePlayer = {
    uid,
    displayName: meta.displayName,
    photoURL: meta.photoURL,
    level: meta.level,
    rating: Math.max(0, (current?.rating ?? 0) + (won ? RATING_WIN : -RATING_LOSS)),
    weekXp: (current?.weekXp ?? 0) + Math.max(0, Math.round(xpEarned)),
    weekStart: isoWeekStart(),
    updatedAt: Date.now(),
    avatarGender: meta.avatarGender,
    avatarTierIndex: meta.avatarTierIndex,
    titleTierIndex: meta.titleTierIndex,
  }
  try {
    await setDoc(doc(db, 'battlePlayers', uid), next)
  } catch (error) {
    console.warn('[tarihhub] Could not save the battle result.', error)
  }
}

/**
 * This week's top players by battle XP.
 *
 * Deliberately over-fetches: the query can only order by the stored `weekXp`,
 * which for a row left over from last week is a number that no longer counts.
 * Those are zeroed on the way in and the list is re-sorted here, so a player
 * who stopped playing can't hold the top of a new week.
 */
export async function fetchWeeklyLeaderboard(count = 10): Promise<BattlePlayer[]> {
  if (!db) return []
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'battlePlayers'),
        orderBy('weekXp', 'desc'),
        limit(Math.max(count * 3, 30)),
      ),
    )
    return snapshot.docs
      .map((entry) => normalizeBattlePlayer(entry.id, entry.data()))
      .filter((player) => player.weekXp > 0)
      .sort((a, b) => b.weekXp - a.weekXp)
      .slice(0, count)
  } catch (error) {
    console.warn('[tarihhub] Could not read the weekly battle board.', error)
    return []
  }
}

/** The default cutoff for "this week's top players" everywhere the app shows the badge. */
export const WEEKLY_TOP_COUNT = 10

/**
 * Uids of this week's top `count` battle players, as a set for O(1) lookups —
 * every screen that shows the 🔥 weekly-top badge (Profile, a live duel,
 * Кахут) reads from this instead of re-deriving position from the full board.
 */
export async function fetchWeeklyTopUids(count = WEEKLY_TOP_COUNT): Promise<Set<string>> {
  const board = await fetchWeeklyLeaderboard(count)
  return new Set(board.map((player) => player.uid))
}

/* ----------------------------- matchmaking ----------------------------- */

/** Announces that this player is waiting for a duel in `mode`. */
export async function joinQueue(uid: string, mode: BattleMode): Promise<void> {
  if (!db) return
  try {
    await setDoc(doc(db, 'battleQueue', uid), { uid, mode, joinedAt: Date.now() })
  } catch (error) {
    console.warn('[tarihhub] Could not join the battle queue.', error)
  }
}

/** Removes this player's own waiting slot. Safe to call when there isn't one. */
export async function leaveQueue(uid: string): Promise<void> {
  if (!db) return
  try {
    await deleteDoc(doc(db, 'battleQueue', uid))
  } catch (error) {
    console.warn('[tarihhub] Could not leave the battle queue.', error)
  }
}

/** Clears the claim someone placed on this player once it has been acted on. */
export async function clearClaim(uid: string): Promise<void> {
  if (!db) return
  try {
    await deleteDoc(doc(db, 'battleClaims', uid))
  } catch (error) {
    console.warn('[tarihhub] Could not clear the battle claim.', error)
  }
}

/**
 * Watches for someone claiming *this* player. The other side has already built
 * the match by the time this fires, so the id it carries is ready to open.
 *
 * The claim's own timestamp comes with it: a browser closed mid-duel leaves its
 * documents behind (nothing cleans up after a tab that never unmounts), so the
 * caller has to be able to tell a live claim from yesterday's leftovers.
 */
export function watchClaim(
  uid: string,
  onClaimed: (matchId: string, createdAt: number) => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(
    doc(db, 'battleClaims', uid),
    (snapshot) => {
      if (!snapshot.exists()) return
      const data = snapshot.data()
      const matchId = data.matchId
      if (typeof matchId === 'string' && matchId) {
        onClaimed(matchId, numberOr(data.createdAt, 0))
      }
    },
    (error) => console.warn('[tarihhub] Battle claim listener failed.', error),
  )
}

/**
 * One matchmaking pass: looks for someone else waiting in the same mode and
 * tries to claim the longest-waiting one. Returns the new match's id, or `null`
 * when nobody was free — the caller keeps polling.
 *
 * The queue is filtered by mode only and sorted here rather than in the query:
 * an equality filter combined with an `orderBy` on another field would need a
 * composite index deployed alongside the rules, and this list is a handful of
 * documents.
 */
export async function findMatch(
  uid: string,
  mode: BattleMode,
  ratingTierIndex: number | null = null,
): Promise<string | null> {
  if (!db) return null
  let candidates: string[] = []
  const freshEnough = Date.now() - QUEUE_TTL_MS
  try {
    const snapshot = await getDocs(
      query(collection(db, 'battleQueue'), where('mode', '==', mode), limit(20)),
    )
    candidates = snapshot.docs
      .filter(
        (entry) =>
          entry.id !== uid && numberOr(entry.data().joinedAt, 0) > freshEnough,
      )
      .sort((a, b) => numberOr(a.data().joinedAt, 0) - numberOr(b.data().joinedAt, 0))
      .map((entry) => entry.id)
  } catch (error) {
    console.warn('[tarihhub] Could not read the battle queue.', error)
    return null
  }

  for (const candidateUid of candidates) {
    const matchId = await claimCandidate(uid, candidateUid, mode, ratingTierIndex)
    if (matchId) return matchId
  }
  return null
}

/**
 * Claims one candidate and builds the match in a single transaction.
 *
 * Both claim documents are read first: the candidate's, because someone else
 * may have taken them a moment ago, and the caller's own, because the candidate
 * may be claiming *us* at the same instant — without that second check two
 * players could walk away holding two different matches.
 */
async function claimCandidate(
  uid: string,
  candidateUid: string,
  mode: BattleMode,
  ratingTierIndex: number | null,
): Promise<string | null> {
  if (!db) return null
  const database = db
  const matchRef = doc(collection(database, 'battleMatches'))
  try {
    await runTransaction(database, async (transaction) => {
      const theirClaim = await transaction.get(
        doc(database, 'battleClaims', candidateUid),
      )
      const myClaim = await transaction.get(doc(database, 'battleClaims', uid))
      if (theirClaim.exists() || myClaim.exists()) {
        throw new Error('battle-claim-taken')
      }
      transaction.set(doc(database, 'battleClaims', candidateUid), {
        claimedBy: uid,
        matchId: matchRef.id,
        createdAt: Date.now(),
      })
      transaction.set(matchRef, {
        mode,
        players: [uid, candidateUid],
        // Matchmaking pairs by join order, not rating, so the initiator's own
        // league stands in for "this match's" league — casual duels (and
        // ranked ones before a rating exists) pass `null` for the plain
        // light → medium → hard climb.
        questionIds: pickRoundQuestionIds(ROUND_SIZE, mode === 'ranked' ? ratingTierIndex : null),
        p1: emptySlot(),
        p2: emptySlot(),
        createdAt: Date.now(),
        status: 'active',
      })
    })
    return matchRef.id
  } catch {
    // Lost the race (or the write was refused) — the caller tries the next
    // candidate and, failing that, keeps waiting to be claimed instead.
    return null
  }
}

/* -------------------------------- the duel -------------------------------- */

/** Live view of one match. Fires again on every write either player makes. */
export function watchMatch(
  matchId: string,
  onChange: (match: BattleMatch | null) => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(
    doc(db, 'battleMatches', matchId),
    (snapshot) => {
      onChange(snapshot.exists() ? normalizeMatch(snapshot.id, snapshot.data()) : null)
    },
    (error) => console.warn('[tarihhub] Battle match listener failed.', error),
  )
}

/**
 * Writes this player's own half of the match — never the other one, which the
 * rules would refuse anyway. `done` stamps `doneAt`, which is how the other
 * client learns the duel can be scored.
 */
export async function pushSlot(
  matchId: string,
  slot: SlotKey,
  answers: (number | null)[],
  xp: number,
  done: boolean,
): Promise<void> {
  if (!db) return
  try {
    await updateDoc(doc(db, 'battleMatches', matchId), {
      [`${slot}.answers`]: answers,
      [`${slot}.xp`]: xp,
      ...(done ? { [`${slot}.doneAt`]: Date.now() } : null),
    })
  } catch (error) {
    console.warn('[tarihhub] Could not save the battle answer.', error)
  }
}

/** Closes the match. Both clients do this for their own side; it is idempotent. */
export async function closeMatch(matchId: string): Promise<void> {
  if (!db) return
  try {
    await updateDoc(doc(db, 'battleMatches', matchId), { status: 'done' })
  } catch (error) {
    console.warn('[tarihhub] Could not close the battle.', error)
  }
}
