/**
 * Gathering a team before a team battle (2х2 … 5х5).
 *
 * The 1v1 duel in `battle.ts` is untouched: it has its own queue, its own
 * rating and its own screen. This module is only about the bigger formats,
 * where players have to be assembled *before* matchmaking can start.
 *
 * One collection (see `firestore.rules`): `parties/{code}` — the room itself.
 * The document id is the six-letter join code the leader shares, so knowing the
 * code is what gets someone in, exactly like a Кахут room. The leader owns
 * `mode`, `size` and `status`; everyone else may only move or remove
 * themselves.
 *
 * There used to be a second collection, `partyQueue`, holding "this team is
 * looking for an opponent". It is gone: nothing ever read two slots and paired
 * them, so the queue could only ever be waited in, never matched out of. A room
 * holding both sides needs no queue at all.
 *
 * Every join and leave runs in a transaction: five phones editing one members
 * list is exactly the case where read-then-write loses people.
 *
 * As everywhere else here, nothing throws when Firebase is absent — calls
 * become no-ops and the screen shows its unavailable state.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { BattleMode } from './battle'
import { db } from './firebase'
import { FRIEND_CODE_ALPHABET } from './friends'

/** The formats this module covers. 1х1 stays the old duel. */
export const TEAM_SIZES = [2, 3, 4, 5] as const
export type TeamSize = (typeof TEAM_SIZES)[number]

/** Shorter than a friend code: it is read aloud across a classroom, not kept. */
export const PARTY_CODE_LENGTH = 6
const PARTY_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/

/**
 * `queued` is no longer written by anything — it belonged to the old search.
 * It stays in the union because rooms created before the queue was removed may
 * still carry it, and `joinParty` refusing to let anyone into such a room is
 * the right answer for a document this code can no longer drive.
 */
export type PartyStatus = 'idle' | 'queued'

/**
 * The two sides of one room.
 *
 * A room used to be a single team that then queued for an opponent, and the
 * opponent never came: nothing in the app ever read two queue slots and paired
 * them, so a full team could wait for ever. Even with that written, at this
 * app's size two full teams are almost never waiting in the same minute. The
 * room now holds both sides at once — gather whoever is around, split them,
 * play. No queue, and it works with four people online.
 */
export interface Teams {
  a: string[]
  b: string[]
}

export interface Party {
  code: string
  leader: string
  /** Everyone in the room, both sides. `teams` says who is on which. */
  members: string[]
  mode: BattleMode
  /** Per side, so the room holds `size * 2`. */
  size: TeamSize
  teams: Teams
  status: PartyStatus
  createdAt: number
}

/** Where a uid sits, or `null` when they are in the room but unassigned. */
export type TeamKey = 'a' | 'b'

/** Room capacity: both sides. */
export function roomCapacity(size: TeamSize): number {
  return size * 2
}

/** Reads a roster off a raw document, keeping only strings. */
function roster(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * Splits `members` into two sides when the document has no `teams` yet.
 *
 * Rooms created before this existed are single teams, and the honest reading
 * of one is "everybody on side A" — not a silent half-and-half split that
 * would put friends against each other without anyone choosing it.
 */
function teamsFrom(value: unknown, members: string[]): Teams {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const a = roster(raw?.a).filter((uid) => members.includes(uid))
  const b = roster(raw?.b).filter((uid) => members.includes(uid))
  if (!raw || (a.length === 0 && b.length === 0)) return { a: [...members], b: [] }
  const placed = new Set([...a, ...b])
  // Anyone in the room but on neither side joins the smaller one, so a
  // half-written document can never leave a player with nowhere to stand.
  const rest = members.filter((uid) => !placed.has(uid))
  const out: Teams = { a, b }
  for (const uid of rest) (out.a.length <= out.b.length ? out.a : out.b).push(uid)
  return out
}

/** The side with room, preferring A when they are even. */
export function smallerSide(teams: Teams): TeamKey {
  return teams.a.length <= teams.b.length ? 'a' : 'b'
}

/**
 * How long a room stays worth reopening.
 *
 * A room has no expiry of its own and nobody leaves one properly — people just
 * close the tab, which writes nothing. So the morning after, the stored code
 * still resolved and the screen showed yesterday's roster as if four people
 * were sitting in it. Worse, the join-by-code form is only rendered when you
 * are *not* in a room, so a room that would not let go also hid the only way
 * into a new one: Erlan could get in by invitation and not by code, and those
 * two symptoms were one bug.
 *
 * Three hours: long enough to survive a lunch break, short enough that a room
 * never outlives the sitting that made it.
 */
export const PARTY_TTL_MS = 3 * 60 * 60_000

/** Yesterday's room — old enough that nobody in it is still at their phone. */
export function isStaleParty(party: Party, now: number = Date.now()): boolean {
  // `createdAt` is 0 on a document written before that field existed; such a
  // room is older than anything this check could catch, so it counts too.
  return now - party.createdAt > PARTY_TTL_MS
}

/** Both sides manned and equal — Erlan's rule: no 3 against 5. */
export function teamsReady(party: Party): boolean {
  const { a, b } = party.teams
  return a.length >= 1 && a.length === b.length
}

/* ---------------------------------- codes --------------------------------- */

/** Same look-alike-free alphabet as a friend code (no I, O, 0, 1). */
export function generatePartyCode(): string {
  const bytes = new Uint8Array(PARTY_CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => FRIEND_CODE_ALPHABET[byte % FRIEND_CODE_ALPHABET.length]).join('')
}

/** Whatever was typed, as a party code — or `null` if it can't be one. */
export function normalizePartyCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '')
  return PARTY_CODE_PATTERN.test(code) ? code : null
}

/** A size the rules will accept, or `null`. Used before any write. */
export function asTeamSize(value: unknown): TeamSize | null {
  return TEAM_SIZES.includes(value as TeamSize) ? (value as TeamSize) : null
}

/* --------------------------------- reading -------------------------------- */

/** One raw party document, or `null` when it is malformed. */
export function toParty(code: string, data: unknown): Party | null {
  if (!data || typeof data !== 'object') return null
  const value = data as Record<string, unknown>
  const size = asTeamSize(value.size)
  const members = value.members
  if (!size || !Array.isArray(members) || members.some((m) => typeof m !== 'string')) return null
  if (typeof value.leader !== 'string') return null
  const roomMembers = members as string[]
  return {
    code,
    leader: value.leader,
    members: roomMembers,
    mode: value.mode === 'ranked' ? 'ranked' : 'casual',
    size,
    teams: teamsFrom(value.teams, roomMembers),
    status: value.status === 'queued' ? 'queued' : 'idle',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
  }
}

/** Streams one party. `onGone` fires when it is disbanded, so the screen can
 *  say so instead of showing a party that no longer exists. */
export function watchParty(
  code: string,
  onChange: (party: Party) => void,
  onGone: () => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(
    doc(db, 'parties', code),
    (snapshot) => {
      if (!snapshot.exists()) {
        onGone()
        return
      }
      const party = toParty(code, snapshot.data())
      if (party) onChange(party)
    },
    (error) => {
      console.warn('[tarihhub] Party listener failed.', error)
      onGone()
    },
  )
}

/* --------------------------------- writing -------------------------------- */

/**
 * Firestore's own name for why a write failed — `permission-denied`,
 * `unavailable`, `unauthenticated` and so on.
 *
 * Every failure in here used to collapse into one friendly sentence on screen
 * ("Не получилось войти. Проверь интернет"), which is precisely the state that
 * left Erlan reporting "код не работает вообще" and me unable to tell a rule
 * refusing the write from a phone with no signal. The code is carried out to
 * the screen so the next report names the cause.
 */
function failureCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : 'unknown'
}

export interface CreatePartyOutcome {
  /** The new room's code, or `null` when it could not be opened. */
  code: string | null
  /** Firestore's error code when `code` is `null`. */
  reason?: string
}

/** Opens a party with the caller alone in it. */
export async function createParty(
  uid: string,
  mode: BattleMode,
  size: TeamSize,
): Promise<CreatePartyOutcome> {
  if (!db) return { code: null, reason: 'no-firebase' }
  let reason = 'unknown'
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = generatePartyCode()
    try {
      // `create` on a code already taken is an update, which the rules refuse,
      // so a collision fails here rather than hijacking someone's party.
      await setDoc(doc(db, 'parties', code), {
        leader: uid,
        members: [uid],
        mode,
        size,
        teams: { a: [uid], b: [] },
        status: 'idle',
        createdAt: Date.now(),
      })
      return { code }
    } catch (error) {
      // A denied write is not a code collision, and retrying it three more
      // times only delays the message, so the last reason is kept and reported.
      reason = failureCode(error)
      console.warn('[tarihhub] Party code attempt failed, retrying.', error)
    }
  }
  return { code: null, reason }
}

export type JoinPartyResult =
  | 'joined'
  | 'already'
  | 'full'
  | 'searching'
  | 'notFound'
  | 'invalid'
  | 'error'

export interface JoinOutcome {
  result: JoinPartyResult
  /** Firestore's error code when `result` is `'error'`. */
  reason?: string
}

/** Joins by code. The read and the write share a transaction so two friends
 *  tapping "join" at the same moment can't overwrite each other's row. */
export async function joinParty(rawCode: string, uid: string): Promise<JoinOutcome> {
  const code = normalizePartyCode(rawCode)
  if (!code) return { result: 'invalid' }
  if (!db) return { result: 'error', reason: 'no-firebase' }
  const database = db
  try {
    const result = await runTransaction(database, async (transaction) => {
      const ref = doc(database, 'parties', code)
      const snapshot = await transaction.get(ref)
      if (!snapshot.exists()) return 'notFound' as JoinPartyResult
      const party = toParty(code, snapshot.data())
      if (!party) return 'notFound' as JoinPartyResult
      if (party.members.includes(uid)) return 'already' as JoinPartyResult
      if (party.status === 'queued') return 'searching' as JoinPartyResult
      if (party.members.length >= roomCapacity(party.size)) return 'full' as JoinPartyResult
      // Straight onto the thinner side, so a room fills evenly without anyone
      // having to shuffle people about before they can start.
      const side = smallerSide(party.teams)
      transaction.update(ref, {
        members: [...party.members, uid],
        teams: { ...party.teams, [side]: [...party.teams[side], uid] },
      })
      return 'joined' as JoinPartyResult
    })
    return { result }
  } catch (error) {
    console.warn('[tarihhub] Could not join the party.', error)
    return { result: 'error', reason: failureCode(error) }
  }
}

/**
 * The patch that takes one uid out of the room.
 *
 * `members` and `teams` have to move together in a single update: leaving a
 * uid behind on a side it is no longer a member of would let a team start with
 * a player who is not in the room.
 */
function dropFromRoom(party: Party, uid: string): { members: string[]; teams: Teams } {
  return {
    members: party.members.filter((member) => member !== uid),
    teams: {
      a: party.teams.a.filter((member) => member !== uid),
      b: party.teams.b.filter((member) => member !== uid),
    },
  }
}

/** Leaves, or — for the leader — disbands the whole party. */
export async function leaveParty(code: string, uid: string): Promise<boolean> {
  if (!db) return false
  const database = db
  try {
    await runTransaction(database, async (transaction) => {
      const ref = doc(database, 'parties', code)
      const snapshot = await transaction.get(ref)
      if (!snapshot.exists()) return
      const party = toParty(code, snapshot.data())
      if (!party) return
      if (party.leader === uid) {
        // The leader leaving means there is no room any more: without this the
        // others would sit in a room nobody can start.
        transaction.delete(ref)
        return
      }
      transaction.update(ref, dropFromRoom(party, uid))
    })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not leave the party.', error)
    return false
  }
}

/** Leader removes someone else. */
export async function removeMember(code: string, memberUid: string): Promise<boolean> {
  if (!db) return false
  const database = db
  try {
    await runTransaction(database, async (transaction) => {
      const ref = doc(database, 'parties', code)
      const snapshot = await transaction.get(ref)
      const party = snapshot.exists() ? toParty(code, snapshot.data()) : null
      if (!party || memberUid === party.leader) return
      transaction.update(ref, dropFromRoom(party, memberUid))
    })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not remove the member.', error)
    return false
  }
}

/**
 * Moves one player to the other side.
 *
 * Anyone may move themselves and the leader may move anyone, which is how the
 * two reference lobbies Erlan pointed at behave. The side being joined has to
 * have room, or a 2v2 room could end up 4v0 and never satisfy `teamsReady`.
 */
export async function switchTeam(code: string, uid: string, to: TeamKey): Promise<boolean> {
  if (!db) return false
  const database = db
  try {
    return await runTransaction(database, async (transaction) => {
      const ref = doc(database, 'parties', code)
      const snapshot = await transaction.get(ref)
      const party = snapshot.exists() ? toParty(code, snapshot.data()) : null
      if (!party || party.status !== 'idle') return false
      if (!party.members.includes(uid)) return false
      if (party.teams[to].includes(uid)) return true
      if (party.teams[to].length >= party.size) return false
      const from: TeamKey = to === 'a' ? 'b' : 'a'
      transaction.update(ref, {
        teams: {
          [from]: party.teams[from].filter((member) => member !== uid),
          [to]: [...party.teams[to], uid],
        },
      })
      return true
    })
  } catch (error) {
    console.warn('[tarihhub] Could not switch sides.', error)
    return false
  }
}

/* -------------------------------- invites --------------------------------- */

/**
 * "Come and play with us", from someone in a room to one friend.
 *
 * Until this existed the only way in was to read the six-letter code aloud,
 * which made the Друзья section decorative: you could collect friends and then
 * had no way to use them. An invite carries the code for them.
 *
 * The document id is `${code}_${to}`, so inviting the same person to the same
 * room twice overwrites the first invite instead of stacking a second card on
 * their screen.
 */
export interface PartyInvite {
  id: string
  code: string
  from: string
  to: string
  createdAt: number
}

/** After this long an invite is treated as stale and not shown: the room it
 *  points at has almost certainly been disbanded, and joining it would only
 *  produce "такой команды нет". */
export const INVITE_TTL_MS = 2 * 60 * 60_000

export function inviteId(code: string, to: string): string {
  return `${code}_${to}`
}

export function toPartyInvite(id: string, data: unknown): PartyInvite | null {
  if (!data || typeof data !== 'object') return null
  const value = data as Record<string, unknown>
  if (typeof value.code !== 'string' || typeof value.from !== 'string') return null
  if (typeof value.to !== 'string' || value.to === value.from) return null
  if (!normalizePartyCode(value.code)) return null
  return {
    id,
    code: value.code,
    from: value.from,
    to: value.to,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
  }
}

/** Invites one friend into a room the caller is already in. */
export async function invitePlayer(code: string, from: string, to: string): Promise<boolean> {
  if (!db) return false
  if (from === to) return false
  try {
    await setDoc(doc(db, 'partyInvites', inviteId(code, to)), {
      code,
      from,
      to,
      createdAt: Date.now(),
    })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not invite the player.', error)
    return false
  }
}

/** Streams the invitations waiting for one person, newest first and fresh only. */
export function watchMyInvites(
  uid: string,
  onChange: (invites: PartyInvite[]) => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(
    query(collection(db, 'partyInvites'), where('to', '==', uid)),
    (snapshot) => {
      const now = Date.now()
      onChange(
        snapshot.docs
          .map((entry) => toPartyInvite(entry.id, entry.data()))
          .filter((invite): invite is PartyInvite => invite !== null)
          .filter((invite) => now - invite.createdAt <= INVITE_TTL_MS)
          .sort((a, b) => b.createdAt - a.createdAt),
      )
    },
    (error) => console.warn('[tarihhub] Invite listener failed.', error),
  )
}

/** Clears one invite — after joining, or when it is not wanted. */
export async function dismissInvite(id: string): Promise<boolean> {
  if (!db) return false
  try {
    await deleteDoc(doc(db, 'partyInvites', id))
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not dismiss the invite.', error)
    return false
  }
}

/** Leader changes the format. */
export async function setPartyFormat(
  code: string,
  patch: { size?: TeamSize; mode?: BattleMode },
): Promise<boolean> {
  if (!db) return false
  try {
    await updateDoc(doc(db, 'parties', code), patch)
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not change the party format.', error)
    return false
  }
}

