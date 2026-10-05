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
  serverTimestamp,
  setDoc,
  Timestamp,
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
    dailyDate: '2026-03-01',
    dailyStreak: 3,
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

    it('lets an account whose stored doc predates the daily set keep syncing', async () => {
      // The stale-build case, and the reason the two daily fields are read
      // through `get` with a default instead of asserted directly. A phone
      // still running yesterday's bundle writes a profile with neither field;
      // if that were denied, the reader would simply stop syncing, with no
      // error they could see and no way to recover (`allow delete: if false`).
      const legacy = validProfile()
      delete (legacy as Record<string, unknown>).dailyDate
      delete (legacy as Record<string, unknown>).dailyStreak
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(setDoc(doc(db, 'users/alice/profile/state'), legacy))
    })

    it('accepts a profile carrying the daily set fields', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(
        setDoc(
          doc(db, 'users/alice/profile/state'),
          validProfile({ dailyDate: '2026-09-30', dailyStreak: 12 }),
        ),
      )
    })

    it('rejects an absurd daily streak', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(db, 'users/alice/profile/state'), validProfile({ dailyStreak: 9_000_000 })),
      )
      await assertFails(
        setDoc(doc(db, 'users/alice/profile/state'), validProfile({ dailyStreak: -1 })),
      )
    })

    it('lets the daily streak fall back to 1 after a missed day', async () => {
      // Unlike xp or totalVisits this is not a lifetime counter, so it must
      // NOT be in `progressCountersMonotonic` — a reader who skips a day has
      // to be able to write the reset, or their next finish is denied for ever.
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), 'users/alice/profile/state'),
          validProfile({ dailyStreak: 30 }),
        )
      })
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(updateDoc(doc(db, 'users/alice/profile/state'), { dailyStreak: 1 }))
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
    /**
     * A scoring write exactly as the app makes it.
     *
     * `applyRankedResult` sends `serverTimestamp()` for `scoredAt`, because the
     * rules require that field to equal `request.time` on any write that gains
     * rating or weekly XP. The anchor of the throttle is therefore not anything
     * the client chose — which is the whole substance of the fix these tests
     * cover.
     */
    const scoringWrite = (over: Record<string, unknown> = {}) =>
      validBattlePlayer({ scoredAt: serverTimestamp(), ...over })

    /**
     * A stored row with its throttle anchor placed `anchorAgeMs` in the past.
     * Written with the rules off: in nearly every test below it is the *second*
     * write that is under examination.
     */
    const seedMirror = async (
      over: Record<string, unknown> = {},
      anchorAgeMs = 0,
      uid = 'alice',
    ) => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), 'battlePlayers', uid),
          validBattlePlayer({
            scoredAt: Timestamp.fromMillis(Date.now() - anchorAgeMs),
            ...over,
          }),
        )
      })
    }

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
          validBattlePlayer({ weekXp: 100, scoredAt: Timestamp.fromMillis(now - 5000) }),
        )
      })
      const db = env.authenticatedContext('alice').firestore()
      // Within 60s of the last *scoring* write → a scoring change is refused.
      await assertFails(
        setDoc(doc(db, 'battlePlayers/alice'), scoringWrite({ weekXp: 300 })),
      )
      // A delta over the per-write cap is refused even with time on its side.
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), 'battlePlayers/alice'),
          validBattlePlayer({ weekXp: 100, scoredAt: Timestamp.fromMillis(now - 120_000) }),
        )
      })
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          scoringWrite({ weekXp: 100 + 5000 }),
        ),
      )
    })

    it('refuses a scoring write whose anchor the client made up', async () => {
      // Not only a backdated one: an honest `Date.now()` is refused just as
      // flatly, because a client that may name the anchor may name a time a
      // minute ago and clear its own throttle. That is precisely what the
      // ruleset used to permit, by anchoring on `updatedAt` instead.
      await seedMirror({ weekXp: 100 }, 120_000)
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          validBattlePlayer({ weekXp: 400, scoredAt: Date.now() }),
        ),
      )
      await assertSucceeds(
        setDoc(doc(db, 'battlePlayers/alice'), scoringWrite({ weekXp: 400 })),
      )
    })

    it('closes the backdated-clock exploit: no second duel without the minute', async () => {
      // The exploit the audit landed on. `updatedAt` may legitimately sit five
      // minutes in the past — a school phone off NTP is an honest player — and
      // the throttle was anchored to it against a threshold of one minute.
      // 300000 > 60000, so there was no interval at all: one backdated write
      // opened the next, and eleven in a row took weekXp from 0 to 6600 and
      // rating from 0 to 220 with no waiting whatsoever.
      await seedMirror({ weekXp: 100, rating: 100 }, 5_000)
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          scoringWrite({ weekXp: 700, rating: 118, updatedAt: Date.now() - 300_000 }),
        ),
      )
    })

    it('an identity refresh neither clears the throttle nor moves the anchor', async () => {
      await seedMirror({ weekXp: 100, rating: 100 }, 5_000)
      const db = env.authenticatedContext('alice').firestore()
      // `syncBattlePlayer`'s real write: identity fields only, and it never
      // mentions the anchor. Allowed however recent the last duel was — the
      // whole reason the throttle needs its own field instead of `updatedAt`.
      await assertSucceeds(
        updateDoc(doc(db, 'battlePlayers/alice'), { level: 9, updatedAt: Date.now() }),
      )
      // It must not carry the anchor forward with it, though, or the ping
      // becomes the way to clear the wait.
      await assertFails(
        updateDoc(doc(db, 'battlePlayers/alice'), { level: 10, scoredAt: serverTimestamp() }),
      )
      // And the duel that follows still has to serve its minute.
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          scoringWrite({ weekXp: 400, rating: 118, level: 9 }),
        ),
      )
    })

    it('lets a Monday start the week over, and keeps the rating gain', async () => {
      // Each of the two audits found one half of this. `normalizeBattlePlayer`
      // reads a row from last week as zero XP, so the first duel of a new week
      // legitimately writes a *smaller* `weekXp` than the one stored — and the
      // monotonic rule refused that write, taking the rating gain down with it
      // because both travel in the same `setDoc`. Every Monday, in silence.
      await seedMirror({ weekXp: 2000, rating: 300, weekStart: '2026-02-23' }, 120_000)
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          scoringWrite({ weekXp: 300, rating: 318, weekStart: '2026-03-02' }),
        ),
      )
      // The reset is not a door for a large number: the first write of a new
      // week is still worth at most one duel.
      await seedMirror({ weekXp: 2000, rating: 300, weekStart: '2026-02-23' }, 120_000)
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          scoringWrite({ weekXp: 5000, rating: 318, weekStart: '2026-03-02' }),
        ),
      )
    })

    it('will not let one write wipe a rating built over months', async () => {
      // What a *failed* read used to look like on the wire: the client read
      // "could not read" as "no row yet", wrote a zeroed baseline, and a real
      // ladder was gone. `readBattlePlayer` no longer does that, and the rules
      // no longer allow it either — belt and braces, because only one of the
      // two can be deployed at a time.
      await seedMirror({ weekXp: 100, rating: 300 }, 120_000)
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(db, 'battlePlayers/alice'), scoringWrite({ rating: 0, weekXp: 100 })),
      )
      // A loss is still a loss: `RATING_LOSS` is 9.
      await assertSucceeds(
        setDoc(doc(db, 'battlePlayers/alice'), scoringWrite({ rating: 291, weekXp: 130 })),
      )
    })

    it('holds an absolute ceiling, not only a per-write one', async () => {
      // A per-write cap bounds one write; it does not bound a patient script.
      await seedMirror({ weekXp: 35_900, rating: 4_995 }, 120_000)
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          scoringWrite({ weekXp: 36_400, rating: 4_995 }),
        ),
      )
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/alice'),
          scoringWrite({ weekXp: 35_900, rating: 5_013 }),
        ),
      )
    })

    it('does not let a first row name its own anchor', async () => {
      // The zeroed baseline `syncBattlePlayer` writes for a player seen for the
      // first time.
      await assertSucceeds(
        setDoc(
          doc(env.authenticatedContext('alice').firestore(), 'battlePlayers/alice'),
          validBattlePlayer(),
        ),
      )
      // A create free to choose its anchor would be born with the throttle
      // already cleared.
      await assertFails(
        setDoc(
          doc(env.authenticatedContext('bob').firestore(), 'battlePlayers/bob'),
          validBattlePlayer({ scoredAt: Date.now() - 600_000 }),
        ),
      )
      // A genuine first duel, server-stamped, is fine.
      await assertSucceeds(
        setDoc(
          doc(env.authenticatedContext('carol').firestore(), 'battlePlayers/carol'),
          validBattlePlayer({ scoredAt: serverTimestamp(), weekXp: 300, rating: 18 }),
        ),
      )
    })

    it('is readable by any signed-in player, and by nobody else', async () => {
      // The one rule in this collection no test touched. It is deliberately
      // open to every signed-in user: that is how the weekly board draws ten
      // other people's names, and how a duel screen draws the face across the
      // board. What it must not be is open to the world — these rows carry a
      // child's display name and photo.
      await seedMirror({ weekXp: 100 })
      await assertSucceeds(
        getDoc(doc(env.authenticatedContext('bob').firestore(), 'battlePlayers/alice')),
      )
      await assertFails(
        getDoc(doc(env.unauthenticatedContext().firestore(), 'battlePlayers/alice')),
      )
    })
  })

  /* -------------------------- aiUsage --------------------------- */

  describe('battleMatches/{matchId}', () => {
    // This whole collection had no tests, and that is where the worst hole in
    // the ruleset was hiding: a slot score the client later hands to
    // `recordBattleResult` as real profile XP, and compares to decide a
    // ranked win, with nothing bounding it on update.
    const liveMatch = (over: Record<string, unknown> = {}) => ({
      players: ['alice', 'bob'],
      mode: 'ranked',
      questionIds: ['q1', 'q2'],
      createdAt: 1_700_000_000_000,
      status: 'active',
      // The shape `emptySlot()` actually writes. The fixture used to carry only
      // `xp` and `doneAt`, which is a document the client never creates — and a
      // fixture that is not the real shape cannot test the rules that bound it.
      p1: { answers: [null, null], xp: 0, doneAt: null, lastSeenAt: 1_700_000_000_000 },
      p2: { answers: [null, null], xp: 0, doneAt: null, lastSeenAt: 1_700_000_000_000 },
      ...over,
    })

    const seed = async (over: Record<string, unknown> = {}) => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'battleMatches/m1'), liveMatch(over))
      })
    }

    it('lets a player score their own slot within the honest ceiling', async () => {
      await seed()
      const db = env.authenticatedContext('alice').firestore()
      // Field paths, which is how `pushSlot` writes: the rest of the slot
      // survives the write. Replacing the whole map, as this test used to, is
      // something no code in the app does.
      await assertSucceeds(
        updateDoc(doc(db, 'battleMatches/m1'), {
          'p1.xp': 594,
          'p1.doneAt': 1_700_000_100_000,
        }),
      )
    })

    it('refuses a slot score no real duel could produce', async () => {
      // The exploit: one write, no questions answered, 99999 into your own
      // slot. It inflates lifetime XP and forces `won` on the ranked ladder.
      await seed()
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        updateDoc(doc(db, 'battleMatches/m1'), {
          'p1.xp': 99_999,
          'p1.doneAt': 1_700_000_100_000,
        }),
      )
      await assertFails(
        updateDoc(doc(db, 'battleMatches/m1'), {
          'p1.xp': -50,
          'p1.doneAt': 1_700_000_100_000,
        }),
      )
      // And the answer list cannot be used as a sack to stuff the document
      // with: both clients re-read this document on every write either of them
      // makes, so the cost of bloat here is billed to the opponent too.
      await assertFails(
        updateDoc(doc(db, 'battleMatches/m1'), {
          'p1.answers': Array.from({ length: 400 }, () => null),
        }),
      )
    })

    it('still refuses writing into the slot that is not theirs', async () => {
      await seed()
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        updateDoc(doc(db, 'battleMatches/m1'), { 'p2.doneAt': 1_700_000_100_000 }),
      )
    })

    it('is invisible to anyone who is not playing it', async () => {
      await seed()
      const db = env.authenticatedContext('mallory').firestore()
      await assertFails(getDoc(doc(db, 'battleMatches/m1')))
      await assertFails(updateDoc(doc(db, 'battleMatches/m1'), { 'p1.xp': 10 }))
    })

    it('checks the shape of a match on the way in', async () => {
      // This create rule had no test at all, and almost no conditions: two
      // players, a status, two empty slots. Its keys, its types and its age all
      // went unchecked — and a match is something anyone may create naming
      // anybody else, because that is what matchmaking is. The shape is all
      // there is to check.
      const alice = env.authenticatedContext('alice').firestore()
      const fresh = (over: Record<string, unknown> = {}) =>
        liveMatch({ createdAt: Date.now(), ...over })
      await assertSucceeds(setDoc(doc(alice, 'battleMatches/ok1'), fresh()))
      // An unknown field, a wrong mode, a question list that is not one.
      await assertFails(setDoc(doc(alice, 'battleMatches/bad1'), fresh({ winner: 'alice' })))
      await assertFails(setDoc(doc(alice, 'battleMatches/bad2'), fresh({ mode: 'tournament' })))
      await assertFails(setDoc(doc(alice, 'battleMatches/bad3'), fresh({ questionIds: [] })))
      await assertFails(
        setDoc(
          doc(alice, 'battleMatches/bad4'),
          fresh({ questionIds: Array.from({ length: 50 }, (_, i) => 'q' + i) }),
        ),
      )
      // A match that claims to be from last year. Nobody is about to play it —
      // staleness is what a planted match needs in order to sit and wait for
      // the person it names to walk into it.
      await assertFails(setDoc(doc(alice, 'battleMatches/bad5'), liveMatch()))
      await assertFails(
        setDoc(doc(alice, 'battleMatches/bad6'), fresh({ createdAt: Date.now() + 86_400_000 })),
      )
      // A slot that arrives already filled, or missing half of itself.
      await assertFails(
        setDoc(
          doc(alice, 'battleMatches/bad7'),
          fresh({ p1: { answers: [null, null], xp: 500, doneAt: null, lastSeenAt: Date.now() } }),
        ),
      )
      await assertFails(
        setDoc(doc(alice, 'battleMatches/bad8'), fresh({ p1: { xp: 0, doneAt: null } })),
      )
    })
  })

  describe('battleQueue / battleClaims', () => {
    it('accepts the queue slot the app actually writes', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertSucceeds(
        setDoc(doc(db, 'battleQueue/alice'), {
          uid: 'alice',
          mode: 'ranked',
          joinedAt: 1_700_000_000_000,
        }),
      )
    })

    it('refuses a payload hung off the queue slot', async () => {
      // Every other player sweeping for a match reads this document, so junk
      // attached here is billed to everyone searching, not just to its author.
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(db, 'battleQueue/alice'), {
          uid: 'alice',
          mode: 'ranked',
          joinedAt: 1_700_000_000_000,
          payload: 'x'.repeat(5000),
        }),
      )
    })

    it('refuses a queue slot under a uid that is not theirs', async () => {
      const db = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(db, 'battleQueue/bob'), {
          uid: 'bob',
          mode: 'casual',
          joinedAt: 1_700_000_000_000,
        }),
      )
    })

    it('only lets a claim be planted on somebody genuinely waiting', async () => {
      const db = env.authenticatedContext('alice').firestore()
      // Bob is not in the queue: a claim on him would jam his matchmaking.
      await assertFails(
        setDoc(doc(db, 'battleClaims/bob'), {
          claimedBy: 'alice',
          matchId: 'm1',
          createdAt: 1_700_000_000_000,
        }),
      )
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'battleQueue/bob'), {
          uid: 'bob',
          mode: 'casual',
          joinedAt: 1_700_000_000_000,
        })
      })
      await assertSucceeds(
        setDoc(doc(db, 'battleClaims/bob'), {
          claimedBy: 'alice',
          matchId: 'm1',
          createdAt: 1_700_000_000_000,
        }),
      )
    })

    it('lets a searching player sweep the queue, but only clear their own slot', async () => {
      // Both halves went untested. The sweep has to work — there is no
      // server-side matchmaker, so every client looks for its own opponent —
      // and the delete has to be narrow, because an open one let any signed-in
      // user empty the whole queue, and nobody would ever learn why they were
      // never matched.
      await env.withSecurityRulesDisabled(async (ctx) => {
        for (const uid of ['alice', 'bob']) {
          await setDoc(doc(ctx.firestore(), 'battleQueue', uid), {
            uid,
            mode: 'ranked',
            joinedAt: 1_700_000_000_000,
          })
        }
      })
      const alice = env.authenticatedContext('alice').firestore()
      await assertSucceeds(
        getDocs(query(collection(alice, 'battleQueue'), where('mode', '==', 'ranked'))),
      )
      await assertFails(deleteDoc(doc(alice, 'battleQueue/bob')))
      await assertSucceeds(deleteDoc(doc(alice, 'battleQueue/alice')))
      await assertFails(
        getDocs(collection(env.unauthenticatedContext().firestore(), 'battleQueue')),
      )
    })

    it('lets the claimed player read their claim and clear it, and nobody else', async () => {
      // A claim is the claimed player's inbox: they read it to learn which
      // match to open, and they clear it when they are done. The claimer must
      // not be able to take it back — doing so mid-duel would leave the other
      // side matched against a document nobody owns.
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'battleClaims/bob'), {
          claimedBy: 'alice',
          matchId: 'm1',
          createdAt: 1_700_000_000_000,
        })
      })
      await assertSucceeds(
        getDoc(doc(env.authenticatedContext('bob').firestore(), 'battleClaims/bob')),
      )
      await assertFails(
        deleteDoc(doc(env.authenticatedContext('alice').firestore(), 'battleClaims/bob')),
      )
      await assertSucceeds(
        deleteDoc(doc(env.authenticatedContext('bob').firestore(), 'battleClaims/bob')),
      )
    })
  })

  describe('the owner tier', () => {
    // Index 7 is the developer badge. It is granted by identity in
    // src/lib/rankStyle.ts, and until now the rules let anyone claim it: the
    // public mirrors other people read — the weekly board, a duel opponent
    // card, a Кахут player row — simply stored whatever index was written.
    const OWNER = 'erlanbegzanov@gmail.com'

    it('lets the owner wear their own tier', async () => {
      const db = env
        .authenticatedContext('erlan', { email: OWNER, email_verified: true })
        .firestore()
      await assertSucceeds(
        setDoc(
          doc(db, 'battlePlayers/erlan'),
          validBattlePlayer({ avatarTierIndex: 7, titleTierIndex: 7 }),
        ),
      )
    })

    it('refuses the developer badge to everybody else', async () => {
      const db = env
        .authenticatedContext('mallory', { email: 'mallory@example.com', email_verified: true })
        .firestore()
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/mallory'),
          validBattlePlayer({ avatarTierIndex: 7, titleTierIndex: 7 }),
        ),
      )
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/mallory'),
          validBattlePlayer({ avatarTierIndex: 0, titleTierIndex: 7 }),
        ),
      )
    })

    it('refuses it on an unverified claim to the owner address', async () => {
      // An email claim nobody verified must not stand in for the account.
      const db = env
        .authenticatedContext('impostor', { email: OWNER, email_verified: false })
        .firestore()
      await assertFails(
        setDoc(
          doc(db, 'battlePlayers/impostor'),
          validBattlePlayer({ avatarTierIndex: 7, titleTierIndex: 7 }),
        ),
      )
    })

    it('still lets an ordinary player wear any tier they could really reach', async () => {
      const db = env
        .authenticatedContext('bob', { email: 'bob@example.com', email_verified: true })
        .firestore()
      await assertSucceeds(
        setDoc(
          doc(db, 'battlePlayers/bob'),
          validBattlePlayer({ avatarTierIndex: 6, titleTierIndex: 6 }),
        ),
      )
    })

    it('closes the same hole in a live Кахут room', async () => {
      // A classroom is where impersonation actually pays off: everyone in the
      // room sees the stored tier rendered as a title next to a name.
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'kahootSessions/ABC123'), {
          hostUid: 'teacher',
          gameId: 'g1',
          state: 'lobby',
          questionIndex: 0,
          startedAt: null,
          createdAt: 1_700_000_000_000,
        })
      })
      const db = env
        .authenticatedContext('mallory', { email: 'mallory@example.com', email_verified: true })
        .firestore()
      await assertFails(
        setDoc(doc(db, 'kahootSessions/ABC123/players/mallory'), {
          uid: 'mallory',
          displayName: 'Аружан',
          photoURL: '',
          score: 0,
          lastAnswerIndex: null,
          lastAnswerAt: null,
          // Must be ~now: the create rule bounds it, and a fixed 2023 stamp
          // would make this test fail for a reason that is not the tier.
          joinedAt: Date.now(),
          avatarGender: 'f',
          avatarTierIndex: 7,
          titleTierIndex: 7,
        }),
      )
    })
  })

  /*
   * The lobby row every classmate sees. Three of its fields sat in the key
   * list and were never typed: the readers in `kahoot.ts` coerce them, so
   * nothing crashed, but two of them decide what the class is shown.
   */
  describe('kahootSessions/{code}/players/{uid}', () => {
    const CODE = 'XYZ789'

    async function seedSession(over: Record<string, unknown> = {}) {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'kahootSessions', CODE), {
          hostUid: 'teacher',
          gameId: 'g1',
          state: 'lobby',
          questionIndex: 0,
          startedAt: null,
          createdAt: 1_700_000_000_000,
          ...over,
        })
      })
    }

    const player = (over: Record<string, unknown> = {}) => ({
      uid: 'alice',
      displayName: 'Әлия',
      photoURL: '',
      score: 0,
      lastAnswerIndex: null,
      lastAnswerAt: null,
      joinedAt: Date.now(),
      avatarGender: 'f',
      avatarTierIndex: 0,
      titleTierIndex: 0,
      ...over,
    })

    async function seedPlayer(over: Record<string, unknown> = {}) {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'kahootSessions', CODE, 'players', 'alice'), player(over))
      })
    }

    it('seats an honest student', async () => {
      await seedSession()
      const alice = env.authenticatedContext('alice').firestore()
      await assertSucceeds(setDoc(doc(alice, 'kahootSessions', CODE, 'players', 'alice'), player()))
    })

    it('refuses an answer that is not one of the four options', async () => {
      await seedSession()
      const alice = env.authenticatedContext('alice').firestore()
      const at = (over: Record<string, unknown>) =>
        setDoc(doc(alice, 'kahootSessions', CODE, 'players', 'alice'), player(over))
      await assertFails(at({ lastAnswerIndex: 7 }))
      await assertFails(at({ lastAnswerIndex: -1 }))
      await assertFails(at({ lastAnswerIndex: 'a' }))
      await assertSucceeds(at({ lastAnswerIndex: 3 }))
    })

    it('refuses an answer timed in the future', async () => {
      // `answeredThisRound` asks whether `lastAnswerAt` is at or after the
      // question's start. A stamp a day out showed a student as having
      // answered every question in the game without answering one.
      await seedSession()
      const alice = env.authenticatedContext('alice').firestore()
      const at = (over: Record<string, unknown>) =>
        setDoc(doc(alice, 'kahootSessions', CODE, 'players', 'alice'), player(over))
      await assertFails(at({ lastAnswerAt: Date.now() + 86_400_000 }))
      await assertSucceeds(at({ lastAnswerAt: Date.now() }))
      // A stamp from earlier in the same game is honest: a write that does
      // not touch it still carries the previous time through the merge.
      await assertSucceeds(at({ lastAnswerAt: Date.now() - 600_000 }))
    })

    it('refuses a join time that wins every tie forever', async () => {
      // The leaderboard sorts by score, then by `joinedAt` ascending.
      await seedSession()
      const alice = env.authenticatedContext('alice').firestore()
      const at = (over: Record<string, unknown>) =>
        setDoc(doc(alice, 'kahootSessions', CODE, 'players', 'alice'), player(over))
      await assertFails(at({ joinedAt: 0 }))
      await assertFails(at({ joinedAt: 1_700_000_000_000 }))
      await assertFails(at({ joinedAt: 'now' }))
    })

    it('keeps the join time put once the game is under way', async () => {
      await seedSession()
      await seedPlayer()
      const alice = env.authenticatedContext('alice').firestore()
      const ref = doc(alice, 'kahootSessions', CODE, 'players', 'alice')
      // Answering leaves it alone.
      await assertSucceeds(updateDoc(ref, { lastAnswerIndex: 2, lastAnswerAt: Date.now() }))
      await assertFails(updateDoc(ref, { joinedAt: 0 }))
      // Re-stamping is allowed, because reloading in the lobby rewrites the
      // whole row through `joinSession` — it just has to be ~now.
      await assertSucceeds(updateDoc(ref, { joinedAt: Date.now() }))
    })

    it('holds a running total to the questions the host has opened', async () => {
      // The rule allowed +1200 per write against an honest maximum of 66 — and
      // a per-write cap is only ever a cap on how often someone writes, so
      // twenty writes took the top of the class whatever the number was.
      //
      // 66, not 90: `KahootJoin` calls `answerXp` without a clock argument, so
      // the speed bonus is clamped at the duel's twelve seconds rather than
      // stretched over the room's twenty. The audit report had this at 90.
      await seedSession()
      await seedPlayer()
      const alice = env.authenticatedContext('alice').firestore()
      const ref = doc(alice, 'kahootSessions', CODE, 'players', 'alice')
      // One question open, so one question's worth is the whole ceiling.
      await assertSucceeds(updateDoc(ref, { score: 66 }))
      await assertFails(updateDoc(ref, { score: 1200 }))
      await assertFails(updateDoc(ref, { score: 140 }))
      // The host moves the game on, and the ceiling moves with it — it is the
      // one count in a live room a student cannot touch.
      await seedSession({ questionIndex: 2 })
      await assertSucceeds(updateDoc(ref, { score: 132 }))
      await assertFails(updateDoc(ref, { score: 211 }))
    })

    it('is readable by the class, and removable by its owner or the host', async () => {
      // The lobby and the leaderboard are this subcollection, read by everyone
      // in the room — so the read is open to any signed-in user and the row
      // carries only what the class is meant to see. The delete is the host
      // removing someone who should not be there, or a student leaving.
      await seedSession()
      await seedPlayer()
      const bob = env.authenticatedContext('bob').firestore()
      await assertSucceeds(getDocs(collection(bob, 'kahootSessions', CODE, 'players')))
      // A classmate cannot throw another student out of the game.
      await assertFails(deleteDoc(doc(bob, 'kahootSessions', CODE, 'players', 'alice')))
      const teacher = env.authenticatedContext('teacher').firestore()
      await assertSucceeds(deleteDoc(doc(teacher, 'kahootSessions', CODE, 'players', 'alice')))
      await seedPlayer()
      const alice = env.authenticatedContext('alice').firestore()
      await assertSucceeds(deleteDoc(doc(alice, 'kahootSessions', CODE, 'players', 'alice')))
    })

    it('lets nobody write another student row', async () => {
      await seedSession()
      await seedPlayer()
      const bob = env.authenticatedContext('bob').firestore()
      await assertFails(
        setDoc(doc(bob, 'kahootSessions', CODE, 'players', 'alice'), player({ score: 5000 })),
      )
    })
  })

  /*
   * Neither of these two had a single test, and one of them is the answer key:
   * `kahootGames` stores the correct option for every question in a quiz. The
   * coverage report put both collections' rules among the 22% of conditions the
   * 1425-line suite never evaluated once.
   */
  describe('kahootGames/{gameId}', () => {
    const GAME = 'GAME01'

    async function seedGame() {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'kahootGames', GAME), {
          hostUid: 'teacher',
          title: 'Сақтар',
          questions: [{ prompt: 'q', options: ['a', 'b', 'c', 'd'], correctIndex: 2 }],
        })
      })
    }

    it('keeps the answer key away from the students playing it', async () => {
      await seedGame()
      // A student in the teacher's own room still cannot read the quiz: the
      // correct option for every question is in this document, and the host
      // publishes only each question's public half into the room as it opens.
      await assertFails(
        getDoc(doc(env.authenticatedContext('alice').firestore(), 'kahootGames', GAME)),
      )
      await assertSucceeds(
        getDoc(doc(env.authenticatedContext('teacher').firestore(), 'kahootGames', GAME)),
      )
    })

    it('lets a teacher list only their own games', async () => {
      await seedGame()
      const teacher = env.authenticatedContext('teacher').firestore()
      await assertSucceeds(
        getDocs(query(collection(teacher, 'kahootGames'), where('hostUid', '==', 'teacher'))),
      )
      // The query behind "my games" is what the read rule is shaped around; a
      // list that is not filtered to the caller is refused.
      await assertFails(getDocs(collection(teacher, 'kahootGames')))
      await assertFails(
        getDocs(query(collection(teacher, 'kahootGames'), where('hostUid', '==', 'someone-else'))),
      )
    })

    it('lets nobody author or edit a quiz in somebody else’s name', async () => {
      const alice = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(alice, 'kahootGames', 'forged'), {
          hostUid: 'teacher',
          title: 'x',
          questions: [],
        }),
      )
      await assertSucceeds(
        setDoc(doc(alice, 'kahootGames', 'mine'), {
          hostUid: 'alice',
          title: 'x',
          questions: [],
        }),
      )
      await seedGame()
      await assertFails(updateDoc(doc(alice, 'kahootGames', GAME), { title: 'changed' }))
      await assertFails(deleteDoc(doc(alice, 'kahootGames', GAME)))
    })
  })

  describe('kahootSessions/{code} — the room document', () => {
    const ROOM = 'ROOM01'

    async function seedRoom() {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'kahootSessions', ROOM), {
          hostUid: 'teacher',
          gameId: 'g1',
          questionIndex: 0,
          createdAt: 1_700_000_000_000,
        })
      })
    }

    it('hands out one room by its code, never the whole list of them', async () => {
      await seedRoom()
      const alice = env.authenticatedContext('alice').firestore()
      // A student fetches the code they were told, which is what `get` is.
      await assertSucceeds(getDoc(doc(alice, 'kahootSessions', ROOM)))
      // `read` is get plus list, and a list hands back every live code in the
      // school at once — after which the players subcollection gives up each
      // room's names and scores. Nothing in the app queries this collection.
      await assertFails(getDocs(collection(alice, 'kahootSessions')))
    })

    it('lets a teacher open a room in their own name only', async () => {
      const teacher = env.authenticatedContext('teacher').firestore()
      await assertSucceeds(
        setDoc(doc(teacher, 'kahootSessions', 'ROOM02'), {
          hostUid: 'teacher',
          gameId: 'g1',
          questionIndex: 0,
          createdAt: Date.now(),
        }),
      )
      // Opening a room in someone else's name would hand the attacker the host
      // seat for a code the real teacher is about to read out to the class.
      const alice = env.authenticatedContext('alice').firestore()
      await assertFails(
        setDoc(doc(alice, 'kahootSessions', 'ROOM03'), {
          hostUid: 'teacher',
          gameId: 'g1',
          questionIndex: 0,
          createdAt: Date.now(),
        }),
      )
    })

    it('lets only the host drive the room', async () => {
      await seedRoom()
      const alice = env.authenticatedContext('alice').firestore()
      await assertFails(updateDoc(doc(alice, 'kahootSessions', ROOM), { questionIndex: 5 }))
      await assertFails(deleteDoc(doc(alice, 'kahootSessions', ROOM)))
      const teacher = env.authenticatedContext('teacher').firestore()
      await assertSucceeds(updateDoc(doc(teacher, 'kahootSessions', ROOM), { questionIndex: 1 }))
    })
  })

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

    it('spreads the shared ceiling over ten shards, and only those', async () => {
      // The single shared document was the one place ordinary requests collided,
      // and the limiter now refuses a request it cannot count rather than waving
      // it through — so the contention had to go. `GLOBAL_SHARDS` in
      // api/gemini.ts picks one of these ten at random per request.
      const db = env.authenticatedContext('someone').firestore()
      await assertSucceeds(setDoc(doc(db, path('_shared_7')), { count: 1, day: '2026-03-01' }))
      await assertSucceeds(updateDoc(doc(db, path('_shared_7')), { count: 2 }))
      await assertFails(updateDoc(doc(db, path('_shared_7')), { count: 40 }))
      // Not a licence for any name starting with an underscore: everything
      // outside the per-user and shard shapes is still nobody's to write.
      await assertFails(setDoc(doc(db, path('_shared_x')), { count: 1, day: '2026-03-01' }))
      await assertFails(setDoc(doc(db, path('_shared_12')), { count: 1, day: '2026-03-01' }))
      await assertFails(setDoc(doc(db, path('_global')), { count: 1, day: '2026-03-01' }))
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

    it('is readable by a friend holding the code, but not by the world', async () => {
      // An invited friend has to look the room up before they are in it, so
      // this `get` is open to any signed-in user — and it is a `get`, not a
      // `read`, so nobody can list every open room in the school.
      await seedParty()
      await assertSucceeds(
        getDoc(doc(env.authenticatedContext('bob').firestore(), 'parties', PARTY)),
      )
      await assertFails(
        getDocs(collection(env.authenticatedContext('bob').firestore(), 'parties')),
      )
      await assertFails(
        getDoc(doc(env.unauthenticatedContext().firestore(), 'parties', PARTY)),
      )
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
    /** Fixed, because every player run has to name the match it belongs to. */
    const MATCH_AT = 1_700_000_000_000

    /** A match that matches the room `seedRoom()` seeds. */
    function teamMatch(over: Record<string, unknown> = {}) {
      const teams = (over.teams ?? SIDES) as { a: string[]; b: string[] }
      return {
        leader: 'alice',
        size: 2,
        questionIds: ['q1', 'q2', 'q3'],
        startedAt: MATCH_AT,
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
      // `startTeamMatch` writes with a plain `setDoc`, which an audit flagged
      // as needing a transaction: two taps on a slow phone would stage two
      // matches, and the second one's new `startedAt` would orphan every run
      // already filed against the first. It cannot happen, and this is why —
      // a `set` over an existing document is an update, and an update is
      // refused. The second tap fails; the match the room is playing stands.
      await assertFails(
        setDoc(doc(alice, 'teamMatches', PARTY), teamMatch({ startedAt: MATCH_AT + 5000 })),
      )
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
        startedAt: MATCH_AT,
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
        // One answer's worth, for one answer. A run opening with points it has
        // not answered for is the hole the invariant below closes, not the
        // shape of an honest first write.
        await assertSucceeds(
          setDoc(
            doc(bob, 'teamMatches', PARTY, 'players', 'bob'),
            run({ side: 'b', score: 70, answered: 1 }),
          ),
        )
      })

      it('cannot open a run on points it has not answered for', async () => {
        // `validRun` bounded a score only against the *whole match* — 80 x the
        // question count — and the per-write cap lives on the update branch
        // alone. So both paths that may write a run from nothing, the first
        // create and the reset into a newer match, could open with the maximum
        // and take the game for their side in one write. The comment above the
        // update rule asserted this was impossible.
        await seedRoom()
        await seedMatch()
        const alice = env.authenticatedContext('alice').firestore()
        const ref = doc(alice, 'teamMatches', PARTY, 'players', 'alice')
        await assertFails(setDoc(ref, run({ score: 240, answered: 0 })))
        await assertFails(setDoc(ref, run({ score: 160, answered: 1 })))
        // The honest shapes: seated with nothing, or one answer paid for.
        await assertSucceeds(setDoc(ref, run({ score: 0, answered: 0 })))
        await assertSucceeds(setDoc(ref, run({ score: 75, answered: 1 })))
        // And the same holds on the reset into a later match in the room.
        const AGAIN = MATCH_AT + 60_000
        await seedMatch({ startedAt: AGAIN })
        await assertFails(setDoc(ref, run({ score: 240, answered: 0, startedAt: AGAIN })))
        await assertSucceeds(setDoc(ref, run({ score: 0, answered: 0, startedAt: AGAIN })))
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

      it('a run must name the match it is played in', async () => {
        await seedRoom()
        await seedMatch()
        const alice = env.authenticatedContext('alice').firestore()
        // Without this a run could claim to belong to a round that is not being
        // played, and the reader's round filter would be trivial to sidestep.
        await assertFails(
          setDoc(
            doc(alice, 'teamMatches', PARTY, 'players', 'alice'),
            run({ startedAt: MATCH_AT + 1 }),
          ),
        )
        await assertFails(
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run({ startedAt: 0 })),
        )
      })

      /**
       * The reason `startedAt` exists at all.
       *
       * Deleting a match does not delete this subcollection — Firestore keeps
       * documents whose parent is gone — so the next match in the same room
       * meets the previous one's finished runs. Without a way to reset them it
       * would open already over, on last game's scores.
       */
      it('a later match in the same room starts everyone from zero again', async () => {
        await seedRoom()
        await seedMatch()
        await env.withSecurityRulesDisabled(async (ctx) => {
          await setDoc(
            doc(ctx.firestore(), 'teamMatches', PARTY, 'players', 'alice'),
            run({ score: 150, answered: 3, done: true }),
          )
        })
        const alice = env.authenticatedContext('alice').firestore()
        const AGAIN = MATCH_AT + 60_000
        // Still the same match: the old run stands.
        await assertFails(
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run({ score: 0 })),
        )
        // The captain starts another one in the same room.
        await seedMatch({ startedAt: AGAIN })
        await assertSucceeds(
          setDoc(
            doc(alice, 'teamMatches', PARTY, 'players', 'alice'),
            run({ score: 0, answered: 0, done: false, startedAt: AGAIN }),
          ),
        )
        // And the reset does not let anyone file the fresh run under the other
        // team on the way through.
        await seedMatch({ startedAt: AGAIN + 60_000 })
        await assertFails(
          setDoc(
            doc(alice, 'teamMatches', PARTY, 'players', 'alice'),
            run({ side: 'b', score: 0, startedAt: AGAIN + 60_000 }),
          ),
        )
      })

      /**
       * A run used to be `score >= 0` and nothing more, and the update rule
       * only asked that it climb. One hand-written write took the game.
       *
       * The ceiling is one question's honest maximum (75, rounded to 80 for
       * room) times the match's own question count — three here, so 240.
       */
      it('a run cannot score more than the match is worth', async () => {
        await seedRoom()
        await seedMatch()
        const alice = env.authenticatedContext('alice').firestore()
        const at = (over: Record<string, unknown>) =>
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run(over))
        // Three questions, every one answered correctly on the first second.
        await assertSucceeds(at({ score: 240, answered: 3, done: true }))
        await assertFails(at({ score: 241, answered: 3, done: true }))
        await assertFails(at({ score: 99_999, answered: 3, done: true }))
      })

      it('a run climbs by at most one question per write', async () => {
        await seedRoom()
        await seedMatch()
        await env.withSecurityRulesDisabled(async (ctx) => {
          await setDoc(
            doc(ctx.firestore(), 'teamMatches', PARTY, 'players', 'alice'),
            run({ score: 0, answered: 2 }),
          )
        })
        const alice = env.authenticatedContext('alice').firestore()
        const at = (over: Record<string, unknown>) =>
          setDoc(doc(alice, 'teamMatches', PARTY, 'players', 'alice'), run(over))
        // Refused first, and the order matters: a successful write moves the
        // stored score up, so asserting the honest climb before the jump would
        // leave 240 only 60 above the new base and the test would pass on a
        // rule that was never checked.
        //
        // 160 is inside both the total ceiling and the answers-paid-for
        // invariant (three answers would allow 240), so the only rule left that
        // can refuse it is the per-write cap — which is the point of this test.
        await assertFails(at({ score: 160, answered: 3 }))
        // One more question's worth: the only write `recordMatchAnswer` makes.
        await assertSucceeds(at({ score: 70, answered: 3 }))
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
