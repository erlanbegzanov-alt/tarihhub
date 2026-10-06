/**
 * One place every unexpected failure goes.
 *
 * The site had no such place, and that is the reason the rest of this audit's
 * findings could live for months: a white screen left no trace anywhere, every
 * swallowed error went to a `console.warn` on a student's phone, and the only
 * person who could ever see it was the student — who closes the tab and tells
 * nobody. "It broke again" was all the information that ever came back.
 *
 * What this does NOT do yet is send anything anywhere. There is no server to
 * send to (the app is a static bundle plus Firestore), and a sink that writes
 * to Firestore spends write quota a broken render loop could exhaust in a
 * minute, so that is a deliberate separate decision and not one to smuggle in
 * here. What it does do is make a failure *visible and local*: one call site
 * for the whole app, a ring buffer a reader can be asked to read back, and the
 * `where` that says which part of the app was holding the bag.
 */

export interface ClientError {
  /** `Date.now()` of the report. */
  at: number
  /** Which part of the app was running — a route, a boundary, 'window'. */
  where: string
  message: string
  stack?: string
}

const STORE_KEY = 'tarihhub_errors'
/** Enough to show a pattern, small enough that sessionStorage never complains. */
const MAX_KEPT = 20

/**
 * The same failure, reported twice, is noise; the same failure reported by a
 * render loop forty times a second is a flood that buries the first one. Only
 * the first of each distinct `where|message` is kept and logged.
 */
const seen = new Set<string>()

function read(): ClientError[] {
  // Every access to this API is wrapped: in a private window, or with site
  // data blocked, `sessionStorage` is not an empty store — the property
  // getter itself throws. An unguarded read here would turn the thing meant
  // to report crashes into one more cause of them.
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as ClientError[]) : []
  } catch {
    return []
  }
}

function write(entries: ClientError[]): void {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(entries))
  } catch {
    /* nothing to do: the report is already in the console */
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    // `JSON.stringify(undefined)` returns `undefined`, not a string — and
    // `undefined` is exactly what `window.onerror` and a bare `reject()` hand
    // over. Everything below this point treats the result as a string, and the
    // callers are error handlers, which is the worst place in the app to throw.
    return JSON.stringify(error) ?? String(error)
  } catch {
    return String(error)
  }
}

/** The last failures this tab saw, oldest first. */
export function recentErrors(): ClientError[] {
  return read()
}

/**
 * Records one failure. Safe to call from anywhere, including from inside an
 * error handler — it never throws.
 */
export function report(where: string, error: unknown): void {
  const message = messageOf(error)
  const key = `${where}|${message}`
  if (seen.has(key)) return
  seen.add(key)

  const entry: ClientError = {
    at: Date.now(),
    where,
    message,
    stack: error instanceof Error ? error.stack : undefined,
  }
  // Still the console, because that is where it is readable on a phone over
  // USB and in a screenshot of devtools. The difference is that it now goes
  // through one function, so there is exactly one place to change when there
  // is somewhere to send it.
  console.error(`[tarihhub] ${where}:`, error)
  write([...read(), entry].slice(-MAX_KEPT))
}

/**
 * True when a failure is a code file that did not arrive.
 *
 * This is the shape of the site's worst symptom. A deploy replaces every
 * hashed file under `/assets/`; a tab that has been open since before it is
 * still running the old entry chunk and still asking for the old file names.
 * `vercel.json` used to rewrite the miss to `index.html` with a 200 and a
 * year-long immutable cache header, so the browser was handed HTML where it
 * asked for a module, refused to run it (`nosniff`), and cached that answer
 * for a year — a reload could not clear it. The rewrite now leaves `/assets/`
 * alone, so the miss is an honest 404 and lands here instead.
 *
 * The messages differ per browser and none of them is standardised, which is
 * why this matches on several: Chrome says "Failed to fetch dynamically
 * imported module", Safari "Importing a module script failed", Firefox "error
 * loading dynamically imported module".
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = messageOf(error).toLowerCase()
  return (
    message.includes('dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('failed to fetch dynamically') ||
    message.includes('error loading dynamically') ||
    message.includes('unable to preload css')
  )
}

const RELOADED_KEY = 'tarihhub_chunk_reload'

/**
 * The file name out of a chunk-load message, when the browser named one.
 *
 * Chrome and Firefox both put the full URL in the message; Safari does not.
 * Exported only so a test can hold this regex to the real messages — nothing
 * else should need it.
 */
export function failedUrlFrom(error: unknown): string | null {
  const match = /https?:\/\/[^\s'")]+|\/assets\/[^\s'")]+/.exec(messageOf(error))
  return match ? match[0] : null
}

/**
 * Reloads the page once after a missing-chunk failure, and only once.
 *
 * A reload is the actual cure: `index.html` is served with
 * `max-age=0, must-revalidate`, so a fresh load gets the current file names
 * and the stale ones are never asked for again. The one-shot guard is the
 * whole reason this is a function and not a line — a chunk error that
 * survives the reload (a genuinely broken deploy, an offline device) would
 * otherwise reload forever, which is worse than the white screen it replaces.
 *
 * Returns true when a reload has been scheduled, so the caller can keep its
 * fallback UI quiet rather than flashing an error the reader will never read.
 */
export function reloadOnceForChunkError(error?: unknown): boolean {
  try {
    if (window.sessionStorage.getItem(RELOADED_KEY) === '1') return false
    window.sessionStorage.setItem(RELOADED_KEY, '1')
  } catch {
    // Without a place to remember the attempt there is no safe way to retry,
    // so the fallback UI (which offers a manual reload) is the better answer.
    return false
  }

  const url = failedUrlFrom(error)
  if (!url) {
    window.location.reload()
    return true
  }

  // One fetch of the file that failed, with the HTTP cache bypassed, before
  // reloading.
  //
  // Vercel stamps everything under `/assets/` `immutable, max-age=31536000`,
  // and that header lands on the 404 for a deleted file too — so a browser
  // remembers "this file does not exist" for a year. Normally that is
  // harmless, because the names in the next `index.html` are different ones.
  // It stops being harmless on a revert: reverting the code reverts the
  // content, the content hash comes back with it, and the file exists again at
  // a name this browser has cached a 404 for. Without this, that reader would
  // see the same unfixable white screen, now for the opposite reason.
  //
  // `cache: 'reload'` both bypasses the cache and *replaces* the stored entry
  // with the fresh answer, which is what makes it the fix rather than a probe.
  let reloaded = false
  const go = () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  }
  // The reload must not depend on that request finishing: a hung connection
  // would otherwise leave the reader on a dead screen for ever.
  window.setTimeout(go, 1500)
  void fetch(url, { cache: 'reload' })
    .catch(() => {
      /* 404 again, or offline — the eviction was the point, not the body */
    })
    .finally(go)
  return true
}

let installed = false

/**
 * Catches what no React boundary can: a failure in an event handler, a
 * rejected promise nobody awaited, a module that failed to load outside a
 * `lazy()` call. Call once, as early as possible.
 */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    // A failed <img>/<script> element also fires this, with no `error` object;
    // those are not interesting enough to keep.
    if (!event.error && !event.message) return
    report('window.error', event.error ?? event.message)
  })

  window.addEventListener('unhandledrejection', (event) => {
    report('unhandledrejection', event.reason)
  })
}
