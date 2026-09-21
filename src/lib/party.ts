/**
 * Gathering a team before a team battle (2х2 … 5х5).
 *
 * The 1v1 duel in `battle.ts` is untouched: it has its own queue, its own
 * rating and its own screen. This module is only about the bigger formats,
 * where players have to be assembled *before* matchmaking can start.
 *
 * Two collections (see `firestore.rules`):
 *
 * - `parties/{code}`    — the party itself. The document id is the six-letter
 *   join code the leader shares, so knowing the code is what gets someone in,
 *   exactly like a Кахут room. The leader owns `mode`, `size` and `status`;
 *   everyone else may only add or remove themselves.
 * - `partyQueue/{code}` — "this party is looking for an opponent". Readable by
 *   everyone signed in, which is what lets the format picker show how many
 *   players are waiting in each size instead of dropping someone into an
 *   empty queue with no warning.
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
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
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

/** How long a queue slot is treated as live — a phone that closed mid-search
 *  leaves its slot behind, and a stale slot must not be counted as a waiting
 *  player or matched against. */
export const QUEUE_SLOT_TTL_MS = 90_000

export type PartyStatus = 'idle' | 'queued'

export interface Party {
  code: string
  leader: string
  members: string[]
  mode: BattleMode
  size: TeamSize
  status: PartyStatus
  createdAt: number
}

export interface QueueSlot {
  code: string
  leader: string
  size: TeamSize
  mode: BattleMode
  members: string[]
  createdAt: number
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
  return {
    code,
    leader: value.leader,
    members: members as string[],
    mode: value.mode === 'ranked' ? 'ranked' : 'casual',
    size,
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

/** How many players are waiting right now, per size, for one mode. */
export type QueueCounts = Record<TeamSize, number>

export function emptyQueueCounts(): QueueCounts {
  return { 2: 0, 3: 0, 4: 0, 5: 0 }
}

/** Counts live slots only — ones older than `QUEUE_SLOT_TTL_MS` are leftovers
 *  from closed tabs, and counting them would promise an opponent who isn't
 *  there. */
export function countWaiting(slots: QueueSlot[], mode: BattleMode, now = Date.now()): QueueCounts {
  const counts = emptyQueueCounts()
  for (const slot of slots) {
    if (slot.mode !== mode) continue
    if (now - slot.createdAt > QUEUE_SLOT_TTL_MS) continue
    counts[slot.size] += slot.members.length
  }
  return counts
}

function toSlot(code: string, data: unknown): QueueSlot | null {
  if (!data || typeof data !== 'object') return null
  const value = data as Record<string, unknown>
  const size = asTeamSize(value.size)
  const members = value.members
  if (!size || !Array.isArray(members)) return null
  return {
    code,
    leader: typeof value.leader === 'string' ? value.leader : '',
    size,
    mode: value.mode === 'ranked' ? 'ranked' : 'casual',
    members: members as string[],
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
  }
}

/** Streams the whole queue. It is a handful of documents — a few parties at a
 *  time — so there is no query, no index, and one listener answers both "how
 *  many are waiting in 3х3" and, later, "who can we play against". */
export function watchQueue(onChange: (slots: QueueSlot[]) => void): () => void {
  if (!db) return () => {}
  return onSnapshot(
    collection(db, 'partyQueue'),
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((entry) => toSlot(entry.id, entry.data()))
          .filter((slot): slot is QueueSlot => slot !== null),
      )
    },
    (error) => console.warn('[tarihhub] Party queue listener failed.', error),
  )
}

/* --------------------------------- writing -------------------------------- */

/** Opens a party with the caller alone in it. Returns its code, or `null`. */
export async function createParty(
  uid: string,
  mode: BattleMode,
  size: TeamSize,
): Promise<string | null> {
  if (!db) return null
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
        status: 'idle',
        createdAt: Date.now(),
      })
      return code
    } catch (error) {
      console.warn('[tarihhub] Party code attempt failed, retrying.', error)
    }
  }
  return null
}

export type JoinPartyResult =
  | 'joined'
  | 'already'
  | 'full'
  | 'searching'
  | 'notFound'
  | 'invalid'
  | 'error'

/** Joins by code. The read and the write share a transaction so two friends
 *  tapping "join" at the same moment can't overwrite each other's row. */
export async function joinParty(rawCode: string, uid: string): Promise<JoinPartyResult> {
  const code = normalizePartyCode(rawCode)
  if (!code) return 'invalid'
  if (!db) return 'error'
  const database = db
  try {
    return await runTransaction(database, async (transaction) => {
      const ref = doc(database, 'parties', code)
      const snapshot = await transaction.get(ref)
      if (!snapshot.exists()) return 'notFound' as JoinPartyResult
      const party = toParty(code, snapshot.data())
      if (!party) return 'notFound' as JoinPartyResult
      if (party.members.includes(uid)) return 'already' as JoinPartyResult
      if (party.status === 'queued') return 'searching' as JoinPartyResult
      if (party.members.length >= party.size) return 'full' as JoinPartyResult
      transaction.update(ref, { members: [...party.members, uid] })
      return 'joined' as JoinPartyResult
    })
  } catch (error) {
    console.warn('[tarihhub] Could not join the party.', error)
    return 'error'
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
        // The leader leaving means there is no party any more: without this
        // the others would sit in a room nobody can queue.
        transaction.delete(doc(database, 'partyQueue', code))
        transaction.delete(ref)
        return
      }
      transaction.update(ref, { members: party.members.filter((member) => member !== uid) })
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
      transaction.update(ref, { members: party.members.filter((member) => member !== memberUid) })
    })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not remove the member.', error)
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

/**
 * Starts looking for an opponent: the party is marked `queued` and its slot
 * appears in the queue, both in one batch so the two can never disagree.
 * Only a full party may search — `size` is what the opponent will be matched
 * against, and an under-filled slot would produce an uneven battle.
 */
export async function startSearch(code: string, uid: string): Promise<boolean> {
  if (!db) return false
  try {
    const snapshot = await getDoc(doc(db, 'parties', code))
    const party = snapshot.exists() ? toParty(code, snapshot.data()) : null
    if (!party || party.leader !== uid || party.members.length !== party.size) return false
    const batch = writeBatch(db)
    batch.update(doc(db, 'parties', code), { status: 'queued' })
    batch.set(doc(db, 'partyQueue', code), {
      leader: uid,
      size: party.size,
      mode: party.mode,
      members: party.members,
      createdAt: Date.now(),
    })
    await batch.commit()
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not start the search.', error)
    return false
  }
}

/** Stops looking. Safe to call when not searching. */
export async function stopSearch(code: string): Promise<boolean> {
  if (!db) return false
  try {
    await deleteDoc(doc(db, 'partyQueue', code))
    await updateDoc(doc(db, 'parties', code), { status: 'idle' })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not stop the search.', error)
    return false
  }
}

/** Keeps a live slot from ageing past `QUEUE_SLOT_TTL_MS` while the leader's
 *  screen is still open — the same idea as the duel's presence ping. */
export async function refreshQueueSlot(code: string, uid: string, party: Party): Promise<void> {
  if (!db) return
  try {
    await setDoc(doc(db, 'partyQueue', code), {
      leader: uid,
      size: party.size,
      mode: party.mode,
      members: party.members,
      createdAt: Date.now(),
    })
  } catch (error) {
    console.warn('[tarihhub] Could not refresh the queue slot.', error)
  }
}

/**
 * The sizes worth offering instead of the one being waited on: smaller
 * formats the party can actually field, and that somebody is waiting in.
 * This is the answer to "5х5 may never fill" — rather than hiding an empty
 * queue, the screen offers a format with real people in it.
 */
export function downsizeOptions(
  current: TeamSize,
  members: number,
  counts: QueueCounts,
): TeamSize[] {
  return TEAM_SIZES.filter((size) => size < current && size <= members && counts[size] > 0)
}
