/**
 * Firestore security-rules tests. Runs against the local emulator:
 *
 *   npm run test:rules
 *
 * (which is `firebase emulators:exec --only firestore ... vitest run`). Skipped
 * automatically when `FIRESTORE_EMULATOR_HOST` is not set, so a plain
 * `npm test` on a machine without Java stays green.
 */
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const d = hasEmulator ? describe : describe.skip

// Outside the skipped block on purpose: if `test:rules` ever stops exporting
// FIRESTORE_EMULATOR_HOST the whole `d(...)` suite would skip silently and go
// green with zero assertions — this line is what fails instead.
it('runs against a Firestore emulator (FIRESTORE_EMULATOR_HOST set)', () => {
  expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy()
})

/** A complete, in-bounds profile document — the shape `validProfileShape` wants. */
function validProfile(over: Record<string, unknown> = {}) {
  return {
    xp: 100,
    streak: 3,
    quizzesCompleted: 2,
    unlockedBadges: ['flame'],
    totalVisits: 5,
    lastVisitDate: '2026-03-01',
    peopleViewed: ['p1'],
    timelineViewed: true,
    lessonProgress: { l1: 100 },
    completedLessons: ['l1'],
    lessonQuizBest: { l1: { correct: 5, total: 5 } },
    sectionChecksDone: ['l1:0'],
    avatarGender: 'm',
    displayedRankTier: null,
    displayedAvatarTier: null,
    casualDuels: 1,
    casualWins: 1,
    casualStreak: 1,
    recentCasualDuels: [],
    rankedDuels: 0,
    rankedWins: 0,
    rankedStreak: 0,
    recentRankedDuels: [],
    ...over,
  }
}

function validBattlePlayer(over: Record<string, unknown> = {}) {
  return {
    displayName: 'Aisha',
    photoURL: '',
    level: 4,
    avatarTierIndex: 2,
    titleTierIndex: 2,
    updatedAt: Date.now(),
    weekXp: 0,
    rating: 0,
    weekStart: '2026-03-01',
    scoredAt: 0,
    avatarGender: 'f',
    ...over,
  }
}

let env: RulesTestEnvironment

d('firestore.rules', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'tarihhub-test',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    })
  })
  afterAll(async () => env?.cleanup())
  beforeEach(async () => env.clearFirestore())

  /* --------------------------- profile --------------------------- */

  describe('users/{uid}/profile/state', () => {
    it('the owner can create an in-bounds profile', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(setDoc(doc(db, 'users/alice/profile/state'), validProfile()))
    })

    it('rejects an absurd xp', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(db, 'users/alice/profile/state'), validProfile({ xp: 1_000_000_000_000 })),
      )
    })

    it('rejects an unknown extra field', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(db, 'users/alice/profile/state'), validProfile({ isAdmin: true })),
      )
    })

    it('lets an account whose stored doc predates the battle counters keep syncing', async () => {
      // A profile last written before casualDuels/rankedWins existed. The
      // monotonic check must read those absent keys as 0, not error (which
      // would deny — and `allow delete: if false` leaves no way to recover).
      const legacy = validProfile()
      delete (legacy as Record<string, unknown>).casualDuels
      delete (legacy as Record<string, unknown>).casualWins
      delete (legacy as Record<string, unknown>).rankedDuels
      delete (legacy as Record<string, unknown>).rankedWins
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/alice/profile/state'), legacy)
      })
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(
        setDoc(doc(db, 'users/alice/profile/state'), validProfile({ xp: 140 }), { merge: true }),
      )
    })

    it('rejects a decreasing lifetime counter on update', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/alice/profile/state'), validProfile({ xp: 500 }))
      })
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(updateDoc(doc(db, 'users/alice/profile/state'), { xp: 400 }))
      await assertSucceeds(updateDoc(doc(db, 'users/alice/profile/state'), { xp: 520 }))
    })

    it('rejects an xp jump larger than one sync could produce', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/alice/profile/state'), validProfile({ xp: 100 }))
      })
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(updateDoc(doc(db, 'users/alice/profile/state'), { xp: 100 + 250_000 }))
    })

    it('never lets another user read or write it, or anyone delete it', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/alice/profile/state'), validProfile())
      })
      const mallory = env.authenticatedContext('mallory').firestore()
      await assertFails(getDoc(doc(mallory, 'users/alice/profile/state')))
      await assertFails(setDoc(doc(mallory, 'users/alice/profile/state'), validProfile()))
      const alice = env.authenticatedContext('alice').firestore()
      await assertFails(deleteDoc(doc(alice, 'users/alice/profile/state')))
    })
  })

  /* ------------------------ battlePlayers ------------------------ */

  describe('battlePlayers/{uid}', () => {
    it('rejects a create that front-loads weekXp', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(db, 'battlePlayers/alice'), validBattlePlayer({ weekXp: 5000 })),
      )
    })

    it('accepts only a plain lh3.googleusercontent.com photoURL', async () => {
      const db = env.authenticatedContext('alice').firestore()
      for (const bad of [
        'https://evil.example/x.png',
        'https://res.cloudinary.com/x/image/upload/v1/q.jpg',
        'https://evil.example/?x=https://lh3.googleusercontent.com/a/y',
        'https://lh3.googleusercontent.com.evil.example/a/x',
        'https://lh3.googleusercontent.com@evil.example/x',
      ]) {
        await assertFails(
          setDoc(doc(db, 'battlePlayers/alice'), validBattlePlayer({ photoURL: bad })),
        )
      }
      await assertSucceeds(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          validBattlePlayer({ photoURL: 'https://lh3.googleusercontent.com/a/x' }),
        ),
      )
    })

    it('rejects an unknown extra field on the mirror', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(db, 'battlePlayers/alice'), validBattlePlayer({ isChampion: true })),
      )
    })

    it('tolerates a device clock a few minutes off but not wildly off', async () => {
      const db = env.authenticatedContext('alice').firestore()
      // A phone 90s off NTP used to have every duel write denied by a ±5s
      // window; ±5min now lets it through.
      await assertSucceeds(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          validBattlePlayer({ updatedAt: Date.now() - 90_000 }),
        ),
      )
      // The window is still bounded — a 10-minute backdate is refused.
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/bob'),
          validBattlePlayer({ updatedAt: Date.now() - 600_000 }),
        ),
      )
    })

    it('throttles scoring writes to one per 60 seconds and caps the delta', async () => {
      const now = Date.now()
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), 'battlePlayers/alice'),
          validBattlePlayer({ weekXp: 100, updatedAt: now - 5000 }),
        )
      })
      const db = env.authenticatedContext('alice').firestore()
      // Within 60s of the last write → a scoring change is refused.
      await assertFails(
        setDoc(doc(db, 'battlePlayers/alice'), validBattlePlayer({ weekXp: 300, updatedAt: now })),
      )
      // A delta over the per-write cap is refused even with time on its side.
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), 'battlePlayers/alice'),
          validBattlePlayer({ weekXp: 100, updatedAt: now - 120_000 }),
        )
      })
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          validBattlePlayer({ weekXp: 100 + 5000, updatedAt: now }),
        ),
      )
    })
  })

  /* -------------------------- aiUsage --------------------------- */

  describe('aiUsage/{bucket}/days/{day}', () => {
    const path = (bucket: string) => `aiUsage/${bucket}/days/2026-03-01`

    it('per-user counter is created at 1 and only ever rises by 1', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(setDoc(doc(db, path('alice')), { count: 3, day: '2026-03-01' }))
      await assertSucceeds(setDoc(doc(db, path('alice')), { count: 1, day: '2026-03-01' }))
      await assertSucceeds(updateDoc(doc(db, path('alice')), { count: 2 }))
      await assertFails(updateDoc(doc(db, path('alice')), { count: 4 }))
      await assertFails(updateDoc(doc(db, path('alice')), { count: 1 }))
      await assertFails(deleteDoc(doc(db, path('alice'))))
    })

    it('a user cannot read or move another user’s counter', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), path('alice')), { count: 5, day: '2026-03-01' })
      })
      const mallory = env.authenticatedContext('mallory').firestore()
      await assertFails(getDoc(doc(mallory, path('alice'))))
      await assertFails(updateDoc(doc(mallory, path('alice')), { count: 6 }))
    })

    it('any signed-in user may push the shared circuit-breaker up by one', async () => {
      const db = env.authenticatedContext('someone').firestore()
      await assertSucceeds(setDoc(doc(db, path('_shared')), { count: 1, day: '2026-03-01' }))
      await assertSucceeds(updateDoc(doc(db, path('_shared')), { count: 2 }))
      await assertFails(updateDoc(doc(db, path('_shared')), { count: 999 }))
    })
  })

  /* --------------------------- friends --------------------------- */

  /** The batch `ensureMyFriendCode` writes: the code and its owner pointer together. */
  function mintCode(db: Firestore, uid: string, code: string) {
    const batch = writeBatch(db)
    batch.set(doc(db, 'friendCodes', code), { uid, createdAt: Date.now() })
    batch.set(doc(db, 'friendCodeOwners', uid), { code })
    return batch.commit()
  }

  const BOB_CODE = 'BQK7M2XZ'
  const ALICE_CODE = 'A3HJ9PWR'

  /** Seeds bob's (and optionally alice's) code with the rules off. */
  async function seedCodes(withAlice = false) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'friendCodes', BOB_CODE), { uid: 'bob', createdAt: 1 })
      await setDoc(doc(db, 'friendCodeOwners/bob'), { code: BOB_CODE })
      if (withAlice) {
        await setDoc(doc(db, 'friendCodes', ALICE_CODE), { uid: 'alice', createdAt: 1 })
        await setDoc(doc(db, 'friendCodeOwners/alice'), { code: ALICE_CODE })
      }
    })
  }

  function request(over: Record<string, unknown> = {}) {
    return {
      uids: ['alice', 'bob'],
      requestedBy: 'alice',
      status: 'pending',
      createdAt: Date.now(),
      viaCode: BOB_CODE,
      ...over,
    }
  }

  describe('friendCodes / friendCodeOwners', () => {
    it('an account mints its own code and pointer in one batch', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(mintCode(db, 'alice', ALICE_CODE))
    })

    it('a code without its owner pointer (or the other way round) is refused', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(setDoc(doc(db, 'friendCodes', ALICE_CODE), { uid: 'alice', createdAt: 1 }))
      await assertFails(setDoc(doc(db, 'friendCodeOwners/alice'), { code: ALICE_CODE }))
    })

    it('an account cannot mint a second code', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(mintCode(db, 'alice', ALICE_CODE))
      await assertFails(mintCode(db, 'alice', 'Z9Z9Z9Z9'))
    })

    it('nobody can take over a code that already belongs to someone', async () => {
      await seedCodes()
      const db = env.authenticatedContext('mallory').firestore()
      await assertFails(mintCode(db, 'mallory', BOB_CODE))
    })

    it('rejects codes with look-alike characters or the wrong length', async () => {
      const db = env.authenticatedContext('alice').firestore()
      for (const bad of ['ABCDEFG0', 'ABCDEFGI', 'ABCDEFG', 'abcdefgh']) {
        await assertFails(mintCode(db, 'alice', bad))
      }
    })

    it('a code can be looked up by value, but the codes cannot be listed', async () => {
      await seedCodes()
      const db = env.authenticatedContext('mallory').firestore()
      await assertSucceeds(getDoc(doc(db, 'friendCodes', BOB_CODE)))
      await assertFails(getDocs(collection(db, 'friendCodes')))
      // Nor can someone else's pointer be read to learn their code.
      await assertFails(getDoc(doc(db, 'friendCodeOwners/bob')))
    })
  })

  describe('friendships/{pairId}', () => {
    it('alice can send bob a request with bob’s real code', async () => {
      await seedCodes()
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(setDoc(doc(db, 'friendships/alice_bob'), request()))
    })

    it('a request without the other person’s code is refused', async () => {
      await seedCodes(true)
      const db = env.authenticatedContext('alice').firestore()
      // Her own code, a made-up code, and no code at all.
      await assertFails(setDoc(doc(db, 'friendships/alice_bob'), request({ viaCode: ALICE_CODE })))
      await assertFails(setDoc(doc(db, 'friendships/alice_bob'), request({ viaCode: 'ZZZZZZZZ' })))
      const noCode = request()
      delete (noCode as Record<string, unknown>).viaCode
      await assertFails(setDoc(doc(db, 'friendships/alice_bob'), noCode))
    })

    it('rejects a spoofed sender, a pre-accepted request and a badly formed pair', async () => {
      await seedCodes()
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(setDoc(doc(db, 'friendships/alice_bob'), request({ requestedBy: 'bob' })))
      await assertFails(setDoc(doc(db, 'friendships/alice_bob'), request({ status: 'accepted' })))
      await assertFails(
        setDoc(doc(db, 'friendships/bob_alice'), request({ uids: ['bob', 'alice'] })),
      )
      await assertFails(setDoc(doc(db, 'friendships/alice_carol'), request()))
    })

    it('mallory cannot plant a friendship between two other people', async () => {
      await seedCodes()
      const db = env.authenticatedContext('mallory').firestore()
      await assertFails(
        setDoc(doc(db, 'friendships/alice_bob'), request({ requestedBy: 'mallory' })),
      )
    })

    it('only the person asked can accept, and only as pending → accepted', async () => {
      await seedCodes()
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'friendships/alice_bob'), request())
      })
      const alice = env.authenticatedContext('alice').firestore()
      await assertFails(
        updateDoc(doc(alice, 'friendships/alice_bob'), { status: 'accepted', acceptedAt: Date.now() }),
      )
      const bob = env.authenticatedContext('bob').firestore()
      // Accepting may not rewrite who is in the pair.
      await assertFails(
        updateDoc(doc(bob, 'friendships/alice_bob'), {
          status: 'accepted',
          acceptedAt: Date.now(),
          requestedBy: 'bob',
        }),
      )
      await assertSucceeds(
        updateDoc(doc(bob, 'friendships/alice_bob'), { status: 'accepted', acceptedAt: Date.now() }),
      )
    })

    it('only the two people in a pair can see it, as a document or in a query', async () => {
      await seedCodes()
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'friendships/alice_bob'), request())
      })
      const bob = env.authenticatedContext('bob').firestore()
      await assertSucceeds(getDoc(doc(bob, 'friendships/alice_bob')))
      await assertSucceeds(
        getDocs(query(collection(bob, 'friendships'), where('uids', 'array-contains', 'bob'))),
      )
      const mallory = env.authenticatedContext('mallory').firestore()
      await assertFails(getDoc(doc(mallory, 'friendships/alice_bob')))
      await assertFails(
        getDocs(query(collection(mallory, 'friendships'), where('uids', 'array-contains', 'bob'))),
      )
      // A pair that doesn't exist is refused just the same — no existence leak.
      await assertFails(getDoc(doc(mallory, 'friendships/bob_carol')))
      // But the caller may check one of their own pairs before sending.
      await assertSucceeds(getDoc(doc(mallory, 'friendships/bob_mallory')))
    })

    it('either side can remove the pair; nobody else can', async () => {
      await seedCodes()
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'friendships/alice_bob'), request())
      })
      const mallory = env.authenticatedContext('mallory').firestore()
      await assertFails(deleteDoc(doc(mallory, 'friendships/alice_bob')))
      const bob = env.authenticatedContext('bob').firestore()
      await assertSucceeds(deleteDoc(doc(bob, 'friendships/alice_bob')))
    })
  })

})
