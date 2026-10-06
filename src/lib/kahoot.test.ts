/**
 * The published Kahoot board.
 *
 * This projection is why a classroom no longer costs the whole project's daily
 * read quota, so what it contains matters twice over: it has to carry exactly
 * what the two row components draw, and it must not carry anything else — every
 * student in the room reads it, and the rows it is built from hold a child's
 * answer history.
 */
import { describe, expect, it } from 'vitest'
import { boardFrom, MAX_BOARD_ROWS } from './kahoot'
import type { KahootPlayer } from './kahoot'

function player(over: Partial<KahootPlayer> = {}): KahootPlayer {
  return {
    uid: 'u1',
    displayName: 'Аян',
    photoURL: '',
    score: 0,
    lastAnswerIndex: null,
    lastAnswerAt: null,
    joinedAt: 1_700_000_000_000,
    avatarGender: 'f',
    avatarTierIndex: 2,
    titleTierIndex: 2,
    ...over,
  }
}

describe('boardFrom', () => {
  it('ranks by score, and breaks a tie the way the live board does', () => {
    const rows = boardFrom([
      player({ uid: 'b', score: 120, joinedAt: 20 }),
      player({ uid: 'c', score: 300, joinedAt: 30 }),
      // Same score as b, but in the room first — so ahead of b.
      player({ uid: 'a', score: 120, joinedAt: 10 }),
    ])
    expect(rows.map((row) => row.uid)).toEqual(['c', 'a', 'b'])
  })

  it('carries the six fields the rows draw, and nothing else', () => {
    // `lastAnswerIndex` and `lastAnswerAt` are what a student answered and
    // when. The host sees them; the class must not, and the way to be sure of
    // that is for them never to reach the document the class reads.
    const [row] = boardFrom([player({ lastAnswerIndex: 3, lastAnswerAt: 1_700_000_000_123 })])
    expect(Object.keys(row).sort()).toEqual([
      'avatarGender',
      'avatarTierIndex',
      'displayName',
      'photoURL',
      'score',
      'uid',
    ])
  })

  it('is bounded, so one room document cannot grow without a limit', () => {
    // Every student re-reads this document on every move the host makes, so an
    // unbounded array here would be paid for by the whole class.
    const many = Array.from({ length: MAX_BOARD_ROWS + 25 }, (_, index) =>
      player({ uid: `u${index}`, score: index }),
    )
    const rows = boardFrom(many)
    expect(rows).toHaveLength(MAX_BOARD_ROWS)
    // The ones kept are the top of the table, not the first ones found.
    expect(rows[0].score).toBe(MAX_BOARD_ROWS + 24)
  })

  it('leaves the list it was given alone', () => {
    // The host's own screen renders from this same array; sorting it in place
    // would reorder the teacher's view as a side effect of publishing.
    const players = [player({ uid: 'a', score: 10 }), player({ uid: 'b', score: 90 })]
    boardFrom(players)
    expect(players.map((entry) => entry.uid)).toEqual(['a', 'b'])
  })
})
