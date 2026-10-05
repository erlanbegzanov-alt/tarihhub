/**
 * The reporting channel's pure half.
 *
 * `isChunkLoadError` is the one function in the app that decides whether a
 * white screen heals itself: a missing code file reloads once, anything else
 * shows the reader a message instead. It matches on text, because browsers
 * never agreed on a message or an error class for this, so a wrong string here
 * is a silent return to the symptom it was written to cure — which is exactly
 * what a test is for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The tests run in node, where there is no `window` and no session storage. */
function installStorageStub(): Map<string, string> {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
  ;(globalThis as { window?: unknown }).window = { sessionStorage: storage }
  return store
}

describe('isChunkLoadError', () => {
  it('recognises what each browser actually says', async () => {
    const { isChunkLoadError } = await import('./report')
    // Verbatim from the three engines. None of these is standardised, and none
    // of them carries a distinctive error class, so the text is all there is.
    for (const message of [
      'Failed to fetch dynamically imported module: https://tarihhub.com/assets/MapScreen-BQ1t.js',
      'Importing a module script failed.',
      'error loading dynamically imported module: https://tarihhub.com/assets/Quiz-9xA2.js',
      'Unable to preload CSS for /assets/index-abc.css',
    ]) {
      expect(isChunkLoadError(new Error(message)), message).toBe(true)
    }
  })

  it('does not mistake an ordinary bug for a stale build', async () => {
    const { isChunkLoadError } = await import('./report')
    // A reload cures a missing file. It does nothing for any of these, and
    // reloading on them would spin the tab instead of showing the message.
    for (const message of [
      "Cannot read properties of undefined (reading 'map')",
      'Missing or insufficient permissions.',
      'NetworkError when attempting to fetch resource.',
      'Maximum update depth exceeded',
    ]) {
      expect(isChunkLoadError(new Error(message)), message).toBe(false)
    }
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError({ odd: true })).toBe(false)
  })
})

describe('failedUrlFrom', () => {
  it('finds the file name in what each browser says, and invents none', async () => {
    const { failedUrlFrom } = await import('./report')
    expect(
      failedUrlFrom(
        new Error(
          'Failed to fetch dynamically imported module: https://tarihhub.com/assets/MapScreen-BQ1t.js',
        ),
      ),
    ).toBe('https://tarihhub.com/assets/MapScreen-BQ1t.js')
    expect(
      failedUrlFrom(new Error('error loading dynamically imported module: /assets/Quiz-9xA2.js')),
    ).toBe('/assets/Quiz-9xA2.js')
    // Safari names nothing. The caller has to cope with that rather than
    // re-fetch a URL this function made up.
    expect(failedUrlFrom(new Error('Importing a module script failed.'))).toBeNull()
  })
})

describe('report', () => {
  beforeEach(() => {
    // A fresh copy of the module for each test: the dedupe set is module
    // state, which is the whole point of it.
    vi.resetModules()
    installStorageStub()
  })
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('keeps one copy of a repeated failure, and both of two different ones', async () => {
    // Fresh module per test: the dedupe set is module state, which is the point
    // of it — a render loop reporting forty times a second must not bury the
    // first report under its own repeats.
    const { report, recentErrors } = await import('./report')
    const boom = new Error('boom')
    report('route:/quiz', boom)
    report('route:/quiz', boom)
    report('route:/quiz', new Error('different'))
    report('window.error', boom)

    const kept: { where: string; message: string }[] = recentErrors()
    expect(kept.map((entry) => `${entry.where}|${entry.message}`)).toEqual([
      'route:/quiz|boom',
      'route:/quiz|different',
      'window.error|boom',
    ])
  })

  it('survives a storage that throws on access', async () => {
    // A private window does not hand back an empty store — the property getter
    // itself throws. The thing that reports crashes must not become one.
    ;(globalThis as { window?: unknown }).window = {
      get sessionStorage(): never {
        throw new Error('The operation is insecure.')
      },
    }
    const { report, recentErrors } = await import('./report')
    expect(() => report('route:/map', new Error('boom'))).not.toThrow()
    expect(recentErrors()).toEqual([])
  })
})
