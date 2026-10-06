/**
 * The first test this folder has ever had.
 *
 * `api/gemini.ts` is the only part of TarihHub that runs on a server, it holds
 * a shared paid API key, and the outage of 2026-10-01 was one `catch` in it
 * returning the wrong answer for two days. What is tested here is the live
 * metering path — the REST limiter, which is the one that actually runs on
 * production, because no service-account key is configured there.
 *
 * `fetch` is stubbed rather than mocked through a library: the point of the
 * exercise is the ladder of answers (allowed, refused, cannot tell), and that
 * is decided entirely by the status codes Firestore returns.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT = 'tarihhub-test'
const DOC = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/aiUsage/alice/days/`

type Call = { url: string; method: string; body: unknown }

/**
 * Collects every request the limiter makes, and answers by method.
 *
 * By method, not in sequence: the loop re-reads the document on every attempt,
 * so a script that simply answers the Nth call hands a write's answer to a
 * read — and a 400 on a *read* is "cannot tell", which is a different verdict
 * from the one under test.
 */
function stubFetch(get: () => Response, patch?: () => Response): Call[] {
  const calls: Call[] = []
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({
      url: String(input),
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    if (method === 'GET') return Promise.resolve(get())
    // Leaving `patch` out is how a test states that no write should happen —
    // and this is what makes the statement a proof rather than a hope.
    if (!patch) throw new Error('the limiter wrote where this test expected no write')
    return Promise.resolve(patch())
  })
  return calls
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** What Firestore answers a PATCH whose `updateTime` precondition has expired:
 *  400, not 412 — the mapping is not uniform, and the code depends on it. */
const lostRace = () =>
  new Response(JSON.stringify({ error: { status: 'FAILED_PRECONDITION' } }), { status: 400 })

async function limiter() {
  // The document base is computed once at module load from the environment.
  process.env.VITE_FIREBASE_PROJECT_ID = PROJECT
  vi.resetModules()
  return (await import('./gemini.js')).restCheckAndIncrement
}

describe('restCheckAndIncrement', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('counts an honest request, starting the day at one', async () => {
    const calls = stubFetch(() => json({}, 404), () => json({}))
    const check = await limiter()
    await expect(check('alice', 'token', 50)).resolves.toBe(true)
    expect(calls[0].url.startsWith(DOC)).toBe(true)
    expect(calls[1].method).toBe('PATCH')
    // A day with no document yet is created at one, under a precondition that
    // the document does not exist — so two first-requests cannot both be first.
    expect(calls[1].body).toMatchObject({ fields: { count: { integerValue: '1' } } })
    expect(calls[1].url).toContain('currentDocument.exists=false')
  })

  it('refuses a reader who has spent the day, without writing', async () => {
    const calls = stubFetch(() =>
      json({ updateTime: 'T1', fields: { count: { integerValue: '50' } } }),
    )
    const check = await limiter()
    await expect(check('alice', 'token', 50)).resolves.toBe(false)
    expect(calls).toHaveLength(1)
  })

  it('refuses rather than allows when it cannot win the race', async () => {
    // The hole this test exists for. The loop used to give up after three
    // attempts and `return true` — "rather than 500 the feature". But every
    // request in a burst loses its race, so a burst was exactly the case where
    // the cap stopped applying: the counter moved by a handful while the number
    // of answered requests moved by the size of the burst.
    // The read always succeeds; every write loses its precondition.
    stubFetch(
      () => json({ updateTime: 'T1', fields: { count: { integerValue: '3' } } }),
      lostRace,
    )
    const check = await limiter()
    await expect(check('alice', 'token', 50)).resolves.toBe(false)
  })

  it('says "cannot tell" when Firestore is unreachable, and never guesses', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('getaddrinfo ENOTFOUND')))
    const check = await limiter()
    // `null` is not a verdict — it hands the decision to the caller, which
    // consults ALLOW_UNMETERED_AI and otherwise fails closed. That distinction
    // is the whole reason this returns three values and not two.
    await expect(check('alice', 'token', 50)).resolves.toBeNull()
  })

  it('cannot meter a caller who sent no token', async () => {
    const check = await limiter()
    await expect(check('alice', '', 50)).resolves.toBeNull()
  })
})
