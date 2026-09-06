import { describe, expect, it } from 'vitest'
import { DEFAULT_STATE } from './progress'
import type { ProfileState } from './progress'
import { mergeProfiles } from './profileSync'

/** A full ProfileState with just the fields a test cares about overridden. */
function profile(patch: Partial<ProfileState>): ProfileState {
  return { ...DEFAULT_STATE, ...patch }
}

/** Minimal well-formed casual-duel record for the log-merge test. */
function duel(at: number) {
  return {
    opponentName: 'X',
    opponentPhotoURL: '',
    opponentAvatarGender: null,
    opponentAvatarTierIndex: 0,
    opponentIsBot: false,
    opponentWasAfk: false,
    won: true,
    xp: 10,
    foeXp: 5,
    at,
  }
}

describe('mergeProfiles', () => {
  it('returns the local copy untouched when there is no remote', () => {
    const local = profile({ xp: 120 })
    expect(mergeProfiles(null, local)).toBe(local)
  })

  it('takes the higher value for every lifetime counter', () => {
    const merged = mergeProfiles(
      profile({ xp: 900, quizzesCompleted: 3, casualWins: 10, rankedDuels: 1 }),
      profile({ xp: 200, quizzesCompleted: 8, casualWins: 4, rankedDuels: 6 }),
    )
    expect(merged.xp).toBe(900)
    expect(merged.quizzesCompleted).toBe(8)
    expect(merged.casualWins).toBe(10)
    expect(merged.rankedDuels).toBe(6)
  })

  it('unions the id arrays without duplicates', () => {
    const merged = mergeProfiles(
      profile({ unlockedBadges: ['a', 'b'], peopleViewed: ['p1', 'p2'] }),
      profile({ unlockedBadges: ['b', 'c'], peopleViewed: ['p2', 'p3'] }),
    )
    expect([...merged.unlockedBadges].sort()).toEqual(['a', 'b', 'c'])
    expect([...merged.peopleViewed].sort()).toEqual(['p1', 'p2', 'p3'])
  })

  it('keeps the furthest progress per lesson and the better quiz attempt', () => {
    const merged = mergeProfiles(
      profile({
        lessonProgress: { l1: 100, l2: 30 },
        lessonQuizBest: { l1: { correct: 3, total: 5 } },
      }),
      profile({
        lessonProgress: { l1: 40, l2: 75, l3: 10 },
        lessonQuizBest: { l1: { correct: 5, total: 5 } },
      }),
    )
    expect(merged.lessonProgress).toEqual({ l1: 100, l2: 75, l3: 10 })
    expect(merged.lessonQuizBest.l1).toEqual({ correct: 5, total: 5 })
  })

  it('dedupes the duel log by timestamp, newest first, within the cap', () => {
    const merged = mergeProfiles(
      profile({ recentCasualDuels: [duel(300), duel(100)] }),
      profile({ recentCasualDuels: [duel(300), duel(200)] }),
    )
    expect(merged.recentCasualDuels.map((d) => d.at)).toEqual([300, 200, 100])
  })

  it('takes the streak from whichever copy was active more recently', () => {
    const older = profile({ streak: 9, lastVisitDate: '2026-02-01' })
    const newer = profile({ streak: 2, lastVisitDate: '2026-03-01' })
    expect(mergeProfiles(older, newer).streak).toBe(2)
    expect(mergeProfiles(newer, older).streak).toBe(2)
  })
})
