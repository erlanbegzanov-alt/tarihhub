/**
 * The AI chat's failure path.
 *
 * This is the one place in the app where failure is *designed* to look like
 * success: when the live call does not come back, the reader still gets a
 * plausible in-character answer from the canned engine. That part is
 * deliberate — a history chat that answers nothing is worse than one that
 * answers plainly. What was not deliberate is that every cause arrived as the
 * same word, so "the AI fell over again" could not be told apart from "you
 * have asked your fifty questions for today", and the proxy's status code —
 * which says precisely which it was — existed for one line and was dropped.
 */
import { describe, expect, it } from 'vitest'
import { getPerson } from '../data/people'
import { askPersona, reasonFromStatus } from './ai'
import type { AiFailure } from './ai'

describe('reasonFromStatus', () => {
  it('maps every code the proxy actually returns', () => {
    // Not invented: api/gemini.ts raises exactly these, and 500 only for a
    // missing GEMINI_API_KEY — the one 500 it raises on purpose.
    const expected: Array<[number, AiFailure]> = [
      [401, 'signed-out'],
      [403, 'signed-out'],
      [429, 'limit'],
      [500, 'unconfigured'],
      [502, 'upstream'],
    ]
    for (const [status, reason] of expected) {
      expect(reasonFromStatus(status)).toBe(reason)
    }
  })

  it('reads an unknown code as upstream, never as a limit', () => {
    // The dangerous direction. "Limit reached" tells the reader to come back
    // tomorrow, and if it was really a dead upstream, tomorrow is the same.
    expect(reasonFromStatus(504)).toBe('upstream')
    expect(reasonFromStatus(418)).toBe('upstream')
  })
})

describe('askPersona', () => {
  it('still answers without a live call, and carries why', async () => {
    // Firebase is unconfigured under test, so `auth` is null and no token can
    // be minted — the same path as a reader whose session has expired. The
    // answer must still arrive, must be labelled demo rather than live, and
    // must now name the reason instead of discarding it.
    const person = getPerson('abylai')
    if (!person) throw new Error('fixture: abylai is missing from people.ts')

    const answer = await askPersona(person, [], 'Сәлем, кім болдыңыз?', 'ru')

    expect(answer.engine).toBe('demo')
    expect(answer.failure).toBe('signed-out')
    expect(answer.text.length).toBeGreaterThan(0)
  })
})
