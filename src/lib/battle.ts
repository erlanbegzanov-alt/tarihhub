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

/* ------------------------------- presence ------------------------------- */

/*
 * Backing out the instant a match is found used to cost nothing: the other
 * player ground through all nine questions against somebody who would never
 * answer, with no sign anything was wrong. With no server there is nobody to
 * notice that for us, so each client says "still here" into its own slot and
 * reads the other's — three numbers, no new collection, no rules change (a
 * dotted write to `p1.lastSeenAt` leaves `p2` byte-identical, which is exactly
 * what the existing `battleMatches` update rule already allows).
 */

/** How often a player in a live duel refreshes their own `lastSeenAt`. */
export const PRESENCE_PING_MS = 4_000
/**
 * How long an opponent's `lastSeenAt` may stand still before they count as
 * gone. Four missed heartbeats: long enough that ordinary jitter, a backgrounded
 * tab's throttled timers or a slow Firestore round-trip never read as absence,
 * short enough that a real walk-out is caught inside one question.
 *
 * Both timestamps come from their own writer's clock, so a badly skewed device
 * is compared against ours — the same trade the queue TTL and the claim stamp
 * already make. The margin here absorbs anything short of a genuinely wrong
 * clock.
 */
export const PRESENCE_STALE_MS = 16_000
/**
 * No staleness check at all until this long after the match was created, so the
 * seeded `lastSeenAt` of a player whose first heartbeat is still in flight can
 * never be mistaken for an empty chair.
 */
export const PRESENCE_GRACE_MS = 10_000
/**
 * How long an opponent's heartbeat may stay missing before the still-present
 * player's own client resolves the duel unprompted and takes the win. Well
 * past `PRESENCE_STALE_MS` — the stamp has already been showing for a while
 * by then — so a real hiccup (a backgrounded tab catching back up, a rough
 * patch of signal) has room to recover before the match is decided for good.
 */
export const PRESENCE_AFK_CONFIRM_MS = 40_000

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
  /**
   * "I am still here", refreshed by this slot's owner every
   * `PRESENCE_PING_MS` while they have the duel open (`pingPresence`).
   *
   * Seeded to the match's creation time for *both* slots by `emptySlot()`, so a
   * duel is never read as abandoned in the instant before either client has had
   * a chance to send its first real heartbeat. `0` means the field is absent
   * altogether — a document written before presence existed — which readers
   * must treat as "no signal", never as "gone".
   */
  lastSeenAt: number
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
    // Defense in depth, not the security boundary — `firestore.rules` caps
    // the same field server-side. Kept in sync so the UI never shows a name
    // the rules would have rejected in the first place.
    displayName: stringOr(data.displayName, '').slice(0, 40),
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
    lastSeenAt: numberOr(data.lastSeenAt, 0),
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
    // Both slots start "seen" at match creation — see `BattleSlot.lastSeenAt`.
    lastSeenAt: Date.now(),
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
 * weekly board have a name, an avatar and a level to show.
 *
 * On an existing row this writes *only* the identity fields, via `updateDoc`
 * rather than a full `setDoc` overwrite. That matters because this runs on
 * its own effect keyed off `meta` (`BattleDuel.tsx`), which can re-fire the
 * instant a duel ends — `recordBattleResult` bumps the caller's profile XP,
 * which can change `level`/`rankIdentity` and thus `meta`'s identity — at
 * the exact moment `applyRankedResult` is writing a fresh `rating`/`weekXp`
 * for the same document. A full overwrite here would carry forward whatever
 * stale `rating`/`weekXp` this call's own read happened to see and, if it
 * lands after the ranked result's write, silently erase it. Touching only
 * the identity fields makes that race impossible: whatever this write
 * doesn't mention, Firestore (and firestore.rules, which evaluates
 * `request.resource.data` against the merged result) leaves untouched.
 */
export async function syncBattlePlayer(
  uid: string,
  meta: BattlePlayerMeta,
): Promise<BattlePlayer | null> {
  if (!db) return null
  const current = await fetchBattlePlayer(uid)
  // Matches the `displayName.size() <= 40` cap in firestore.rules — without
  // this, a real (if unusually long) Google account name could get this
  // write rejected outright instead of just trimmed.
  const displayName = meta.displayName.slice(0, 40)
  if (current) {
    try {
      await updateDoc(doc(db, 'battlePlayers', uid), {
        displayName,
        photoURL: meta.photoURL,
        level: meta.level,
        updatedAt: Date.now(),
        avatarGender: meta.avatarGender,
        avatarTierIndex: meta.avatarTierIndex,
        titleTierIndex: meta.titleTierIndex,
      })
      return { ...current, displayName, photoURL: meta.photoURL, level: meta.level }
    } catch (error) {
      console.warn('[tarihhub] Could not publish the battle player.', error)
      return current
    }
  }
  // First time this player is seen: no rating/weekXp to preserve yet, so the
  // full document (including the zeroed baseline) is written in one create.
  const next: BattlePlayer = {
    uid,
    displayName,
    photoURL: meta.photoURL,
    level: meta.level,
    rating: 0,
    weekXp: 0,
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
    return null
  }
}

/**
 * Where the rating stood on either side of one ranked duel.
 *
 * Returned rather than left for the caller to re-read, because re-reading is
 * exactly what it cannot do: `syncBattlePlayer` may write the same document a
 * moment later, and a second read would race it. These two numbers are the
 * ones this write actually committed, so the result screen can say
 * "1240 → 1258" instead of an opaque "+18", and the ranked history can store
 * the same pair (see `recordRankedDuelResult` in `src/lib/progress.ts`).
 *
 * `after` is not always `before ± RATING_WIN/RATING_LOSS`: the rating floors
 * at zero, so a loss near the bottom of the ladder moves it by less.
 */
export interface RatingChange {
  before: number
  after: number
}

/**
 * Applies one finished ranked duel to the caller's own mirror: the rating moves
 * by `RATING_WIN` / `RATING_LOSS` (never below zero) and the XP earned is added
 * to this week's total, on top of the lazy weekly reset. Casual duels never
 * reach this — they pay real profile XP and nothing else.
 *
 * Resolves to `null` only when there was no write to describe — Firebase
 * unconfigured, or the write refused.
 */
export async function applyRankedResult(
  uid: string,
  meta: BattlePlayerMeta,
  xpEarned: number,
  won: boolean,
): Promise<RatingChange | null> {
  if (!db) return null
  const current = await fetchBattlePlayer(uid)
  const next: BattlePlayer = {
    uid,
    // Matches the `displayName.size() <= 40` cap in firestore.rules.
    displayName: meta.displayName.slice(0, 40),
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
    return { before: current?.rating ?? 0, after: next.rating }
  } catch (error) {
    console.warn('[tarihhub] Could not save the battle result.', error)
    return null
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

/**
 * "Still here" — the heartbeat behind AFK detection, written the same
 * own-slot-only way `pushSlot` writes an answer, so the same rule covers it.
 *
 * Failures are swallowed on purpose and not even warned about: this runs every
 * few seconds for the whole duel, and a dropped heartbeat is already what the
 * staleness threshold is built to tolerate.
 */
export async function pingPresence(matchId: string, slot: SlotKey): Promise<void> {
  if (!db) return
  try {
    await updateDoc(doc(db, 'battleMatches', matchId), {
      [`${slot}.lastSeenAt`]: Date.now(),
    })
  } catch {
    /* one missed beat — the threshold allows several */
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
