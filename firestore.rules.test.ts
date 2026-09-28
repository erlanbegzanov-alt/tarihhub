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

  /* ------------------------- team battle ------------------------- */

  const PARTY = 'K7PMX2'

  /**
   * Sides for a room, dealt alternately.
   *
   * The rules insist `teams` accounts for exactly the members, so almost every
   * write below has to carry both. Dealing alternately is also stable when a
   * player is appended — everyone already placed keeps their side, which is
   * exactly what the join rule checks.
   */
  function sides(members: string[]) {
    const a: string[] = []
    const b: string[] = []
    members.forEach((uid, i) => (i % 2 === 0 ? a : b).push(uid))
    return { a, b }
  }

  /** The members plus the sides that match them — the shape an update needs. */
  function withTeams(members: string[]) {
    return { members, teams: sides(members) }
  }

  function party(over: Record<string, unknown> = {}) {
    const base = {
      leader: 'alice',
      members: ['alice'],
      mode: 'casual',
      size: 2,
      status: 'idle',
      createdAt: Date.now(),
      ...over,
    }
    return { ...base, teams: over.teams ?? sides(base.members as string[]) }
  }

  /** Seeds a party with the rules off, so each test starts from a known state. */
  async function seedParty(over: Record<string, unknown> = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'parties', PARTY), party(over))
    })
  }

  describe('parties/{code}', () => {
    it('a leader opens a party containing only themselves', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(setDoc(doc(db, 'parties', PARTY), party()))
    })

    it('rejects a party that starts with someone else in it, or a bad code/size', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(setDoc(doc(db, 'parties', PARTY), party({ members: ['alice', 'bob'] })))
      await assertFails(setDoc(doc(db, 'parties', PARTY), party({ leader: 'bob' })))
      await assertFails(setDoc(doc(db, 'parties', PARTY), party({ size: 9 })))
      await assertFails(setDoc(doc(db, 'parties', 'k7pmx2'), party()))
      await assertFails(setDoc(doc(db, 'parties', PARTY), party({ status: 'queued' })))
    })

    it('a friend with the code joins by appending only themselves', async () => {
      await seedParty()
      const bob = env.authenticatedContext('bob').firestore()
      await assertSucceeds(updateDoc(doc(bob, 'parties', PARTY), withTeams(['alice', 'bob'])))
    })

    it('nobody can drag a third person in, or rewrite the party while joining', async () => {
      await seedParty()
      const bob = env.authenticatedContext('bob').firestore()
      // Each of these carries sides that match its members, so what the rules
      // reject is the act itself and not a malformed document.
      await assertFails(
        updateDoc(doc(bob, 'parties', PARTY), withTeams(['alice', 'bob', 'carol'])),
      )
      await assertFails(updateDoc(doc(bob, 'parties', PARTY), withTeams(['alice', 'carol'])))
      await assertFails(
        updateDoc(doc(bob, 'parties', PARTY), { ...withTeams(['alice', 'bob']), leader: 'bob' }),
      )
      await assertFails(
        updateDoc(doc(bob, 'parties', PARTY), { ...withTeams(['alice', 'bob']), size: 5 }),
      )
    })

    it('a party already searching cannot be joined', async () => {
      await seedParty({ members: ['alice', 'bob'], size: 3, status: 'queued' })
      const carol = env.authenticatedContext('carol').firestore()
      await assertFails(
        updateDoc(doc(carol, 'parties', PARTY), withTeams(['alice', 'bob', 'carol'])),
      )
    })

    it('a player moves only themselves between the sides', async () => {
      await seedParty({ members: ['alice', 'bob', 'carol'], size: 3 })
      // Seeded sides are A: alice, carol — B: bob.
      const bob = env.authenticatedContext('bob').firestore()
      // Bob crosses over to A on his own: everyone else stays put.
      await assertSucceeds(
        updateDoc(doc(bob, 'parties', PARTY), {
          members: ['alice', 'bob', 'carol'],
          teams: { a: ['alice', 'carol', 'bob'], b: [] },
        }),
      )
      // But he cannot drag Carol across with him.
      await assertFails(
        updateDoc(doc(bob, 'parties', PARTY), {
          members: ['alice', 'bob', 'carol'],
          teams: { a: ['alice'], b: ['bob', 'carol'] },
        }),
      )
    })

    it('rejects sides that do not account for exactly the room', async () => {
      await seedParty({ members: ['alice', 'bob'], size: 3 })
      const bob = env.authenticatedContext('bob').firestore()
      // A player on no side at all.
      await assertFails(
        updateDoc(doc(bob, 'parties', PARTY), {
          members: ['alice', 'bob'],
          teams: { a: ['alice'], b: [] },
        }),
      )
      // A player on a side who is not in the room.
      await assertFails(
        updateDoc(doc(bob, 'parties', PARTY), {
          members: ['alice', 'bob'],
          teams: { a: ['alice'], b: ['ghost'] },
        }),
      )
    })

    it('a member removes only themselves; the leader may remove anyone', async () => {
      await seedParty({ members: ['alice', 'bob', 'carol'], size: 3 })
      const bob = env.authenticatedContext('bob').firestore()
      // Bob cannot drop Carol …
      await assertFails(updateDoc(doc(bob, 'parties', PARTY), withTeams(['alice', 'bob'])))
      // … but can leave himself.
      await assertSucceeds(updateDoc(doc(bob, 'parties', PARTY), withTeams(['alice', 'carol'])))
      const alice = env.authenticatedContext('alice').firestore()
      await assertSucceeds(updateDoc(doc(alice, 'parties', PARTY), withTeams(['alice'])))
      // Not even the leader can write themselves out of their own party.
      await assertFails(updateDoc(doc(alice, 'parties', PARTY), withTeams(['carol'])))
    })

    it('a room holds both sides — five a side, ten in all', async () => {
      // A sixth player is now fine: the room is 5v5, not a single team of 5.
      await seedParty({ members: ['alice', 'b', 'c', 'd', 'e'], size: 5 })
      const f = env.authenticatedContext('f').firestore()
      await assertSucceeds(
        updateDoc(doc(f, 'parties', PARTY), withTeams(['alice', 'b', 'c', 'd', 'e', 'f'])),
      )
    })

    it('a room never grows past ten, and no side past its size', async () => {
      const ten = ['alice', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
      await seedParty({ members: ten, size: 5 })
      const k = env.authenticatedContext('k').firestore()
      await assertFails(updateDoc(doc(k, 'parties', PARTY), withTeams([...ten, 'k'])))

      // Six on one side of a 5v5 is refused even when the room itself fits.
      await seedParty({ members: ['alice', 'b', 'c', 'd', 'e', 'f'], size: 5 })
      const g = env.authenticatedContext('g').firestore()
      await assertFails(
        updateDoc(doc(g, 'parties', PARTY), {
          members: ['alice', 'b', 'c', 'd', 'e', 'f', 'g'],
          teams: { a: ['alice', 'b', 'c', 'd', 'e', 'f'], b: ['g'] },
        }),
      )
    })

    it('only the leader disbands it', async () => {
      await seedParty({ members: ['alice', 'bob'] })
      const bob = env.authenticatedContext('bob').firestore()
      await assertFails(deleteDoc(doc(bob, 'parties', PARTY)))
      const alice = env.authenticatedContext('alice').firestore()
      await assertSucceeds(deleteDoc(doc(alice, 'parties', PARTY)))
    })
  })

  describe('partyQueue/{code} — removed', () => {
    // The search queue is gone (see firestore.rules and src/lib/party.ts).
    // This is the security half of that removal: dropping the rules has to
    // leave the collection shut, so a stale tab still running the old search
    // cannot keep writing to a surface nothing reads any more.
    it('is closed to reads and writes now that no rules cover it', async () => {
      await seedParty({ members: ['alice', 'bob'] })
      const alice = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(alice, 'partyQueue', PARTY), {
          leader: 'alice',
          size: 2,
          mode: 'casual',
          members: ['alice', 'bob'],
          createdAt: Date.now(),
        }),
      )
      await assertFails(getDocs(collection(alice, 'partyQueue')))
    })
  })

  describe('teamMatches/{code}', () => {
    const ROOM = ['alice', 'bob', 'carol', 'dan']
    const SIDES = sides(ROOM)

    /** A match that matches the room `seedRoom()` seeds. */
    function teamMatch(over: Record<string, unknown> = {}) {
      const teams = (over.teams ?? SIDES) as { a: string[]; b: string[] }
      return {
        leader: 'alice',
        size: 2,
        questionIds: ['q1', 'q2', 'q3'],
        startedAt: Date.now(),
        ...over,
        teams,
        members: [...teams.a, ...teams.b],
      }
    }

    /** The room the match is started from — same code, same sides. */
    async function seedRoom(over: Record<string, unknown> = {}) {
      await seedParty({ members: ROOM, size: 2, ...over })
    }

    async function seedMatch(over: Record<string, unknown> = {}) {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'teamMatches', PARTY), teamMatch(over))
      })
    }

    it('the room’s leader starts a match with that room’s own sides', async () => {
      await seedRoom()
      const alice = env.authenticatedContext('alice').firestore()
      await assertSucceeds(setDoc(doc(alice, 'teamMatches', PARTY), teamMatch()))
    })

    it('nobody but the leader starts it', async () => {
      await seedRoom()
      const bob = env.authenticatedContext('bob').firestore()
      // Even claiming the leadership in the document does not help: the room
      // itself is consulted.
      await assertFails(setDoc(doc(bob, 'teamMatches', PARTY), teamMatch({ leader: 'bob' })))
    })

    it('rejects a match naming a roster the room does not have', async () => {
      await seedRoom()
      const alice = env.authenticatedContext('alice').firestore()
      // Staging a game in other people's names — they would be scored against
      // without ever having been in the room.
      await assertFails(
        setDoc(
          doc(alice, 'teamMatches', PARTY),
          teamMatch({ teams: { a: ['alice', 'eve'], b: ['bob', 'dan'] } }),
        ),
      )
    })

    it('rejects uneven or empty sides', async () => {
      await seedRoom()
      const alice = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(
          doc(alice, 'teamMatches', PARTY),
          teamMatch({ teams: { a: ['alice', 'carol'], b: ['bob'] } }),
        ),
      )
      await assertFails(
        setDoc(doc(alice, 'teamMatches', PARTY), teamMatch({ teams: { a: ['alice'], b: [] } })),
      )
    })

    it('a started match is frozen, and only its leader clears it', async () => {
      await seedRoom()
      await seedMatch()
      const alice = env.authenticatedContext('alice').firestore()
      const bob = env.authenticatedContext('bob').firestore()
      // Swapping the questions mid-match would change what everyone else is
      // already being scored on.
      await assertFails(updateDoc(doc(alice, 'teamMatches', PARTY), { questionIds: ['q9'] }))
      await assertFails(deleteDoc(doc(bob, 'teamMatches', PARTY)))
      await assertSucceeds(deleteDoc(doc(alice, 'teamMatches', PARTY)))
    })

    it('only the people playing can read it', async () => {
      await seedRoom()
      await seedMatch()
      const dan = env.authenticatedContext('dan').firestore()
      await assertSucceeds(getDoc(doc(dan, 'teamMatches', PARTY)))
      const eve = env.authenticatedContext('eve').firestore()
      await assertFails(getDoc(doc(eve, 'teamMatches', PARTY)))
    })

    describe('players/{player}', () => {
      const run = (over: Record<string, unknown> = {}) => ({
        side: 'a',
        score: 0,
        answered: 0,
        done: false,
        ...over,
      })

      it('a player opens their own run, on the side the match puts them on', async () => {
        await seedRoom()
        await seedMatch()
        const alice = env.authenticatedContext('alice').firestore()
        await assertSucceeds(
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run({ side: 'a' })),
        )
      })

      it('nobody writes someone else’s run, or scores into the other team', async () => {
        await seedRoom()
        await seedMatch()
        const bob = env.authenticatedContext('bob').firestore()
        // bob is on side B; filing his points under A would move them to the
        // team he is playing against.
        await assertFails(
          setDoc(doc(bob, 'teamMatches', PARTY, 'players', 'bob'), run({ side: 'a', score: 90 })),
        )
        await assertFails(
          setDoc(doc(bob, 'teamMatches', PARTY, 'players', 'alice'), run({ score: 90 })),
        )
        await assertSucceeds(
          setDoc(doc(bob, 'teamMatches', PARTY, 'players', 'bob'), run({ side: 'b', score: 90 })),
        )
      })

      it('a score never goes down, and a finished run never un-finishes', async () => {
        await seedRoom()
        await seedMatch()
        await env.withSecurityRulesDisabled(async (ctx) => {
          await setDoc(
            doc(ctx.firestore(), 'teamMatches', PARTY, 'players', 'alice'),
            run({ score: 90, answered: 2, done: true }),
          )
        })
        const alice = env.authenticatedContext('alice').firestore()
        await assertFails(
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run({ score: 10, answered: 2, done: true })),
        )
        await assertFails(
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run({ score: 90, answered: 1, done: true })),
        )
        // Un-setting `done` would reopen a run the other side has already been
        // shown as finished.
        await assertFails(
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run({ score: 90, answered: 2, done: false })),
        )
        await assertSucceeds(
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run({ score: 120, answered: 3, done: true })),
        )
      })

      it('cannot answer more questions than the match has', async () => {
        await seedRoom()
        await seedMatch()
        const alice = env.authenticatedContext('alice').firestore()
        await assertFails(
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run({ answered: 4 })),
        )
      })

      it('a run cannot be deleted, and a stranger cannot read one', async () => {
        await seedRoom()
        await seedMatch()
        await env.withSecurityRulesDisabled(async (ctx) => {
          await setDoc(doc(ctx.firestore(), 'teamMatches', PARTY, 'players', 'alice'), run())
        })
        const alice = env.authenticatedContext('alice').firestore()
        await assertFails(deleteDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice')))
        const eve = env.authenticatedContext('eve').firestore()
        await assertFails(getDoc(doc(eve, 'teamMatches', PARTY, 'players', 'alice')))
      })
    })
  })

  describe('partyInvites/{inviteId}', () => {
    /** The pair document `friends.ts` writes, seeded straight past the rules. */
    async function seedFriendship(a: string, b: string, status = 'accepted') {
      const pair = a < b ? `${a}_${b}` : `${b}_${a}`
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'friendships', pair), {
          uids: [a, b].sort(),
          status,
          requestedBy: a,
          createdAt: Date.now(),
        })
      })
    }

    const invite = (over: Record<string, unknown> = {}) => ({
      code: PARTY,
      from: 'alice',
      to: 'bob',
      createdAt: Date.now(),
      ...over,
    })

    it('someone sitting in a room calls a friend into it', async () => {
      await seedParty({ members: ['alice'] })
      await seedFriendship('alice', 'bob')
      const alice = env.authenticatedContext('alice').firestore()
      await assertSucceeds(setDoc(doc(alice, 'partyInvites', `${PARTY}_bob`), invite()))
    })

    it('you cannot call anyone into a room you are not in yourself', async () => {
      await seedParty({ leader: 'carol', members: ['carol'] })
      await seedFriendship('alice', 'bob')
      const alice = env.authenticatedContext('alice').firestore()
      await assertFails(setDoc(doc(alice, 'partyInvites', `${PARTY}_bob`), invite()))
    })

    it('only an accepted friend can be called, never a stranger', async () => {
      await seedParty({ members: ['alice'] })
      const alice = env.authenticatedContext('alice').firestore()
      // Without this an invite is a way to push a card onto any account whose
      // id you happen to know.
      await assertFails(setDoc(doc(alice, 'partyInvites', `${PARTY}_bob`), invite()))
      // A request that has not been answered yet is not a friendship.
      await seedFriendship('alice', 'bob', 'pending')
      await assertFails(setDoc(doc(alice, 'partyInvites', `${PARTY}_bob`), invite()))
    })

    it('nobody sends an invitation in someone else’s name', async () => {
      await seedParty({ members: ['alice'] })
      await seedFriendship('alice', 'bob')
      const mallory = env.authenticatedContext('mallory').firestore()
      await assertFails(setDoc(doc(mallory, 'partyInvites', `${PARTY}_bob`), invite()))
    })

    it('only the person called reads it; either side may clear it', async () => {
      await seedParty({ members: ['alice'] })
      await seedFriendship('alice', 'bob')
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'partyInvites', `${PARTY}_bob`), invite())
      })
      const bob = env.authenticatedContext('bob').firestore()
      const mallory = env.authenticatedContext('mallory').firestore()
      await assertSucceeds(getDoc(doc(bob, 'partyInvites', `${PARTY}_bob`)))
      await assertFails(getDoc(doc(mallory, 'partyInvites', `${PARTY}_bob`)))
      await assertFails(deleteDoc(doc(mallory, 'partyInvites', `${PARTY}_bob`)))
      await assertSucceeds(deleteDoc(doc(bob, 'partyInvites', `${PARTY}_bob`)))
    })

    /**
     * The listener, not a document read.
     *
     * `watchMyInvites` does not fetch invitations by id — it cannot, since it
     * does not know which rooms exist. It runs `where('to', '==', uid)` over the
     * whole collection, and a query the rules refuse fails as one operation:
     * the snapshot callback never fires, `onChange` is never called, and the
     * only trace is a console warning. The screen then shows no invitations and
     * looks exactly like nobody invited you — which is what Erlan reported.
     *
     * The single-document test above cannot catch that, because `get` and `list`
     * are evaluated differently: a `list` is allowed only when the query itself
     * proves every document it could return satisfies the rule.
     */
    it('the invited person can run the listener’s own query', async () => {
      await seedParty({ members: ['alice'] })
      await seedFriendship('alice', 'bob')
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'partyInvites', `${PARTY}_bob`), invite())
      })
      const bob = env.authenticatedContext('bob').firestore()
      const mine = query(collection(bob, 'partyInvites'), where('to', '==', 'bob'))
      const found = await assertSucceeds(getDocs(mine))
      expect(found.size).toBe(1)

      // And that query is the only one allowed: unconstrained, the collection
      // would be a directory of who plays with whom.
      await assertFails(getDocs(query(collection(bob, 'partyInvites'))))
      const mallory = env.authenticatedContext('mallory').firestore()
      await assertFails(
        getDocs(query(collection(mallory, 'partyInvites'), where('to', '==', 'bob'))),
      )
    })
  })

})
