/**
 * The team battle itself: one match document per room, one player document per
 * person, and a team's score is the sum of its players' scores.
 *
 * Everyone answers the same nine questions at their own pace rather than in
 * lockstep. A synchronised, Кахут-style match needs a host phone to drive the
 * clock, and one player on a bad connection stalls nine other people; here a
 * slow phone only costs that player their own seconds, and the live team totals
 * still make it feel like one game.
 *
 * `teamMatches/{code}` shares its id with the room that started it
 * (`parties/{code}`), which is what lets every member's room screen simply
 * watch for the document appearing and follow it into the match — no field has
 * to be added to the room, and no one has to be told to press anything.
 *
 * The match document is self-contained: it copies the sides and the roster in
 * at creation. The room is deleted the moment its leader leaves, and a match
 * that had to `get()` a room to know who was playing would become unreadable
 * halfway through.
 *
 * There is no `status` field. "Finished" is `everyoneDone()` over the player
 * documents — a derived answer cannot disagree with the documents it is
 * derived from, and a stored one can.
 *
 * As everywhere else here, nothing throws when Firebase is absent: calls become
 * no-ops and the screen shows its unavailable state.
 */
import { collection, deleteDoc, doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore'
import { pickRoundQuestionIds } from '../data/battleQuestions'
import { ROUND_SIZE } from './battle'
import { db } from './firebase'
import { asTeamSize } from './party'
import type { Party, TeamKey, Teams, TeamSize } from './party'

/** One person's run through the match. */
export interface TeamMatchPlayer {
  uid: string
  side: TeamKey
  /** Points so far, on the duel's scale (see `answerXp` in battle.ts). */
  score: number
  /** How many of `questionIds` they have answered. */
  answered: number
  /** They have reached the end of their own run. */
  done: boolean
  /**
   * The `startedAt` of the match this run belongs to.
   *
   * Deleting a match document does not delete this subcollection — Firestore
   * keeps documents whose parent is gone — so a second match in the same room
   * would otherwise open on the first one's finished runs. Readers keep only
   * the runs stamped with the live match's `startedAt`.
   */
  startedAt: number
}

export interface TeamMatch {
  code: string
  leader: string
  size: TeamSize
  teams: Teams
  /** Both sides flattened — what the rules check membership against. */
  members: string[]
  questionIds: string[]
  startedAt: number
}

export interface TeamScores {
  a: number
  b: number
}

/* --------------------------------- reading -------------------------------- */

function roster(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** One raw match document, or `null` when it is malformed. */
export function toTeamMatch(code: string, data: unknown): TeamMatch | null {
  if (!data || typeof data !== 'object') return null
  const value = data as Record<string, unknown>
  const size = asTeamSize(value.size)
  if (!size || typeof value.leader !== 'string') return null
  const teamsValue =
    value.teams && typeof value.teams === 'object'
      ? (value.teams as Record<string, unknown>)
      : null
  if (!teamsValue) return null
  const teams: Teams = { a: roster(teamsValue.a), b: roster(teamsValue.b) }
  const questionIds = roster(value.questionIds)
  // A match with nobody on a side, or with no questions, cannot be played at
  // all — rendering it would only produce an empty screen with no way out.
  if (teams.a.length === 0 || teams.b.length === 0 || questionIds.length === 0) return null
  return {
    code,
    leader: value.leader,
    size,
    teams,
    members: [...teams.a, ...teams.b],
    questionIds,
    startedAt: typeof value.startedAt === 'number' ? value.startedAt : 0,
  }
}

/** One raw player document, or `null` when it is malformed. */
export function toMatchPlayer(uid: string, data: unknown): TeamMatchPlayer | null {
  if (!data || typeof data !== 'object') return null
  const value = data as Record<string, unknown>
  if (value.side !== 'a' && value.side !== 'b') return null
  return {
    uid,
    side: value.side,
    score: typeof value.score === 'number' && value.score >= 0 ? value.score : 0,
    answered: typeof value.answered === 'number' && value.answered >= 0 ? value.answered : 0,
    done: value.done === true,
    startedAt: typeof value.startedAt === 'number' ? value.startedAt : 0,
  }
}

/**
 * A side's score is the sum of its players'.
 *
 * Players are summed by the side written on their own document, not by looking
 * them up in `match.teams`: a player document is the only thing its owner can
 * write, and the rules pin its `side` to the match's sides at creation, so the
 * two can never drift apart.
 */
export function teamScores(players: TeamMatchPlayer[]): TeamScores {
  const scores: TeamScores = { a: 0, b: 0 }
  for (const player of players) scores[player.side] += player.score
  return scores
}

export type TeamOutcome = TeamKey | 'draw'

export function matchOutcome(scores: TeamScores): TeamOutcome {
  if (scores.a === scores.b) return 'draw'
  return scores.a > scores.b ? 'a' : 'b'
}

/**
 * Everyone who was in the room when it started has finished their own run.
 *
 * Keyed off `match.members` rather than the player documents that exist: a
 * player who never opened the match has no document at all, and counting only
 * the documents present would declare the match over while someone is still
 * loading it.
 */
export function everyoneDone(match: TeamMatch, players: TeamMatchPlayer[]): boolean {
  const byUid = new Map(players.map((player) => [player.uid, player]))
  return match.members.every((uid) => byUid.get(uid)?.done === true)
}

/**
 * How long a match may stay unfinished before every screen calls it over
 * anyway.
 *
 * `everyoneDone` is derived from the runs, which is the right shape — but
 * `members` is fixed when the match is created, so somebody who closes the tab
 * mid-match leaves a run that can never reach `done`, and the rest of the room
 * waits on them for ever. Nobody can clear that: a run may never be deleted or
 * lowered, and no client may write another player's document.
 *
 * A player who is actually there cannot take longer than
 * `BATTLE_QUESTIONS * (QUESTION_SECONDS + REVEAL_MS)` — about two minutes —
 * because the board answers for them when their own clock runs out. This cap is
 * three times that, so it can only ever fire on someone who has left.
 *
 * Derived from `startedAt` and the wall clock rather than stored, so every
 * screen crosses it at the same moment without anyone writing a flag, and a
 * reload reaches the same answer from the same documents.
 */
export const MATCH_STALL_MS = 6 * 60_000

/** Whether the match should be shown as over: everyone finished, or long
 *  enough has passed that whoever is missing is not coming back. */
export function matchOver(
  match: TeamMatch,
  players: TeamMatchPlayer[],
  now: number = Date.now(),
): boolean {
  return everyoneDone(match, players) || now - match.startedAt > MATCH_STALL_MS
}

/** How far the whole room has got, for the progress line while people play. */
export function answeredTotal(players: TeamMatchPlayer[]): number {
  return players.reduce((sum, player) => sum + player.answered, 0)
}

/** Streams the match. `onGone` fires when it is cleared, so a screen can leave
 *  instead of sitting on a match that no longer exists. */
export function watchTeamMatch(
  code: string,
  onChange: (match: TeamMatch) => void,
  onGone: () => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(
    doc(db, 'teamMatches', code),
    (snapshot) => {
      if (!snapshot.exists()) {
        onGone()
        return
      }
      const match = toTeamMatch(code, snapshot.data())
      if (match) onChange(match)
      else onGone()
    },
    (error) => {
      console.warn('[tarihhub] Team match listener failed.', error)
      onGone()
    },
  )
}

/**
 * Streams every player's progress in ONE match. At most ten documents, so no
 * query.
 *
 * `startedAt` is not optional: runs left behind by an earlier match in the same
 * room are still in this collection, and counting them would open a fresh match
 * already finished. Filtering here rather than at each call site means no screen
 * can forget to do it.
 */
export function watchMatchPlayers(
  code: string,
  startedAt: number,
  onChange: (players: TeamMatchPlayer[]) => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(
    collection(db, 'teamMatches', code, 'players'),
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((entry) => toMatchPlayer(entry.id, entry.data()))
          .filter((player): player is TeamMatchPlayer => player !== null)
          .filter((player) => player.startedAt === startedAt),
      )
    },
    (error) => console.warn('[tarihhub] Team match players listener failed.', error),
  )
}

/* --------------------------------- writing -------------------------------- */

/**
 * Starts the match for a room, as its leader.
 *
 * The questions come from the duel's own picker, so a team battle asks the same
 * bank in the same light → medium → hard climb as a 1v1; `null` for the tier
 * because a team battle pays no rating and so belongs to no league.
 */
export async function startTeamMatch(party: Party, uid: string): Promise<boolean> {
  if (!db) return false
  if (party.leader !== uid) return false
  const { a, b } = party.teams
  if (a.length === 0 || a.length !== b.length) return false
  try {
    await setDoc(doc(db, 'teamMatches', party.code), {
      leader: uid,
      size: party.size,
      teams: { a, b },
      members: [...a, ...b],
      questionIds: pickRoundQuestionIds(ROUND_SIZE, null),
      startedAt: Date.now(),
    })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not start the team match.', error)
    return false
  }
}

/**
 * Records one answer on the caller's own player document.
 *
 * A transaction, and `answered`/`score` only ever move up: two tabs of the same
 * account, or a retry after a dropped write, must not be able to rewind a run
 * or bank the same question twice. The rules enforce the same monotonicity, so
 * neither a bug here nor a hand-written request can undo points.
 */
export async function recordMatchAnswer(
  code: string,
  uid: string,
  side: TeamKey,
  startedAt: number,
  gained: number,
  done: boolean,
): Promise<boolean> {
  if (!db) return false
  const database = db
  try {
    await runTransaction(database, async (transaction) => {
      const ref = doc(database, 'teamMatches', code, 'players', uid)
      const snapshot = await transaction.get(ref)
      const stored = snapshot.exists() ? toMatchPlayer(uid, snapshot.data()) : null
      // A document left by an earlier match in this room is not this run: it
      // must not carry its score forward, and its side is last game's.
      const current = stored && stored.startedAt === startedAt ? stored : null
      transaction.set(ref, {
        side: current?.side ?? side,
        score: (current?.score ?? 0) + Math.max(0, gained),
        answered: (current?.answered ?? 0) + 1,
        done: done || current?.done === true,
        startedAt,
      })
    })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not record the answer.', error)
    return false
  }
}

/** Seats the caller in the match before their first answer, so the others can
 *  see they have arrived rather than reading an absence as "not finished". */
export async function joinTeamMatch(
  code: string,
  uid: string,
  side: TeamKey,
  startedAt: number,
): Promise<boolean> {
  if (!db) return false
  const database = db
  try {
    await runTransaction(database, async (transaction) => {
      const ref = doc(database, 'teamMatches', code, 'players', uid)
      const snapshot = await transaction.get(ref)
      const stored = snapshot.exists() ? toMatchPlayer(uid, snapshot.data()) : null
      // Already seated in THIS match — leave the run alone, it may be underway.
      // A document from an earlier match in the same room is overwritten: that
      // reset is the one write the rules allow to lower a score, and only ever
      // towards a newer match.
      if (stored && stored.startedAt === startedAt) return
      transaction.set(ref, { side, score: 0, answered: 0, done: false, startedAt })
    })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not join the team match.', error)
    return false
  }
}

/**
 * Clears the match so the room can play another.
 *
 * Only the document itself. Its `players` subcollection stays behind —
 * Firestore keeps documents whose parent is deleted, and a client loop removing
 * up to ten of them would be a partial delete waiting to fail halfway. Those
 * leftovers are harmless because every run is stamped with its match's
 * `startedAt` and readers keep only the live one's.
 */
export async function clearTeamMatch(
  code: string,
  uid: string,
  match: TeamMatch,
): Promise<boolean> {
  if (!db) return false
  if (match.leader !== uid) return false
  try {
    await deleteDoc(doc(db, 'teamMatches', code))
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not clear the team match.', error)
    return false
  }
}
