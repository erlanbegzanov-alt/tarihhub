import { describe, expect, it } from 'vitest'
import {
  generatePartyCode,
  inviteId,
  normalizePartyCode,
  roomCapacity,
  smallerSide,
  teamsReady,
  toParty,
  toPartyInvite,
} from './party'

const NOW = 1_800_000_000_000

describe('party codes', () => {
  it('generates 6 characters without look-alikes', () => {
    for (let i = 0; i < 100; i++) expect(generatePartyCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('accepts what a person types and rejects what cannot be a code', () => {
    expect(normalizePartyCode('k7pmx2')).toBe('K7PMX2')
    expect(normalizePartyCode(' K7P-MX2 ')).toBe('K7PMX2')
    for (const bad of ['', 'K7PMX', 'K7PMX22', 'K7PMX0', 'K7PMXO']) {
      expect(normalizePartyCode(bad)).toBeNull()
    }
  })
})

describe('reading a party', () => {
  it('reads a well-formed party', () => {
    const party = toParty('K7PMX2', {
      leader: 'alice',
      members: ['alice', 'bob'],
      mode: 'ranked',
      size: 2,
      status: 'queued',
      createdAt: NOW,
    })
    expect(party).toEqual({
      code: 'K7PMX2',
      leader: 'alice',
      members: ['alice', 'bob'],
      mode: 'ranked',
      size: 2,
      // No `teams` in the document: this is a room made before a room held two
      // sides. Everyone lands on A rather than being split down the middle,
      // because nobody chose that split.
      teams: { a: ['alice', 'bob'], b: [] },
      status: 'queued',
      createdAt: NOW,
    })
  })

  it('keeps the sides a document already states', () => {
    const party = toParty('K7PMX2', {
      leader: 'alice',
      members: ['alice', 'bob', 'carol', 'dan'],
      mode: 'casual',
      size: 2,
      teams: { a: ['alice', 'carol'], b: ['bob', 'dan'] },
      status: 'idle',
      createdAt: NOW,
    })
    expect(party?.teams).toEqual({ a: ['alice', 'carol'], b: ['bob', 'dan'] })
  })

  it('seats a member the sides forgot, and drops a side member who left', () => {
    const party = toParty('K7PMX2', {
      leader: 'alice',
      members: ['alice', 'bob', 'carol'],
      mode: 'casual',
      size: 2,
      // `carol` is in the room but on neither side; `ghost` is on a side but
      // not in the room. A half-written document must strand neither.
      teams: { a: ['alice'], b: ['bob', 'ghost'] },
      status: 'idle',
      createdAt: NOW,
    })
    expect(party?.teams.b).not.toContain('ghost')
    expect([...(party?.teams.a ?? []), ...(party?.teams.b ?? [])].sort()).toEqual([
      'alice',
      'bob',
      'carol',
    ])
  })
})

describe('sides of a room', () => {
  const room = (a: string[], b: string[], size = 3) =>
    toParty('K7PMX2', {
      leader: 'alice',
      members: [...a, ...b],
      mode: 'casual',
      size,
      teams: { a, b },
      status: 'idle',
      createdAt: NOW,
    })!

  it('holds both teams, so a room is twice a team', () => {
    expect(roomCapacity(2)).toBe(4)
    expect(roomCapacity(5)).toBe(10)
  })

  it('sends the next player to the thinner side, and prefers A when level', () => {
    expect(smallerSide({ a: [], b: [] })).toBe('a')
    expect(smallerSide({ a: ['alice'], b: [] })).toBe('b')
    expect(smallerSide({ a: ['alice'], b: ['bob'] })).toBe('a')
    expect(smallerSide({ a: ['alice'], b: ['bob', 'carol'] })).toBe('a')
  })

  it('is ready only when both sides are manned and equal', () => {
    expect(teamsReady(room(['alice'], ['bob']))).toBe(true)
    expect(teamsReady(room(['alice', 'carol'], ['bob', 'dan']))).toBe(true)
    // Erlan's rule: no 3 against 5, and never one side on its own.
    expect(teamsReady(room(['alice', 'carol'], ['bob']))).toBe(false)
    expect(teamsReady(room(['alice', 'bob'], []))).toBe(false)
  })

  it('drops a malformed one instead of rendering nonsense', () => {
    expect(toParty('K7PMX2', null)).toBeNull()
    expect(toParty('K7PMX2', { leader: 'alice', members: ['alice'], size: 9 })).toBeNull()
    expect(toParty('K7PMX2', { leader: 'alice', members: 'alice', size: 2 })).toBeNull()
    expect(toParty('K7PMX2', { members: ['alice'], size: 2 })).toBeNull()
  })

  it('reads an invitation, and refuses one that cannot be acted on', () => {
    const raw = { code: 'K7PMX2', from: 'alice', to: 'bob', createdAt: NOW }
    expect(toPartyInvite('K7PMX2_bob', raw)).toEqual({
      id: 'K7PMX2_bob',
      code: 'K7PMX2',
      from: 'alice',
      to: 'bob',
      createdAt: NOW,
    })
    // A code no room could ever have: tapping "Войти" would only ever say
    // "такой команды нет".
    expect(toPartyInvite('x', { ...raw, code: 'K7PMX' })).toBeNull()
    // Inviting yourself is not a thing, and would render as a card calling you
    // into the room you are already in.
    expect(toPartyInvite('x', { ...raw, to: 'alice' })).toBeNull()
    expect(toPartyInvite('x', { ...raw, from: 42 })).toBeNull()
    expect(toPartyInvite('x', null)).toBeNull()
  })

  it('gives one invitation per room per person, so a second call replaces the first', () => {
    expect(inviteId('K7PMX2', 'bob')).toBe('K7PMX2_bob')
    expect(inviteId('K7PMX2', 'bob')).toBe(inviteId('K7PMX2', 'bob'))
    expect(inviteId('AAAAAA', 'bob')).not.toBe(inviteId('K7PMX2', 'bob'))
  })

  it('treats an unknown mode or status as the safe default', () => {
    const party = toParty('K7PMX2', {
      leader: 'alice',
      members: ['alice'],
      mode: 'tournament',
      size: 2,
      status: 'playing',
      createdAt: NOW,
    })
    expect(party?.mode).toBe('casual')
    expect(party?.status).toBe('idle')
  })
})

