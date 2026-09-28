/**
 * What is waiting for the reader's answer, counted in one place.
 *
 * Two things arrive from other people and both were invisible until you went
 * looking for them: a friend request, which only showed on `/battle/friends`,
 * and an invitation into a room, which only showed on the team screen. Nobody
 * opens either on the off-chance, so an invitation nobody sees is an invitation
 * that never arrived — Erlan hit exactly that and asked for a dot.
 *
 * The counts live here rather than in each screen because three places have to
 * agree on them: the dot on the nav rail, the dot on the burger (the rail is
 * hidden behind it on a phone, so without that one the badge would be invisible
 * on the device most of his users are on), and the numbers on the Батл tiles.
 *
 * Both listeners are the ones the screens already use, so this adds no new
 * query shape and no new collection.
 */
import { useEffect, useState } from 'react'
import { FEATURE_TEAM_BATTLE } from './environment'
import { watchFriendships } from './friends'
import type { Friendship } from './friends'
import { watchMyInvites } from './party'
import type { PartyInvite } from './party'
import { useSession } from './session'

export interface Alerts {
  /** Friend requests someone sent the reader and the reader has not answered. */
  friendRequests: number
  /** Invitations into a room, still fresh (see `INVITE_TTL_MS`). */
  partyInvites: number
  /** What the dot is for: anything at all. */
  total: number
}

const NOTHING: Alerts = { friendRequests: 0, partyInvites: 0, total: 0 }

/**
 * Counts of the things addressed to the reader personally.
 *
 * Returns zeroes while signed out and when the team feature is off, so a dot
 * can never appear over a section that cannot receive anything.
 */
export function useAlerts(): Alerts {
  const uid = useSession().user?.uid ?? null
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [invites, setInvites] = useState<PartyInvite[]>([])

  useEffect(() => {
    if (!uid) {
      setFriendships([])
      setInvites([])
      return
    }
    const stopFriends = watchFriendships(uid, setFriendships)
    // The friends list works without the team feature; rooms do not exist
    // without it, so there is nothing to listen for.
    const stopInvites = FEATURE_TEAM_BATTLE ? watchMyInvites(uid, setInvites) : null
    return () => {
      stopFriends()
      stopInvites?.()
    }
  }, [uid])

  if (!uid) return NOTHING

  // `sentByMe` is the whole point: a request the reader sent is waiting on the
  // other person, and a dot on it would be a badge for your own action.
  const friendRequests = friendships.filter(
    (entry) => entry.status === 'pending' && !entry.sentByMe,
  ).length
  const partyInvites = invites.length

  return { friendRequests, partyInvites, total: friendRequests + partyInvites }
}
