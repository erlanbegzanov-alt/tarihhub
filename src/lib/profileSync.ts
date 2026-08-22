/**
 * Cloud mirror for the local progress store.
 *
 * Model: localStorage stays the fast, always-available cache that every screen
 * reads through `useProfile()`. Once a Firebase user is signed in, the document
 * at `users/{uid}/profile/state` becomes the durable source of truth: it is
 * merged into the local copy on sign-in, and every later local write is pushed
 * up. Signed out (or with no Firebase config) nothing here runs.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore'
import type { DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import {
  RECENT_CASUAL_DUELS_MAX,
  RECENT_RANKED_DUELS_MAX,
  getProfile,
  loadProfileForUser,
  normalizeProfile,
  replaceProfile,
  setRemoteWriter,
} from './progress'
import type { LessonQuizScore, ProfileState } from './progress'

function profileDoc(uid: string): DocumentReference | null {
  if (!db) return null
  return doc(db, 'users', uid, 'profile', 'state')
}

/**
 * Combines the cloud copy with whatever this device accumulated locally.
 *
 * The cloud copy always wins where the two disagree in a way that can't be
 * reconciled — a returning user on a fresh device must never have their real
 * progress replaced by this browser's near-empty state. Counters take the
 * higher value and lists take the union, so progress made on this device
 * before the cloud copy loaded is carried up rather than thrown away.
 */
/**
 * Newest-first union of two duel logs, capped.
 *
 * Deduped by `at` — the millisecond the duel was recorded, which is unique per
 * duel and identical in both copies of the same one. Without that, every
 * sign-in re-merges the cloud copy with the local cache that was pushed *from*
 * that same copy and keeps a second identical row, so one duel quietly becomes
 * two, then four; the counters beside it (merged with `Math.max`) stay right,
 * which is what makes the drift so easy to miss.
 */
function mergeDuelLog<T extends { at: number }>(
  remote: T[],
  local: T[],
  max: number,
): T[] {
  const byTime = new Map<number, T>()
  for (const duel of [...remote, ...local]) {
    if (!byTime.has(duel.at)) byTime.set(duel.at, duel)
  }
  return [...byTime.values()].sort((a, b) => b.at - a.at).slice(0, max)
}

export function mergeProfiles(
  remote: ProfileState | null,
  local: ProfileState,
): ProfileState {
  if (!remote) return local

  // Streak only makes sense together with the date it was last touched, so the
  // more recently active copy supplies both.
  const remoteIsNewer = remote.lastVisitDate >= local.lastVisitDate

  // Same idea for the casual win streak: it isn't a lifetime counter like
  // `casualWins`, so whichever side played the more recent duel supplies it.
  const remoteCasualAt = remote.recentCasualDuels[0]?.at ?? 0
  const localCasualAt = local.recentCasualDuels[0]?.at ?? 0
  const casualIsNewer = remoteCasualAt >= localCasualAt
  const recentCasualDuels = mergeDuelLog(
    remote.recentCasualDuels,
    local.recentCasualDuels,
    RECENT_CASUAL_DUELS_MAX,
  )

  // The ranked log merges by exactly the same rules as the casual one above.
  const remoteRankedAt = remote.recentRankedDuels[0]?.at ?? 0
  const localRankedAt = local.recentRankedDuels[0]?.at ?? 0
  const rankedIsNewer = remoteRankedAt >= localRankedAt
  const recentRankedDuels = mergeDuelLog(
    remote.recentRankedDuels,
    local.recentRankedDuels,
    RECENT_RANKED_DUELS_MAX,
  )

  // Per lesson, the furthest either device got. A device that only just opened
  // a lesson must never push a returning user back from a finished one.
  const lessonProgress: Record<string, number> = { ...remote.lessonProgress }
  for (const [id, percent] of Object.entries(local.lessonProgress)) {
    lessonProgress[id] = Math.max(lessonProgress[id] ?? 0, percent)
  }

  // Per lesson, the better of the two best attempts. Compared by ratio, since
  // the two sides can hold different question counts for the same lesson.
  const lessonQuizBest: Record<string, LessonQuizScore> = {
    ...remote.lessonQuizBest,
  }
  for (const [id, score] of Object.entries(local.lessonQuizBest)) {
    const current = lessonQuizBest[id]
    if (!current || score.correct / score.total > current.correct / current.total) {
      lessonQuizBest[id] = score
    }
  }

  return {
    xp: Math.max(remote.xp, local.xp),
    quizzesCompleted: Math.max(remote.quizzesCompleted, local.quizzesCompleted),
    totalVisits: Math.max(remote.totalVisits, local.totalVisits),
    streak: remoteIsNewer ? remote.streak : local.streak,
    lastVisitDate: remoteIsNewer ? remote.lastVisitDate : local.lastVisitDate,
    unlockedBadges: [
      ...new Set([...remote.unlockedBadges, ...local.unlockedBadges]),
    ],
    peopleViewed: [...new Set([...remote.peopleViewed, ...local.peopleViewed])],
    sectionChecksDone: [
      ...new Set([...remote.sectionChecksDone, ...local.sectionChecksDone]),
    ],
    timelineViewed: remote.timelineViewed || local.timelineViewed,
    // A track picked on any device beats an unset one; the cloud copy breaks a tie.
    avatarGender: remote.avatarGender ?? local.avatarGender,
    // Purely a display choice, so the same rule applies: the cloud copy is the
    // one the user last deliberately set, and `null` means "no choice made".
    displayedRankTier: remote.displayedRankTier ?? local.displayedRankTier,
    // Same rule, independently: the cloud copy is the last deliberate pick.
    displayedAvatarTier: remote.displayedAvatarTier ?? local.displayedAvatarTier,
    casualDuels: Math.max(remote.casualDuels, local.casualDuels),
    casualWins: Math.max(remote.casualWins, local.casualWins),
    casualStreak: casualIsNewer ? remote.casualStreak : local.casualStreak,
    recentCasualDuels,
    rankedDuels: Math.max(remote.rankedDuels, local.rankedDuels),
    rankedWins: Math.max(remote.rankedWins, local.rankedWins),
    rankedStreak: rankedIsNewer ? remote.rankedStreak : local.rankedStreak,
    recentRankedDuels,
    lessonProgress,
    completedLessons: [
      ...new Set([...remote.completedLessons, ...local.completedLessons]),
    ],
    lessonQuizBest,
  }
}

/**
 * Adopts the signed-in user's cloud profile and starts mirroring local writes
 * to it. Safe to call when Firestore is unavailable — it simply does nothing.
 */
export async function startProfileSync(uid: string): Promise<void> {
  // Scope the local cache to this account *before* touching it below, so the
  // merge only ever sees this account's own device history — never a
  // previous account's numbers left over from the same browser.
  loadProfileForUser(uid)

  const ref = profileDoc(uid)
  if (!ref) return

  let remote: ProfileState | null = null
  try {
    const snapshot = await getDoc(ref)
    if (snapshot.exists()) remote = normalizeProfile(snapshot.data())
  } catch (error) {
    // Offline or rules not deployed yet: keep working from the local copy and
    // don't attach a writer that would only fail on every keystroke.
    console.warn('[tarihhub] Could not read the cloud profile.', error)
    return
  }

  // Attach the writer first so the merged state below is pushed up in the same
  // write that lands it in localStorage.
  setRemoteWriter((next) => {
    void setDoc(ref, next, { merge: true }).catch((error: unknown) => {
      console.warn('[tarihhub] Could not save progress to the cloud.', error)
    })
  })

  replaceProfile(mergeProfiles(remote, getProfile()))
}

/** Detaches the cloud mirror and clears the account-scoped local cache. */
export function stopProfileSync(): void {
  setRemoteWriter(null)
  loadProfileForUser(null)
}
