import { describe, expect, it } from 'vitest'
import {
  QUEUE_SLOT_TTL_MS,
  countWaiting,
  downsizeOptions,
  emptyQueueCounts,
  generatePartyCode,
  normalizePartyCode,
  toParty,
} from './party'
import type { QueueSlot } from './party'

const NOW = 1_800_000_000_000

function slot(over: Partial<QueueSlot> = {}): QueueSlot {
  return {
    code: 'K7PMX2',
    leader: 'alice',
    size: 3,
    mode: 'casual',
    members: ['alice', 'bob', 'carol'],
    createdAt: NOW,
    ...over,
  }
}

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
      status: 'queued',
      createdAt: NOW,
    })
  })

  it('drops a malformed one instead of rendering nonsense', () => {
    expect(toParty('K7PMX2', null)).toBeNull()
    expect(toParty('K7PMX2', { leader: 'alice', members: ['alice'], size: 9 })).toBeNull()
    expect(toParty('K7PMX2', { leader: 'alice', members: 'alice', size: 2 })).toBeNull()
    expect(toParty('K7PMX2', { members: ['alice'], size: 2 })).toBeNull()
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

describe('who is waiting', () => {
  it('counts players per size, not parties', () => {
    const counts = countWaiting([slot(), slot({ code: 'AAAAAA', size: 2, members: ['d', 'e'] })], 'casual', NOW)
    expect(counts[3]).toBe(3)
    expect(counts[2]).toBe(2)
    expect(counts[5]).toBe(0)
  })

  it('ignores the other mode', () => {
    expect(countWaiting([slot({ mode: 'ranked' })], 'casual', NOW)).toEqual(emptyQueueCounts())
  })

  it('ignores a slot left behind by a closed tab', () => {
    const stale = slot({ createdAt: NOW - QUEUE_SLOT_TTL_MS - 1 })
    expect(countWaiting([stale], 'casual', NOW)[3]).toBe(0)
    const fresh = slot({ createdAt: NOW - QUEUE_SLOT_TTL_MS + 1000 })
    expect(countWaiting([fresh], 'casual', NOW)[3]).toBe(3)
  })
})

describe('what to offer when nobody is in 5х5', () => {
  it('offers only smaller formats the party can field and someone waits in', () => {
    const counts = { ...emptyQueueCounts(), 2: 4, 3: 0, 4: 6 }
    expect(downsizeOptions(5, 5, counts)).toEqual([2, 4])
    // A party of three cannot field 4х4, however many are waiting there.
    expect(downsizeOptions(5, 3, counts)).toEqual([2])
  })

  it('offers nothing when every smaller queue is empty', () => {
    expect(downsizeOptions(5, 5, emptyQueueCounts())).toEqual([])
  })

  it('never offers the size already being waited on, or a bigger one', () => {
    const counts = { ...emptyQueueCounts(), 2: 2, 3: 2, 4: 2, 5: 2 }
    expect(downsizeOptions(3, 5, counts)).toEqual([2])
  })
})
