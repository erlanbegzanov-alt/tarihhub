/**
 * Friends: personal codes and friend requests.
 *
 * Most of the people on TarihHub are children, so there is deliberately no way
 * to find anyone by name. Every account gets one personal code; a friend is
 * added by typing that code, and `firestore.rules` checks the code on every
 * request, so a uid seen on the public leaderboard is not enough to reach
 * anyone.
 *
 * Three collections, all shaped for a server-less app (see the file header of
 * `battle.ts` — there are no Cloud Functions):
 *
 * - `friendCodes/{code}`       — `{ uid, createdAt }`. Readable by exact code
 *   only, never listable.
 * - `friendCodeOwners/{uid}`   — `{ code }`. The account's own pointer to its
 *   code. Created in the same batch as the code; neither is ever rewritten,
 *   which is what makes it one code per account.
 * - `friendships/{a_b}`        — one document per pair, the two uids sorted and
 *   joined with `_`. `status` goes `pending` → `accepted`; declining,
 *   cancelling and unfriending are all a delete.
 *
 * A friend's name and avatar are read from their public battle mirror
 * (`battlePlayers/{uid}`, see `battle.ts`) rather than copied in here, so a
 * renamed friend never shows a stale name and no new personal data is stored.
 *
 * Like every other Firebase module here, nothing throws when the app runs
 * without Firebase: each call becomes a no-op or a neutral result.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

/* --------------------------------- codes --------------------------------- */

/**
 * 32 symbols with I, O, 0 and 1 left out — the four a child reading a code off
 * a friend's phone mixes up. Must stay in step with `validFriendCodeId` in
 * firestore.rules. 32⁸ ≈ 10¹² codes, far too many to find one by guessing.
 */
export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const FRIEND_CODE_LENGTH = 8

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/

/** A fresh random code. `crypto.getRandomValues`, not `Math.random`: codes are the only thing standing between a stranger and a child's profile. */
export function generateFriendCode(): string {
  const bytes = new Uint8Array(FRIEND_CODE_LENGTH)
  crypto.getRandomValues(bytes)
  // 256 is an exact multiple of 32, so `% 32` is unbiased.
  return Array.from(bytes, (byte) => FRIEND_CODE_ALPHABET[byte % FRIEND_CODE_ALPHABET.length]).join('')
}

/**
 * Whatever a person typed, as a code — or `null` if it can't be one.
 * Forgives case, spaces and the dash `formatFriendCode` shows.
 */
export function normalizeFriendCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '')
  return CODE_PATTERN.test(code) ? code : null
}

/** `BQK7M2XZ` → `BQK7-M2XZ`, easier to read aloud and copy by eye. */
export function formatFriendCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * The caller's code, minting it on first use.
 *
 * A collision with an existing code turns the batch's `create` into an update
 * the rules refuse, so a clash just fails and the next attempt draws again.
 * Returns `null` when Firebase is off or every attempt failed.
 */
export async function ensureMyFriendCode(uid: string): Promise<string | null> {
  if (!db) return null
  try {
    const owner = await getDoc(doc(db, 'friendCodeOwners', uid))
    const existing = owner.exists() ? owner.data().code : null
    if (typeof existing === 'string' && CODE_PATTERN.test(existing)) return existing
  } catch (error) {
    console.warn('[tarihhub] Could not read the friend code.', error)
    return null
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = generateFriendCode()
    const batch = writeBatch(db)
    batch.set(doc(db, 'friendCodes', code), { uid, createdAt: Date.now() })
    batch.set(doc(db, 'friendCodeOwners', uid), { code })
    try {
      await batch.commit()
      return code
    } catch (error) {
      console.warn('[tarihhub] Friend code attempt failed, retrying.', error)
    }
  }
  return null
}

/** The uid a code belongs to, or `null` for an unknown code. */
async function lookupFriendCode(code: string): Promise<string | null> {
  if (!db) return null
  const snapshot = await getDoc(doc(db, 'friendCodes', code))
  if (!snapshot.exists()) return null
  const uid = snapshot.data().uid
  return typeof uid === 'string' ? uid : null
}

/* ------------------------------- friendships ------------------------------- */

export type FriendshipStatus = 'pending' | 'accepted'

/** One pair, as seen from the reader's side. */
export interface Friendship {
  id: string
  /** The other person. */
  otherUid: string
  status: FriendshipStatus
  /** True when the reader sent the request (so it's theirs to cancel, not answer). */
  sentByMe: boolean
  createdAt: number
}

/** The document id for a pair — the same whichever side computes it. */
export function friendshipId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`
}

/** Reads one raw friendship document into the reader's point of view, or `null` if it's malformed. */
export function toFriendship(id: string, data: unknown, myUid: string): Friendship | null {
  if (!data || typeof data !== 'object') return null
  const value = data as Record<string, unknown>
  const uids = value.uids
  if (!Array.isArray(uids) || uids.length !== 2 || !uids.includes(myUid)) return null
  const otherUid = uids[0] === myUid ? uids[1] : uids[0]
  if (typeof otherUid !== 'string') return null
  const status = value.status === 'accepted' ? 'accepted' : value.status === 'pending' ? 'pending' : null
  if (!status) return null
  return {
    id,
    otherUid,
    status,
    sentByMe: value.requestedBy === myUid,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
  }
}

/** What happened to "add this code", in words the screen can show. */
export type AddFriendResult =
  | 'sent'
  | 'accepted'
  | 'already'
  | 'pending'
  | 'self'
  | 'notFound'
  | 'invalid'
  | 'error'

/**
 * Sends a friend request to the owner of `rawCode`.
 *
 * If they had already asked the reader, this accepts theirs instead of
 * sending a second one — two people adding each other at once should end up
 * friends, not stuck with a request each way.
 */
export async function addFriendByCode(myUid: string, rawCode: string): Promise<AddFriendResult> {
  const code = normalizeFriendCode(rawCode)
  if (!code) return 'invalid'
  if (!db) return 'error'
  try {
    const otherUid = await lookupFriendCode(code)
    if (!otherUid) return 'notFound'
    if (otherUid === myUid) return 'self'

    const id = friendshipId(myUid, otherUid)
    const ref = doc(db, 'friendships', id)
    const existing = await getDoc(ref)
    if (existing.exists()) {
      const friendship = toFriendship(id, existing.data(), myUid)
      if (friendship?.status === 'accepted') return 'already'
      if (friendship?.sentByMe) return 'pending'
      await updateDoc(ref, { status: 'accepted', acceptedAt: Date.now() })
      return 'accepted'
    }

    await setDoc(ref, {
      uids: [myUid, otherUid].sort(),
      requestedBy: myUid,
      status: 'pending',
      createdAt: Date.now(),
      viaCode: code,
    })
    return 'sent'
  } catch (error) {
    console.warn('[tarihhub] Could not send the friend request.', error)
    return 'error'
  }
}

/** Answers "yes" to a request someone sent the reader. */
export async function acceptFriendRequest(id: string): Promise<boolean> {
  if (!db) return false
  try {
    await updateDoc(doc(db, 'friendships', id), { status: 'accepted', acceptedAt: Date.now() })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not accept the friend request.', error)
    return false
  }
}

/** Declines, cancels or unfriends — all three are the same delete. */
export async function removeFriendship(id: string): Promise<boolean> {
  if (!db) return false
  try {
    await deleteDoc(doc(db, 'friendships', id))
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not remove the friendship.', error)
    return false
  }
}

/**
 * Streams every pair the reader is in — friends and requests both ways.
 * Newest first. `onError` fires if the listener can't start.
 */
export function watchFriendships(
  myUid: string,
  onChange: (friendships: Friendship[]) => void,
  onError?: () => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(
    query(collection(db, 'friendships'), where('uids', 'array-contains', myUid)),
    (snapshot) => {
      const list = snapshot.docs
        .map((entry) => toFriendship(entry.id, entry.data(), myUid))
        .filter((entry): entry is Friendship => entry !== null)
        .sort((a, b) => b.createdAt - a.createdAt)
      onChange(list)
    },
    (error) => {
      console.warn('[tarihhub] Friendship listener failed.', error)
      onError?.()
    },
  )
}

/** How long after their last visit a friend still counts as "в сети". */
export const ONLINE_WINDOW_MS = 5 * 60_000
