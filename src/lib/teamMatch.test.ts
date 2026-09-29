import { describe, expect, it } from 'vitest'
import { battleQuestion, pickRoundQuestionIds } from '../data/battleQuestions'
import {
  MATCH_STALL_MS,
  TEAM_MATCH_QUESTIONS,
  TEAM_QUESTION_SECONDS,
  TEAM_ROUND_SIZE,
  answeredTotal,
  everyoneDone,
  matchOutcome,
  matchOver,
  teamScores,
  toMatchPlayer,
  toTeamMatch,
} from './teamMatch'
import type { TeamMatchPlayer } from './teamMatch'

const NOW = 1_800_000_000_000

const RAW = {
  leader: 'alice',
  size: 2,
  teams: { a: ['alice', 'bob'], b: ['carol', 'dan'] },
  members: ['alice', 'bob', 'carol', 'dan'],
  questionIds: ['q1', 'q2', 'q3'],
  startedAt: NOW,
}

function player(over: Partial<TeamMatchPlayer> = {}): TeamMatchPlayer {
  return { uid: 'alice', side: 'a', score: 0, answered: 0, done: false, startedAt: NOW, ...over }
}

describe('reading a match', () => {
  it('reads a well-formed match and flattens both sides into members', () => {
    const match = toTeamMatch('K7PMX2', RAW)
    expect(match).toEqual({
      code: 'K7PMX2',
      leader: 'alice',
      size: 2,
      teams: { a: ['alice', 'bob'], b: ['carol', 'dan'] },
      // Derived from `teams`, never trusted from the document: the two could
      // otherwise disagree about who is playing.
      members: ['alice', 'bob', 'carol', 'dan'],
      questionIds: ['q1', 'q2', 'q3'],
      startedAt: NOW,
    })
  })

  it('refuses a match that cannot be played', () => {
    expect(toTeamMatch('K7PMX2', null)).toBeNull()
    // One side empty: there is no opponent to score against.
    expect(toTeamMatch('K7PMX2', { ...RAW, teams: { a: ['alice'], b: [] } })).toBeNull()
    // No questions: the screen would open on nothing.
    expect(toTeamMatch('K7PMX2', { ...RAW, questionIds: [] })).toBeNull()
    expect(toTeamMatch('K7PMX2', { ...RAW, size: 9 })).toBeNull()
    expect(toTeamMatch('K7PMX2', { ...RAW, leader: 42 })).toBeNull()
    expect(toTeamMatch('K7PMX2', { ...RAW, teams: 'both' })).toBeNull()
  })

  it('drops non-strings out of the rosters instead of rendering them', () => {
    const match = toTeamMatch('K7PMX2', {
      ...RAW,
      teams: { a: ['alice', 7, null], b: ['carol'] },
      questionIds: ['q1', 3],
    })
    expect(match?.teams.a).toEqual(['alice'])
    expect(match?.questionIds).toEqual(['q1'])
  })
})

describe('reading a player', () => {
  it('reads a run', () => {
    expect(
      toMatchPlayer('bob', { side: 'b', score: 120, answered: 4, done: true, startedAt: NOW }),
    ).toEqual({
      uid: 'bob',
      side: 'b',
      score: 120,
      answered: 4,
      done: true,
      startedAt: NOW,
    })
  })

  it('needs a real side, since the score is filed under it', () => {
    expect(toMatchPlayer('bob', { side: 'c', score: 10 })).toBeNull()
    expect(toMatchPlayer('bob', null)).toBeNull()
  })

  it('treats a missing or negative number as nothing scored', () => {
    const empty = toMatchPlayer('bob', { side: 'a' })
    expect(empty).toEqual({
      uid: 'bob',
      side: 'a',
      score: 0,
      answered: 0,
      done: false,
      // A run written before rounds existed belongs to no match, so every live
      // match's reader drops it — which is the behaviour we want for leftovers.
      startedAt: 0,
    })
    // A negative score would subtract from that side's total.
    expect(toMatchPlayer('bob', { side: 'a', score: -50 })?.score).toBe(0)
  })
})

describe('the score', () => {
  it('a team is the sum of its players', () => {
    const scores = teamScores([
      player({ uid: 'alice', side: 'a', score: 90 }),
      player({ uid: 'bob', side: 'a', score: 60 }),
      player({ uid: 'carol', side: 'b', score: 140 }),
    ])
    expect(scores).toEqual({ a: 150, b: 140 })
  })

  it('is zero for a side nobody has played for yet', () => {
    expect(teamScores([])).toEqual({ a: 0, b: 0 })
  })

  it('names a winner, and says draw rather than picking one', () => {
    expect(matchOutcome({ a: 150, b: 140 })).toBe('a')
    expect(matchOutcome({ a: 10, b: 140 })).toBe('b')
    expect(matchOutcome({ a: 0, b: 0 })).toBe('draw')
  })
})

describe('when the match is over', () => {
  const match = toTeamMatch('K7PMX2', RAW)!

  it('only once everyone in the room has finished their own run', () => {
    const three = ['alice', 'bob', 'carol'].map((uid) => player({ uid, done: true }))
    // dan has finished nothing — three people waiting on him is not over.
    expect(everyoneDone(match, three)).toBe(false)
    expect(everyoneDone(match, [...three, player({ uid: 'dan', done: true })])).toBe(true)
  })

  it('is not over for a player who never opened the match', () => {
    // No document at all reads as "still coming", not as "finished": counting
    // only the documents present would end the match while someone is loading.
    const present = ['alice', 'bob', 'carol'].map((uid) => player({ uid, done: true }))
    expect(everyoneDone(match, present)).toBe(false)
  })

  it('ends anyway once the stall cap passes, so one closed tab cannot hang the room', () => {
    // dan closed his tab: his run can never reach `done`, and no client is
    // allowed to delete or lower it. Without the cap everyone else waits for
    // ever — the failure most likely to happen in front of an audience.
    const three = ['alice', 'bob', 'carol'].map((uid) => player({ uid, done: true }))
    expect(matchOver(match, three, NOW + MATCH_STALL_MS - 1)).toBe(false)
    expect(matchOver(match, three, NOW + MATCH_STALL_MS + 1)).toBe(true)
  })

  it('does not wait for the cap when everyone actually finished', () => {
    const all = ['alice', 'bob', 'carol', 'dan'].map((uid) => player({ uid, done: true }))
    expect(matchOver(match, all, NOW + 1000)).toBe(true)
  })

  it('leaves room for the slowest honest player', () => {
    // A player who is present is answered for by their own clock, so the
    // longest possible honest run is the whole match at full time. The cap has
    // to stay clear of that by a wide margin, and it has to be checked against
    // the constants rather than a number typed once: raising the match from 9
    // questions to 15 nearly ate a six-minute cap.
    const longestHonestRunMs = TEAM_MATCH_QUESTIONS * (TEAM_QUESTION_SECONDS + 2) * 1000
    expect(MATCH_STALL_MS).toBeGreaterThan(2 * longestHonestRunMs)
  })

  it('gives a team match fifteen questions, five from each difficulty pool', () => {
    const ids = pickRoundQuestionIds(TEAM_ROUND_SIZE, null)
    expect(TEAM_MATCH_QUESTIONS).toBe(15)
    expect(ids).toHaveLength(TEAM_MATCH_QUESTIONS)
    // No question may be asked twice inside one match.
    expect(new Set(ids).size).toBe(TEAM_MATCH_QUESTIONS)
    // Every id has to resolve, or the board would render a blank question.
    expect(ids.every((id) => battleQuestion(id) !== undefined)).toBe(true)
  })

  it('counts how far the room has got together', () => {
    expect(
      answeredTotal([player({ answered: 3 }), player({ uid: 'bob', answered: 5 })]),
    ).toBe(8)
  })
})
