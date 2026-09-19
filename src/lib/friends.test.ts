import { describe, expect, it } from 'vitest'
import {
  FRIEND_CODE_ALPHABET,
  formatFriendCode,
  friendshipId,
  generateFriendCode,
  normalizeFriendCode,
  toFriendship,
} from './friends'

describe('friend codes', () => {
  it('generates 8 characters from the look-alike-free alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateFriendCode()
      expect(code).toHaveLength(8)
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    }
  })

  it('leaves out I, O, 0 and 1', () => {
    for (const ch of ['I', 'O', '0', '1']) expect(FRIEND_CODE_ALPHABET).not.toContain(ch)
    expect(FRIEND_CODE_ALPHABET).toHaveLength(32)
  })

  it('accepts what a person plausibly types', () => {
    expect(normalizeFriendCode('bqk7-m2xz')).toBe('BQK7M2XZ')
    expect(normalizeFriendCode('  BQK7 M2XZ ')).toBe('BQK7M2XZ')
    expect(normalizeFriendCode(formatFriendCode('BQK7M2XZ'))).toBe('BQK7M2XZ')
  })

  it('rejects anything that cannot be a code', () => {
    for (const bad of ['', 'BQK7M2X', 'BQK7M2XZZ', 'BQK7M2X0', 'BQK7M2XO', 'BQK7-M2X!']) {
      expect(normalizeFriendCode(bad)).toBeNull()
    }
  })

  it('formats as two groups of four', () => {
    expect(formatFriendCode('BQK7M2XZ')).toBe('BQK7-M2XZ')
  })
})

describe('friendships', () => {
  it('gives a pair the same id from either side', () => {
    expect(friendshipId('bob', 'alice')).toBe('alice_bob')
    expect(friendshipId('alice', 'bob')).toBe('alice_bob')
  })

  it('reads a request from the reader’s side', () => {
    const raw = { uids: ['alice', 'bob'], requestedBy: 'alice', status: 'pending', createdAt: 5 }
    expect(toFriendship('alice_bob', raw, 'alice')).toEqual({
      id: 'alice_bob',
      otherUid: 'bob',
      status: 'pending',
      sentByMe: true,
      createdAt: 5,
    })
    expect(toFriendship('alice_bob', raw, 'bob')?.sentByMe).toBe(false)
    expect(toFriendship('alice_bob', raw, 'bob')?.otherUid).toBe('alice')
  })

  it('drops malformed documents instead of crashing the list', () => {
    expect(toFriendship('x', null, 'alice')).toBeNull()
    expect(toFriendship('x', { uids: ['alice'] }, 'alice')).toBeNull()
    expect(toFriendship('x', { uids: ['bob', 'carol'], status: 'pending' }, 'alice')).toBeNull()
    expect(toFriendship('x', { uids: ['alice', 'bob'], status: 'blocked' }, 'alice')).toBeNull()
  })
})
